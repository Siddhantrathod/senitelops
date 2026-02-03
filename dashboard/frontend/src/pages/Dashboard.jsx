import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
} from 'lucide-react'
import { fetchSecuritySummary } from '../services/api'
import { formatDate, calculateRiskScore, getSecurityGrade } from '../utils/helpers'
import StatCard from '../components/StatCard'
import SeverityPieChart from '../components/charts/SeverityPieChart'
import VulnerabilityBarChart from '../components/charts/VulnerabilityBarChart'
import TrendChart from '../components/charts/TrendChart'
import SecurityRadarChart from '../components/charts/SecurityRadarChart'
import { PageLoader } from '../components/LoadingSpinner'
import Alert from '../components/Alert'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const result = await fetchSecuritySummary()
      setData(result)
    } catch (err) {
      setError('Failed to load security data. Please ensure the backend is running.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <PageLoader />

  if (error) {
    return (
      <Alert variant="error" title="Connection Error">
        {error}
        <button onClick={loadData} className="btn-primary mt-4 text-sm">
          Retry
        </button>
      </Alert>
    )
  }

  const banditResults = data?.bandit?.results || []
  const banditMetrics = data?.bandit?.metrics?._totals || {}
  const trivyResults = extractTrivyVulnerabilities(data?.trivy)
  const totalVulnerabilities = banditResults.length + trivyResults.length

  // Calculate severity counts
  const banditSeverityCounts = {
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
    Critical: trivySeverityCounts.CRITICAL || 0,
    High: banditSeverityCounts.HIGH + (trivySeverityCounts.HIGH || 0),
    Medium: banditSeverityCounts.MEDIUM + (trivySeverityCounts.MEDIUM || 0),
    Low: banditSeverityCounts.LOW + (trivySeverityCounts.LOW || 0),
  }

  const severityPieData = Object.entries(combinedSeverity)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({ name, value }))

  // Security score (inverse - higher is better)
  const allVulns = [...banditResults, ...trivyResults]
  const riskScore = calculateRiskScore(allVulns)
  const securityScore = 100 - riskScore
  const { grade, color } = getSecurityGrade(securityScore)

  // Radar chart data
  const radarData = [
    { category: 'Code Security', score: 100 - calculateRiskScore(banditResults) },
    { category: 'Container Security', score: 100 - calculateRiskScore(trivyResults) },
    { category: 'Dependencies', score: trivyResults.length > 3 ? 60 : 90 },
    { category: 'Configuration', score: banditResults.some(v => v.test_id === 'B201') ? 50 : 85 },
    { category: 'Secrets', score: banditResults.some(v => v.test_id === 'B105') ? 40 : 95 },
    { category: 'Compliance', score: totalVulnerabilities > 5 ? 65 : 85 },
  ]

  // Bar chart data by type
  const vulnerabilityByType = [
    { name: 'Code Analysis', count: banditResults.length, severity: 'high' },
    { name: 'Container Scan', count: trivyResults.length, severity: 'medium' },
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
          <h1 className="text-3xl font-bold text-white mb-2">Security Dashboard</h1>
          <p className="text-dark-400">
            Overview of your DevSecOps security posture
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-dark-800 rounded-xl border border-dark-700/50">
            <Clock className="w-4 h-4 text-dark-500" />
            <span className="text-sm text-dark-400">
              Last scan: {formatDate(data?.bandit?.generated_at)}
            </span>
          </div>
          <button className="btn-primary">
            Run Scan
          </button>
        </div>
      </div>

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
          subtitle={`${banditResults.length} code + ${trivyResults.length} container`}
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
        {/* Bandit Summary */}
        <Link to="/bandit" className="glass-card-hover p-6 group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-purple-500/20">
              <Bug className="w-6 h-6 text-purple-400" />
            </div>
            <ChevronRight className="w-5 h-5 text-dark-500 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Bandit Code Analysis</h3>
          <p className="text-dark-400 text-sm mb-4">
            Static analysis of Python code for security vulnerabilities
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">{banditResults.length}</span>
              <span className="text-dark-500 text-sm">issues found</span>
            </div>
            <div className="h-8 w-px bg-dark-700" />
            <div className="flex gap-2">
              <span className="badge badge-high">{banditSeverityCounts.HIGH} High</span>
              <span className="badge badge-medium">{banditSeverityCounts.MEDIUM} Med</span>
            </div>
          </div>
        </Link>

        {/* Trivy Summary */}
        <Link to="/trivy" className="glass-card-hover p-6 group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-cyan-500/20">
              <Container className="w-6 h-6 text-cyan-400" />
            </div>
            <ChevronRight className="w-5 h-5 text-dark-500 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Trivy Container Scan</h3>
          <p className="text-dark-400 text-sm mb-4">
            Vulnerability scanner for containers and dependencies
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">{trivyResults.length}</span>
              <span className="text-dark-500 text-sm">vulnerabilities</span>
            </div>
            <div className="h-8 w-px bg-dark-700" />
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
      </div>

      {/* Recent Findings */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Recent Critical Findings</h3>
          <Link to="/bandit" className="text-primary-400 hover:text-primary-300 text-sm font-medium">
            View All →
          </Link>
        </div>
        <div className="space-y-3">
          {banditResults
            .filter(v => v.issue_severity === 'HIGH')
            .slice(0, 3)
            .map((vuln, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-dark-900/50 rounded-xl hover:bg-dark-800/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {vuln.test_name?.replace(/_/g, ' ')}
                    </p>
                    <p className="text-dark-500 text-sm">
                      {vuln.filename} • Line {vuln.line_number}
                    </p>
                  </div>
                </div>
                <span className="badge badge-high">{vuln.issue_severity}</span>
              </div>
            ))}
          {banditResults.filter(v => v.issue_severity === 'HIGH').length === 0 && (
            <div className="text-center py-8 text-dark-500">
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
