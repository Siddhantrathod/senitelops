import { cn } from '../../../utils/helpers'

export default function SettingsCard({ title, description, icon: Icon, children, className, actions }) {
  return (
    <div className={cn('glass-card p-6', className)}>
      {(title || Icon) && (
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-theme-subtle">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <Icon className="w-5 h-5 text-violet-400" />
              </div>
            )}
            <div>
              {title && <h3 className="text-lg font-semibold text-steel-50">{title}</h3>}
              {description && <p className="text-steel-500 text-sm mt-0.5">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
