export const DEFAULT_APPEARANCE = {
  theme: 'dark',
  density: 'comfortable',
  chartStyle: 'default',
  animations: true,
  autoRefreshInterval: 30,
}

const CHART_PALETTES = {
  default: {
    critical: '#ff3b5c',
    high: '#ff6b35',
    medium: '#ffb800',
    low: '#5ce60a',
    info: '#a855f7',
    primary: '#a855f7',
    secondary: '#22d3ee',
    success: '#00ff88',
  },
  minimal: {
    critical: '#f43f5e',
    high: '#fb7185',
    medium: '#f59e0b',
    low: '#84cc16',
    info: '#64748b',
    primary: '#64748b',
    secondary: '#94a3b8',
    success: '#10b981',
  },
  vibrant: {
    critical: '#ff1744',
    high: '#ff9100',
    medium: '#ffd600',
    low: '#76ff03',
    info: '#00e5ff',
    primary: '#7c3aed',
    secondary: '#00e5ff',
    success: '#00ff88',
  },
}

export function normalizeAppearancePrefs(prefs = {}) {
  return {
    ...DEFAULT_APPEARANCE,
    ...prefs,
    autoRefreshInterval: Number.isFinite(Number(prefs?.autoRefreshInterval))
      ? Number(prefs.autoRefreshInterval)
      : DEFAULT_APPEARANCE.autoRefreshInterval,
  }
}

export function getStoredAppearance() {
  return normalizeAppearancePrefs({
    theme: localStorage.getItem('sentinelops-theme-mode') || localStorage.getItem('sentinelops-theme') || 'dark',
    density: localStorage.getItem('sentinelops-density') || 'comfortable',
    chartStyle: localStorage.getItem('sentinelops-chart-style') || 'default',
    animations: localStorage.getItem('sentinelops-animations') !== 'false',
    autoRefreshInterval: Number(localStorage.getItem('sentinelops-auto-refresh') || 30),
  })
}

function resolveEffectiveTheme(themeMode) {
  if (themeMode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return themeMode === 'light' ? 'light' : 'dark'
}

export function applyAppearancePrefs(prefs = {}) {
  const merged = normalizeAppearancePrefs(prefs)
  const root = document.documentElement

  const themeMode = ['light', 'dark', 'system'].includes(merged.theme)
    ? merged.theme
    : 'dark'
  const effectiveTheme = resolveEffectiveTheme(themeMode)

  root.classList.toggle('dark', effectiveTheme === 'dark')
  root.classList.toggle('no-animations', !merged.animations)
  root.setAttribute('data-density', merged.density || 'comfortable')
  root.setAttribute('data-chart-style', merged.chartStyle || 'default')

  localStorage.setItem('sentinelops-theme-mode', themeMode)
  if (themeMode === 'system') {
    localStorage.removeItem('sentinelops-theme')
  } else {
    localStorage.setItem('sentinelops-theme', themeMode)
  }

  localStorage.setItem('sentinelops-density', merged.density || 'comfortable')
  localStorage.setItem('sentinelops-chart-style', merged.chartStyle || 'default')
  localStorage.setItem('sentinelops-animations', String(Boolean(merged.animations)))
  localStorage.setItem('sentinelops-auto-refresh', String(merged.autoRefreshInterval))

  window.dispatchEvent(new CustomEvent('sentinelops:appearance-updated', { detail: merged }))
  return merged
}

export function getChartPalette() {
  const style = localStorage.getItem('sentinelops-chart-style') || 'default'
  return CHART_PALETTES[style] || CHART_PALETTES.default
}

export function isAnimationsEnabled() {
  return localStorage.getItem('sentinelops-animations') !== 'false'
}

export function getAutoRefreshInterval(fallbackSeconds = 30) {
  const value = Number(localStorage.getItem('sentinelops-auto-refresh'))
  return Number.isFinite(value) && value >= 0 ? value : fallbackSeconds
}
