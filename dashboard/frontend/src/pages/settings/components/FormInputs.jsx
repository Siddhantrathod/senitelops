import { cn } from '../../../utils/helpers'

const inputBase = 'w-full px-4 py-2.5 rounded-xl border text-sm font-mono outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed'
const inputTheme = 'bg-theme-input text-steel-50 border-theme placeholder-theme focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30'

export function TextInput({ className, ...props }) {
  return <input className={cn(inputBase, inputTheme, className)} {...props} />
}

export function TextArea({ className, rows = 4, ...props }) {
  return <textarea rows={rows} className={cn(inputBase, inputTheme, 'resize-none', className)} {...props} />
}

export function Select({ className, options = [], ...props }) {
  return (
    <select className={cn(inputBase, inputTheme, className)} {...props}>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}
