import { cn } from '../../utils/helpers'

export function SkeletonLine({ className }) {
  return (
    <div className={cn('h-4 bg-white/[0.06] rounded-lg animate-pulse', className)} />
  )
}

export function SkeletonCard({ className }) {
  return (
    <div className={cn('rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3', className)}>
      <div className="flex justify-between">
        <SkeletonLine className="w-24 h-3" />
        <SkeletonLine className="w-8 h-8 rounded-lg" />
      </div>
      <SkeletonLine className="w-20 h-7" />
      <SkeletonLine className="w-16 h-3" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4, className }) {
  return (
    <div className={cn('glass-card overflow-hidden', className)}>
      <div className="border-b border-white/[0.06] px-5 py-3 flex gap-8">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} className="w-20 h-3" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-5 py-4 flex gap-8 border-b border-white/[0.04]">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} className={cn('h-4', c === 0 ? 'w-32' : 'w-20')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart({ className }) {
  return (
    <div className={cn('glass-card p-6 space-y-4', className)}>
      <div className="flex justify-between items-center">
        <SkeletonLine className="w-40 h-5" />
        <SkeletonLine className="w-20 h-4" />
      </div>
      <div className="h-64 bg-white/[0.03] rounded-xl animate-pulse flex items-end gap-2 p-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-white/[0.06] rounded-t"
            style={{ height: `${20 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  )
}
