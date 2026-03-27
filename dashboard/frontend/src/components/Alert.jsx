import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react'
import { cn } from '../utils/helpers'

const variants = {
  error: {
    icon: XCircle,
    className: 'bg-gradient-to-r from-red-500/10 to-transparent border-red-500/30 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.1)]',
    iconBase: 'bg-red-500/20 text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    className: 'bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.1)]',
    iconBase: 'bg-amber-500/20 text-amber-400',
  },
  success: {
    icon: CheckCircle,
    className: 'bg-gradient-to-r from-lime-500/10 to-transparent border-lime-500/30 text-lime-400 shadow-[0_0_20px_rgba(132,204,22,0.1)]',
    iconBase: 'bg-lime-500/20 text-lime-400',
  },
  info: {
    icon: Info,
    className: 'bg-gradient-to-r from-cyan-500/10 to-transparent border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.1)]',
    iconBase: 'bg-cyan-500/20 text-cyan-400',
  },
}

export default function Alert({ variant = 'info', title, children, className }) {
  const { icon: Icon, className: variantClass, iconBase } = variants[variant] || variants.info

  return (
    <div
      className={cn(
        'relative overflow-hidden flex items-start gap-4 p-5 rounded-2xl border',
        variantClass,
        className
      )}
    >
      <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-white/5 to-transparent pointer-events-none" />
      <div className={cn('p-2 rounded-xl flex-shrink-0', iconBase)}>
        <Icon className="w-5 h-5 flex-shrink-0" />
      </div>
      <div className="z-10">
        {title && <h4 className="font-bold text-lg mb-1 tracking-wide">{title}</h4>}
        <div className="text-sm font-medium opacity-90 leading-relaxed text-white/80">{children}</div>
      </div>
    </div>
  )
}
