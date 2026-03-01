import { cn } from '../utils/helpers'

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendDirection = 'up',
  className,
  gradient = 'primary',
}) {
  const gradients = {
    primary: 'from-violet-500 to-violet-400',
    danger: 'from-red-500 to-red-400',
    warning: 'from-amber-500 to-orange-400',
    success: 'from-lime-500 to-lime-400',
    purple: 'from-purple-500 to-violet-400',
  }

  const glowColors = {
    primary: 'shadow-glow-sm',
    danger: 'shadow-glow-red',
    warning: 'shadow-glow-amber',
    success: 'shadow-glow-lime',
    purple: '0 0 20px rgba(168,85,247,0.15)',
  }

  const iconBg = {
    primary: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    success: 'bg-lime-500/10 text-lime-400 border border-lime-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  }

  return (
    <div
      className={cn('stat-card group', className)}
    >
      {/* Top accent line */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-px bg-gradient-to-r',
          gradients[gradient]
        )}
      />

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-steel-400 text-sm font-medium mb-1">{title}</p>
          <div className="flex items-center gap-2">
            <h3 className="text-3xl font-bold text-steel-50 tracking-tight font-mono data-readout">{value}</h3>
          </div>
          {subtitle && (
            <p className="text-steel-500 text-xs mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              'flex items-center gap-1 mt-3 text-xs font-semibold px-2 py-1 rounded-full w-fit border',
              trendDirection === 'up'
                ? 'bg-lime-500/10 text-lime-400 border-lime-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            )}>
              <span>{trendDirection === 'up' ? '↑' : '↓'}</span>
              <span>{trend}</span>
              <span className="font-normal text-steel-500 ml-1">vs last scan</span>
            </div>
          )}
        </div>

        {Icon && (
          <div className={cn(
            'p-3 rounded-xl transition-transform group-hover:scale-110',
            iconBg[gradient]
          )}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  )
}
