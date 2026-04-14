import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  FileText, Search, Filter, RefreshCw, ChevronDown, ChevronUp,
  Download, Clock, Shield, Users, GitBranch, AlertTriangle,
  CheckCircle, Info, Terminal, Globe,
} from 'lucide-react'
import { cn } from '../../utils/helpers'
import { StatusBadge, DataTable, KpiCard, SkeletonTable } from '../../components/admin'
import { fetchSystemLogs } from '../../services/api'

const LOG_TYPES = {
  pipeline: { label: 'Pipeline', icon: GitBranch, color: 'text-emerald-400' },
  auth: { label: 'Auth', icon: Users, color: 'text-emerald-400' },
  security: { label: 'Security', icon: Shield, color: 'text-red-400' },
  system: { label: 'System', icon: Terminal, color: 'text-cyan-400' },
}

const SEVERITY_STYLES = {
  info: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  error: 'bg-red-500/10 border-red-500/20 text-red-400',
  success: 'bg-lime-500/10 border-lime-500/20 text-lime-400',
}

export default function AdminLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedLog, setExpandedLog] = useState(null)
  const [total, setTotal] = useState(0)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const { logs: fetchedLogs, total: fetchedTotal } = await fetchSystemLogs({
        level: severityFilter,
        search,
        limit: 100,
        offset: 0,
        sort: 'desc',
      })
      setLogs(fetchedLogs)
      setTotal(fetchedTotal)
    } catch (err) {
      console.error('Failed to load logs:', err)
    }
    setLoading(false)
  }, [severityFilter, search])

  useEffect(() => { loadLogs() }, [loadLogs])

  // Filtered
  const filteredLogs = logs

  // Stats
  const errorCount = logs.filter(l => l.level === 'error').length
  const warningCount = logs.filter(l => l.level === 'warning').length
  const todayCount = logs.filter(l => {
    const d = new Date(l.created_at)
    const today = new Date()
    return d.toDateString() === today.toDateString()
  }).length

  const handleExport = () => {
    const csv = ['Timestamp,Level,Source,Message,Metadata']
    filteredLogs.forEach(l => {
      csv.push(`"${l.created_at}","${l.level}","${l.source}","${l.message.replace(/"/g, '""')}","${JSON.stringify(l.metadata).replace(/"/g, '""')}"`)
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
          <h1 className="text-3xl font-extrabold text-emerald-400 drop-shadow mb-1 animate-pulse">System Logs</h1>
          <p className="text-steel-400 text-sm">Live platform events, errors, and notifications</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-black/30 text-steel-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition-all shadow-inner"
            style={{ minWidth: 180 }}
          />
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={loadLogs} className="btn-secondary flex items-center gap-2 text-sm animate-spin-once">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Events" value={total} icon={FileText} accent="blue" />
        <KpiCard label="Today" value={todayCount} icon={Clock} accent="blue" />
        <KpiCard label="Errors" value={errorCount} icon={AlertTriangle} accent="red" />
        <KpiCard label="Warnings" value={warningCount} icon={AlertTriangle} accent="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-steel-500" />
        <div className="flex items-center gap-1.5">
          {['all', 'error', 'warning', 'info', 'success'].map(s => (
            <button key={s} onClick={() => setSeverityFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                severityFilter === s
                  ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-emerald-500/30 text-emerald-400 shadow-lg'
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
          <div className="glass-card p-12 text-center animate-fade-in">
            <FileText className="w-12 h-12 text-cyan-600 mx-auto mb-4 animate-bounce" />
            <p className="text-cyan-400 text-base font-semibold">No log entries match the current filters</p>
          </div>
        )}
        {filteredLogs.slice(0, 50).map(log => {
          const isExpanded = expandedLog === log.id
          return (
            <div key={log.id} className={cn("glass-card overflow-hidden border-l-4 transition-all",
              log.level === 'error' ? 'border-red-500/80 shadow-lg shadow-red-900/10' :
              log.level === 'warning' ? 'border-amber-400/80 shadow-lg shadow-amber-900/10' :
              log.level === 'info' ? 'border-cyan-400/80 shadow-lg shadow-cyan-900/10' :
              'border-emerald-400/80 shadow-lg shadow-emerald-900/10')}
            >
              <button
                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors group"
              >
                <div className={cn('p-2 rounded-lg',
                  log.level === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  log.level === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  log.level === 'info' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20')}
                >
                  {log.level === 'error' && <AlertTriangle className="w-4 h-4 animate-pulse" />}
                  {log.level === 'warning' && <AlertTriangle className="w-4 h-4 animate-bounce" />}
                  {log.level === 'info' && <Info className="w-4 h-4 animate-spin-slow" />}
                  {log.level === 'success' && <CheckCircle className="w-4 h-4 animate-pulse" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-steel-200 truncate font-semibold group-hover:text-emerald-300 transition-colors">
                    {log.message}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-steel-500 font-mono">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                    <span className={cn('text-[10px] font-mono',
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warning' ? 'text-amber-400' :
                      log.level === 'info' ? 'text-cyan-400' :
                      'text-emerald-400')}>{log.level.toUpperCase()}</span>
                    {log.source && <span className="text-[10px] text-steel-500 font-mono">{log.source}</span>}
                  </div>
                </div>
                <StatusBadge status={log.level === 'error' ? 'failed' : log.level === 'warning' ? 'MEDIUM' : log.level === 'success' ? 'success' : 'info'} size="sm" />
                {isExpanded ? <ChevronUp className="w-4 h-4 text-steel-500" /> : <ChevronDown className="w-4 h-4 text-steel-500" />}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/[0.04] bg-white/[0.01] animate-fade-in">
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col p-3 rounded-xl bg-black/20 border border-white/[0.04] hover:border-white/[0.08] transition-colors group/prop">
                      <span className="text-[10px] font-black uppercase tracking-widest text-steel-500 mb-1 group-hover/prop:text-steel-400 transition-colors">
                        Source
                      </span>
                      <span className="text-xs font-mono text-steel-200 break-all">{log.source || '—'}</span>
                    </div>
                    <div className="flex flex-col p-3 rounded-xl bg-black/20 border border-white/[0.04] hover:border-white/[0.08] transition-colors group/prop">
                      <span className="text-[10px] font-black uppercase tracking-widest text-steel-500 mb-1 group-hover/prop:text-steel-400 transition-colors">
                        Metadata
                      </span>
                      <span className="text-xs font-mono text-steel-200 break-all">{JSON.stringify(log.metadata, null, 2)}</span>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(JSON.stringify({ ...log, exported_at: new Date().toISOString() }, null, 2));
                      }}
                      className="sm:col-span-2 mt-2 flex items-center justify-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-[10px] font-bold uppercase tracking-widest text-steel-500 hover:bg-white/[0.05] hover:text-steel-200 transition-all group/copy"
                    >
                      <Terminal className="w-3 h-3 group-hover/copy:text-cyan-400 transition-colors" />
                      Copy Raw Event Data
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {filteredLogs.length > 50 && (
          <p className="text-center text-xs text-cyan-400 py-4 animate-fade-in">
            Showing 50 of {filteredLogs.length} entries — use filters or export to see all
          </p>
        )}
      </div>
    </div>
  )
}
