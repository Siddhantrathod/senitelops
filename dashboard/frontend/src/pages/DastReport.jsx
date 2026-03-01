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

const riskColors = {
  HIGH: { badge: 'bg-red-500/15 text-red-400 border-red-500/25', dot: 'bg-red-500' },
  MEDIUM: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/25', dot: 'bg-amber-500' },
  LOW: { badge: 'bg-green-500/15 text-green-400 border-green-500/25', dot: 'bg-green-500' },
  INFORMATIONAL: { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25', dot: 'bg-blue-500' },
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
  const [expandedAlert, setExpandedAlert] = useState(null)
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
      if (filters.risk !== 'all' && (alert.risk || '').toUpperCase() !== filters.risk) {
        return false
      }
      if (filters.search) {
        const q = filters.search.toLowerCase()
        return (
          (alert.name || '').toLowerCase().includes(q) ||
          (alert.description || '').toLowerCase().includes(q) ||
          (alert.url || '').toLowerCase().includes(q) ||
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
          <p className="mb-2">No DAST scan has been run yet. DAST scanning requires:</p>
          <ul className="list-disc list-inside text-sm space-y-1 text-steel-300">
            <li>A Dockerfile in your repository</li>
            <li>Docker installed on the system</li>
            <li>OWASP ZAP Docker image (pulled automatically)</li>
          </ul>
          <p className="mt-2 text-sm">Run a full pipeline scan to include DAST analysis.</p>
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
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] text-steel-50 rounded-xl border border-white/[0.08] outline-none text-sm focus:ring-2 focus:ring-violet-500/30 placeholder-steel-600"
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
                  ? 'bg-violet-500/15 text-violet-400'
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
        {filteredResults.map((alert, idx) => {
          const isExpanded = expandedAlert === idx
          return (
            <div key={idx} className="glass-card overflow-hidden">
              <button
                onClick={() => setExpandedAlert(isExpanded ? null : idx)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-steel-500" /> : <ChevronRight className="w-4 h-4 text-steel-500" />}
                <RiskBadge risk={alert.risk} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-steel-50 truncate">{alert.name || 'Alert'}</p>
                  <p className="text-xs text-steel-500 font-mono truncate">{alert.url || targetUrl}</p>
                </div>
                {alert.cwe_id && (
                  <span className="text-xs text-steel-500 font-mono hidden sm:block">CWE-{alert.cwe_id}</span>
                )}
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-white/[0.06] pt-4 space-y-4">
                  {/* Description */}
                  {alert.description && (
                    <div>
                      <h4 className="text-xs font-bold text-steel-400 uppercase tracking-wider mb-1">Description</h4>
                      <p className="text-sm text-steel-300 leading-relaxed">{alert.description}</p>
                    </div>
                  )}

                  {/* Solution */}
                  {alert.solution && (
                    <div>
                      <h4 className="text-xs font-bold text-lime-400 uppercase tracking-wider mb-1">Solution</h4>
                      <p className="text-sm text-steel-300 leading-relaxed">{alert.solution}</p>
                    </div>
                  )}

                  {/* Details grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    {alert.url && (
                      <div>
                        <span className="text-steel-500 block mb-1">URL</span>
                        <span className="text-steel-50 font-mono break-all text-[11px]">{alert.url}</span>
                      </div>
                    )}
                    {alert.method && (
                      <div>
                        <span className="text-steel-500 block mb-1">Method</span>
                        <span className="text-steel-50 font-mono">{alert.method}</span>
                      </div>
                    )}
                    {alert.param && (
                      <div>
                        <span className="text-steel-500 block mb-1">Parameter</span>
                        <span className="text-steel-50 font-mono">{alert.param}</span>
                      </div>
                    )}
                    {alert.cwe_id && (
                      <div>
                        <span className="text-steel-500 block mb-1">CWE</span>
                        <a
                          href={`https://cwe.mitre.org/data/definitions/${alert.cwe_id}.html`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-400 hover:text-violet-300 flex items-center gap-1"
                        >
                          CWE-{alert.cwe_id} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    {alert.evidence && (
                      <div className="col-span-2">
                        <span className="text-steel-500 block mb-1">Evidence</span>
                        <code className="text-xs text-amber-300 bg-white/[0.04] px-2 py-1 rounded border border-white/[0.06] block overflow-x-auto">
                          {typeof alert.evidence === 'string' ? alert.evidence.slice(0, 300) : JSON.stringify(alert.evidence).slice(0, 300)}
                        </code>
                      </div>
                    )}
                  </div>

                  {/* References */}
                  {alert.reference && (
                    <div>
                      <h4 className="text-xs font-bold text-steel-400 uppercase tracking-wider mb-1">References</h4>
                      <div className="text-xs text-violet-400 space-y-1">
                        {(typeof alert.reference === 'string' ? alert.reference.split('\n') : [alert.reference])
                          .filter(Boolean)
                          .slice(0, 5)
                          .map((ref, i) => (
                            <a key={i} href={ref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-violet-300">
                              <ExternalLink className="w-3 h-3" /> {ref}
                            </a>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

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
    </div>
  )
}
