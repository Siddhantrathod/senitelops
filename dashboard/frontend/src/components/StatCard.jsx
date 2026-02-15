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
    primary: 'from-primary-500 to-primary-600',
    danger: 'from-red-500 to-red-600',
    warning: 'from-yellow-500 to-orange-500',
    success: 'from-green-500 to-emerald-600',
    purple: 'from-purple-500 to-violet-600',
  }

  const iconBg = {
    primary: 'bg-primary-50 text-primary-600',
    danger: 'bg-red-50 text-red-600',
    warning: 'bg-yellow-50 text-yellow-600',
    success: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <div
      className={cn('stat-card group bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all', className)}
    >
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r',
          gradients[gradient]
        )}
      />

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
          <div className="flex items-center gap-2">
            <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{value}</h3>
          </div>
          {subtitle && (
            <p className="text-slate-400 text-xs mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              'flex items-center gap-1 mt-3 text-xs font-semibold px-2 py-1 rounded-full w-fit',
              trendDirection === 'up' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            )}>
              <span>{trendDirection === 'up' ? '↑' : '↓'}</span>
              <span>{trend}</span>
              <span className="font-normal text-slate-500 ml-1">vs last scan</span>
            </div>
          )}
        </div>

        {Icon && (
          <div className={cn(
            'p-3 rounded-xl transition-transform group-hover:scale-110 shadow-sm',
            iconBg[gradient]
          )}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  )
}
