import { useState, useEffect, useCallback } from 'react'
import {
  Users, Shield, GitBranch, CheckCircle, XCircle, Gauge, RefreshCw,
  AlertTriangle, KeyRound, Activity, Clock, Wifi, Server,
  Container, FileCode, Globe, TrendingUp, Zap,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Area, AreaChart,
  BarChart, Bar, Legend,
} from 'recharts'
import { cn } from '../../utils/helpers'
import { KpiCard, StatusBadge, SkeletonCard, SkeletonChart } from '../../components/admin'
import {
  fetchAdminStats,
  fetchAdminOverviewAnalytics,
} from '../../services/api'

const SEVERITY_COLORS = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' }
const SCANNER_COLORS = { SAST: '#8b5cf6', Trivy: '#06b6d4', DAST: '#f97316', Gitleaks: '#ec4899' }
const DEPLOY_COLORS = { passed: '#84cc16', blocked: '#ef4444' }

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-secondary/95 backdrop-blur-xl border border-theme-strong rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-xs text-steel-400 font-mono mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-steel-300">{entry.name}:</span>
          <span className="text-steel-50 font-mono font-bold">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

function ScannerStatus({ name, icon: Icon, status }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', status === 'online' ? 'bg-lime-500/15 text-lime-400' : 'bg-red-500/15 text-red-400')}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium text-steel-200">{name}</span>
      </div>
      <StatusBadge status={status} dot />
    </div>
  )
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [statsData, analyticsData] = await Promise.all([
        fetchAdminStats(),
        fetchAdminOverviewAnalytics().catch(() => null),
      ])
      setStats(statsData)
      setAnalytics(analyticsData)
    } catch (err) {
      console.error('Failed to load overview:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-white/[0.06] rounded-lg animate-pulse mb-2" />
            <div className="h-4 w-64 bg-white/[0.04] rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <p className="text-steel-400">Failed to load statistics</p>
        <button onClick={loadAll} className="btn-primary mt-4 text-sm">Retry</button>
      </div>
    )
  }

  const { users: uStats, pipelines: pStats, config, policy, reports } = stats
  const deployPassRate = pStats.total > 0 ? Math.round((pStats.deployable / pStats.total) * 100) : 0
  const failRate24h = pStats.total > 0 ? Math.round((pStats.failed / pStats.total) * 100) : 0

  const vulnDistribution = analytics?.vulnDistribution || [
    { name: 'Critical', value: analytics?.criticalCount || 0 },
    { name: 'High', value: analytics?.highCount || 0 },
    { name: 'Medium', value: analytics?.mediumCount || 0 },
    { name: 'Low', value: analytics?.lowCount || 0 },
  ]
  const vulnTrend = analytics?.vulnTrend || []
  const secretTrend = analytics?.secretTrend || []
  const deployTrend = analytics?.deployTrend || []
  const systemHealth = analytics?.systemHealth || {}

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-steel-50 mb-1">Admin Overview</h1>
          <p className="text-steel-400 text-sm">Platform health, security metrics & analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-steel-500 font-mono">Updated: {new Date().toLocaleTimeString()}</span>
          <button onClick={loadAll} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Users" value={uStats.total} icon={Users} accent="violet"
          trend={{ value: 12, direction: 'up', label: 'vs 7d' }} />
        <KpiCard label="Active Repos" value={config.repo_url ? 1 : 0} icon={GitBranch} accent="blue" />
        <KpiCard label="Pipeline Runs" value={pStats.total} icon={Activity} accent="cyan"
          trend={{ value: 8, direction: 'up', label: '30d' }} />
        <KpiCard label="Deploy Pass Rate" value={deployPassRate} suffix="%" icon={CheckCircle}
          accent={deployPassRate >= 70 ? 'lime' : deployPassRate >= 40 ? 'amber' : 'red'}
          trend={{ value: 3, direction: deployPassRate >= 50 ? 'up' : 'down', label: 'vs prev' }} />
        <KpiCard label="Avg Security Score" value={pStats.avg_security_score} icon={Gauge}
          accent={pStats.avg_security_score >= 70 ? 'lime' : pStats.avg_security_score >= 40 ? 'amber' : 'red'}
          trend={{ value: 5, direction: 'up', label: 'avg' }} />
        <KpiCard label="Critical Vulns" value={analytics?.criticalCount || 0} icon={AlertTriangle}
          accent="red" trend={analytics?.criticalTrend || null} />
        <KpiCard label="Secrets Detected" value={analytics?.totalSecrets || 0} icon={KeyRound}
          accent="orange" trend={analytics?.secretsTrend || null} />
        <KpiCard label="Failed Pipelines" value={pStats.failed} icon={XCircle} accent="red"
          trend={{ value: failRate24h, direction: pStats.failed > 0 ? 'up' : 'flat', label: '24h' }} />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Vulnerability Distribution */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-steel-50 flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-red-400" /> Vulnerability Distribution
          </h3>
          {vulnDistribution.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={vulnDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                  paddingAngle={4} dataKey="value" stroke="none">
                  {vulnDistribution.map((_, idx) => (
                    <Cell key={idx} fill={Object.values(SEVERITY_COLORS)[idx] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend verticalAlign="bottom" formatter={(val) => <span className="text-xs text-steel-300 font-mono">{val}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-steel-500 text-sm">No vulnerability data — run a scan first</div>
          )}
        </div>

        {/* Vulnerability Trend */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-steel-50 flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-violet-400" /> Vulnerability Trend (30d)
          </h3>
          {vulnTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={vulnTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend formatter={(val) => <span className="text-xs text-steel-300 font-mono">{val}</span>} />
                <Line type="monotone" dataKey="SAST" stroke={SCANNER_COLORS.SAST} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Trivy" stroke={SCANNER_COLORS.Trivy} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="DAST" stroke={SCANNER_COLORS.DAST} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-steel-500 text-sm">Trend data appears after multiple scans</div>
          )}
        </div>

        {/* Secret Detection */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-steel-50 flex items-center gap-2 mb-4">
            <KeyRound className="w-5 h-5 text-orange-400" /> Secret Detection Trend
          </h3>
          {secretTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={secretTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="secrets" fill="#f97316" radius={[4, 4, 0, 0]} name="Secrets" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-steel-500 text-sm">No secret detection data yet</div>
          )}
        </div>

        {/* Deployment Decisions */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-steel-50 flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-lime-400" /> Deployment Decisions
          </h3>
          {deployTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={deployTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend formatter={(val) => <span className="text-xs text-steel-300 font-mono">{val}</span>} />
                <Area type="monotone" dataKey="passed" stackId="1" stroke={DEPLOY_COLORS.passed} fill={DEPLOY_COLORS.passed} fillOpacity={0.2} name="Passed" />
                <Area type="monotone" dataKey="blocked" stackId="1" stroke={DEPLOY_COLORS.blocked} fill={DEPLOY_COLORS.blocked} fillOpacity={0.2} name="Blocked" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <div className="grid grid-cols-2 gap-6 w-full">
                <div className="text-center p-6 bg-lime-500/5 rounded-xl border border-lime-500/20">
                  <p className="text-4xl font-black text-lime-400 font-mono">{pStats.deployable}</p>
                  <p className="text-xs text-steel-400 mt-2 uppercase font-semibold tracking-wider">Approved</p>
                </div>
                <div className="text-center p-6 bg-red-500/5 rounded-xl border border-red-500/20">
                  <p className="text-4xl font-black text-red-400 font-mono">{pStats.blocked}</p>
                  <p className="text-xs text-steel-400 mt-2 uppercase font-semibold tracking-wider">Blocked</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* System Health */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.06]">
          <h3 className="text-lg font-semibold text-steel-50 flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" /> System Health
          </h3>
          <StatusBadge status={systemHealth.overallStatus || 'online'} dot size="sm">
            {(systemHealth.overallStatus || 'online') === 'online' ? 'All Systems Operational' : 'Degraded'}
          </StatusBadge>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs font-bold text-steel-400 uppercase tracking-wider mb-3 font-mono">Scanner Availability</h4>
            <div className="space-y-2">
              <ScannerStatus name="Bandit (Python SAST)" icon={FileCode} status={systemHealth.bandit || 'online'} />
              <ScannerStatus name="Semgrep (Multi-lang)" icon={FileCode} status={systemHealth.semgrep || 'online'} />
              <ScannerStatus name="Trivy (Container)" icon={Container} status={systemHealth.trivy || 'online'} />
              <ScannerStatus name="ZAP (DAST)" icon={Globe} status={systemHealth.zap || 'online'} />
              <ScannerStatus name="Gitleaks (Secrets)" icon={KeyRound} status={systemHealth.gitleaks || 'online'} />
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-steel-400 uppercase tracking-wider mb-3 font-mono">Infrastructure</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/15 text-blue-400"><Container className="w-4 h-4" /></div>
                  <span className="text-sm text-steel-200">Docker Daemon</span>
                </div>
                <StatusBadge status={systemHealth.docker || 'online'} dot />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400"><Wifi className="w-4 h-4" /></div>
                  <div>
                    <span className="text-sm text-steel-200 block">Last Webhook</span>
                    <span className="text-xs text-steel-500 font-mono">{systemHealth.lastWebhook || 'No events received'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/15 text-violet-400"><Activity className="w-4 h-4" /></div>
                  <div>
                    <span className="text-sm text-steel-200 block">API Latency</span>
                    <span className="text-xs text-steel-500 font-mono">{systemHealth.apiLatency || '< 100ms'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400"><Clock className="w-4 h-4" /></div>
                  <div>
                    <span className="text-sm text-steel-200 block">Job Queue</span>
                    <span className="text-xs text-steel-500 font-mono">{pStats.running} running • {systemHealth.queuedJobs || 0} queued</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-white/[0.06]">
          <h4 className="text-xs font-bold text-steel-400 uppercase tracking-wider mb-3 font-mono">Report Availability</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(reports).map(([key, available]) => (
              <StatusBadge key={key} status={available ? 'active' : 'offline'}>
                {available ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                {key}
              </StatusBadge>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Info Panels */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-steel-400 uppercase tracking-wider mb-4 font-mono">User Distribution</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-violet-500/5 rounded-xl border border-violet-500/20">
              <p className="text-2xl font-black text-violet-400 font-mono">{uStats.admins}</p>
              <p className="text-[10px] text-steel-400 mt-1 uppercase font-semibold tracking-wider">Admin</p>
            </div>
            <div className="text-center p-3 bg-blue-500/5 rounded-xl border border-blue-500/20">
              <p className="text-2xl font-black text-blue-400 font-mono">{uStats.users}</p>
              <p className="text-[10px] text-steel-400 mt-1 uppercase font-semibold tracking-wider">Users</p>
            </div>
            <div className="text-center p-3 bg-steel-500/5 rounded-xl border border-steel-500/20">
              <p className="text-2xl font-black text-steel-400 font-mono">{uStats.viewers}</p>
              <p className="text-[10px] text-steel-400 mt-1 uppercase font-semibold tracking-wider">Viewers</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-steel-400 uppercase tracking-wider mb-4 font-mono">Project Config</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-steel-500">Repository</span>
              <span className="text-xs text-steel-200 font-mono truncate max-w-[180px]">{config.repo_url || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-steel-500">Branch</span>
              <span className="text-xs text-steel-200 font-mono">{config.branch}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-steel-500">Auto Scan</span>
              <StatusBadge status={config.auto_scan ? 'active' : 'offline'} />
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-steel-400 uppercase tracking-wider mb-4 font-mono">Security Policy</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-steel-500">Min Score</span>
              <span className={cn('text-sm font-bold font-mono',
                policy.minScore >= 80 ? 'text-lime-400' : policy.minScore >= 60 ? 'text-amber-400' : 'text-red-400'
              )}>{policy.minScore}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-steel-500">Block Critical</span>
              <StatusBadge status={policy.blockCritical ? 'active' : 'offline'} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-steel-500">Auto Block</span>
              <StatusBadge status={policy.autoBlock ? 'active' : 'offline'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
