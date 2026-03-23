import { createContext, useContext, useState, useEffect } from 'react'
import { applyAppearancePrefs, getStoredAppearance } from '../utils/appearance'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const mode = localStorage.getItem('sentinelops-theme-mode')
    if (mode === 'light' || mode === 'dark' || mode === 'system') return mode
    const stored = localStorage.getItem('sentinelops-theme')
    if (stored === 'light' || stored === 'dark') return stored
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
    return 'dark'
  })

  useEffect(() => {
    const stored = getStoredAppearance()
    applyAppearancePrefs({ ...stored, theme })
  }, [theme])

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const mode = localStorage.getItem('sentinelops-theme-mode')
      if (mode === 'system') {
        applyAppearancePrefs({ theme: 'system' })
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggleTheme = () => {
    setTheme(prev => {
      const current = prev === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : prev
      return current === 'dark' ? 'light' : 'dark'
    })
  }

  const effectiveTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme
  const isDark = effectiveTheme === 'dark'

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setThemeMode: setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
