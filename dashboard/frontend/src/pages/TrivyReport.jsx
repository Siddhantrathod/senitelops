import { useState, useEffect, useMemo } from 'react'
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
import { fetchTrivyReport } from '../services/api'
import { formatDate, cn } from '../utils/helpers'
import StatCard from '../components/StatCard'
import VulnerabilityTable from '../components/VulnerabilityTable'
import VulnerabilityModal from '../components/VulnerabilityModal'
import SeverityPieChart from '../components/charts/SeverityPieChart'
import VulnerabilityBarChart from '../components/charts/VulnerabilityBarChart'
import { PageLoader } from '../components/LoadingSpinner'
import Alert from '../components/Alert'

export default function TrivyReport() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedVuln, setSelectedVuln] = useState(null)
  const [filters, setFilters] = useState({
    severity: 'all',
    hasfix: 'all',
    search: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchTrivyReport()
      setData(result)
    } catch (err) {
      setError('Failed to load Trivy report. Please ensure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  // Extract vulnerabilities from Trivy report structure
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

  const metadata = data?.Metadata || {}
  const artifactName = data?.ArtifactName || 'Unknown'
  const imageSize = metadata.Size ? `${(metadata.Size / 1024 / 1024).toFixed(1)} MB` : 'N/A'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-500/20">
            <Container className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Trivy Container Scan</h1>
            <p className="text-dark-400 flex items-center gap-2 mt-1">
              <Clock className="w-4 h-4" />
              Scanned: {formatDate(data?.CreatedAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
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

      {/* Image Info Card */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Container Image Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-500/20">
              <Server className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <p className="text-dark-500 text-xs uppercase">Image Name</p>
              <p className="text-white font-medium">{artifactName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <HardDrive className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-dark-500 text-xs uppercase">Size</p>
              <p className="text-white font-medium">{imageSize}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <Package className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-dark-500 text-xs uppercase">OS</p>
              <p className="text-white font-medium">
                {metadata.OS?.Family} {metadata.OS?.Name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Container className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-dark-500 text-xs uppercase">Type</p>
              <p className="text-white font-medium">{data?.ArtifactType?.replace('_', ' ')}</p>
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
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-2 text-dark-400">
            <Filter className="w-5 h-5" />
            <span className="font-medium">Filters:</span>
          </div>
          
          {/* Search */}
          <div className="flex items-center gap-2 px-4 py-2 bg-dark-900 rounded-lg border border-dark-700/50 flex-1 md:max-w-xs">
            <Search className="w-4 h-4 text-dark-500" />
            <input
              type="text"
              placeholder="Search CVE, package..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="bg-transparent text-white placeholder-dark-500 outline-none w-full text-sm"
            />
          </div>

          {/* Severity Filter */}
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            className="px-4 py-2 bg-dark-900 text-white rounded-lg border border-dark-700/50 outline-none text-sm"
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
            className="px-4 py-2 bg-dark-900 text-white rounded-lg border border-dark-700/50 outline-none text-sm"
          >
            <option value="all">All Status</option>
            <option value="yes">Fix Available</option>
            <option value="no">No Fix</option>
          </select>

          {/* Results count */}
          <div className="ml-auto text-dark-400 text-sm">
            Showing {filteredVulnerabilities.length} of {vulnerabilities.length} vulnerabilities
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
