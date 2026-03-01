import { Sun, Moon, Monitor, Palette, BarChart3, Sparkles, RefreshCw, Save, RotateCcw } from 'lucide-react'
import { useTheme } from '../../../context/ThemeContext'
import { SettingsCard, FormField, ToggleSwitch, SettingsSkeleton } from '../components'
import { Select } from '../components/FormInputs'
import { useSettings } from '../hooks/useSettings'
import { fetchAppearancePrefs, updateAppearancePrefs } from '../services/settingsApi'
import { cn } from '../../../utils/helpers'

const DEFAULTS = {
  theme: 'dark',
  density: 'comfortable',
  chartStyle: 'default',
  animations: true,
  autoRefreshInterval: 30,
}

const THEME_OPTIONS = [
  { key: 'light', label: 'Light', icon: Sun, desc: 'Clean light interface' },
  { key: 'dark', label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
  { key: 'system', label: 'System', icon: Monitor, desc: 'Match OS preference' },
]

const DENSITY_OPTIONS = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
]

const CHART_STYLES = [
  { value: 'default', label: 'Default' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'vibrant', label: 'Vibrant' },
]

const REFRESH_OPTIONS = [
  { value: 10, label: '10 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '60 seconds' },
  { value: 0, label: 'Manual only' },
]

export default function AppearanceTab({ showToast }) {
  const { theme: currentTheme, toggleTheme, isDark } = useTheme()
  const { data, loading, saving, dirty, update, save, reset } = useSettings(
    fetchAppearancePrefs, updateAppearancePrefs, { ...DEFAULTS, theme: currentTheme }
  )

  const handleThemeChange = (newTheme) => {
    update('theme', newTheme)
    // Apply immediately for instant feedback
    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', prefersDark)
      localStorage.removeItem('sentinelops-theme')
    } else {
      document.documentElement.classList.toggle('dark', newTheme === 'dark')
      localStorage.setItem('sentinelops-theme', newTheme)
    }
  }

  const handleSave = async () => {
    const result = await save()
    showToast(result.success ? 'Appearance preferences saved' : result.error, result.success ? 'success' : 'error')
  }

  if (loading) return <SettingsSkeleton />

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <SettingsCard title="Theme" icon={Palette} description="Choose your preferred color scheme">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEME_OPTIONS.map(opt => {
            const isActive = data.theme === opt.key
            return (
              <button
                key={opt.key}
                onClick={() => handleThemeChange(opt.key)}
                className={cn(
                  'flex flex-col items-center gap-3 p-5 rounded-xl border transition-all text-center',
                  isActive
                    ? 'bg-violet-500/10 border-violet-500/30 ring-1 ring-violet-500/20'
                    : 'bg-theme-base border-theme-subtle hover:bg-theme-hover hover:border-theme'
                )}
              >
                <div className={cn(
                  'p-3 rounded-xl',
                  isActive ? 'bg-violet-500/15' : 'bg-theme-accent'
                )}>
                  <opt.icon className={cn('w-6 h-6', isActive ? 'text-violet-400' : 'text-steel-400')} />
                </div>
                <div>
                  <p className={cn('text-sm font-medium', isActive ? 'text-violet-400' : 'text-steel-200')}>{opt.label}</p>
                  <p className="text-xs text-steel-500 mt-0.5">{opt.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
      </SettingsCard>

      {/* Display Options */}
      <SettingsCard title="Display Options" icon={BarChart3} description="Customize dashboard layout and density">
        <div className="space-y-5">
          <FormField label="Dashboard Density" hint="Controls spacing between UI elements">
            <Select
              value={data.density}
              onChange={(e) => update('density', e.target.value)}
              options={DENSITY_OPTIONS}
            />
          </FormField>

          <FormField label="Chart Style" hint="Visual style for dashboard charts">
            <Select
              value={data.chartStyle}
              onChange={(e) => update('chartStyle', e.target.value)}
              options={CHART_STYLES}
            />
          </FormField>

          <div className="flex items-center justify-between p-4 rounded-xl bg-theme-base border border-theme-subtle">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Sparkles className="w-4 h-4 text-pink-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-steel-100">Animations</p>
                <p className="text-xs text-steel-500">Enable transition effects and micro-animations</p>
              </div>
            </div>
            <ToggleSwitch checked={data.animations} onChange={(val) => update('animations', val)} />
          </div>

          <FormField label="Auto-Refresh Interval" hint="How often dashboard data refreshes automatically">
            <div className="relative">
              <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-500 z-10" />
              <Select
                value={data.autoRefreshInterval}
                onChange={(e) => update('autoRefreshInterval', Number(e.target.value))}
                options={REFRESH_OPTIONS}
                className="pl-10"
              />
            </div>
          </FormField>
        </div>
      </SettingsCard>

      {/* Save / Cancel */}
      <div className="flex items-center justify-end gap-3">
        <button onClick={reset} disabled={!dirty || saving}
          className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-40">
          <RotateCcw className="w-4 h-4" /> Discard
        </button>
        <button onClick={handleSave} disabled={!dirty || saving}
          className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}
