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
import { fetchTrivyReport, fetchSetupStatus, fetchCveDetail } from '../services/api'
import { useRepo } from '../context/RepoContext'
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
  const { selectedRepo } = useRepo()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [redirecting, setRedirecting] = useState(false)
  const [selectedVuln, setSelectedVuln] = useState(null)
  const [cveDetails, setCveDetails] = useState({})  // cve_id -> enrichment data
  const [loadingCve, setLoadingCve] = useState(null)
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

      const result = await fetchTrivyReport(selectedRepo?.full_name)
      setData(result)
      setLoading(false)
    } catch (err) {
      console.error('TrivyReport error:', err)
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

  const handleCveClick = async (cveId) => {
    if (!cveId || cveDetails[cveId]) return
    setLoadingCve(cveId)
    try {
      const data = await fetchCveDetail(cveId)
      setCveDetails(prev => ({ ...prev, [cveId]: data }))
    } catch (e) {
      setCveDetails(prev => ({ ...prev, [cveId]: { error: true } }))
    } finally {
      setLoadingCve(null)
    }
  }

  if (loading) return <PageLoader />

  if (error === 'no-report') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <Container className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-steel-50">Trivy Container Scan</h1>
            <p className="text-steel-500">Container vulnerability scanning</p>
          </div>
        </div>
        <Alert variant="warning" title="No Trivy Report Available">
          <p className="mb-4">
            No Trivy report is available for your account yet.
          </p>
          <p className="text-sm text-steel-400">
            Run pipeline to see reports.
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
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <Container className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-steel-50">Trivy Container Scan</h1>
            <p className="text-steel-500 flex items-center gap-2 mt-1 font-mono text-sm">
              <Clock className="w-4 h-4" />
              Scanned: {formatDate(data?.CreatedAt)}
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

      {/* Image Info Card */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-steel-50 mb-4">Container Image Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <p className="text-steel-500 text-[10px] uppercase tracking-[0.15em] font-mono">Image Name</p>
              <p className="text-steel-50 font-medium">{artifactName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <p className="text-steel-500 text-[10px] uppercase tracking-[0.15em] font-mono">Size</p>
              <p className="text-steel-50 font-medium font-mono">{imageSize}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-lime-500/10 text-lime-400 border border-lime-500/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-steel-500 text-[10px] uppercase tracking-[0.15em] font-mono">OS</p>
              <p className="text-steel-50 font-medium">
                {metadata.OS?.Family} {metadata.OS?.Name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Container className="w-5 h-5" />
            </div>
            <div>
              <p className="text-steel-500 text-[10px] uppercase tracking-[0.15em] font-mono">Type</p>
              <p className="text-steel-50 font-medium">{data?.ArtifactType?.replace('_', ' ')}</p>
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
          <div className="flex items-center gap-2 text-steel-400">
            <Filter className="w-5 h-5" />
            <span className="font-medium">Filters:</span>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] rounded-lg border border-white/[0.06] flex-1 md:max-w-xs focus-within:ring-2 focus-within:ring-emerald-500/30 transition-all">
            <Search className="w-4 h-4 text-steel-500" />
            <input
              type="text"
              placeholder="Search CVE, package..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="bg-transparent text-steel-50 placeholder-steel-600 outline-none w-full text-sm"
            />
          </div>

          {/* Severity Filter */}
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            className="px-4 py-2 bg-white/[0.04] text-steel-300 rounded-lg border border-white/[0.06] outline-none text-sm focus:ring-2 focus:ring-emerald-500/30"
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
            className="px-4 py-2 bg-white/[0.04] text-steel-300 rounded-lg border border-white/[0.06] outline-none text-sm focus:ring-2 focus:ring-emerald-500/30"
          >
            <option value="all">All Status</option>
            <option value="yes">Fix Available</option>
            <option value="no">No Fix</option>
          </select>

          {/* Results count */}
          <div className="ml-auto text-steel-500 text-sm font-mono">
            Showing <span className="font-medium text-steel-50">{filteredVulnerabilities.length}</span> of {vulnerabilities.length} vulnerabilities
          </div>
        </div>
      </div>

      {/* Vulnerabilities Table */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-steel-50">Vulnerability List</h3>
          <span className="text-xs text-steel-500 font-mono">Click a CVE ID to enrich with live threat intelligence</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-steel-500 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                <th className="pb-3 pr-4">CVE ID</th>
                <th className="pb-3 pr-4">Package</th>
                <th className="pb-3 pr-4">Severity</th>
                <th className="pb-3 pr-4">Installed</th>
                <th className="pb-3">Fix Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredVulnerabilities.map((vuln, i) => {
                const cveId = vuln.VulnerabilityID
                const enrichment = cveDetails[cveId]
                const isKev = enrichment?.is_actively_exploited
                return (
                  <>
                    <tr key={`${cveId}-${i}`} className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => handleCveClick(cveId)}>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-cyan-400 text-xs hover:underline">{cveId}</span>
                          {isKev && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                              🔴 KEV
                            </span>
                          )}
                          {loadingCve === cveId && (
                            <span className="text-[10px] text-steel-500">loading...</span>
                          )}
                        </div>
                        {vuln.Title && <p className="text-steel-500 text-[11px] mt-0.5 max-w-xs truncate">{vuln.Title}</p>}
                      </td>
                      <td className="py-3 pr-4 text-steel-300 font-mono text-xs">{vuln.PkgName}</td>
                      <td className="py-3 pr-4">
                        <span className={`badge badge-${(vuln.Severity || 'unknown').toLowerCase()}`}>
                          {vuln.Severity}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-steel-400 font-mono text-xs">{vuln.InstalledVersion}</td>
                      <td className="py-3">
                        {vuln.FixedVersion ? (
                          <span className="text-emerald-400 text-xs font-mono">{vuln.FixedVersion}</span>
                        ) : (
                          <span className="text-steel-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                    {enrichment && !enrichment.error && (
                      <tr key={`${cveId}-enriched`}>
                        <td colSpan={5} className="pb-3 pt-0">
                          <div className="mx-2 mb-2 p-4 rounded-xl bg-white/[0.03] border border-cyan-500/15">
                            <div className="flex items-start gap-4 flex-wrap">
                              {enrichment.cvss_score != null && (
                                <div className="text-center">
                                  <p className="text-[10px] text-steel-500 uppercase tracking-wider">CVSS</p>
                                  <p className={`text-xl font-bold font-mono ${enrichment.cvss_score >= 9 ? 'text-red-400' : enrichment.cvss_score >= 7 ? 'text-orange-400' : 'text-amber-400'}`}>
                                    {enrichment.cvss_score}
                                  </p>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-steel-300 text-sm leading-relaxed">{enrichment.description}</p>
                                {enrichment.cwes?.length > 0 && (
                                  <p className="text-steel-600 text-xs mt-1">CWE: {enrichment.cwes.join(', ')}</p>
                                )}
                              </div>
                              <a href={enrichment.nvd_url} target="_blank" rel="noreferrer"
                                className="text-xs text-cyan-400 hover:underline whitespace-nowrap mt-1"
                                onClick={e => e.stopPropagation()}>
                                NVD →
                              </a>
                            </div>
                            {isKev && (
                              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                                <span className="text-red-400 text-xs font-semibold">🔴 CISA Known Exploited Vulnerability (KEV)</span>
                                <span className="text-red-300/70 text-xs">— This CVE is actively being exploited in the wild. Patch immediately.</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {filteredVulnerabilities.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-steel-500">No matching vulnerabilities found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
