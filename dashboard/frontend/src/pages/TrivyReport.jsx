import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Filter,
  Download,
  RefreshCw,
  Search,
  AlertTriangle,
  Package,
  Clock,
  Server,
  HardDrive,
} from 'lucide-react'
import { fetchTrivyReport, fetchSetupStatus } from '../services/api'
import { formatDate, cn } from '../utils/helpers'
import StatCard from '../components/StatCard'
import VulnerabilityTable from '../components/VulnerabilityTable'
import VulnerabilityModal from '../components/VulnerabilityModal'
import SeverityPieChart from '../components/charts/SeverityPieChart'
import VulnerabilityBarChart from '../components/charts/VulnerabilityBarChart'
import { PageLoader } from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import { useAuth } from '../context/AuthContext'

export default function TrivyReport() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [redirecting, setRedirecting] = useState(false)
  const [selectedVuln, setSelectedVuln] = useState(null)
  const [filters, setFilters] = useState({
    severity: 'all',
    hasfix: 'all',
    search: '',
  })
  const { isAuthenticated, loading: authLoading } = useAuth()

  // Derived data - must be before any conditional returns (Rules of Hooks)
  const vulnerabilities = useMemo(() => {
    if (!data?.Results) return []
    return data.Results.flatMap(result => result.Vulnerabilities || [])
  }, [data])

  const filteredVulnerabilities = useMemo(() => {
    return vulnerabilities.filter(vuln => {
      if (filters.severity !== 'all' && vuln.Severity?.toUpperCase() !== filters.severity) {
        return false
      }
      if (filters.hasfix === 'yes' && !vuln.FixedVersion) {
        return false
      }
      if (filters.hasfix === 'no' && vuln.FixedVersion) {
        return false
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        return (
          vuln.VulnerabilityID?.toLowerCase().includes(searchLower) ||
          vuln.PkgName?.toLowerCase().includes(searchLower) ||
          vuln.Title?.toLowerCase().includes(searchLower)
        )
      }
      return true
    })
  }, [vulnerabilities, filters])

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

      const result = await fetchTrivyReport()
      setData(result)
      setLoading(false)
    } catch (err) {
      console.error('TrivyReport error:', err)
      // Check if it's a 404 (no report exists) vs other errors
      if (err.response?.status === 404) {
        setError('no-report')
      } else {
        setError('Failed to load Trivy report. Please ensure the backend is running.')
      }
      setLoading(false)
    }
  }

  // Show loader while loading, auth loading, or redirecting
  if (authLoading || loading || redirecting) return <PageLoader />

  if (error && error !== 'no-report') {
    return (
      <Alert variant="error" title="Connection Error">
        {error}
        <button onClick={checkSetupAndLoad} className="btn-primary mt-4 text-sm">
          Retry
        </button>
      </Alert>
    )
  }

  // Calculate severity counts
  const severityCounts = vulnerabilities.reduce((acc, vuln) => {
    const severity = vuln.Severity?.toUpperCase() || 'UNKNOWN'
    acc[severity] = (acc[severity] || 0) + 1
    return acc
  }, {})

  const severityPieData = [
    { name: 'Critical', value: severityCounts.CRITICAL || 0 },
    { name: 'High', value: severityCounts.HIGH || 0 },
    { name: 'Medium', value: severityCounts.MEDIUM || 0 },
    { name: 'Low', value: severityCounts.LOW || 0 },
  ].filter(item => item.value > 0)

  // Group by package
  const packageCounts = vulnerabilities.reduce((acc, vuln) => {
    const pkg = vuln.PkgName || 'unknown'
    acc[pkg] = (acc[pkg] || 0) + 1
    return acc
  }, {})

  const packageBarData = Object.entries(packageCounts)
    .map(([name, count]) => ({ name, count, severity: 'high' }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // Fixable count
  const fixableCount = vulnerabilities.filter(v => v.FixedVersion).length

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'trivy-report.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <PageLoader />

  if (error === 'no-report') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-50">
            <Container className="w-8 h-8 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Trivy Container Scan</h1>
            <p className="text-slate-500">Container vulnerability scanning</p>
          </div>
        </div>
        <Alert variant="warning" title="No Trivy Report Available">
          <p className="mb-4">
            No container scan has been performed yet. Trivy scans are optional and can be enabled when triggering a scan.
          </p>
          <p className="text-sm text-slate-600">
            To run a Trivy scan, use the scan trigger API with <code className="bg-white border border-slate-200 px-2 py-1 rounded">"run_trivy": true</code>
          </p>
        </Alert>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="error" title="Error Loading Report">
        {error}
        <button onClick={checkSetupAndLoad} className="btn-primary mt-4 text-sm">
          Retry
        </button>
      </Alert>
    )
  }

  const metadata = data?.Metadata || {}
  const artifactName = data?.ArtifactName || 'Unknown'
  const imageSize = metadata.Size ? `${(metadata.Size / 1024 / 1024).toFixed(1)} MB` : 'N/A'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-50">
            <Container className="w-8 h-8 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Trivy Container Scan</h1>
            <p className="text-slate-500 flex items-center gap-2 mt-1">
              <Clock className="w-4 h-4" />
              Scanned: {formatDate(data?.CreatedAt)}
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

      {/* Image Info Card */}
      <div className="glass-card p-6 bg-white border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Container Image Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-50 text-primary-600">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase">Image Name</p>
              <p className="text-slate-900 font-medium">{artifactName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase">Size</p>
              <p className="text-slate-900 font-medium">{imageSize}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase">OS</p>
              <p className="text-slate-900 font-medium">
                {metadata.OS?.Family} {metadata.OS?.Name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600">
              <Container className="w-5 h-5" />
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase">Type</p>
              <p className="text-slate-900 font-medium">{data?.ArtifactType?.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Vulnerabilities"
          value={vulnerabilities.length}
          subtitle="Found in container"
          icon={AlertTriangle}
          gradient="warning"
        />
        <StatCard
          title="Critical/High"
          value={(severityCounts.CRITICAL || 0) + (severityCounts.HIGH || 0)}
          subtitle="Urgent attention needed"
          icon={AlertTriangle}
          gradient="danger"
        />
        <StatCard
          title="Fixable"
          value={fixableCount}
          subtitle={`${vulnerabilities.length - fixableCount} without fix`}
          icon={Package}
          gradient="success"
        />
        <StatCard
          title="Packages Affected"
          value={Object.keys(packageCounts).length}
          subtitle="Unique packages"
          icon={Package}
          gradient="primary"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SeverityPieChart
          data={severityPieData}
          title="Vulnerabilities by Severity"
          height={300}
        />
        <VulnerabilityBarChart
          data={packageBarData}
          title="Most Affected Packages"
          height={300}
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
              placeholder="Search CVE, package..."
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
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Fix Available Filter */}
          <select
            value={filters.hasfix}
            onChange={(e) => setFilters({ ...filters, hasfix: e.target.value })}
            className="px-4 py-2 bg-slate-50 text-slate-700 rounded-lg border border-slate-200 outline-none text-sm focus:ring-2 focus:ring-primary-100"
          >
            <option value="all">All Status</option>
            <option value="yes">Fix Available</option>
            <option value="no">No Fix</option>
          </select>

          {/* Results count */}
          <div className="ml-auto text-slate-500 text-sm">
            Showing <span className="font-medium text-slate-900">{filteredVulnerabilities.length}</span> of {vulnerabilities.length} vulnerabilities
          </div>
        </div>
      </div>

      {/* Vulnerabilities Table */}
      <VulnerabilityTable
        vulnerabilities={filteredVulnerabilities}
        type="trivy"
        onRowClick={setSelectedVuln}
      />

      {/* Vulnerability Modal */}
      <VulnerabilityModal
        vulnerability={selectedVuln}
        type="trivy"
        isOpen={!!selectedVuln}
        onClose={() => setSelectedVuln(null)}
      />
    </div>
  )
}
