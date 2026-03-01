import { cn } from '../../utils/helpers'

const variants = {
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/25',
  HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  LOW: 'bg-green-500/15 text-green-400 border-green-500/25',
  INFO: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  success: 'bg-lime-500/15 text-lime-400 border-lime-500/25',
  failed: 'bg-red-500/15 text-red-400 border-red-500/25',
  running: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  queued: 'bg-steel-500/15 text-steel-400 border-steel-500/25',
  blocked: 'bg-red-500/15 text-red-400 border-red-500/25',
  passed: 'bg-lime-500/15 text-lime-400 border-lime-500/25',
  admin: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  user: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  viewer: 'bg-steel-500/15 text-steel-400 border-steel-500/25',
  active: 'bg-lime-500/15 text-lime-400 border-lime-500/25',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/25',
  online: 'bg-lime-500/15 text-lime-400 border-lime-500/25',
  offline: 'bg-steel-500/15 text-steel-400 border-steel-500/25',
  error: 'bg-red-500/15 text-red-400 border-red-500/25',
  warn: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  google: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  local: 'bg-steel-500/15 text-steel-400 border-steel-500/25',
  webhook: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  manual: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
}

export default function StatusBadge({ status, children, className, dot = false, size = 'sm' }) {
  const key = (status || '').toLowerCase?.() || status
  const variant = variants[status] || variants[key] || 'bg-steel-500/15 text-steel-400 border-steel-500/25'

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-full border',
      size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
      variant,
      className
    )}>
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full',
          key === 'online' || key === 'active' || key === 'success' || key === 'passed' ? 'bg-lime-400 animate-pulse' :
          key === 'running' ? 'bg-violet-400 animate-pulse' :
          key === 'offline' || key === 'error' || key === 'failed' ? 'bg-red-400' :
          'bg-steel-400'
        )} />
      )}
      {children || status}
    </span>
  )
}
