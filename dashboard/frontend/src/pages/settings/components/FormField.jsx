import { cn } from '../../../utils/helpers'

export default function FormField({
  label,
  hint,
  error,
  required,
  children,
  className,
  horizontal = false,
}) {
  return (
    <div className={cn(horizontal ? 'flex items-center justify-between gap-4' : 'space-y-1.5', className)}>
      <div className={horizontal ? 'flex-1' : ''}>
        {label && (
          <label className="block text-sm font-medium text-steel-200">
            {label}
            {required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}
        {hint && <p className="text-xs text-steel-500 mt-0.5">{hint}</p>}
      </div>
      <div className={horizontal ? 'flex-shrink-0' : ''}>
        {children}
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}
