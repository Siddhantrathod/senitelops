import { X } from 'lucide-react'
import { cn } from '../../utils/helpers'

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  danger = false,
}) {
  if (!open) return null

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className={cn(
          'w-full bg-surface-secondary border rounded-2xl shadow-2xl',
          danger ? 'border-red-500/20' : 'border-theme-strong',
          sizeClass[size] || sizeClass.md
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center justify-between px-6 py-4 border-b',
          danger ? 'border-red-500/20' : 'border-theme'
        )}>
          <div>
            <h3 className={cn('text-lg font-bold', danger ? 'text-red-400' : 'text-steel-50')}>
              {title}
            </h3>
            {description && (
              <p className="text-sm text-steel-400 mt-0.5">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-steel-500 hover:text-steel-50 hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-theme">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
