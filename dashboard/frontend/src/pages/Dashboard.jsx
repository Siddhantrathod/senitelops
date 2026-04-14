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
import { fetchSecuritySummary, fetchLatestPipeline, triggerPipeline, fetchSetupStatus, fetchGitleaksReport, fetchDastReport, fetchRepositories, fetchProfile, fetchPipelines } from '../services/api'
import { notyf } from '../utils/notifications'
import { formatDate, calculateRiskScore, getSecurityGrade } from '../utils/helpers'
import { getAutoRefreshInterval } from '../utils/appearance'
import StatCard from '../components/StatCard'
import SeverityPieChart from '../components/charts/SeverityPieChart'
import VulnerabilityBarChart from '../components/charts/VulnerabilityBarChart'
import TrendChart from '../components/charts/TrendChart'
import SecurityRadarChart from '../components/charts/SecurityRadarChart'
import { PageLoader } from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import PermissionGate from '../components/PermissionGate'
import { useAuth } from '../context/AuthContext'
import { useRepo } from '../context/RepoContext'
import FeedbackModal from '../components/FeedbackModal'

function formatTrendLabel(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

function summarizePipeline(pipeline) {
  const vuln = pipeline?.vulnerability_summary || {}
  return {
    total: Number(vuln.total || 0),
    critical: Number(vuln.critical || 0),
    high: Number(vuln.high || 0),
    medium: Number(vuln.medium || 0),
    low: Number(vuln.low || 0),
    securityScore: pipeline?.security_score ?? null,
    createdAt: pipeline?.created_at || pipeline?.completed_at || pipeline?.started_at || pipeline?.triggered_at || null,
    status: pipeline?.status || 'unknown',
    isDeployable: pipeline?.is_deployable,
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [pipeline, setPipeline] = useState(null)
  const [pipelineHistory, setPipelineHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [error, setError] = useState(null)
  const [redirecting, setRedirecting] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [refreshSeconds, setRefreshSeconds] = useState(getAutoRefreshInterval(30))
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { selectedRepo } = useRepo()

  // Reload data when the selected repository changes
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      loadData();
    }
  }, [selectedRepo, isAuthenticated, authLoading])

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
    const handler = () => setRefreshSeconds(getAutoRefreshInterval(30))
    window.addEventListener('sentinelops:appearance-updated', handler)
    return () => window.removeEventListener('sentinelops:appearance-updated', handler)
  }, [])

  // Auto-refresh pipeline status if running
  useEffect(() => {
    if (pipeline && ['running', 'queued'].includes(pipeline.status)) {
      if (refreshSeconds === 0) return undefined
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
      }, refreshSeconds * 1000)
      return () => clearInterval(interval)
    }
  }, [pipeline, refreshSeconds])

  const loadData = async () => {
    try {
      setLoading(true)
      const repoParam = selectedRepo ? selectedRepo.full_name : undefined
      const [result, latestPipeline, gitleaksResult, dastResult, pipelinesResult] = await Promise.all([
        fetchSecuritySummary(repoParam),
        fetchLatestPipeline(repoParam).catch(() => null),
        fetchGitleaksReport(repoParam).catch(() => null),
        fetchDastReport(repoParam).catch(() => null),
        fetchPipelines(14, repoParam).catch(() => null),
      ])
      setData({ ...result, gitleaks: gitleaksResult, dast: dastResult })
      setPipeline(latestPipeline)
      setPipelineHistory(pipelinesResult?.pipelines || [])
    } catch (err) {
      setError('Failed to load security data. Please ensure the backend is running.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleTriggerScan = async () => {
    setTriggering(true)
    try {
      if (!selectedRepo) {
        notyf.error('Please select a GitHub repository from the top menu first.')
        setTriggering(false)
        return
      }

      await triggerPipeline({ repo_url: selectedRepo.html_url, branch: selectedRepo.default_branch || 'main' })

      notyf.success('Security scan started successfully.')
      const latestPipeline = await fetchLatestPipeline(selectedRepo.full_name)
      setPipeline(latestPipeline)
    } catch (err) {
      console.error('Error triggering scan:', err)
      notyf.error(err.response?.data?.error || 'Failed to trigger pipeline.')
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
  const maxCvssScore = pipeline?.max_cvss_score?.toFixed(1) || pipeline?.vulnerability_summary?.max_cvss_score?.toFixed(1) || 'N/A'
  
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

  const radarCoverageCount = [
    Boolean(sastResults.length > 0 || banditResults.length > 0),
    Boolean(trivyResults.length > 0),
    Boolean(secretsCount > 0),
    Boolean(dastAlerts > 0),
  ].filter(Boolean).length

  const radarData = [
    { category: 'Code Security', score: codeSecurityScore },
    { category: 'Container Security', score: trivyResults.length > 0 ? 100 - calculateRiskScore(trivyResults) : 100 },
    { category: 'Secrets', score: secretsCount > 0 ? Math.max(0, 100 - secretsCount * 15) : 100 },
    { category: 'DAST', score: dastAlerts > 0 ? Math.max(0, 100 - dastHigh * 20 - dastMedium * 5) : 100 },
    { category: 'Pipeline Readiness', score: pipeline?.security_score ?? securityScore },
    { category: 'Scan Coverage', score: Math.round((radarCoverageCount / 4) * 100) },
  ]

  // Bar chart data by type
  const vulnerabilityByType = [
    { name: 'Code Analysis', count: codeIssueCount, severity: 'high' },
    { name: 'Container Scan', count: trivyResults.length, severity: 'medium' },
    { name: 'Secret Detection', count: secretsCount, severity: 'high' },
    { name: 'DAST Alerts', count: dastAlerts, severity: 'medium' },
  ]


  const latestPipelineSummary = summarizePipeline(pipeline)
  const previousPipelineSummary = summarizePipeline(pipelineHistory?.[1])

  const newFindings = Math.max((latestPipelineSummary.total || totalVulnerabilities) - (previousPipelineSummary.total || 0), 0)
  const fixedFindings = Math.max((previousPipelineSummary.total || 0) - (latestPipelineSummary.total || totalVulnerabilities), 0)

  const trendData = (() => {
    const runs = [...(pipelineHistory || [])]
      .filter((item) => item?.created_at || item?.completed_at || item?.started_at || item?.triggered_at)
      .sort((a, b) => new Date(a.created_at || a.completed_at || a.started_at || a.triggered_at) - new Date(b.created_at || b.completed_at || b.started_at || b.triggered_at))
      .slice(-7)

    if (runs.length === 0) {
      return [{ date: 'Current', vulnerabilities: totalVulnerabilities, fixed: 0 }]
    }

    return runs.map((run, index) => {
      const summary = summarizePipeline(run)
      const prev = index > 0 ? summarizePipeline(runs[index - 1]) : null
      return {
        date: formatTrendLabel(summary.createdAt),
        vulnerabilities: summary.total,
        fixed: prev ? Math.max(prev.total - summary.total, 0) : 0,
      }
    })
  })()

  const criticalCount = combinedSeverity.Critical + combinedSeverity.High

  const nextActions = [
    criticalCount > 0 && {
      title: 'Review critical/high findings',
      description: `${criticalCount} issues need immediate attention`,
      href: '/dashboard/sast',
      icon: AlertTriangle,
      tone: 'danger',
    },
    secretsCount > 0 && {
      title: 'Rotate exposed secrets',
      description: `${secretsCount} secret${secretsCount === 1 ? '' : 's'} detected`,
      href: '/dashboard/sast',
      icon: KeyRound,
      tone: 'warning',
    },
    dastCount > 0 && {
      title: 'Inspect DAST alerts',
      description: `${dastCount} runtime alert${dastCount === 1 ? '' : 's'} detected`,
      href: '/dashboard/dast',
      icon: Globe,
      tone: 'info',
    },
    pipeline?.status && {
      title: pipeline.status === 'success' ? 'Deployment gate passed' : 'Check latest pipeline',
      description: pipeline.status === 'success'
        ? (pipeline.is_deployable ? 'Ready for deployment' : 'Blocked by policy')
        : `Current state: ${pipeline.status}`,
      href: '/dashboard/pipeline',
      icon: Rocket,
      tone: pipeline.status === 'success' ? 'success' : 'info',
    },
  ].filter(Boolean).slice(0, 3)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-steel-50 mb-2">Security Dashboard</h1>
          <p className="text-steel-400">
            Overview of your DevSecOps security posture
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pipeline && (
            <Link
              to="/dashboard/pipeline"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${pipeline.status === 'running' || pipeline.status === 'queued'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
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
              Last scan: {formatDate(pipeline?.completed_at || pipeline?.created_at || data?.sast?.timestamp)}
            </span>
          </div>
          <PermissionGate permission="pipelines.run">
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
          </PermissionGate>
          
          <button
            onClick={() => setIsFeedbackOpen(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Globe className="w-4 h-4 text-blue-400" />
            Feedback
          </button>
        </div>
      </div>

      {/* Pipeline Status Banner */}
      {pipeline && pipeline.status === 'success' && pipeline.is_deployable !== null && (
        <div className={`relative overflow-hidden rounded-2xl p-5 border ${pipeline.is_deployable
          ? 'bg-gradient-to-r from-lime-500/10 to-transparent border-lime-500/20 shadow-[0_0_30px_rgba(132,204,22,0.1)]'
          : 'bg-gradient-to-r from-red-500/10 to-transparent border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]'
          }`}>
          <div className="absolute top-0 right-0 p-12 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full opacity-50 blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl flex items-center justify-center ${pipeline.is_deployable ? 'bg-lime-500/20 text-lime-400' : 'bg-red-500/20 text-red-400'}`}>
                {pipeline.is_deployable ? (
                  <Rocket className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className={`text-lg font-bold tracking-wide ${pipeline.is_deployable ? 'text-lime-400' : 'text-red-400'}`}>
                  {pipeline.is_deployable ? 'Deployment Approved 🚀' : 'Deployment Blocked ❌'}
                </p>
                <div className={`mt-1 flex items-center gap-2 text-sm font-mono ${pipeline.is_deployable ? 'text-lime-200/70' : 'text-red-200/70'}`}>
                  <span className="px-2 py-0.5 rounded-md bg-black/20 text-white/90 shadow-inner">Pipeline #{pipeline.id}</span>
                  <span>•</span>
                  <span>Branch: <span className="text-white/80">{pipeline.branch}</span></span>
                  <span>•</span>
                  <span>Commit: <span className="text-white/80">{pipeline.commit_sha}</span></span>
                </div>
              </div>
            </div>
            <Link to="/dashboard/pipeline" className={`px-4 py-2 font-medium rounded-xl transition-all shadow-lg ${pipeline.is_deployable ? 'bg-lime-500/20 text-lime-400 hover:bg-lime-500/30 border border-lime-500/30 focus:ring-4 focus:ring-lime-500/20' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 focus:ring-4 focus:ring-red-500/20'}`}>
              View Details →
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
          title="Open Critical/High"
          value={criticalCount}
          subtitle="Issues requiring immediate action"
          icon={AlertTriangle}
          trend={criticalCount > 0 ? 'Needs attention' : 'Clear'}
          trendDirection={criticalCount > 0 ? 'up' : 'down'}
          gradient="warning"
        />
        <StatCard
          title="New Findings"
          value={newFindings}
          subtitle="Compared to the previous scan"
          icon={XCircle}
          trend={fixedFindings > 0 ? `${fixedFindings} fixed` : 'No change'}
          trendDirection={fixedFindings > 0 ? 'down' : 'up'}
          gradient={newFindings > 0 ? 'danger' : 'success'}
        />
        <StatCard
          title="Max CVSS Score"
          value={maxCvssScore}
          subtitle="Highest vulnerability severity"
          icon={AlertTriangle}
          trend={pipeline?.status ? `Pipeline: ${pipeline.status}` : 'No pipeline'}
          trendDirection={maxCvssScore >= 7.0 ? 'up' : 'down'}
          gradient={maxCvssScore >= 9.0 ? 'danger' : maxCvssScore >= 7.0 ? 'warning' : 'success'}
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
          title="Vulnerability Trend (Last 7 Runs)"
          dataKeys={['vulnerabilities', 'fixed']}
          height={280}
        />
        <VulnerabilityBarChart
          data={vulnerabilityByType}
          title="Vulnerabilities by Source"
          height={280}
        />
      </div>

      {/* Next Actions */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-steel-50">Next Actions</h3>
            <p className="text-sm text-steel-500">Short, actionable steps based on the latest scan results.</p>
          </div>
          <Link to="/dashboard/pipeline" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">
            Go to Pipeline →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {nextActions.map((action) => {
            const ActionIcon = action.icon
            const toneClasses = {
              danger: 'bg-red-500/10 border-red-500/20 text-red-400',
              warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
              success: 'bg-lime-500/10 border-lime-500/20 text-lime-400',
              info: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
            }
            return (
              <Link key={action.title} to={action.href} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-all group">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`inline-flex p-2 rounded-xl border ${toneClasses[action.tone]}`}>
                      <ActionIcon className="w-4 h-4" />
                    </div>
                    <h4 className="text-steel-50 font-semibold mt-3 mb-1">{action.title}</h4>
                    <p className="text-steel-400 text-sm">{action.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-steel-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SAST Code Analysis Summary */}
        <Link to="/dashboard/sast" className="glass-card-hover p-6 group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <Code2 className="w-6 h-6 text-purple-400" />
            </div>
            <ChevronRight className="w-5 h-5 text-steel-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-xl font-semibold text-steel-50 mb-2">SAST Code Analysis</h3>
          <p className="text-steel-400 text-sm mb-4">
            Multi-language static analysis ({detectedLanguages.length > 0 ? detectedLanguages.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ') : 'No scan yet'})
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-steel-50 font-mono">{codeIssueCount}</span>
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
            <ChevronRight className="w-5 h-5 text-steel-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-xl font-semibold text-steel-50 mb-2">Trivy Container Scan</h3>
          <p className="text-steel-400 text-sm mb-4">
            Vulnerability scanner for containers and dependencies
          </p>
          <p className="text-steel-400 text-xs mt-1">
            Last scanned: {formatDate(data?.trivy?.CreatedAt) || 'N/A'}
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-steel-50 font-mono">{trivyResults.length}</span>
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
            <ChevronRight className="w-5 h-5 text-steel-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-xl font-semibold text-steel-50 mb-2">DAST Security Scan</h3>
          <p className="text-steel-400 text-sm mb-4">
            Dynamic runtime vulnerability testing {dastData?.tool ? `(${dastData.tool.toUpperCase()})` : '(OWASP ZAP)'}
          </p>
          <p className="text-steel-400 text-xs mt-1">
            Last scanned: {formatDate(dastData?.timestamp) || 'N/A'}
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-steel-50 font-mono">{dastAlerts}</span>
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
            <ChevronRight className="w-5 h-5 text-steel-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-xl font-semibold text-steel-50 mb-2">Secret Detection</h3>
          <p className="text-steel-400 text-sm mb-4">
            Gitleaks hardcoded secret scanning
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-steel-50 font-mono">{secretsCount}</span>
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
          <h3 className="text-lg font-semibold text-steel-50">Recent Critical Findings</h3>
          <Link to="/dashboard/sast" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">
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
                      <p className="text-steel-50 font-medium">
                        {vuln.rule_id || vuln.test_name?.replace(/_/g, ' ') || 'Finding'}
                      </p>
                      <p className="text-steel-500 text-sm font-mono">
                        {vuln.file || vuln.filename} • Line {vuln.line || vuln.line_number}
                        {vuln.language && <span className="ml-2 px-1.5 py-0.5 text-xs bg-theme-active rounded border border-theme">{vuln.language}</span>}
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
                      <p className="text-steel-50 font-medium">
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
      <FeedbackModal open={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
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
