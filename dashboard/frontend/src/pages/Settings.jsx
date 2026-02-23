import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Palette,
  Database,
  Save,
  RefreshCw,
  Lock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Gauge,
  GitBranch,
  Link as LinkIcon,
  FolderOpen,
  Image,
  User,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchPolicy, updatePolicy, evaluatePolicy, fetchConfig, updateConfig } from '../services/api'

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'personalization', label: 'Personalization', icon: Palette },
  { id: 'security', label: 'Security Policy', icon: Shield },
  { id: 'github', label: 'GitHub & Pipeline', icon: GitBranch },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

const inputClass = "w-full px-4 py-2.5 bg-white/[0.04] text-white rounded-xl border border-white/[0.08] outline-none text-sm font-mono focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 placeholder-steel-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
const toggleTrack = "w-11 h-6 bg-white/[0.12] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"

export default function Settings() {
  const { user, isAdmin, changePassword } = useAuth()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    TABS.some(t => t.id === tabFromUrl) ? tabFromUrl : 'profile'
  )

  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      slack: false,
      critical: true,
      high: true,
      medium: false,
      low: false,
    },
    scanning: {
      autoScan: true,
      scanInterval: '24',
      includeDev: false,
    },
    display: {
      theme: 'dark',
      compactView: false,
      showConfidence: true,
    },
  })

  const [policy, setPolicy] = useState({
    minScore: 70,
    blockCritical: true,
    blockHigh: false,
    maxCriticalVulns: 0,
    maxHighVulns: 5,
    autoBlock: true,
  })
  const [policyLoading, setPolicyLoading] = useState(true)
  const [policySaving, setPolicySaving] = useState(false)
  const [policyMessage, setPolicyMessage] = useState(null)

  const [evaluation, setEvaluation] = useState(null)
  const [evaluating, setEvaluating] = useState(false)

  const [pipelineConfig, setPipelineConfig] = useState({
    github_repo_url: '',
    github_branch: 'main',
    auto_scan_enabled: true,
    scan_on_push: true,
    target_image: 'sentinelops-app',
    target_directory: '',
  })
  const [configLoading, setConfigLoading] = useState(true)
  const [configSaving, setConfigSaving] = useState(false)
  const [configMessage, setConfigMessage] = useState(null)

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordMessage, setPasswordMessage] = useState(null)
  const [passwordLoading, setPasswordLoading] = useState(false)

  useEffect(() => {
    loadPolicy()
    loadConfig()
  }, [])

  const loadPolicy = async () => {
    try {
      setPolicyLoading(true)
      const data = await fetchPolicy()
      setPolicy(data)
    } catch (error) {
      console.error('Failed to load policy:', error)
    } finally {
      setPolicyLoading(false)
    }
  }

  const loadConfig = async () => {
    try {
      setConfigLoading(true)
      const data = await fetchConfig()
      setPipelineConfig(data)
    } catch (error) {
      console.error('Failed to load config:', error)
    } finally {
      setConfigLoading(false)
    }
  }

  const handleConfigSave = async () => {
    try {
      setConfigSaving(true)
      setConfigMessage(null)
      await updateConfig(pipelineConfig)
      setConfigMessage({ type: 'success', text: 'Pipeline configuration saved!' })
      setTimeout(() => setConfigMessage(null), 3000)
    } catch (error) {
      setConfigMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save configuration' })
    } finally {
      setConfigSaving(false)
    }
  }

  const handlePolicySave = async () => {
    try {
      setPolicySaving(true)
      setPolicyMessage(null)
      await updatePolicy(policy)
      setPolicyMessage({ type: 'success', text: 'Policy saved successfully!' })
      setTimeout(() => setPolicyMessage(null), 3000)
    } catch (error) {
      setPolicyMessage({ type: 'error', text: error.response?.data?.error || 'Failed to save policy' })
    } finally {
      setPolicySaving(false)
    }
  }

  const handleEvaluatePolicy = async () => {
    try {
      setEvaluating(true)
      const result = await evaluatePolicy()
      setEvaluation(result)
    } catch (error) {
      console.error('Failed to evaluate policy:', error)
    } finally {
      setEvaluating(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordMessage(null)

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' })
      return
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      return
    }

    setPasswordLoading(true)
    const result = await changePassword(passwordData.currentPassword, passwordData.newPassword)

    if (result.success) {
      setPasswordMessage({ type: 'success', text: 'Password changed successfully!' })
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } else {
      setPasswordMessage({ type: 'error', text: result.error })
    }
    setPasswordLoading(false)
  }

  const StatusMessage = ({ message }) => {
    if (!message) return null
    return (
      <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${
        message.type === 'success'
          ? 'bg-lime-500/10 border-lime-500/20 text-lime-400'
          : 'bg-red-500/10 border-red-500/20 text-red-400'
      }`}>
        {message.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
        <p className="font-medium">{message.text}</p>
      </div>
    )
  }

  const ProfileTab = () => (
    <div className="space-y-8">
      <div className="glass-card p-6">
        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/[0.06]">
          <div className="w-16 h-16 bg-violet-500/10 rounded-full flex items-center justify-center border border-violet-500/20">
            <User className="w-8 h-8 text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{user?.username || 'User'}</h2>
            <p className="text-steel-500 text-sm font-mono">{isAdmin() ? 'Administrator' : 'User'}</p>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/[0.06]">
          <Lock className="w-5 h-5 text-amber-400" />
          <h2 className="text-xl font-semibold text-white">Change Password</h2>
        </div>

        <StatusMessage message={passwordMessage} />

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-steel-300 font-medium mb-1.5 text-sm">Current Password</label>
            <input type="password" value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} className={inputClass} required />
          </div>
          <div>
            <label className="block text-steel-300 font-medium mb-1.5 text-sm">New Password</label>
            <input type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} className={inputClass} required />
          </div>
          <div>
            <label className="block text-steel-300 font-medium mb-1.5 text-sm">Confirm New Password</label>
            <input type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} className={inputClass} required />
          </div>
          <button type="submit" disabled={passwordLoading} className="btn-primary inline-flex items-center gap-2 mt-2">
            {passwordLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Change Password
          </button>
        </form>
      </div>
    </div>
  )

  const PersonalizationTab = () => (
    <div className="space-y-8">
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/[0.06]">
          <Palette className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-white">Display Options</h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-steel-300 font-medium mb-2 text-sm">Theme</label>
            <select
              value={settings.display.theme}
              onChange={(e) => setSettings({ ...settings, display: { ...settings.display, theme: e.target.value } })}
              className={inputClass}
            >
              <option value="dark">Dark Mode</option>
              <option value="light">Light Mode (Coming Soon)</option>
              <option value="system">System Default</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
            <div>
              <p className="text-white font-medium">Compact View</p>
              <p className="text-steel-500 text-sm">Show more items with less spacing</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.display.compactView} onChange={(e) => setSettings({ ...settings, display: { ...settings.display, compactView: e.target.checked } })} className="sr-only peer" />
              <div className={`${toggleTrack} peer-checked:bg-violet-500`}></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
            <div>
              <p className="text-white font-medium">Show Confidence Level</p>
              <p className="text-steel-500 text-sm">Display confidence badges on issues</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.display.showConfidence} onChange={(e) => setSettings({ ...settings, display: { ...settings.display, showConfidence: e.target.checked } })} className="sr-only peer" />
              <div className={`${toggleTrack} peer-checked:bg-violet-500`}></div>
            </label>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/[0.06]">
          <Database className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-semibold text-white">Data Management</h2>
        </div>

        <div className="space-y-4">
          <button className="btn-secondary inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Clear Cache
          </button>
          <p className="text-steel-500 text-sm">
            Clear locally cached scan results. New data will be fetched on next load.
          </p>
        </div>
      </div>
    </div>
  )

  const SecurityTab = () => (
    <div className="space-y-8">
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <Gauge className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-semibold text-white">Security Policy</h2>
          </div>
          {isAdmin() && (
            <button onClick={handlePolicySave} disabled={policySaving} className="btn-primary inline-flex items-center gap-2 text-sm">
              {policySaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Policy
            </button>
          )}
        </div>

        <StatusMessage message={policyMessage} />

        {policyLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="block text-white font-semibold mb-1">Minimum Security Score</label>
                  <p className="text-steel-500 text-sm">Deployments with scores below this threshold will be blocked</p>
                </div>
                <div className="w-16 text-center">
                  <span className={`text-2xl font-bold font-mono ${
                    policy.minScore >= 80 ? 'text-lime-400' :
                    policy.minScore >= 60 ? 'text-amber-400' :
                    policy.minScore >= 40 ? 'text-orange-400' : 'text-red-400'
                  }`}>
                    {policy.minScore}
                  </span>
                </div>
              </div>
              <input
                type="range" min="0" max="100" value={policy.minScore}
                onChange={(e) => setPolicy({ ...policy, minScore: parseInt(e.target.value) })}
                disabled={!isAdmin()}
                className="w-full h-2 bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div>
                  <p className="text-white font-medium">Block on Critical</p>
                  <p className="text-steel-500 text-sm">Block if any CRITICAL vulnerabilities</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={policy.blockCritical} onChange={(e) => setPolicy({ ...policy, blockCritical: e.target.checked })} disabled={!isAdmin()} className="sr-only peer" />
                  <div className={`${toggleTrack} peer-checked:bg-red-500`}></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div>
                  <p className="text-white font-medium">Block on High</p>
                  <p className="text-steel-500 text-sm">Block if HIGH vulnerabilities exceed limit</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={policy.blockHigh} onChange={(e) => setPolicy({ ...policy, blockHigh: e.target.checked })} disabled={!isAdmin()} className="sr-only peer" />
                  <div className={`${toggleTrack} peer-checked:bg-orange-500`}></div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-steel-300 font-medium mb-2 text-sm">Max Critical Vulnerabilities</label>
                <input type="number" min="0" max="100" value={policy.maxCriticalVulns} onChange={(e) => setPolicy({ ...policy, maxCriticalVulns: parseInt(e.target.value) || 0 })} disabled={!isAdmin()} className={inputClass} />
              </div>
              <div>
                <label className="block text-steel-300 font-medium mb-2 text-sm">Max High Vulnerabilities</label>
                <input type="number" min="0" max="100" value={policy.maxHighVulns} onChange={(e) => setPolicy({ ...policy, maxHighVulns: parseInt(e.target.value) || 0 })} disabled={!isAdmin()} className={inputClass} />
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-white/[0.06]">
              <div>
                <p className="text-white font-medium">Automatic Blocking</p>
                <p className="text-steel-500 text-sm">Automatically block deployments that violate policy</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={policy.autoBlock} onChange={(e) => setPolicy({ ...policy, autoBlock: e.target.checked })} disabled={!isAdmin()} className="sr-only peer" />
                <div className={`${toggleTrack} peer-checked:bg-violet-500`}></div>
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-lime-400" />
            <h2 className="text-xl font-semibold text-white">Policy Evaluation</h2>
          </div>
          <button onClick={handleEvaluatePolicy} disabled={evaluating} className="btn-secondary inline-flex items-center gap-2">
            {evaluating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Evaluate Now
          </button>
        </div>

        {evaluation ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl text-center">
                <p className="text-steel-500 text-[10px] uppercase tracking-[0.15em] font-mono mb-1">Security Score</p>
                <p className={`text-3xl font-bold font-mono ${
                  evaluation.score >= 80 ? 'text-lime-400' :
                  evaluation.score >= 60 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {evaluation.score}
                </p>
              </div>
              <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl text-center">
                <p className="text-steel-500 text-[10px] uppercase tracking-[0.15em] font-mono mb-1">Critical Vulns</p>
                <p className="text-3xl font-bold text-red-400 font-mono">{evaluation.criticalCount}</p>
              </div>
              <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl text-center">
                <p className="text-steel-500 text-[10px] uppercase tracking-[0.15em] font-mono mb-1">High Vulns</p>
                <p className="text-3xl font-bold text-orange-400 font-mono">{evaluation.highCount}</p>
              </div>
            </div>

            <div className={`p-4 rounded-xl flex items-center gap-3 border ${
              evaluation.deploymentAllowed
                ? 'bg-lime-500/10 border-lime-500/20'
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              {evaluation.deploymentAllowed ? (
                <>
                  <CheckCircle className="w-8 h-8 text-lime-400" />
                  <div>
                    <p className="text-lime-400 font-bold text-lg">Deployment Allowed</p>
                    <p className="text-lime-400/70 text-sm">All policy requirements are met</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-8 h-8 text-red-400" />
                  <div>
                    <p className="text-red-400 font-bold text-lg">Deployment Blocked</p>
                    <p className="text-red-400/70 text-sm">Policy violations detected</p>
                  </div>
                </>
              )}
            </div>

            {evaluation.violations && evaluation.violations.length > 0 && (
              <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.06]">
                <p className="text-white font-semibold mb-3">Detected Violations:</p>
                <div className="space-y-2">
                  {evaluation.violations.map((violation, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-2 rounded border border-red-500/20">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {violation}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.06] mb-3">
              <Shield className="w-6 h-6 text-steel-500" />
            </div>
            <p className="text-steel-500">
              Click "Evaluate Now" to check current security status against policy
            </p>
          </div>
        )}
      </div>
    </div>
  )

  const GitHubTab = () => (
    <div className="space-y-8">
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Repository Configuration</h2>
          </div>
          {isAdmin() && (
            <button onClick={handleConfigSave} disabled={configSaving} className="btn-primary inline-flex items-center gap-2 text-sm">
              {configSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Config
            </button>
          )}
        </div>

        <StatusMessage message={configMessage} />

        {configLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-steel-300 text-sm mb-2 flex items-center gap-2 font-medium">
                  <LinkIcon className="w-4 h-4" /> GitHub Repository URL
                </label>
                <input type="text" value={pipelineConfig.github_repo_url} onChange={(e) => setPipelineConfig({ ...pipelineConfig, github_repo_url: e.target.value })} placeholder="https://github.com/user/repo.git" disabled={!isAdmin()} className={inputClass} />
                <p className="text-steel-600 text-xs mt-1">Repository to monitor for pushes</p>
              </div>
              <div>
                <label className="block text-steel-300 text-sm mb-2 flex items-center gap-2 font-medium">
                  <GitBranch className="w-4 h-4" /> Branch
                </label>
                <input type="text" value={pipelineConfig.github_branch} onChange={(e) => setPipelineConfig({ ...pipelineConfig, github_branch: e.target.value })} placeholder="main" disabled={!isAdmin()} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-steel-300 text-sm mb-2 flex items-center gap-2 font-medium">
                  <Image className="w-4 h-4" /> Target Docker Image
                </label>
                <input type="text" value={pipelineConfig.target_image} onChange={(e) => setPipelineConfig({ ...pipelineConfig, target_image: e.target.value })} placeholder="sentinelops-app" disabled={!isAdmin()} className={inputClass} />
              </div>
              <div>
                <label className="block text-steel-300 text-sm mb-2 flex items-center gap-2 font-medium">
                  <FolderOpen className="w-4 h-4" /> Target Directory
                </label>
                <input type="text" value={pipelineConfig.target_directory} onChange={(e) => setPipelineConfig({ ...pipelineConfig, target_directory: e.target.value })} placeholder="./src" disabled={!isAdmin()} className={inputClass} />
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.06] space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div>
                  <p className="text-white font-medium">Auto Scan on Push</p>
                  <p className="text-steel-500 text-sm">Automatically trigger scans when code is pushed</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={pipelineConfig.scan_on_push} onChange={(e) => setPipelineConfig({ ...pipelineConfig, scan_on_push: e.target.checked })} disabled={!isAdmin()} className="sr-only peer" />
                  <div className={`${toggleTrack} peer-checked:bg-violet-500`}></div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/[0.06]">
          <Shield className="w-5 h-5 text-lime-400" />
          <h2 className="text-xl font-semibold text-white">Scanning Options</h2>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Automatic Scanning</p>
              <p className="text-steel-500 text-sm">Run scans automatically on schedule</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.scanning.autoScan} onChange={(e) => setSettings({ ...settings, scanning: { ...settings.scanning, autoScan: e.target.checked } })} className="sr-only peer" />
              <div className={`${toggleTrack} peer-checked:bg-violet-500`}></div>
            </label>
          </div>

          <div>
            <label className="block text-steel-300 font-medium mb-2 text-sm">Scan Interval</label>
            <select value={settings.scanning.scanInterval} onChange={(e) => setSettings({ ...settings, scanning: { ...settings.scanning, scanInterval: e.target.value } })} className={inputClass}>
              <option value="1">Every hour</option>
              <option value="6">Every 6 hours</option>
              <option value="12">Every 12 hours</option>
              <option value="24">Every 24 hours</option>
              <option value="168">Weekly</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
            <div>
              <p className="text-white font-medium">Include Dev Dependencies</p>
              <p className="text-steel-500 text-sm">Scan development dependencies too</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.scanning.includeDev} onChange={(e) => setSettings({ ...settings, scanning: { ...settings.scanning, includeDev: e.target.checked } })} className="sr-only peer" />
              <div className={`${toggleTrack} peer-checked:bg-violet-500`}></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  const NotificationsTab = () => (
    <div className="space-y-8">
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/[0.06]">
          <Bell className="w-5 h-5 text-violet-400" />
          <h2 className="text-xl font-semibold text-white">Notification Channels</h2>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <div>
                <p className="text-white font-medium">Email Notifications</p>
                <p className="text-steel-500 text-sm">Receive alerts via email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settings.notifications.email} onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, email: e.target.checked } })} className="sr-only peer" />
                <div className={`${toggleTrack} peer-checked:bg-violet-500`}></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
              <div>
                <p className="text-white font-medium">Slack Integration</p>
                <p className="text-steel-500 text-sm">Send alerts to Slack channel</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settings.notifications.slack} onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, slack: e.target.checked } })} className="sr-only peer" />
                <div className={`${toggleTrack} peer-checked:bg-violet-500`}></div>
              </label>
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-6">
            <p className="text-steel-500 text-[10px] mb-4 font-medium uppercase tracking-[0.15em] font-mono">Alert for severity levels:</p>
            <div className="flex flex-wrap gap-4">
              {['critical', 'high', 'medium', 'low'].map((level) => (
                <label key={level} className="flex items-center gap-2 cursor-pointer bg-white/[0.03] px-4 py-3 rounded-xl border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
                  <input
                    type="checkbox"
                    checked={settings.notifications[level]}
                    onChange={(e) => setSettings({ ...settings, notifications: { ...settings.notifications, [level]: e.target.checked } })}
                    className="w-4 h-4 text-violet-500 border-white/[0.15] rounded focus:ring-violet-500 bg-white/[0.04]"
                  />
                  <span className="text-steel-200 capitalize font-medium">{level}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile': return <ProfileTab />
      case 'personalization': return <PersonalizationTab />
      case 'security': return <SecurityTab />
      case 'github': return <GitHubTab />
      case 'notifications': return <NotificationsTab />
      default: return <ProfileTab />
    }
  }

  return (
    <div className="animate-fade-in min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <SettingsIcon className="w-8 h-8 text-violet-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Settings</h1>
            <p className="text-steel-500">Configure your security dashboard</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-64 flex-shrink-0">
            <nav className="glass-card p-2 sticky top-8">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                      : 'text-steel-400 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-violet-400' : 'text-steel-600'}`} />
                  <span className="flex-1">{tab.label}</span>
                  {activeTab === tab.id && <ChevronRight className="w-4 h-4 text-violet-400" />}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1 pb-10">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
