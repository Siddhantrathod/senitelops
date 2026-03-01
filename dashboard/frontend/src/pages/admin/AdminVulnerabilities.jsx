import { useState, useMemo } from 'react'
import {
  Shield, AlertTriangle, Filter, RefreshCw, Eye,
  ExternalLink, FileText, Bug, Container, Globe, KeyRound,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { cn } from '../../utils/helpers'
import { DataTable, StatusBadge, KpiCard, Modal, SkeletonTable, SkeletonChart } from '../../components/admin'
import { useAdminData } from '../../hooks/useAdminData'
import { fetchAdminVulnSummary } from '../../services/api'

const SEVERITY_COLORS = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e', INFO: '#6b7280' }
const SCANNER_ICONS = { SAST: FileText, Bandit: Bug, Trivy: Container, DAST: Globe, Gitleaks: KeyRound }

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-secondary/95 backdrop-blur-xl border border-theme-strong rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-xs text-steel-400 font-mono mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
          <span className="text-steel-300">{entry.name}:</span>
          <span className="text-steel-50 font-mono font-bold">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminVulnerabilities() {
  const { data: summary, loading, error, refresh } = useAdminData(fetchAdminVulnSummary)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [scannerFilter, setScannerFilter] = useState('all')
  const [detailModal, setDetailModal] = useState({ open: false, vuln: null })

  const allVulns = useMemo(() => {
    if (!summary) return []
    const vulns = []
    // SAST findings
    if (summary.sast?.findings) {
      summary.sast.findings.forEach((f, i) => vulns.push({
        id: `sast-${i}`,
        scanner: 'SAST',
        severity: f.severity || 'MEDIUM',
        title: f.check_id || f.rule_id || f.message?.slice(0, 60) || 'SAST Finding',
        file: f.path || f.file || '—',
        line: f.start?.line || f.line || '—',
        message: f.message || f.extra?.message || '',
        ...f,
      }))
    }
    // Trivy findings
    if (summary.trivy?.vulnerabilities) {
      summary.trivy.vulnerabilities.forEach((v, i) => vulns.push({
        id: `trivy-${i}`,
        scanner: 'Trivy',
        severity: v.Severity || v.severity || 'MEDIUM',
        title: v.VulnerabilityID || v.vulnerability_id || 'CVE',
        file: v.PkgName || v.pkg_name || '—',
        line: '—',
        message: v.Title || v.title || v.Description || '',
        ...v,
      }))
    }
    // Gitleaks
    if (summary.gitleaks?.findings) {
      summary.gitleaks.findings.forEach((s, i) => vulns.push({
        id: `gitleaks-${i}`,
        scanner: 'Gitleaks',
        severity: 'HIGH',
        title: s.Description || s.RuleID || 'Secret Detected',
        file: s.File || '—',
        line: s.StartLine || '—',
        message: `Match: ${s.Match?.slice(0, 40) || '***'}`,
        ...s,
      }))
    }
    return vulns
  }, [summary])

  // Filtered
  const filteredVulns = useMemo(() => {
    return allVulns.filter(v => {
      if (severityFilter !== 'all' && v.severity?.toUpperCase() !== severityFilter) return false
      if (scannerFilter !== 'all' && v.scanner !== scannerFilter) return false
      return true
    })
  }, [allVulns, severityFilter, scannerFilter])

  // Stats
  const critical = allVulns.filter(v => v.severity?.toUpperCase() === 'CRITICAL').length
  const high = allVulns.filter(v => v.severity?.toUpperCase() === 'HIGH').length
  const medium = allVulns.filter(v => v.severity?.toUpperCase() === 'MEDIUM').length
  const low = allVulns.filter(v => v.severity?.toUpperCase() === 'LOW').length

  const sevDist = [
    { name: 'Critical', value: critical },
    { name: 'High', value: high },
    { name: 'Medium', value: medium },
    { name: 'Low', value: low },
  ].filter(d => d.value > 0)

  const scannerDist = useMemo(() => {
    const counts = {}
    allVulns.forEach(v => { counts[v.scanner] = (counts[v.scanner] || 0) + 1 })
    return Object.entries(counts).map(([name, count]) => ({ name, count }))
  }, [allVulns])

  const scanners = [...new Set(allVulns.map(v => v.scanner))]

  const columns = [
    {
      key: 'scanner',
      label: 'Scanner',
      sortable: true,
      render: (row) => {
        const Icon = SCANNER_ICONS[row.scanner] || Shield
        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-steel-400" />
            <span className="text-xs text-steel-300 font-mono">{row.scanner}</span>
          </div>
        )
      },
    },
    {
      key: 'severity',
      label: 'Severity',
      sortable: true,
      render: (row) => <StatusBadge status={row.severity?.toUpperCase()} />,
    },
    {
      key: 'title',
      label: 'Finding',
      sortable: true,
      render: (row) => (
        <div>
          <p className="text-sm text-steel-100 font-medium truncate max-w-[280px]">{row.title}</p>
          <p className="text-[10px] text-steel-500 font-mono truncate max-w-[280px]">{row.file}:{row.line}</p>
        </div>
      ),
    },
    {
      key: 'file',
      label: 'File',
      hidden: true,
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-56 bg-white/[0.06] rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse"><div className="h-8 w-16 bg-white/[0.06] rounded" /></div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <SkeletonChart /><SkeletonChart />
        </div>
        <SkeletonTable rows={6} cols={4} />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-steel-50 mb-1">Vulnerabilities</h1>
          <p className="text-steel-400 text-sm">Aggregated findings across all scanners</p>
        </div>
        <button onClick={refresh} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Findings" value={allVulns.length} icon={Shield} accent="violet" />
        <KpiCard label="Critical" value={critical} icon={AlertTriangle} accent="red" />
        <KpiCard label="High" value={high} icon={AlertTriangle} accent="orange" />
        <KpiCard label="Medium / Low" value={medium + low} icon={Shield} accent="amber" />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-steel-50 mb-4">Severity Distribution</h3>
          {sevDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={sevDist} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                  paddingAngle={4} dataKey="value" stroke="none">
                  {sevDist.map((entry, idx) => (
                    <Cell key={idx} fill={SEVERITY_COLORS[entry.name.toUpperCase()] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend formatter={(val) => <span className="text-xs text-steel-300 font-mono">{val}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-steel-500 text-sm">No vulnerabilities found</div>
          )}
        </div>
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-steel-50 mb-4">By Scanner</h3>
          {scannerDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={scannerDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Findings" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-steel-500 text-sm">No data</div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-steel-500" />
        <div className="flex items-center gap-1.5">
          {['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => (
            <button key={s} onClick={() => setSeverityFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                severityFilter === s
                  ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
                  : 'border-white/[0.06] text-steel-400 hover:text-steel-200 hover:bg-white/[0.04]'
              )}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
        {scanners.length > 1 && (
          <>
            <div className="w-px h-5 bg-white/[0.08]" />
            <div className="flex items-center gap-1.5">
              {['all', ...scanners].map(s => (
                <button key={s} onClick={() => setScannerFilter(s)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                    scannerFilter === s
                      ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                      : 'border-white/[0.06] text-steel-400 hover:text-steel-200 hover:bg-white/[0.04]'
                  )}>
                  {s === 'all' ? 'All Scanners' : s}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredVulns}
        searchable
        searchKeys={['title', 'file', 'scanner', 'severity', 'message']}
        pageSize={12}
        emptyMessage="No vulnerabilities match the current filters"
        onRowClick={(row) => setDetailModal({ open: true, vuln: row })}
      />

      {/* Detail Modal */}
      <Modal
        open={detailModal.open}
        onClose={() => setDetailModal({ open: false, vuln: null })}
        title="Vulnerability Details"
        description={detailModal.vuln?.title}
        size="lg"
      >
        {detailModal.vuln && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                <p className="text-[10px] text-steel-500 uppercase font-mono mb-1">Severity</p>
                <StatusBadge status={detailModal.vuln.severity?.toUpperCase()} />
              </div>
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                <p className="text-[10px] text-steel-500 uppercase font-mono mb-1">Scanner</p>
                <p className="text-sm text-steel-200 font-mono">{detailModal.vuln.scanner}</p>
              </div>
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                <p className="text-[10px] text-steel-500 uppercase font-mono mb-1">File</p>
                <p className="text-sm text-steel-200 font-mono truncate">{detailModal.vuln.file}</p>
              </div>
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                <p className="text-[10px] text-steel-500 uppercase font-mono mb-1">Line</p>
                <p className="text-sm text-steel-200 font-mono">{detailModal.vuln.line}</p>
              </div>
            </div>
            {detailModal.vuln.message && (
              <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                <p className="text-[10px] text-steel-500 uppercase font-mono mb-2">Description</p>
                <p className="text-sm text-steel-300 leading-relaxed">{detailModal.vuln.message}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
