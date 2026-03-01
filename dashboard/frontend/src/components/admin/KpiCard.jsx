import { cn } from '../../utils/helpers'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const accentMap = {
  violet: {
    card: 'from-violet-500/10 to-violet-500/5 border-violet-500/20',
    icon: 'bg-violet-500/15 text-violet-400',
    value: 'text-violet-400',
  },
  lime: {
    card: 'from-lime-500/10 to-lime-500/5 border-lime-500/20',
    icon: 'bg-lime-500/15 text-lime-400',
    value: 'text-lime-400',
  },
  red: {
    card: 'from-red-500/10 to-red-500/5 border-red-500/20',
    icon: 'bg-red-500/15 text-red-400',
    value: 'text-red-400',
  },
  amber: {
    card: 'from-amber-500/10 to-amber-500/5 border-amber-500/20',
    icon: 'bg-amber-500/15 text-amber-400',
    value: 'text-amber-400',
  },
  blue: {
    card: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
    icon: 'bg-blue-500/15 text-blue-400',
    value: 'text-blue-400',
  },
  cyan: {
    card: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/20',
    icon: 'bg-cyan-500/15 text-cyan-400',
    value: 'text-cyan-400',
  },
  orange: {
    card: 'from-orange-500/10 to-orange-500/5 border-orange-500/20',
    icon: 'bg-orange-500/15 text-orange-400',
    value: 'text-orange-400',
  },
}

export default function KpiCard({
  label,
  value,
  icon: Icon,
  accent = 'violet',
  trend = null,     // { value: 12, direction: 'up' | 'down' | 'flat', label: 'vs last 7d' }
  suffix = '',
  className,
}) {
  const colors = accentMap[accent] || accentMap.violet

  const TrendIcon = trend?.direction === 'up' ? TrendingUp
    : trend?.direction === 'down' ? TrendingDown
    : Minus

  const trendColor = trend?.direction === 'up' ? 'text-lime-400'
    : trend?.direction === 'down' ? 'text-red-400'
    : 'text-steel-500'

  return (
    <div className={cn(
      'rounded-xl border bg-gradient-to-br p-4 transition-all duration-300 hover:shadow-lg hover:shadow-black/10',
      colors.card,
      className
    )}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-steel-400 font-mono leading-tight">
          {label}
        </span>
        <div className={cn('p-1.5 rounded-lg', colors.icon)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <p className="text-2xl font-black font-mono text-steel-50 mb-1">
        {value}{suffix}
      </p>

      {trend && (
        <div className="flex items-center gap-1.5 mt-2">
          <TrendIcon className={cn('w-3.5 h-3.5', trendColor)} />
          <span className={cn('text-xs font-bold font-mono', trendColor)}>
            {trend.direction === 'up' ? '+' : trend.direction === 'down' ? '-' : ''}{trend.value}%
          </span>
          {trend.label && (
            <span className="text-[10px] text-steel-500 font-mono">{trend.label}</span>
          )}
        </div>
      )}
    </div>
  )
}
