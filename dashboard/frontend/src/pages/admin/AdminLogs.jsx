import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  FileText, Search, Filter, RefreshCw, ChevronDown, ChevronUp,
  Download, Clock, Shield, Users, GitBranch, AlertTriangle,
  CheckCircle, Info, Terminal, Globe,
} from 'lucide-react'
import { cn } from '../../utils/helpers'
import { StatusBadge, DataTable, KpiCard, SkeletonTable } from '../../components/admin'
import { fetchAdminPipelines, fetchAdminUsers, fetchAdminStats } from '../../services/api'

const LOG_TYPES = {
  pipeline: { label: 'Pipeline', icon: GitBranch, color: 'text-violet-400' },
  auth: { label: 'Auth', icon: Users, color: 'text-blue-400' },
  security: { label: 'Security', icon: Shield, color: 'text-red-400' },
  system: { label: 'System', icon: Terminal, color: 'text-cyan-400' },
}

const SEVERITY_STYLES = {
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  error: 'bg-red-500/10 border-red-500/20 text-red-400',
  success: 'bg-lime-500/10 border-lime-500/20 text-lime-400',
}

export default function AdminLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [expandedLog, setExpandedLog] = useState(null)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const [pipelines, users, stats] = await Promise.all([
        fetchAdminPipelines(100).catch(() => []),
        fetchAdminUsers().catch(() => []),
        fetchAdminStats().catch(() => ({})),
      ])

      // Generate logs from pipeline data
      const pipelineLogs = (pipelines || []).map(p => ({
        id: `pl-${p.pipeline_id}`,
        type: 'pipeline',
        severity: p.status === 'failed' ? 'error' : p.status === 'success' ? 'success' : 'info',
        message: `Pipeline ${p.pipeline_id?.slice(0, 8)} ${p.status} — Score: ${p.security_score ?? '—'}, Decision: ${p.decision || '—'}`,
        timestamp: p.timestamp || new Date().toISOString(),
        details: {
          pipeline_id: p.pipeline_id,
          status: p.status,
          security_score: p.security_score,
          decision: p.decision,
          scanners: p.scanners_run?.join(', ') || '—',
          trigger: p.trigger || 'manual',
          failure_reason: p.failure_reason || null,
        },
      }))

      // Generate auth logs from user creation
      const authLogs = (users || []).map(u => ({
        id: `auth-${u.id}`,
        type: 'auth',
        severity: 'info',
        message: `User "${u.username}" registered via ${u.auth_type || 'local'} as ${u.role}`,
        timestamp: u.created_at || new Date().toISOString(),
        details: {
          username: u.username,
          role: u.role,
          auth_type: u.auth_type || 'local',
          email: u.email || '—',
        },
      }))

      // System events
      const systemLogs = [
        {
          id: 'sys-1',
          type: 'system',
          severity: 'info',
          message: `Platform stats: ${stats.users?.total || 0} users, ${stats.pipelines?.total || 0} pipelines`,
          timestamp: new Date().toISOString(),
          details: {
            total_users: stats.users?.total,
            total_pipelines: stats.pipelines?.total,
            avg_score: stats.pipelines?.avg_security_score,
          },
        },
      ]

      const allLogs = [...pipelineLogs, ...authLogs, ...systemLogs]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

      setLogs(allLogs)
    } catch (err) {
      console.error('Failed to load logs:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadLogs() }, [loadLogs])

  // Filtered
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (typeFilter !== 'all' && l.type !== typeFilter) return false
      if (severityFilter !== 'all' && l.severity !== severityFilter) return false
      return true
    })
  }, [logs, typeFilter, severityFilter])

  // Stats
  const errorCount = logs.filter(l => l.severity === 'error').length
  const warningCount = logs.filter(l => l.severity === 'warning').length
  const todayCount = logs.filter(l => {
    const d = new Date(l.timestamp)
    const today = new Date()
    return d.toDateString() === today.toDateString()
  }).length

  const handleExport = () => {
    const csv = ['Timestamp,Type,Severity,Message']
    filteredLogs.forEach(l => {
      csv.push(`"${l.timestamp}","${l.type}","${l.severity}","${l.message.replace(/"/g, '""')}"`)
    })
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `senitelops-logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-white/[0.06] rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse"><div className="h-8 w-16 bg-white/[0.06] rounded" /></div>
          ))}
        </div>
        <SkeletonTable rows={10} cols={4} />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-steel-50 mb-1">System Logs</h1>
          <p className="text-steel-400 text-sm">Pipeline events, auth activity & system notifications</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={loadLogs} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Events" value={logs.length} icon={FileText} accent="violet" />
        <KpiCard label="Today" value={todayCount} icon={Clock} accent="blue" />
        <KpiCard label="Errors" value={errorCount} icon={AlertTriangle} accent="red" />
        <KpiCard label="Warnings" value={warningCount} icon={AlertTriangle} accent="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-steel-500" />
        <div className="flex items-center gap-1.5">
          {['all', ...Object.keys(LOG_TYPES)].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                typeFilter === t
                  ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
                  : 'border-white/[0.06] text-steel-400 hover:text-steel-200 hover:bg-white/[0.04]'
              )}>
              {t === 'all' ? 'All Types' : LOG_TYPES[t]?.label || t}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-white/[0.08]" />
        <div className="flex items-center gap-1.5">
          {['all', 'error', 'warning', 'success', 'info'].map(s => (
            <button key={s} onClick={() => setSeverityFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                severityFilter === s
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                  : 'border-white/[0.06] text-steel-400 hover:text-steel-200 hover:bg-white/[0.04]'
              )}>
              {s === 'all' ? 'All Levels' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Log Entries */}
      <div className="space-y-2">
        {filteredLogs.length === 0 && (
          <div className="glass-card p-12 text-center">
            <FileText className="w-12 h-12 text-steel-600 mx-auto mb-4" />
            <p className="text-steel-500 text-sm">No log entries match the current filters</p>
          </div>
        )}
        {filteredLogs.slice(0, 50).map(log => {
          const typeInfo = LOG_TYPES[log.type] || LOG_TYPES.system
          const Icon = typeInfo.icon
          const isExpanded = expandedLog === log.id

          return (
            <div key={log.id} className="glass-card overflow-hidden">
              <button
                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className={cn('p-2 rounded-lg', SEVERITY_STYLES[log.severity] || SEVERITY_STYLES.info)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-steel-200 truncate">{log.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-steel-500 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    <span className={cn('text-[10px] font-mono', typeInfo.color)}>{typeInfo.label}</span>
                  </div>
                </div>
                <StatusBadge status={log.severity === 'error' ? 'failed' : log.severity === 'warning' ? 'MEDIUM' : log.severity === 'success' ? 'success' : 'info'} size="sm" />
                {isExpanded ? <ChevronUp className="w-4 h-4 text-steel-500" /> : <ChevronDown className="w-4 h-4 text-steel-500" />}
              </button>

              {isExpanded && log.details && (
                <div className="px-4 pb-4 border-t border-white/[0.04]">
                  <div className="mt-3 p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                    <pre className="text-xs text-steel-300 font-mono whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {filteredLogs.length > 50 && (
          <p className="text-center text-xs text-steel-500 py-4">
            Showing 50 of {filteredLogs.length} entries — use filters or export to see all
          </p>
        )}
      </div>
    </div>
  )
}
