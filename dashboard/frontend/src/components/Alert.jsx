import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react'
import { cn } from '../utils/helpers'

const variants = {
  error: {
    icon: XCircle,
    className: 'bg-red-500/10 border-red-500/30 text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    className: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  },
  success: {
    icon: CheckCircle,
    className: 'bg-green-500/10 border-green-500/30 text-green-400',
  },
  info: {
    icon: Info,
    className: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  },
}

export default function Alert({ variant = 'info', title, children, className }) {
  const { icon: Icon, className: variantClass } = variants[variant]

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border',
        variantClass,
        className
      )}
    >
      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <div>
        {title && <p className="font-semibold mb-1">{title}</p>}
        <div className="text-sm opacity-90">{children}</div>
      </div>
    </div>
  )
}
