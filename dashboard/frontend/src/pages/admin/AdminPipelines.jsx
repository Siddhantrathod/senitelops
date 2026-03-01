import { useState, useMemo } from 'react'
import {
  GitBranch, Play, CheckCircle, XCircle, Clock, RefreshCw,
  Filter, Eye, AlertTriangle, ChevronDown, ChevronUp,
  Shield, Gauge, Terminal, Download,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { cn } from '../../utils/helpers'
import { DataTable, StatusBadge, KpiCard, SkeletonTable, SkeletonChart, Modal } from '../../components/admin'
import { usePolling } from '../../hooks/useAdminData'
import { fetchAdminPipelines } from '../../services/api'

const STATUS_ICONS = {
  success: CheckCircle,
  failed: XCircle,
  running: Play,
  queued: Clock,
}

const SEVERITY_COLORS = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e', INFO: '#6b7280' }

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-secondary/95 backdrop-blur-xl border border-theme-strong rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-xs text-steel-400 font-mono mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-steel-300">{entry.name}:</span>
          <span className="text-steel-50 font-mono font-bold">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminPipelines() {
  const { data: rawPipelines, loading, lastUpdated, refresh } = usePolling(fetchAdminPipelines, { interval: 15000 })
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedRow, setExpandedRow] = useState(null)
  const [detailModal, setDetailModal] = useState({ open: false, pipeline: null })

  // Backend returns { pipelines: [...], total } — extract the array
  const data = Array.isArray(rawPipelines) ? rawPipelines : (rawPipelines?.pipelines || [])

  // Filter
  const filteredData = useMemo(() => {
    if (statusFilter === 'all') return data
    return data.filter(p => p.status === statusFilter)
  }, [data, statusFilter])

  // Stats
  const total = data.length
  const successful = data.filter(p => p.status === 'success').length
  const failed = data.filter(p => p.status === 'failed').length
  const running = data.filter(p => p.status === 'running').length
  const avgScore = total > 0 ? Math.round(data.reduce((s, p) => s + (p.security_score || 0), 0) / total) : 0
  const passRate = total > 0 ? Math.round((successful / total) * 100) : 0

  // Charts data
  const statusDistribution = [
    { name: 'Success', value: successful, color: '#84cc16' },
    { name: 'Failed', value: failed, color: '#ef4444' },
    { name: 'Running', value: running, color: '#3b82f6' },
  ].filter(d => d.value > 0)

  const scannerAgg = useMemo(() => {
    const agg = {}
    data.forEach(p => {
      const scanners = p.scanners_run || []
      scanners.forEach(s => {
        if (!agg[s]) agg[s] = { name: s, runs: 0, findings: 0 }
        agg[s].runs++
        agg[s].findings += p[`${s.toLowerCase()}_findings`] || 0
      })
    })
    return Object.values(agg)
  }, [data])

  // Failure analysis
  const failedPipelines = useMemo(() => data.filter(p => p.status === 'failed'), [data])
  const failureReasons = useMemo(() => {
    const reasons = {}
    failedPipelines.forEach(p => {
      const reason = p.failure_reason || p.decision || 'Unknown'
      reasons[reason] = (reasons[reason] || 0) + 1
    })
    return Object.entries(reasons)
      .map(([name, count]) => ({ name: name.length > 30 ? name.slice(0, 30) + '…' : name, count }))
      .sort((a, b) => b.count - a.count)
  }, [failedPipelines])

  const columns = [
    {
      key: 'pipeline_id',
      label: 'Pipeline',
      sortable: true,
      render: (row) => {
        const Icon = STATUS_ICONS[row.status] || GitBranch
        return (
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              row.status === 'success' ? 'bg-lime-500/15 text-lime-400' :
              row.status === 'failed' ? 'bg-red-500/15 text-red-400' :
              row.status === 'running' ? 'bg-blue-500/15 text-blue-400' :
              'bg-steel-500/15 text-steel-400'
            )}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-mono text-steel-100 font-medium">{row.pipeline_id?.slice(0, 8) || '—'}</p>
              <p className="text-[10px] text-steel-500">{row.trigger || 'manual'}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} dot={row.status === 'running'} />,
    },
    {
      key: 'security_score',
      label: 'Score',
      sortable: true,
      render: (row) => {
        const s = row.security_score
        if (s == null) return <span className="text-xs text-steel-500">—</span>
        return (
          <span className={cn(
            'text-sm font-bold font-mono',
            s >= 70 ? 'text-lime-400' : s >= 40 ? 'text-amber-400' : 'text-red-400'
          )}>
            {s}
          </span>
        )
      },
    },
    {
      key: 'decision',
      label: 'Decision',
      sortable: true,
      render: (row) => (
        <StatusBadge status={row.decision === 'DEPLOY' || row.decision === 'passed' ? 'success' : row.decision === 'BLOCK' ? 'failed' : (row.decision || 'queued').toLowerCase()}>
          {row.decision || '—'}
        </StatusBadge>
      ),
    },
    {
      key: 'scanners_run',
      label: 'Scanners',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {(row.scanners_run || []).map(s => (
            <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-steel-300 font-mono">{s}</span>
          ))}
          {(!row.scanners_run || row.scanners_run.length === 0) && (
            <span className="text-xs text-steel-500">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'timestamp',
      label: 'Time',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-steel-400 font-mono">
          {row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'}
        </span>
      ),
    },
  ]

  if (loading && !data.length) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-56 bg-white/[0.06] rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse"><div className="h-8 w-16 bg-white/[0.06] rounded" /></div>
          ))}
        </div>
        <SkeletonTable rows={6} cols={6} />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-steel-50 mb-1">Pipeline Monitoring</h1>
          <p className="text-steel-400 text-sm">
            Live pipeline feed — auto-refreshing every 15s
            {lastUpdated && (
              <span className="ml-2 text-steel-600 font-mono">
                Last: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {running > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs text-blue-400 font-mono font-bold">{running} running</span>
            </div>
          )}
          <button onClick={refresh} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Runs" value={total} icon={GitBranch} accent="violet" />
        <KpiCard label="Pass Rate" value={passRate} suffix="%" icon={CheckCircle}
          accent={passRate >= 70 ? 'lime' : passRate >= 40 ? 'amber' : 'red'} />
        <KpiCard label="Avg Score" value={avgScore} icon={Gauge}
          accent={avgScore >= 70 ? 'lime' : avgScore >= 40 ? 'amber' : 'red'} />
        <KpiCard label="Failed" value={failed} icon={XCircle} accent="red"
          trend={failed > 0 ? { value: failed, direction: 'up', label: 'total' } : null} />
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-steel-50 flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-violet-400" /> Status Distribution
          </h3>
          {statusDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                  paddingAngle={4} dataKey="value" stroke="none">
                  {statusDistribution.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend formatter={(val) => <span className="text-xs text-steel-300 font-mono">{val}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex items-center justify-center text-steel-500 text-sm">No pipeline data</div>
          )}
        </div>

        {/* Failure Analysis */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-steel-50 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400" /> Failure Analysis
          </h3>
          {failureReasons.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={failureReasons} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} name="Occurrences" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex items-center justify-center text-lime-500/60 text-sm">
              <CheckCircle className="w-8 h-8 mr-2" /> No failures recorded
            </div>
          )}
        </div>
      </div>

      {/* Scanner Aggregation */}
      {scannerAgg.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-steel-50 flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-cyan-400" /> Cross-Scanner Aggregation
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scannerAgg}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend formatter={(val) => <span className="text-xs text-steel-300 font-mono">{val}</span>} />
              <Bar dataKey="runs" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Runs" />
              <Bar dataKey="findings" fill="#f97316" radius={[4, 4, 0, 0]} name="Findings" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-steel-500" />
        {['all', 'success', 'failed', 'running', 'queued'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
              statusFilter === s
                ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
                : 'border-white/[0.06] text-steel-400 hover:text-steel-200 hover:bg-white/[0.04]'
            )}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && (
              <span className="ml-1.5 text-steel-600 font-mono">
                {data.filter(p => p.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pipeline Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        searchable
        searchKeys={['pipeline_id', 'status', 'decision', 'trigger']}
        pageSize={10}
        emptyMessage="No pipelines match the current filter"
        exportable
        onExport={() => {
          const csv = ['Pipeline ID,Status,Score,Decision,Time']
          filteredData.forEach(p => {
            csv.push(`${p.pipeline_id},${p.status},${p.security_score || ''},${p.decision || ''},${p.timestamp || ''}`)
          })
          const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'pipelines-export.csv'
          a.click()
          URL.revokeObjectURL(url)
        }}
        onRowClick={(row) => setDetailModal({ open: true, pipeline: row })}
      />

      {/* Pipeline Detail Modal */}
      <Modal
        open={detailModal.open}
        onClose={() => setDetailModal({ open: false, pipeline: null })}
        title="Pipeline Details"
        description={`Run ${detailModal.pipeline?.pipeline_id?.slice(0, 8) || ''}`}
        size="lg"
      >
        {detailModal.pipeline && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                <p className="text-[10px] text-steel-500 uppercase font-mono mb-1">Status</p>
                <StatusBadge status={detailModal.pipeline.status} dot={detailModal.pipeline.status === 'running'} />
              </div>
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                <p className="text-[10px] text-steel-500 uppercase font-mono mb-1">Security Score</p>
                <span className={cn(
                  'text-2xl font-black font-mono',
                  (detailModal.pipeline.security_score || 0) >= 70 ? 'text-lime-400' :
                  (detailModal.pipeline.security_score || 0) >= 40 ? 'text-amber-400' : 'text-red-400'
                )}>
                  {detailModal.pipeline.security_score ?? '—'}
                </span>
              </div>
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                <p className="text-[10px] text-steel-500 uppercase font-mono mb-1">Decision</p>
                <p className="text-sm text-steel-200 font-mono font-bold">{detailModal.pipeline.decision || '—'}</p>
              </div>
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                <p className="text-[10px] text-steel-500 uppercase font-mono mb-1">Trigger</p>
                <p className="text-sm text-steel-200 font-mono">{detailModal.pipeline.trigger || 'manual'}</p>
              </div>
            </div>
            {detailModal.pipeline.scanners_run?.length > 0 && (
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                <p className="text-[10px] text-steel-500 uppercase font-mono mb-2">Scanners Executed</p>
                <div className="flex flex-wrap gap-2">
                  {detailModal.pipeline.scanners_run.map(s => (
                    <span key={s} className="px-3 py-1 rounded-lg text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {detailModal.pipeline.failure_reason && (
              <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/20">
                <p className="text-[10px] text-red-400 uppercase font-mono mb-1">Failure Reason</p>
                <p className="text-sm text-red-300 font-mono">{detailModal.pipeline.failure_reason}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
