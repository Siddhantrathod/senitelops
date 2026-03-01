import { CheckCircle, XCircle, X, Info } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { cn } from '../../../utils/helpers'

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

const styles = {
  success: 'bg-lime-500/10 border-lime-500/20 text-lime-400',
  error: 'bg-red-500/10 border-red-500/20 text-red-400',
  info: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
}

export function useToast() {
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success', duration = 4000) => {
    setToast({ message, type })
    if (duration > 0) {
      setTimeout(() => setToast(null), duration)
    }
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  return { toast, showToast, dismissToast }
}

export default function Toast({ toast, onDismiss }) {
  if (!toast) return null

  const Icon = icons[toast.type] || icons.info

  return (
    <div className="fixed top-6 right-6 z-[60] animate-fade-in">
      <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-lg max-w-sm', styles[toast.type])}>
        <Icon className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm font-medium flex-1">{toast.message}</p>
        <button onClick={onDismiss} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
