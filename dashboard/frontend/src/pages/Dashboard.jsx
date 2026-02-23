import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Shield,
  Bug,
  Container,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronRight,
  CheckCircle,
  XCircle,
  GitBranch,
  Rocket,
  Play,
  Loader2,
  Code2,
  Languages,
  Globe,
  KeyRound,
} from 'lucide-react'
import { fetchSecuritySummary, fetchLatestPipeline, triggerPipeline, fetchSetupStatus, fetchGitleaksReport, fetchDastReport } from '../services/api'
import { formatDate, calculateRiskScore, getSecurityGrade } from '../utils/helpers'
import StatCard from '../components/StatCard'
import SeverityPieChart from '../components/charts/SeverityPieChart'
import VulnerabilityBarChart from '../components/charts/VulnerabilityBarChart'
import TrendChart from '../components/charts/TrendChart'
import SecurityRadarChart from '../components/charts/SecurityRadarChart'
import { PageLoader } from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [pipeline, setPipeline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [error, setError] = useState(null)
  const [redirecting, setRedirecting] = useState(false)
  const { isAuthenticated, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      checkSetupAndLoad()
    }
  }, [isAuthenticated, authLoading])

  const checkSetupAndLoad = async () => {
    try {
      setLoading(true)
      const status = await fetchSetupStatus()

      // Redirect to setup page if not completed
      if (!status.setup_completed) {
        setRedirecting(true)
        window.location.href = '/setup'
        return
      }

      await loadData()
      setLoading(false)
    } catch (err) {
      console.error('Error checking setup:', err)
      setError('Failed to load dashboard. Please try again.')
      setLoading(false)
    }
  }

  // Auto-refresh pipeline status if running
  useEffect(() => {
    if (pipeline && ['running', 'queued'].includes(pipeline.status)) {
      const interval = setInterval(async () => {
        try {
          const latestPipeline = await fetchLatestPipeline()
          if (latestPipeline) {
            setPipeline(latestPipeline)
            // If pipeline completed, reload all data
            if (['success', 'failed'].includes(latestPipeline.status)) {
              loadData()
            }
          }
        } catch (err) {
          console.error('Error refreshing pipeline:', err)
        }
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [pipeline])

  const loadData = async () => {
    try {
      const [result, latestPipeline, gitleaksResult, dastResult] = await Promise.all([
        fetchSecuritySummary(),
        fetchLatestPipeline().catch(() => null),
        fetchGitleaksReport().catch(() => null),
        fetchDastReport().catch(() => null),
      ])
      setData({ ...result, gitleaks: gitleaksResult, dast: dastResult })
      setPipeline(latestPipeline)
    } catch (err) {
      setError('Failed to load security data. Please ensure the backend is running.')
      console.error(err)
    }
  }

  const handleTriggerScan = async () => {
    setTriggering(true)
    try {
      await triggerPipeline()
      const latestPipeline = await fetchLatestPipeline()
      setPipeline(latestPipeline)
    } catch (err) {
      console.error('Error triggering scan:', err)
    } finally {
      setTriggering(false)
    }
  }

  // Show loader while loading, auth loading, or redirecting
  if (authLoading || loading || redirecting) return <PageLoader />

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

  const banditResults = data?.bandit?.results || []
  const banditMetrics = data?.bandit?.metrics?._totals || {}
  const trivyResults = extractTrivyVulnerabilities(data?.trivy)

  // SAST unified data (prefer over bandit-only)
  const sastData = data?.sast || null
  const sastResults = sastData?.results || []
  const sastMetrics = sastData?.metrics?.totals || {}
  const rawLangs = sastData?.languages_detected
  const detectedLanguages = Array.isArray(rawLangs) ? rawLangs : (rawLangs ? Object.keys(rawLangs) : (banditResults.length > 0 ? ['python'] : []))
  const rawTools = sastData?.tools_used
  const toolsUsed = Array.isArray(rawTools) ? rawTools : (rawTools ? Object.keys(rawTools) : (banditResults.length > 0 ? ['bandit'] : []))

  // Use SAST totals if available, otherwise compute from bandit
  const codeIssueCount = sastResults.length > 0 ? sastResults.length : banditResults.length
  const gitleaksCount = data?.gitleaks?.total_secrets || 0
  const dastCount = data?.dast?.total_alerts || 0
  const totalVulnerabilities = codeIssueCount + trivyResults.length + gitleaksCount + dastCount

  // Calculate severity counts from SAST if available
  const codeSeverityCounts = sastResults.length > 0
    ? {
      CRITICAL: sastMetrics.critical || 0,
      HIGH: sastMetrics.high || 0,
      MEDIUM: sastMetrics.medium || 0,
      LOW: sastMetrics.low || 0,
    }
    : {
      CRITICAL: 0,
      HIGH: banditMetrics['SEVERITY.HIGH'] || 0,
      MEDIUM: banditMetrics['SEVERITY.MEDIUM'] || 0,
      LOW: banditMetrics['SEVERITY.LOW'] || 0,
    }

  const trivySeverityCounts = trivyResults.reduce((acc, v) => {
    const severity = v.Severity?.toUpperCase() || 'UNKNOWN'
    acc[severity] = (acc[severity] || 0) + 1
    return acc
  }, {})

  const combinedSeverity = {
    Critical: codeSeverityCounts.CRITICAL + (trivySeverityCounts.CRITICAL || 0),
    High: codeSeverityCounts.HIGH + (trivySeverityCounts.HIGH || 0),
    Medium: codeSeverityCounts.MEDIUM + (trivySeverityCounts.MEDIUM || 0),
    Low: codeSeverityCounts.LOW + (trivySeverityCounts.LOW || 0),
  }

  const severityPieData = Object.entries(combinedSeverity)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({ name, value }))

  // Security score - use pipeline score if available, otherwise calculate from vulnerabilities
  const allVulns = [...(sastResults.length > 0 ? sastResults.map(r => ({ ...r, Severity: r.severity, issue_severity: r.severity })) : banditResults), ...trivyResults]
  const riskScore = calculateRiskScore(allVulns)
  const calculatedScore = 100 - riskScore
  // Prefer pipeline score for consistency
  const securityScore = pipeline?.security_score ?? calculatedScore
  const { grade, color } = getSecurityGrade(securityScore)

  // Radar chart data
  const codeSecurityScore = codeIssueCount > 0 ? 100 - calculateRiskScore(
    sastResults.length > 0 ? sastResults.map(r => ({ Severity: r.severity })) : banditResults
  ) : 100

  // Gitleaks data
  const gitleaksData = data?.gitleaks || null
  const secretsCount = gitleaksData?.total_secrets || 0
  const secretsCritical = gitleaksData?.metrics?.critical || 0
  const secretsHigh = gitleaksData?.metrics?.high || 0

  // DAST data
  const dastData = data?.dast || null
  const dastAlerts = dastData?.total_alerts || 0
  const dastHigh = dastData?.metrics?.high || 0
  const dastMedium = dastData?.metrics?.medium || 0
  const dastLow = dastData?.metrics?.low || 0

  const radarData = [
    { category: 'Code Security', score: codeSecurityScore },
    { category: 'Container Security', score: 100 - calculateRiskScore(trivyResults) },
    { category: 'Dependencies', score: trivyResults.length > 3 ? 60 : 90 },
    { category: 'Secrets', score: secretsCount > 0 ? Math.max(0, 100 - secretsCount * 15) : 95 },
    { category: 'DAST', score: dastAlerts > 0 ? Math.max(0, 100 - dastHigh * 20 - dastMedium * 5) : 95 },
    { category: 'Compliance', score: totalVulnerabilities > 5 ? 65 : 85 },
  ]

  // Bar chart data by type
  const vulnerabilityByType = [
    { name: 'Code Analysis', count: codeIssueCount, severity: 'high' },
    { name: 'Container Scan', count: trivyResults.length, severity: 'medium' },
    { name: 'Secret Detection', count: secretsCount, severity: 'high' },
    { name: 'DAST Alerts', count: dastAlerts, severity: 'medium' },
  ]

  // Trend data (mock for demo - in real app this would be historical)
  const trendData = [
    { date: 'Jan 28', vulnerabilities: totalVulnerabilities + 3, fixed: 2 },
    { date: 'Jan 29', vulnerabilities: totalVulnerabilities + 2, fixed: 3 },
    { date: 'Jan 30', vulnerabilities: totalVulnerabilities + 1, fixed: 4 },
    { date: 'Jan 31', vulnerabilities: totalVulnerabilities, fixed: 5 },
    { date: 'Feb 1', vulnerabilities: totalVulnerabilities - 1, fixed: 6 },
    { date: 'Feb 2', vulnerabilities: totalVulnerabilities, fixed: 6 },
  ]

  const criticalCount = combinedSeverity.Critical + combinedSeverity.High

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Security Dashboard</h1>
          <p className="text-slate-500">
            Overview of your DevSecOps security posture
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pipeline && (
            <Link
              to="/dashboard/pipeline"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${pipeline.status === 'running' || pipeline.status === 'queued'
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : pipeline.status === 'success'
                  ? 'bg-green-50 border-green-200 text-green-600'
                  : 'bg-red-50 border-red-200 text-red-600'
                }`}
            >
              {pipeline.status === 'running' || pipeline.status === 'queued' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : pipeline.status === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <span className="text-sm font-medium capitalize">{pipeline.status}</span>
              {pipeline.security_score !== null && (
                <span className="text-xs">({pipeline.security_score}/100)</span>
              )}
            </Link>
          )}
          <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] rounded-xl border border-white/[0.06]">
            <Clock className="w-4 h-4 text-steel-500" />
            <span className="text-sm text-steel-400 font-mono">
              Last scan: {formatDate(data?.sast?.generated_at || data?.bandit?.generated_at)}
            </span>
          </div>
          <button
            onClick={handleTriggerScan}
            disabled={triggering}
            className="btn-primary flex items-center gap-2"
          >
            {triggering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {triggering ? 'Starting...' : 'Run Scan'}
          </button>
        </div>
      </div>

      {/* Pipeline Status Banner */}
      {pipeline && pipeline.status === 'success' && pipeline.is_deployable !== null && (
        <div className={`rounded-xl p-4 border ${pipeline.is_deployable
          ? 'bg-lime-500/10 border-lime-500/20'
          : 'bg-red-500/10 border-red-500/20'
          }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {pipeline.is_deployable ? (
                <Rocket className="w-6 h-6 text-lime-400" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-red-400" />
              )}
              <div>
                <p className={`font-semibold ${pipeline.is_deployable ? 'text-lime-400' : 'text-red-400'}`}>
                  {pipeline.is_deployable ? '✅ Ready for Deployment' : '❌ Deployment Blocked'}
                </p>
                <p className="text-sm text-steel-500 font-mono">
                  Pipeline #{pipeline.id} • Branch: {pipeline.branch} • Commit: {pipeline.commit_sha}
                </p>
              </div>
            </div>
            <Link to="/dashboard/pipeline" className="btn-secondary text-sm">
              View Pipeline
            </Link>
          </div>
        </div>
      )}

      {/* Critical Alert */}
      {criticalCount > 0 && (
        <Alert variant="warning" title="Attention Required">
          You have <span className="font-bold">{criticalCount}</span> critical/high severity vulnerabilities
          that require immediate attention.
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Security Score"
          value={
            <span className="flex items-center gap-2">
              {securityScore}%
              <span className={`text-lg font-bold ${color}`}>({grade})</span>
            </span>
          }
          subtitle="Overall security health"
          icon={Shield}
          gradient="primary"
        />
        <StatCard
          title="Total Vulnerabilities"
          value={totalVulnerabilities}
          subtitle={`${codeIssueCount} code + ${trivyResults.length} container`}
          icon={AlertTriangle}
          trend={totalVulnerabilities > 5 ? '+2' : '-1'}
          trendDirection={totalVulnerabilities > 5 ? 'up' : 'down'}
          gradient="warning"
        />
        <StatCard
          title="Critical Issues"
          value={criticalCount}
          subtitle="Require immediate action"
          icon={XCircle}
          gradient="danger"
        />
        <StatCard
          title="Fixed This Week"
          value="6"
          subtitle="Vulnerabilities resolved"
          icon={CheckCircle}
          trend="+3"
          trendDirection="down"
          gradient="success"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SeverityPieChart
          data={severityPieData}
          title="Vulnerabilities by Severity"
          height={320}
        />
        <SecurityRadarChart
          data={radarData}
          title="Security Posture Overview"
          height={320}
        />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart
          data={trendData}
          title="Vulnerability Trend (7 Days)"
          dataKeys={['vulnerabilities', 'fixed']}
          height={280}
        />
        <VulnerabilityBarChart
          data={vulnerabilityByType}
          title="Vulnerabilities by Source"
          height={280}
        />
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SAST Code Analysis Summary */}
        <Link to="/dashboard/sast" className="glass-card-hover p-6 group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <Code2 className="w-6 h-6 text-purple-400" />
            </div>
            <ChevronRight className="w-5 h-5 text-steel-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">SAST Code Analysis</h3>
          <p className="text-steel-400 text-sm mb-4">
            Multi-language static analysis ({detectedLanguages.length > 0 ? detectedLanguages.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ') : 'No scan yet'})
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white font-mono">{codeIssueCount}</span>
              <span className="text-steel-400 text-sm">issues found</span>
            </div>
            <div className="h-8 w-px bg-white/[0.06]" />
            <div className="flex gap-2">
              {codeSeverityCounts.CRITICAL > 0 && <span className="badge badge-critical">{codeSeverityCounts.CRITICAL} Crit</span>}
              {codeSeverityCounts.HIGH > 0 && <span className="badge badge-high">{codeSeverityCounts.HIGH} High</span>}
              {codeSeverityCounts.MEDIUM > 0 && <span className="badge badge-medium">{codeSeverityCounts.MEDIUM} Med</span>}
            </div>
          </div>
        </Link>

        {/* Trivy Summary */}
        <Link to="/dashboard/trivy" className="glass-card-hover p-6 group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <Container className="w-6 h-6 text-cyan-400" />
            </div>
            <ChevronRight className="w-5 h-5 text-steel-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Trivy Container Scan</h3>
          <p className="text-steel-400 text-sm mb-4">
            Vulnerability scanner for containers and dependencies
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white font-mono">{trivyResults.length}</span>
              <span className="text-steel-400 text-sm">vulnerabilities</span>
            </div>
            <div className="h-8 w-px bg-white/[0.06]" />
            <div className="flex gap-2">
              {trivySeverityCounts.CRITICAL > 0 && (
                <span className="badge badge-critical">{trivySeverityCounts.CRITICAL} Critical</span>
              )}
              {trivySeverityCounts.HIGH > 0 && (
                <span className="badge badge-high">{trivySeverityCounts.HIGH} High</span>
              )}
            </div>
          </div>
        </Link>

        {/* DAST Scan Summary */}
        <Link to="/dashboard/dast" className="glass-card-hover p-6 group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <Globe className="w-6 h-6 text-cyan-400" />
            </div>
            <ChevronRight className="w-5 h-5 text-steel-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">DAST Security Scan</h3>
          <p className="text-steel-400 text-sm mb-4">
            Dynamic runtime vulnerability testing {dastData?.tool ? `(${dastData.tool.toUpperCase()})` : '(OWASP ZAP)'}
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white font-mono">{dastAlerts}</span>
              <span className="text-steel-400 text-sm">alerts found</span>
            </div>
            <div className="h-8 w-px bg-white/[0.06]" />
            <div className="flex gap-2">
              {dastHigh > 0 && <span className="badge badge-high">{dastHigh} High</span>}
              {dastMedium > 0 && <span className="badge badge-medium">{dastMedium} Med</span>}
              {dastAlerts === 0 && <span className="badge bg-lime-500/15 text-lime-400 border-lime-500/25">Clean</span>}
            </div>
          </div>
        </Link>

        {/* Gitleaks Secrets Summary */}
        <Link to="/dashboard/sast" className="glass-card-hover p-6 group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <KeyRound className="w-6 h-6 text-amber-400" />
            </div>
            <ChevronRight className="w-5 h-5 text-steel-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Secret Detection</h3>
          <p className="text-steel-400 text-sm mb-4">
            Gitleaks hardcoded secret scanning
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white font-mono">{secretsCount}</span>
              <span className="text-steel-400 text-sm">secrets found</span>
            </div>
            <div className="h-8 w-px bg-white/[0.06]" />
            <div className="flex gap-2">
              {secretsCritical > 0 && <span className="badge badge-critical">{secretsCritical} Critical</span>}
              {secretsHigh > 0 && <span className="badge badge-high">{secretsHigh} High</span>}
              {secretsCount === 0 && <span className="badge bg-lime-500/15 text-lime-400 border-lime-500/25">Clean</span>}
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Findings */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Recent Critical Findings</h3>
          <Link to="/dashboard/sast" className="text-violet-400 hover:text-violet-300 text-sm font-medium">
            View All →
          </Link>
        </div>
        <div className="space-y-3">
          {(sastResults.length > 0
            ? sastResults
              .filter(v => v.severity?.toUpperCase() === 'HIGH' || v.severity?.toUpperCase() === 'CRITICAL')
              .slice(0, 3)
              .map((vuln, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl hover:bg-white/[0.04] transition-colors border border-white/[0.06]"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {vuln.rule_id || vuln.test_name?.replace(/_/g, ' ') || 'Finding'}
                      </p>
                      <p className="text-steel-500 text-sm font-mono">
                        {vuln.file || vuln.filename} • Line {vuln.line || vuln.line_number}
                        {vuln.language && <span className="ml-2 px-1.5 py-0.5 text-xs bg-white/[0.06] rounded border border-white/[0.08]">{vuln.language}</span>}
                      </p>
                    </div>
                  </div>
                  <span className={`badge badge-${vuln.severity?.toLowerCase() || 'high'}`}>{vuln.severity || 'HIGH'}</span>
                </div>
              ))
            : banditResults
              .filter(v => v.issue_severity === 'HIGH')
              .slice(0, 3)
              .map((vuln, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl hover:bg-white/[0.04] transition-colors border border-white/[0.06]"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {vuln.test_name?.replace(/_/g, ' ')}
                      </p>
                      <p className="text-steel-500 text-sm font-mono">
                        {vuln.filename} • Line {vuln.line_number}
                      </p>
                    </div>
                  </div>
                  <span className="badge badge-high">{vuln.issue_severity}</span>
                </div>
              ))
          )}
          {(sastResults.length > 0
            ? sastResults.filter(v => v.severity?.toUpperCase() === 'HIGH' || v.severity?.toUpperCase() === 'CRITICAL').length === 0
            : banditResults.filter(v => v.issue_severity === 'HIGH').length === 0
          ) && (
            <div className="text-center py-8 text-steel-500">
              No critical findings. Great job maintaining security!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper to extract vulnerabilities from Trivy report
function extractTrivyVulnerabilities(trivyData) {
  if (!trivyData) return []

  const vulnerabilities = []

  if (trivyData.Results) {
    trivyData.Results.forEach(result => {
      if (result.Vulnerabilities) {
        vulnerabilities.push(...result.Vulnerabilities)
      }
    })
  }

  return vulnerabilities
}
