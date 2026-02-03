import { cn } from '../utils/helpers'

export default function LoadingSpinner({ size = 'md', className }) {
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-2 border-dark-700 border-t-primary-500',
          sizes[size]
        )}
      />
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <LoadingSpinner size="lg" />
      <p className="text-dark-400 text-sm animate-pulse">Loading security data...</p>
    </div>
  )
}

export function CardLoader() {
  return (
    <div className="glass-card p-6 animate-pulse">
      <div className="h-4 bg-dark-700 rounded w-1/3 mb-4" />
      <div className="h-8 bg-dark-700 rounded w-1/2 mb-2" />
      <div className="h-3 bg-dark-700 rounded w-1/4" />
    </div>
  )
}
