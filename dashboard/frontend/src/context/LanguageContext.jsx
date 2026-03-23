import { createContext, useContext, useMemo } from 'react'
import { useAuth } from './AuthContext'

const LanguageContext = createContext()

const TRANSLATIONS = {
  en: { dashboard: 'Dashboard', settings: 'Settings', pipelines: 'Pipelines', repositories: 'Repositories' },
  es: { dashboard: 'Panel', settings: 'Configuración', pipelines: 'Pipelines', repositories: 'Repositorios' },
  fr: { dashboard: 'Tableau de bord', settings: 'Paramètres', pipelines: 'Pipelines', repositories: 'Référentiels' },
  de: { dashboard: 'Dashboard', settings: 'Einstellungen', pipelines: 'Pipelines', repositories: 'Repositories' },
  ja: { dashboard: 'ダッシュボード', settings: '設定', pipelines: 'パイプライン', repositories: 'リポジトリ' },
  hi: { dashboard: 'डैशबोर्ड', settings: 'सेटिंग्स', pipelines: 'पाइपलाइन', repositories: 'रिपॉजिटरी' },
}

export function LanguageProvider({ children }) {
  const { user } = useAuth()
  
  const ctx = useMemo(() => {
    const lang = user?.language || 'en'
    const tz = user?.timezone || 'UTC'
    
    return {
      t: (key) => TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key] || key,
      language: lang,
      timezone: tz
    }
  }, [user])

  return (
    <LanguageContext.Provider value={ctx}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
