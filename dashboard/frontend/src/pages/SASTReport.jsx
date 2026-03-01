import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bug,
  Filter,
  Download,
  RefreshCw,
  Search,
  AlertTriangle,
  FileCode,
  Clock,
  Code2,
  Languages,
  Wrench,
  BarChart3,
} from 'lucide-react'
import { fetchSASTReport, fetchSASTLanguages, fetchSetupStatus } from '../services/api'
import { formatDate, cn, getSeverityBadgeClass } from '../utils/helpers'
import StatCard from '../components/StatCard'
import VulnerabilityTable from '../components/VulnerabilityTable'
import VulnerabilityModal from '../components/VulnerabilityModal'
import SeverityPieChart from '../components/charts/SeverityPieChart'
import VulnerabilityBarChart from '../components/charts/VulnerabilityBarChart'
import { PageLoader } from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import { useAuth } from '../context/AuthContext'

// Language color mapping for dark theme badges
const LANG_COLORS = {
  python: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  javascript: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  typescript: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  java: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  go: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  ruby: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  php: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  c: { bg: 'bg-white/[0.06]', text: 'text-steel-300', border: 'border-white/[0.08]' },
  cpp: { bg: 'bg-white/[0.06]', text: 'text-steel-300', border: 'border-white/[0.08]' },
  csharp: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  rust: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  scala: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  swift: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  kotlin: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  shell: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
}

function getLangColor(lang) {
  return LANG_COLORS[lang?.toLowerCase()] || { bg: 'bg-white/[0.06]', text: 'text-steel-300', border: 'border-white/[0.08]' }
}

function getLangDisplayName(lang) {
  const names = {
    python: 'Python', javascript: 'JavaScript', typescript: 'TypeScript',
    java: 'Java', go: 'Go', ruby: 'Ruby', php: 'PHP',
    c: 'C', cpp: 'C++', csharp: 'C#', rust: 'Rust',
    scala: 'Scala', swift: 'Swift', kotlin: 'Kotlin', shell: 'Shell',
  }
  return names[lang?.toLowerCase()] || lang
}

export default function SASTReport() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [langInfo, setLangInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [redirecting, setRedirecting] = useState(false)
  const [selectedVuln, setSelectedVuln] = useState(null)
  const [filters, setFilters] = useState({
    severity: 'all',
    language: 'all',
    tool: 'all',
    search: '',
  })
  const { isAuthenticated, loading: authLoading } = useAuth()

  // Derived data — normalise languages/tools which may be objects or arrays
  const results = data?.results || []
  const metrics = data?.metrics || {}
  const rawLangs = data?.languages_detected
  const languages = Array.isArray(rawLangs) ? rawLangs : (rawLangs ? Object.keys(rawLangs) : [])
  const rawTools = data?.tools_used
  const tools = Array.isArray(rawTools) ? rawTools : (rawTools ? Object.keys(rawTools) : [])

  const filteredResults = useMemo(() => {
    return results.filter(issue => {
      if (filters.severity !== 'all' && issue.severity?.toUpperCase() !== filters.severity) {
        return false
      }
      if (filters.language !== 'all' && issue.language !== filters.language) {
        return false
      }
      if (filters.tool !== 'all' && issue.tool !== filters.tool) {
        return false
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        return (
          issue.message?.toLowerCase().includes(searchLower) ||
          issue.file?.toLowerCase().includes(searchLower) ||
          issue.rule_id?.toLowerCase().includes(searchLower) ||
          issue.tool?.toLowerCase().includes(searchLower)
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

      const [reportResult, langResult] = await Promise.allSettled([
        fetchSASTReport(),
        fetchSASTLanguages(),
      ])

      if (reportResult.status === 'fulfilled') {
        setData(reportResult.value)
      } else {
        // Check if It's a 404 (no report yet) vs actual connection error
        const status = reportResult.reason?.response?.status
        if (status === 404) {
          setError('no-report')
        } else {
          setError('Failed to load SAST report. Please ensure the backend is running.')
        }
      }

      if (langResult.status === 'fulfilled') {
        setLangInfo(langResult.value)
      }

      setLoading(false)
    } catch (err) {
      console.error('SASTReport error:', err)
      if (err.response?.status === 404) {
        setError('no-report')
      } else {
        setError('Failed to load SAST report. Please ensure the backend is running.')
      }
      setLoading(false)
    }
  }

  if (authLoading || loading || redirecting) return <PageLoader />

  if (error === 'no-report') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Code2 className="w-8 h-8 text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-steel-50">Code Analysis (SAST)</h1>
            <p className="text-steel-500">Static Application Security Testing</p>
          </div>
        </div>
        <Alert variant="warning" title="No SAST Report Available">
          <p className="mb-4">
            No static analysis scan has been performed yet. SAST scans analyze your source code for security vulnerabilities.
          </p>
          <p className="text-sm text-steel-400">
            Run a pipeline scan to generate a SAST report with tools like Semgrep and Bandit.
          </p>
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
        <button onClick={checkSetupAndLoad} className="btn-primary mt-4 text-sm">
          Retry
        </button>
      </Alert>
    )
  }

  // Severity chart data
  const totals = metrics.totals || {}
  const totalIssues = totals.total_issues || totals.total || results.length
  const severityPieData = [
    { name: 'Critical', value: totals.critical || 0 },
    { name: 'High', value: totals.high || 0 },
    { name: 'Medium', value: totals.medium || 0 },
    { name: 'Low', value: totals.low || 0 },
  ].filter(item => item.value > 0)

  // Language distribution chart
  const byLanguage = metrics.by_language || {}
  const languageBarData = Object.entries(byLanguage)
    .map(([lang, counts]) => ({
      name: getLangDisplayName(lang),
      count: counts.total || 0,
      severity: (counts.critical || 0) + (counts.high || 0) > 0 ? 'high' : 'medium',
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // Tool distribution chart
  const byTool = metrics.by_tool || {}
  const toolBarData = Object.entries(byTool)
    .map(([tool, counts]) => ({
      name: tool.charAt(0).toUpperCase() + tool.slice(1),
      count: counts.total || 0,
      severity: 'medium',
    }))
    .sort((a, b) => b.count - a.count)

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sast-report.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <Code2 className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-steel-50">Code Analysis (SAST)</h1>
            <p className="text-steel-500 flex items-center gap-2 mt-1 font-mono text-sm">
              <Clock className="w-4 h-4" />
              Generated: {formatDate(data?.generated_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={checkSetupAndLoad}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Language & Tools Tags */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-steel-500" />
            <span className="text-sm font-medium text-steel-400">Languages:</span>
            <div className="flex flex-wrap gap-1.5">
              {languages.map(lang => {
                const c = getLangColor(lang)
                return (
                  <span key={lang} className={cn('px-2.5 py-1 rounded-lg text-xs font-medium border', c.bg, c.text, c.border)}>
                    {getLangDisplayName(lang)}
                  </span>
                )
              })}
              {languages.length === 0 && <span className="text-sm text-steel-600">None detected</span>}
            </div>
          </div>
          <div className="h-6 w-px bg-white/[0.06] hidden sm:block" />
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-steel-500" />
            <span className="text-sm font-medium text-steel-400">Tools:</span>
            <div className="flex flex-wrap gap-1.5">
              {tools.map(tool => (
                <span key={tool} className="px-2.5 py-1 rounded-lg text-xs font-medium border bg-violet-500/10 text-violet-400 border-violet-500/20">
                  {tool.charAt(0).toUpperCase() + tool.slice(1)}
                </span>
              ))}
              {tools.length === 0 && <span className="text-sm text-steel-600">No tools ran</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Issues"
          value={totalIssues}
          subtitle={`Across ${languages.length} language${languages.length !== 1 ? 's' : ''}`}
          icon={Bug}
          gradient="purple"
        />
        <StatCard
          title="Critical / High"
          value={(totals.critical || 0) + (totals.high || 0)}
          subtitle="Require immediate action"
          icon={AlertTriangle}
          gradient="danger"
        />
        <StatCard
          title="Languages"
          value={languages.length}
          subtitle={languages.slice(0, 3).map(l => getLangDisplayName(l)).join(', ')}
          icon={Languages}
          gradient="primary"
        />
        <StatCard
          title="Tools Used"
          value={tools.length}
          subtitle={tools.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}
          icon={Wrench}
          gradient="warning"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SeverityPieChart
          data={severityPieData}
          title="By Severity"
          height={280}
        />
        <VulnerabilityBarChart
          data={languageBarData}
          title="By Language"
          height={280}
        />
        <VulnerabilityBarChart
          data={toolBarData.length > 0 ? toolBarData : [{ name: 'No data', count: 0, severity: 'low' }]}
          title="By Tool"
          height={280}
        />
      </div>

      {/* Language Breakdown Cards */}
      {Object.keys(byLanguage).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-steel-50 mb-3">Per-Language Breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Object.entries(byLanguage).map(([lang, counts]) => {
              const c = getLangColor(lang)
              return (
                <div key={lang} className={cn('glass-card p-4 border', c.border)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn('text-sm font-semibold', c.text)}>{getLangDisplayName(lang)}</span>
                    <span className="text-lg font-bold text-steel-50 font-mono">{counts.total || 0}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(counts.critical || 0) > 0 && <span className="badge badge-critical text-xs">{counts.critical} Crit</span>}
                    {(counts.high || 0) > 0 && <span className="badge badge-high text-xs">{counts.high} High</span>}
                    {(counts.medium || 0) > 0 && <span className="badge badge-medium text-xs">{counts.medium} Med</span>}
                    {(counts.low || 0) > 0 && <span className="badge badge-low text-xs">{counts.low} Low</span>}
                    {(counts.total || 0) === 0 && <span className="text-xs text-lime-400">Clean!</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-2 text-steel-400">
            <Filter className="w-5 h-5" />
            <span className="font-medium">Filters:</span>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] rounded-lg border border-white/[0.06] flex-1 md:max-w-xs focus-within:ring-2 focus-within:ring-violet-500/30 transition-all">
            <Search className="w-4 h-4 text-steel-500" />
            <input
              type="text"
              placeholder="Search issues..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="bg-transparent text-steel-50 placeholder-steel-600 outline-none w-full text-sm"
            />
          </div>

          {/* Severity Filter */}
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            className="px-4 py-2 bg-white/[0.04] text-steel-300 rounded-lg border border-white/[0.06] outline-none text-sm focus:ring-2 focus:ring-violet-500/30"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Language Filter */}
          <select
            value={filters.language}
            onChange={(e) => setFilters({ ...filters, language: e.target.value })}
            className="px-4 py-2 bg-white/[0.04] text-steel-300 rounded-lg border border-white/[0.06] outline-none text-sm focus:ring-2 focus:ring-violet-500/30"
          >
            <option value="all">All Languages</option>
            {languages.map(lang => (
              <option key={lang} value={lang}>{getLangDisplayName(lang)}</option>
            ))}
          </select>

          {/* Tool Filter */}
          <select
            value={filters.tool}
            onChange={(e) => setFilters({ ...filters, tool: e.target.value })}
            className="px-4 py-2 bg-white/[0.04] text-steel-300 rounded-lg border border-white/[0.06] outline-none text-sm focus:ring-2 focus:ring-violet-500/30"
          >
            <option value="all">All Tools</option>
            {tools.map(tool => (
              <option key={tool} value={tool}>{tool.charAt(0).toUpperCase() + tool.slice(1)}</option>
            ))}
          </select>

          {/* Results count */}
          <div className="ml-auto text-steel-500 text-sm font-mono">
            Showing <span className="font-medium text-steel-50">{filteredResults.length}</span> of {results.length} issues
          </div>
        </div>
      </div>

      {/* Vulnerabilities Table */}
      <VulnerabilityTable
        vulnerabilities={filteredResults}
        type="sast"
        onRowClick={setSelectedVuln}
      />

      {/* Vulnerability Modal */}
      <VulnerabilityModal
        vulnerability={selectedVuln}
        type="sast"
        isOpen={!!selectedVuln}
        onClose={() => setSelectedVuln(null)}
      />
    </div>
  )
}
