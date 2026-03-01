export default function SettingsSkeleton() {
  const shimmer = 'animate-pulse bg-steel-600/20 dark:bg-white/[0.06] rounded-lg'

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-theme-subtle">
          <div className={`w-9 h-9 rounded-lg ${shimmer}`} />
          <div className="space-y-2">
            <div className={`h-5 w-40 ${shimmer}`} />
            <div className={`h-3 w-56 ${shimmer}`} />
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <div className={`h-4 w-24 ${shimmer}`} />
              <div className={`h-10 w-full ${shimmer}`} />
            </div>
          ))}
        </div>
      </div>
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-theme-subtle">
          <div className={`w-9 h-9 rounded-lg ${shimmer}`} />
          <div className={`h-5 w-36 ${shimmer}`} />
        </div>
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-theme-base border border-theme-subtle">
              <div className="space-y-2">
                <div className={`h-4 w-32 ${shimmer}`} />
                <div className={`h-3 w-48 ${shimmer}`} />
              </div>
              <div className={`w-11 h-6 rounded-full ${shimmer}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
