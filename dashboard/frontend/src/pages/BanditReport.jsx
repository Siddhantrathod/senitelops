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
} from 'lucide-react'
import { fetchBanditReport, fetchSetupStatus } from '../services/api'
import { formatDate, cn, getSeverityBadgeClass } from '../utils/helpers'
import StatCard from '../components/StatCard'
import VulnerabilityTable from '../components/VulnerabilityTable'
import VulnerabilityModal from '../components/VulnerabilityModal'
import SeverityPieChart from '../components/charts/SeverityPieChart'
import VulnerabilityBarChart from '../components/charts/VulnerabilityBarChart'
import { PageLoader } from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import { useAuth } from '../context/AuthContext'

export default function BanditReport() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [redirecting, setRedirecting] = useState(false)
  const [selectedVuln, setSelectedVuln] = useState(null)
  const [filters, setFilters] = useState({
    severity: 'all',
    confidence: 'all',
    search: '',
  })
  const { isAuthenticated, loading: authLoading } = useAuth()

  // Derived data - must be before any conditional returns (Rules of Hooks)
  const metrics = data?.metrics?._totals || {}
  const results = data?.results || []

  const filteredResults = useMemo(() => {
    return results.filter(vuln => {
      if (filters.severity !== 'all' && vuln.issue_severity !== filters.severity) {
        return false
      }
      if (filters.confidence !== 'all' && vuln.issue_confidence !== filters.confidence) {
        return false
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        return (
          vuln.test_name?.toLowerCase().includes(searchLower) ||
          vuln.issue_text?.toLowerCase().includes(searchLower) ||
          vuln.filename?.toLowerCase().includes(searchLower)
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

      const result = await fetchBanditReport()
      setData(result)
      setLoading(false)
    } catch (err) {
      console.error('BanditReport error:', err)
      if (err.response?.status === 404) {
        setError('no-report')
      } else {
        setError('Failed to load Bandit report. Please ensure the backend is running.')
      }
      setLoading(false)
    }
  }

  // Show loader while loading, auth loading, or redirecting
  if (authLoading || loading || redirecting) return <PageLoader />

  if (error === 'no-report') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Bug className="w-8 h-8 text-amber-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-steel-50">Bandit Security Scan</h1>
            <p className="text-steel-500">Python-specific security analysis</p>
          </div>
        </div>
        <Alert variant="warning" title="No Bandit Report Available">
          <p className="mb-4">
            No Bandit scan has been performed yet. Bandit analyzes Python code for common security issues.
          </p>
          <p className="text-sm text-steel-400">
            Run a pipeline scan on a Python project to generate a Bandit report.
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

  const severityPieData = [
    { name: 'High', value: metrics['SEVERITY.HIGH'] || 0 },
    { name: 'Medium', value: metrics['SEVERITY.MEDIUM'] || 0 },
    { name: 'Low', value: metrics['SEVERITY.LOW'] || 0 },
  ].filter(item => item.value > 0)

  const confidencePieData = [
    { name: 'High', value: metrics['CONFIDENCE.HIGH'] || 0 },
    { name: 'Medium', value: metrics['CONFIDENCE.MEDIUM'] || 0 },
    { name: 'Low', value: metrics['CONFIDENCE.LOW'] || 0 },
  ].filter(item => item.value > 0)

  // Group by test type
  const groupedByTest = results.reduce((acc, vuln) => {
    const test = vuln.test_name || 'unknown'
    acc[test] = (acc[test] || 0) + 1
    return acc
  }, {})

  const testTypeData = Object.entries(groupedByTest)
    .map(([name, count]) => ({ name: name.replace(/_/g, ' '), count, severity: 'medium' }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bandit-report.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <PageLoader />

  if (error) {
    return (
      <Alert variant="error" title="Error Loading Report">
        {error}
        <button onClick={loadData} className="btn-primary mt-4 text-sm">
          Retry
        </button>
      </Alert>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-50">
            <Bug className="w-8 h-8 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Bandit Analysis</h1>
            <p className="text-slate-500 flex items-center gap-2 mt-1">
              <Clock className="w-4 h-4" />
              Generated: {formatDate(data?.generated_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={checkSetupAndLoad}
            className="btn-secondary inline-flex items-center gap-2 bg-white"
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Issues"
          value={results.length}
          subtitle={`Across ${Object.keys(data?.metrics || {}).length - 1} files`}
          icon={Bug}
          gradient="purple"
        />
        <StatCard
          title="High Severity"
          value={metrics['SEVERITY.HIGH'] || 0}
          subtitle="Critical vulnerabilities"
          icon={AlertTriangle}
          gradient="danger"
        />
        <StatCard
          title="Lines of Code"
          value={metrics.loc || 0}
          subtitle="Total analyzed"
          icon={FileCode}
          gradient="primary"
        />
        <StatCard
          title="High Confidence"
          value={metrics['CONFIDENCE.HIGH'] || 0}
          subtitle="Certain issues"
          icon={AlertTriangle}
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
        <SeverityPieChart
          data={confidencePieData}
          title="By Confidence"
          height={280}
        />
        <VulnerabilityBarChart
          data={testTypeData}
          title="By Issue Type"
          height={280}
        />
      </div>

      {/* Filters */}
      <div className="glass-card p-4 bg-white border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Filter className="w-5 h-5" />
            <span className="font-medium">Filters:</span>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200 flex-1 md:max-w-xs focus-within:ring-2 focus-within:ring-primary-100 transition-all">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search issues..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="bg-transparent text-slate-900 placeholder-slate-400 outline-none w-full text-sm"
            />
          </div>

          {/* Severity Filter */}
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            className="px-4 py-2 bg-slate-50 text-slate-700 rounded-lg border border-slate-200 outline-none text-sm focus:ring-2 focus:ring-primary-100"
          >
            <option value="all">All Severities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Confidence Filter */}
          <select
            value={filters.confidence}
            onChange={(e) => setFilters({ ...filters, confidence: e.target.value })}
            className="px-4 py-2 bg-slate-50 text-slate-700 rounded-lg border border-slate-200 outline-none text-sm focus:ring-2 focus:ring-primary-100"
          >
            <option value="all">All Confidence</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Results count */}
          <div className="ml-auto text-slate-500 text-sm">
            Showing <span className="font-medium text-slate-900">{filteredResults.length}</span> of {results.length} issues
          </div>
        </div>
      </div>

      {/* Vulnerabilities Table */}
      <VulnerabilityTable
        vulnerabilities={filteredResults}
        type="bandit"
        onRowClick={setSelectedVuln}
      />

      {/* Vulnerability Modal */}
      <VulnerabilityModal
        vulnerability={selectedVuln}
        type="bandit"
        isOpen={!!selectedVuln}
        onClose={() => setSelectedVuln(null)}
      />
    </div>
  )
}
