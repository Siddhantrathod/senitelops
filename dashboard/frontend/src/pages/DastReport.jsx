import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Globe,
  Filter,
  Download,
  RefreshCw,
  Search,
  AlertTriangle,
  Clock,
  Shield,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Info,
  CheckCircle,
  XCircle,
  Zap,
  Link as LinkIcon,
} from 'lucide-react'
import { fetchDastReport, fetchSetupStatus } from '../services/api'
import { formatDate, cn } from '../utils/helpers'
import StatCard from '../components/StatCard'
import SeverityPieChart from '../components/charts/SeverityPieChart'
import VulnerabilityBarChart from '../components/charts/VulnerabilityBarChart'
import { PageLoader } from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import { useAuth } from '../context/AuthContext'
import { createPortal } from 'react-dom'

const riskColors = {
  HIGH: { badge: 'bg-red-500/15 text-red-400 border-red-500/25', dot: 'bg-red-500' },
  MEDIUM: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25', dot: 'bg-amber-500' },
  LOW: { badge: 'bg-green-500/15 text-green-400 border-green-500/25', dot: 'bg-green-500' },
  INFORMATIONAL: { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-500' },
}

function RiskBadge({ risk }) {
  const r = (risk || 'LOW').toUpperCase()
  const cfg = riskColors[r] || riskColors.LOW
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-full border', cfg.badge)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {r}
    </span>
  )
}

export default function DastReport() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [redirecting, setRedirecting] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [filters, setFilters] = useState({
    risk: 'all',
    search: '',
  })
  const { isAuthenticated, loading: authLoading } = useAuth()

  // Derived data
  const results = useMemo(() => data?.results || [], [data])
  const metrics = useMemo(() => data?.metrics || {}, [data])

  const filteredResults = useMemo(() => {
    return results.filter(alert => {
      const alertName = alert.name || alert.alert || ''
      const alertDesc = alert.description || alert.desc || ''
      const alertUrl = alert.url || alert.uri || ''

      if (filters.risk !== 'all' && (alert.risk || '').toUpperCase() !== filters.risk) {
        return false
      }
      if (filters.search) {
        const q = filters.search.toLowerCase()
        return (
          alertName.toLowerCase().includes(q) ||
          alertDesc.toLowerCase().includes(q) ||
          alertUrl.toLowerCase().includes(q) ||
          (alert.cwe_id || '').toString().includes(q)
        )
      }
      return true
    })
  }, [results, filters])

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      checkSetupAndLoad()
    }
  }, [isAuthenticated, authLoading])

  const checkSetupAndLoad = async () => {
    try {
      setLoading(true)
      setError(null)
      const status = await fetchSetupStatus()

      if (!status.setup_completed) {
        setRedirecting(true)
        window.location.href = '/setup'
        return
      }

      const result = await fetchDastReport()
      if (result) {
        setData(result)
      } else {
        setError('no-report')
      }
      setLoading(false)
    } catch (err) {
      console.error('DastReport error:', err)
      if (err.response?.status === 404) {
        setError('no-report')
      } else {
        setError('Failed to load DAST report. Please ensure the backend is running.')
      }
      setLoading(false)
    }
  }

  if (authLoading || loading || redirecting) return <PageLoader />

  if (error === 'no-report') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-steel-50 mb-2">DAST Security Scan</h1>
          <p className="text-steel-400">Dynamic Application Security Testing with OWASP ZAP</p>
        </div>
        <Alert variant="info" title="No DAST Report Available">
          <p className="mb-2">No DAST report is available for your account yet.</p>
          <p className="mt-2 text-sm">Run pipeline to see reports.</p>
          <button onClick={() => navigate('/dashboard/pipeline')} className="btn-primary mt-4 text-sm">
            Go to Pipeline
          </button>
        </Alert>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="error" title="Connection Error">
        {error}
        <button onClick={checkSetupAndLoad} className="btn-primary mt-4 text-sm">Retry</button>
      </Alert>
    )
  }

  const totalAlerts = data?.total_alerts || results.length
  const highCount = metrics.high || 0
  const mediumCount = metrics.medium || 0
  const lowCount = metrics.low || 0
  const infoCount = metrics.informational || 0
  const toolName = data?.tool || 'ZAP'
  const targetUrl = data?.target_url || '—'
  const toolAvailable = data?.tool_available ?? false
  const scanType = data?.scan_type || 'baseline'
  const scanTimestamp = data?.timestamp || data?.scan_timestamp

  // Pie chart data
  const severityPieData = [
    { name: 'High', value: highCount },
    { name: 'Medium', value: mediumCount },
    { name: 'Low', value: lowCount },
    { name: 'Informational', value: infoCount },
  ].filter(d => d.value > 0)

  // Bar chart by CWE categories
  const cweCounts = {}
  results.forEach(a => {
    const cwe = a.cwe_id ? `CWE-${a.cwe_id}` : 'Unknown'
    cweCounts[cwe] = (cweCounts[cwe] || 0) + 1
  })
  const cweBarData = Object.entries(cweCounts)
    .map(([name, count]) => ({ name, count, severity: 'medium' }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dast-report.json'
    a.click()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-steel-50 mb-2 flex items-center gap-3">
            <Globe className="w-8 h-8 text-cyan-400" />
            DAST Security Scan
          </h1>
          <p className="text-steel-400">
            Dynamic Application Security Testing — Runtime vulnerability detection
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] rounded-xl border border-white/[0.06]">
            <Clock className="w-4 h-4 text-steel-500" />
            <span className="text-sm text-steel-400 font-mono">{formatDate(scanTimestamp)}</span>
          </div>
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={checkSetupAndLoad} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Scanner info banner */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-cyan-400" />
          <span className="text-sm text-steel-300">
            Tool: <span className="text-steel-50 font-medium">{toolName.toUpperCase()}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-steel-500" />
          <span className="text-sm text-steel-300">
            Target: <span className="text-steel-50 font-mono text-xs">{targetUrl}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-steel-500" />
          <span className="text-sm text-steel-300">
            Scan Type: <span className="text-steel-50 capitalize">{scanType}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {toolAvailable ? (
            <CheckCircle className="w-4 h-4 text-lime-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          )}
          <span className="text-sm text-steel-300">
            {toolAvailable ? 'ZAP Available' : 'Fallback Scanner'}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Alerts"
          value={totalAlerts}
          subtitle="DAST findings"
          icon={Globe}
          gradient="primary"
        />
        <StatCard
          title="High Risk"
          value={highCount}
          subtitle="Critical runtime issues"
          icon={AlertTriangle}
          gradient="danger"
        />
        <StatCard
          title="Medium Risk"
          value={mediumCount}
          subtitle="Moderate concerns"
          icon={Shield}
          gradient="warning"
        />
        <StatCard
          title="Low / Info"
          value={lowCount + infoCount}
          subtitle="Low-priority items"
          icon={Info}
          gradient="success"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {severityPieData.length > 0 ? (
          <SeverityPieChart
            data={severityPieData}
            title="DAST Alerts by Risk Level"
            height={300}
          />
        ) : (
          <div className="glass-card p-6 flex items-center justify-center text-steel-500">
            No alerts to chart
          </div>
        )}
        {cweBarData.length > 0 ? (
          <VulnerabilityBarChart
            data={cweBarData}
            title="Alerts by CWE Category"
            height={300}
          />
        ) : (
          <div className="glass-card p-6 flex items-center justify-center text-steel-500">
            No CWE data available
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-steel-500" />
          <input
            type="text"
            placeholder="Search alerts..."
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] text-steel-50 rounded-xl border border-white/[0.08] outline-none text-sm focus:ring-2 focus:ring-emerald-500/30 placeholder-steel-600"
          />
        </div>
        <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-xl border border-white/[0.06]">
          {['all', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'].map(r => (
            <button
              key={r}
              onClick={() => setFilters({ ...filters, risk: r })}
              className={cn(
                'px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors',
                filters.risk === r
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'text-steel-500 hover:text-steel-300'
              )}
            >
              {r === 'all' ? 'All' : r === 'INFORMATIONAL' ? 'Info' : r}
            </button>
          ))}
        </div>
        <span className="text-sm text-steel-500">{filteredResults.length} alerts</span>
      </div>

      {/* Alerts list */}
      <div className="space-y-3">
        {filteredResults.map((alert, idx) => (
          <div key={idx} className="glass-card overflow-hidden">
            <button
              onClick={() => setSelectedAlert(alert)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.04] transition-colors"
            >
              <RiskBadge risk={alert.risk} />
              <div className="flex-1 min-w-0 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-steel-50 truncate">{alert.name || alert.alert || 'Alert'}</p>
                  <p className="text-xs text-steel-500 font-mono truncate max-w-lg">{alert.url || alert.uri || targetUrl}</p>
                </div>
                {alert.cwe_id && (
                  <span className="text-xs text-steel-500 font-mono hidden sm:block">CWE-{alert.cwe_id}</span>
                )}
              </div>
            </button>
          </div>
        ))}
      </div>

      {selectedAlert && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setSelectedAlert(null)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto glass-card animate-fade-in shadow-card-hover border border-white/[0.16]">
            {/* Header */}
            <div className="sticky top-0 flex items-start justify-between p-6 border-b border-theme bg-surface-secondary/95 backdrop-blur-2xl rounded-t-2xl z-10">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <RiskBadge risk={selectedAlert.risk} />
                  {selectedAlert.cwe_id && (
                    <span className="badge badge-info">CWE-{selectedAlert.cwe_id}</span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-steel-50">{selectedAlert.name || selectedAlert.alert || 'Alert'}</h2>
              </div>
              <button onClick={() => setSelectedAlert(null)} className="p-2 text-steel-500 hover:text-steel-50 hover:bg-theme-active rounded-lg transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Description */}
              {(selectedAlert.description || selectedAlert.desc) && (
                <div>
                  <h4 className="text-[10px] font-bold text-steel-500 uppercase tracking-wider mb-2 font-mono">Description</h4>
                  <div className="text-sm text-steel-300 leading-relaxed whitespace-pre-wrap prose prose-invert max-w-none prose-p:mb-2 prose-a:text-emerald-400" dangerouslySetInnerHTML={{ __html: selectedAlert.description || selectedAlert.desc }} />
                </div>
              )}

              {/* Solution */}
              {selectedAlert.solution && (
                <div>
                  <h4 className="text-[10px] font-bold text-lime-400 uppercase tracking-wider mb-2 font-mono">Solution</h4>
                  <div className="text-sm text-steel-300 leading-relaxed whitespace-pre-wrap prose prose-invert max-w-none prose-p:mb-2 prose-a:text-emerald-400" dangerouslySetInnerHTML={{ __html: selectedAlert.solution }} />
                </div>
              )}

              {/* Details */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(selectedAlert.url || selectedAlert.uri) && (
                  <div className="col-span-2 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                    <span className="text-[10px] text-steel-500 font-mono tracking-wider uppercase block mb-1">URL</span>
                    <span className="text-steel-50 font-mono break-all text-xs">{selectedAlert.url || selectedAlert.uri}</span>
                  </div>
                )}
                {selectedAlert.method && (
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                    <span className="text-[10px] text-steel-500 font-mono tracking-wider uppercase block mb-1">Method</span>
                    <span className="text-steel-50 font-mono text-sm">{selectedAlert.method}</span>
                  </div>
                )}
                {selectedAlert.param && (
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                    <span className="text-[10px] text-steel-500 font-mono tracking-wider uppercase block mb-1">Parameter</span>
                    <span className="text-steel-50 font-mono text-sm">{selectedAlert.param}</span>
                  </div>
                )}
                {selectedAlert.cwe_id && (
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                    <span className="text-[10px] text-steel-500 font-mono tracking-wider uppercase block mb-1">CWE Link</span>
                    <a href={`https://cwe.mitre.org/data/definitions/${selectedAlert.cwe_id}.html`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-sm font-mono block">CWE-{selectedAlert.cwe_id} <ExternalLink className="w-3 h-3" /></a>
                  </div>
                )}
              </div>

              {selectedAlert.evidence && (
                <div>
                  <h4 className="text-[10px] font-bold text-steel-500 uppercase tracking-wider mb-2 font-mono">Evidence</h4>
                  <pre className="text-xs text-amber-300 bg-surface-code p-4 rounded-xl border border-white/[0.06] overflow-x-auto whitespace-pre-wrap break-all custom-scrollbar">
                    {typeof selectedAlert.evidence === 'string' ? selectedAlert.evidence : JSON.stringify(selectedAlert.evidence, null, 2)}
                  </pre>
                </div>
              )}

              {selectedAlert.reference && (
                <div>
                  <h4 className="text-[10px] font-bold text-steel-500 uppercase tracking-wider mb-2 font-mono">References</h4>
                  <div className="text-xs space-y-2">
                    {(typeof selectedAlert.reference === 'string' ? selectedAlert.reference.replace(/<[^>]+>/g, ' ').split(/\s+/) : [selectedAlert.reference])
                      .filter(ref => ref && ref.trim().startsWith('http'))
                      .map((ref, i) => (
                      <a key={i} href={ref.trim()} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-emerald-400 hover:text-emerald-300">
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> <span className="break-all">{ref.trim()}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="sticky bottom-0 flex justify-end gap-3 p-6 border-t border-theme bg-surface-secondary/95 backdrop-blur-2xl rounded-b-2xl">
              <button onClick={() => setSelectedAlert(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

        {filteredResults.length === 0 && results.length > 0 && (
          <div className="text-center py-12 text-steel-500 text-sm">No alerts match the current filters</div>
        )}
        {results.length === 0 && (
          <div className="glass-card p-12 text-center">
            <Globe className="w-12 h-12 text-steel-600 mx-auto mb-4" />
            <p className="text-steel-400 mb-2">No DAST alerts found</p>
            <p className="text-sm text-steel-500">Your application passed the dynamic security scan.</p>
          </div>
        )}
    </div>
  )
}
