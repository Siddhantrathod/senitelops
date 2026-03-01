import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Bell,
  Search,
  GitBranch,
  Palette,
  Key,
  Wrench,
  ChevronRight,
} from 'lucide-react'
import { cn } from '../../utils/helpers'
import { ProfileTab, SecurityTab, NotificationsTab, ScanPreferencesTab, GitIntegrationTab, AppearanceTab, ApiTokensTab, AdvancedTab } from './tabs'
import Toast, { useToast } from './components/Toast'

const TABS = [
  { id: 'profile', label: 'Profile', icon: User, desc: 'Personal details' },
  { id: 'security', label: 'Security', icon: Shield, desc: 'Password & sessions' },
  { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Alert preferences' },
  { id: 'scan-preferences', label: 'Scan Preferences', icon: Search, desc: 'Scanner config' },
  { id: 'git-integration', label: 'Git Integration', icon: GitBranch, desc: 'Webhooks & repos' },
  { id: 'appearance', label: 'Appearance', icon: Palette, desc: 'Theme & display' },
  { id: 'api-tokens', label: 'API Tokens', icon: Key, desc: 'Access management' },
  { id: 'advanced', label: 'Advanced', icon: Wrench, desc: 'Export & debug' },
]

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    TABS.some(t => t.id === tabFromUrl) ? tabFromUrl : 'profile'
  )
  const { toast, showToast, dismissToast } = useToast()

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setSearchParams({ tab: tabId })
  }

  const activeTabData = TABS.find(t => t.id === activeTab)

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'profile': return <ProfileTab showToast={showToast} />
      case 'security': return <SecurityTab showToast={showToast} />
      case 'notifications': return <NotificationsTab showToast={showToast} />
      case 'scan-preferences': return <ScanPreferencesTab showToast={showToast} />
      case 'git-integration': return <GitIntegrationTab showToast={showToast} />
      case 'appearance': return <AppearanceTab showToast={showToast} />
      case 'api-tokens': return <ApiTokensTab showToast={showToast} />
      case 'advanced': return <AdvancedTab showToast={showToast} />
      default: return <ProfileTab showToast={showToast} />
    }
  }, [activeTab, showToast])

  return (
    <div className="animate-fade-in min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <SettingsIcon className="w-8 h-8 text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-steel-50">Settings</h1>
            <p className="text-steel-500">
              Configure your SentinelOps workspace
              {activeTabData && <span className="text-steel-600"> · {activeTabData.label}</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Nav */}
          <div className="lg:w-72 flex-shrink-0">
            <nav className="glass-card p-2 sticky top-8">
              <div className="px-4 py-2 mb-1">
                <p className="text-[10px] font-semibold text-steel-500 uppercase tracking-[0.2em] font-mono">Configuration</p>
              </div>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all group',
                    activeTab === tab.id
                      ? 'bg-violet-500/10 border border-violet-500/20'
                      : 'hover:bg-theme-hover border border-transparent'
                  )}
                >
                  <tab.icon className={cn(
                    'w-5 h-5 flex-shrink-0',
                    activeTab === tab.id ? 'text-violet-400' : 'text-steel-500 group-hover:text-steel-300'
                  )} />
                  <div className="flex-1 min-w-0">
                    <span className={cn(
                      'block text-sm font-medium truncate',
                      activeTab === tab.id ? 'text-violet-400' : 'text-steel-300 group-hover:text-steel-100'
                    )}>
                      {tab.label}
                    </span>
                    <span className="block text-[11px] text-steel-600 truncate">{tab.desc}</span>
                  </div>
                  {activeTab === tab.id && (
                    <ChevronRight className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pb-10">
            {tabContent}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
