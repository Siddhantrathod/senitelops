import { AlertTriangle, X } from 'lucide-react'
import { cn } from '../../../utils/helpers'

export default function ConfirmationModal({ open, onClose, onConfirm, title, message, confirmText = 'Confirm', confirmVariant = 'danger', loading = false }) {
  if (!open) return null

  const variants = {
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
    primary: 'bg-violet-500 hover:bg-violet-600 text-white',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass-card p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-steel-400 hover:text-steel-50 transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4 mb-6">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-steel-50">{title}</h3>
            <p className="text-sm text-steel-400 mt-1">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="btn-secondary px-4 py-2 text-sm"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50', variants[confirmVariant])}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
