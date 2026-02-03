import { cn } from '../utils/helpers'

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendDirection = 'up',
  gradient = 'primary',
  className,
}) {
  const gradients = {
    primary: 'from-primary-500 to-primary-600',
    danger: 'from-red-500 to-red-600',
    warning: 'from-yellow-500 to-orange-500',
    success: 'from-green-500 to-emerald-600',
    purple: 'from-purple-500 to-violet-600',
  }

  const iconBg = {
    primary: 'bg-primary-500/20 text-primary-400',
    danger: 'bg-red-500/20 text-red-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    success: 'bg-green-500/20 text-green-400',
    purple: 'bg-purple-500/20 text-purple-400',
  }

  return (
    <div
      className={cn('stat-card group', className)}
      style={{
        '--card-gradient': `linear-gradient(135deg, var(--tw-gradient-stops))`,
      }}
    >
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r',
          gradients[gradient]
        )}
      />
      
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-dark-400 text-sm font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold text-white mb-1">{value}</p>
          {subtitle && (
            <p className="text-dark-500 text-sm">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              'flex items-center gap-1 mt-2 text-sm font-medium',
              trendDirection === 'up' ? 'text-red-400' : 'text-green-400'
            )}>
              <span>{trendDirection === 'up' ? '↑' : '↓'}</span>
              <span>{trend}</span>
              <span className="text-dark-500 font-normal">vs last scan</span>
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
