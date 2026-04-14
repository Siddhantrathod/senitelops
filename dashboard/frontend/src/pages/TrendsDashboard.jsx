import { useState, useEffect } from 'react'
import {
  TrendingUp, TrendingDown, Shield, AlertTriangle, CheckCircle, XCircle,
  BarChart2, Activity, Clock, GitBranch, Zap,
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { fetchTrends } from '../services/api'
import { PageLoader } from '../components/LoadingSpinner'
import { useRepo } from '../context/RepoContext'
import { getSecurityGrade } from '../utils/helpers'

const palette = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  score: '#10b981',
  total: '#6366f1',
}

function formatLabel(dateStr) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch { return dateStr }
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-secondary/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl text-sm">
      <p className="text-steel-300 font-semibold mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-steel-400">{entry.name}:</span>
          <span className="text-steel-100 font-mono font-bold">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

function StatCard({ title, value, subtitle, icon: Icon, color = 'text-emerald-400', bg = 'bg-emerald-500/10', border = 'border-emerald-500/20' }) {
  return (
    <div className="glass-card p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl border ${bg} ${border}`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-steel-50 font-mono">{value}</p>
        <p className="text-sm font-medium text-steel-300">{title}</p>
        {subtitle && <p className="text-xs text-steel-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

export default function TrendsDashboard() {
  const [trends, setTrends] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const { selectedRepo } = useRepo()

  useEffect(() => {
    setLoading(true)
    fetchTrends(30, selectedRepo?.full_name)
      .then(data => { setTrends(data.trends || []); setLoading(false) })
      .catch(() => { setError('Failed to load trend data.'); setLoading(false) })
  }, [selectedRepo])

  if (loading) return <PageLoader />
  if (error) return (
    <div className="glass-card p-8 text-center text-steel-400">{error}</div>
  )

  if (trends.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-steel-50 mb-2">Security Posture Trends</h1>
          <p className="text-steel-400">Historical security metrics across pipeline runs</p>
        </div>
        <div className="glass-card p-12 text-center">
          <Activity className="w-12 h-12 text-steel-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-steel-300 mb-2">No Pipeline Data Yet</h3>
          <p className="text-steel-500">Run at least one security pipeline scan to see trend data.</p>
        </div>
      </div>
    )
  }

  // Build chart data
  const chartData = trends.map((run, i) => ({
    label: formatLabel(run.created_at || run.completed_at),
    score: run.security_score ?? null,
    total: run.total || 0,
    critical: run.critical || 0,
    high: run.high || 0,
    medium: run.medium || 0,
    low: run.low || 0,
    cvss: run.max_cvss_score ?? null,
    run: i + 1,
    id: run.id,
    status: run.status,
  }))

  // Regression detection: compare last vs previous
  const latestRun = trends[trends.length - 1]
  const prevRun = trends.length > 1 ? trends[trends.length - 2] : null
  const scoreDelta = prevRun && latestRun?.security_score != null && prevRun?.security_score != null
    ? latestRun.security_score - prevRun.security_score : null
  const vulnDelta = prevRun
    ? (latestRun.total || 0) - (prevRun.total || 0) : null

  const avgScore = Math.round(
    trends.filter(t => t.security_score != null).reduce((s, t) => s + t.security_score, 0) /
    (trends.filter(t => t.security_score != null).length || 1)
  )
  const bestScore = Math.max(...trends.map(t => t.security_score ?? 0))
  const totalScans = trends.length
  const successScans = trends.filter(t => t.status === 'success').length

  const { grade: latestGrade, color: gradeColor } = getSecurityGrade(latestRun.security_score ?? 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-steel-50 mb-2">Security Posture Trends</h1>
        <p className="text-steel-400">
          Track your security score, vulnerabilities, and risk across all pipeline runs
        </p>
      </div>

      {/* Regression Alert */}
      {scoreDelta !== null && scoreDelta < -5 && (
        <div className="relative overflow-hidden rounded-2xl p-4 bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/20">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-red-400 font-semibold">⚠️ Security Regression Detected</p>
              <p className="text-red-300/70 text-sm">
                Security score dropped by <strong>{Math.abs(scoreDelta).toFixed(1)} points</strong> since the last scan.
                {vulnDelta > 0 && ` ${vulnDelta} new vulnerabilities were introduced.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {scoreDelta !== null && scoreDelta > 5 && (
        <div className="relative overflow-hidden rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-emerald-400 font-semibold">✅ Security Improved</p>
              <p className="text-emerald-300/70 text-sm">
                Security score improved by <strong>{scoreDelta.toFixed(1)} points</strong> since the last scan.
                {vulnDelta < 0 && ` ${Math.abs(vulnDelta)} vulnerabilities were resolved.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Current Grade"
          value={<span className={gradeColor}>{latestGrade}</span>}
          subtitle={`Score: ${latestRun.security_score ?? 'N/A'}/100`}
          icon={Shield}
          color={gradeColor}
          bg="bg-emerald-500/10"
          border="border-emerald-500/20"
        />
        <StatCard
          title="Avg Security Score"
          value={`${avgScore}`}
          subtitle="Across all pipeline runs"
          icon={BarChart2}
          color="text-indigo-400"
          bg="bg-indigo-500/10"
          border="border-indigo-500/20"
        />
        <StatCard
          title="Best Score Ever"
          value={`${bestScore}`}
          subtitle="Peak security health"
          icon={Zap}
          color="text-amber-400"
          bg="bg-amber-500/10"
          border="border-amber-500/20"
        />
        <StatCard
          title="Pipeline Runs"
          value={`${successScans}/${totalScans}`}
          subtitle="Successful scans"
          icon={Activity}
          color="text-cyan-400"
          bg="bg-cyan-500/10"
          border="border-cyan-500/20"
        />
      </div>

      {/* Security Score Over Time */}
      <div className="glass-card p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-steel-50">Security Score Over Time</h3>
          <p className="text-sm text-steel-500">Higher is better (0–100)</p>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={palette.score} stopOpacity={0.3} />
                <stop offset="95%" stopColor={palette.score} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="score"
              name="Security Score"
              stroke={palette.score}
              strokeWidth={2.5}
              fill="url(#scoreGrad)"
              dot={{ r: 4, fill: palette.score, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Vulnerability Breakdown Over Time */}
      <div className="glass-card p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-steel-50">Vulnerability Breakdown Over Time</h3>
          <p className="text-sm text-steel-500">Critical, High, Medium, Low counts per run</p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            <Bar dataKey="critical" name="Critical" stackId="a" fill={palette.critical} radius={[0, 0, 0, 0]} />
            <Bar dataKey="high" name="High" stackId="a" fill={palette.high} />
            <Bar dataKey="medium" name="Medium" stackId="a" fill={palette.medium} />
            <Bar dataKey="low" name="Low" stackId="a" fill={palette.low} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pipeline Run History Table */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-steel-50 mb-4">Pipeline Run History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-steel-500 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                <th className="pb-3 pr-4">Run #</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Score</th>
                <th className="pb-3 pr-4">Critical</th>
                <th className="pb-3 pr-4">High</th>
                <th className="pb-3 pr-4">Total</th>
                <th className="pb-3">CVSS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {[...trends].reverse().map((run, i) => {
                const { grade, color } = getSecurityGrade(run.security_score ?? 0)
                const isRegression = i > 0 && run.total > ([...trends].reverse()[i - 1]?.total || 0)
                return (
                  <tr key={run.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pr-4 font-mono text-steel-400">#{run.id}</td>
                    <td className="py-3 pr-4 text-steel-400">{formatLabel(run.created_at)}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-medium ${
                        run.status === 'success' ? 'bg-emerald-500/15 text-emerald-400' :
                        run.status === 'failed' ? 'bg-red-500/15 text-red-400' :
                        'bg-amber-500/15 text-amber-400'
                      }`}>
                        {run.status === 'success' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {run.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`font-bold font-mono ${color}`}>
                        {run.security_score ?? 'N/A'} ({grade})
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-red-400 font-mono font-bold">{run.critical || 0}</td>
                    <td className="py-3 pr-4 text-orange-400 font-mono">{run.high || 0}</td>
                    <td className="py-3 pr-4 text-steel-300 font-mono flex items-center gap-1.5">
                      {run.total || 0}
                      {isRegression && <TrendingUp className="w-3.5 h-3.5 text-red-400" />}
                    </td>
                    <td className="py-3 text-steel-400 font-mono">
                      {run.max_cvss_score != null ? (
                        <span className={run.max_cvss_score >= 9 ? 'text-red-400' : run.max_cvss_score >= 7 ? 'text-orange-400' : 'text-steel-400'}>
                          {run.max_cvss_score.toFixed(1)}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
