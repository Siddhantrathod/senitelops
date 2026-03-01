import { cn } from '../../../utils/helpers'

export default function ToggleSwitch({ checked, onChange, disabled = false, size = 'md' }) {
  const sizes = {
    sm: { track: 'w-9 h-5', thumb: 'h-4 w-4', translate: 'peer-checked:after:translate-x-4' },
    md: { track: 'w-11 h-6', thumb: 'h-5 w-5', translate: 'peer-checked:after:translate-x-full' },
    lg: { track: 'w-14 h-7', thumb: 'h-6 w-6', translate: 'peer-checked:after:translate-x-7' },
  }

  const s = sizes[size] || sizes.md

  return (
    <label className={cn('relative inline-flex items-center', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
        className="sr-only peer"
      />
      <div className={cn(
        s.track,
        'rounded-full peer transition-colors duration-200',
        'bg-steel-600/40 dark:bg-white/[0.12]',
        'peer-checked:bg-violet-500',
        `after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:${s.thumb} after:transition-all`,
        s.translate
      )} />
    </label>
  )
}
