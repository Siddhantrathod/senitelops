import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Palette,
  Globe,
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
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchPolicy, updatePolicy, evaluatePolicy, fetchConfig, updateConfig } from '../services/api'

export default function Settings() {
  const { user, isAdmin, changePassword } = useAuth()
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

  // Policy state
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
  
  // Policy evaluation state
  const [evaluation, setEvaluation] = useState(null)
  const [evaluating, setEvaluating] = useState(false)

  // Pipeline config state
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

  // Password change state
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

  const handleSave = () => {
    // In a real app, save to backend
    alert('Settings saved successfully!')
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary-500/20">
            <SettingsIcon className="w-8 h-8 text-primary-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Settings</h1>
            <p className="text-dark-400">Configure your security dashboard</p>
          </div>
        </div>
        <button onClick={handleSave} className="btn-primary inline-flex items-center gap-2">
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </div>

      {/* Security Policy Section */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Gauge className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-semibold text-white">Security Policy</h2>
          </div>
          {isAdmin() && (
            <button 
              onClick={handlePolicySave} 
              disabled={policySaving}
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              {policySaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Policy
            </button>
          )}
        </div>

        {policyMessage && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            policyMessage.type === 'success' 
              ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {policyMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {policyMessage.text}
          </div>
        )}

        {policyLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 text-primary-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Minimum Score */}
            <div>
              <label className="block text-white font-medium mb-2">
                Minimum Security Score
              </label>
              <p className="text-dark-500 text-sm mb-3">
                Deployments with scores below this threshold will be blocked
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={policy.minScore}
                  onChange={(e) => setPolicy({ ...policy, minScore: parseInt(e.target.value) })}
                  disabled={!isAdmin()}
                  className="flex-1 h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
                <div className="w-16 text-center">
                  <span className={`text-2xl font-bold ${
                    policy.minScore >= 80 ? 'text-green-400' : 
                    policy.minScore >= 60 ? 'text-yellow-400' : 
                    policy.minScore >= 40 ? 'text-orange-400' : 'text-red-400'
                  }`}>
                    {policy.minScore}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Block Critical */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Block on Critical</p>
                  <p className="text-dark-500 text-sm">Block if any CRITICAL vulnerabilities</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policy.blockCritical}
                    onChange={(e) => setPolicy({ ...policy, blockCritical: e.target.checked })}
                    disabled={!isAdmin()}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>

              {/* Block High */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Block on High</p>
                  <p className="text-dark-500 text-sm">Block if HIGH vulnerabilities exceed limit</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policy.blockHigh}
                    onChange={(e) => setPolicy({ ...policy, blockHigh: e.target.checked })}
                    disabled={!isAdmin()}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Max Critical Vulns */}
              <div>
                <label className="block text-white font-medium mb-2">Max Critical Vulnerabilities</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={policy.maxCriticalVulns}
                  onChange={(e) => setPolicy({ ...policy, maxCriticalVulns: parseInt(e.target.value) || 0 })}
                  disabled={!isAdmin()}
                  className="w-full px-4 py-2 bg-dark-900 text-white rounded-lg border border-dark-700/50 outline-none focus:border-primary-500"
                />
              </div>

              {/* Max High Vulns */}
              <div>
                <label className="block text-white font-medium mb-2">Max High Vulnerabilities</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={policy.maxHighVulns}
                  onChange={(e) => setPolicy({ ...policy, maxHighVulns: parseInt(e.target.value) || 0 })}
                  disabled={!isAdmin()}
                  className="w-full px-4 py-2 bg-dark-900 text-white rounded-lg border border-dark-700/50 outline-none focus:border-primary-500"
                />
              </div>
            </div>

            {/* Auto Block */}
            <div className="flex items-center justify-between pt-4 border-t border-dark-700/50">
              <div>
                <p className="text-white font-medium">Automatic Blocking</p>
                <p className="text-dark-500 text-sm">Automatically block deployments that violate policy</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.autoBlock}
                  onChange={(e) => setPolicy({ ...policy, autoBlock: e.target.checked })}
                  disabled={!isAdmin()}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            {policy.updatedAt && (
              <p className="text-dark-500 text-sm">
                Last updated: {new Date(policy.updatedAt).toLocaleString()} by {policy.updatedBy}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Policy Evaluation Section */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-green-400" />
            <h2 className="text-xl font-semibold text-white">Policy Evaluation</h2>
          </div>
          <button 
            onClick={handleEvaluatePolicy}
            disabled={evaluating}
            className="btn-secondary inline-flex items-center gap-2"
          >
            {evaluating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Evaluate Now
          </button>
        </div>

        {evaluation && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-dark-800 rounded-xl">
                <p className="text-dark-400 text-sm">Security Score</p>
                <p className={`text-2xl font-bold ${
                  evaluation.score >= 80 ? 'text-green-400' : 
                  evaluation.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {evaluation.score}
                </p>
              </div>
              <div className="p-4 bg-dark-800 rounded-xl">
                <p className="text-dark-400 text-sm">Critical Vulns</p>
                <p className="text-2xl font-bold text-red-400">{evaluation.criticalCount}</p>
              </div>
              <div className="p-4 bg-dark-800 rounded-xl">
                <p className="text-dark-400 text-sm">High Vulns</p>
                <p className="text-2xl font-bold text-orange-400">{evaluation.highCount}</p>
              </div>
            </div>

            <div className={`p-4 rounded-xl flex items-center gap-3 ${
              evaluation.deploymentAllowed 
                ? 'bg-green-500/10 border border-green-500/20' 
                : 'bg-red-500/10 border border-red-500/20'
            }`}>
              {evaluation.deploymentAllowed ? (
                <>
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <div>
                    <p className="text-green-400 font-semibold">Deployment Allowed</p>
                    <p className="text-green-400/70 text-sm">All policy requirements are met</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6 text-red-400" />
                  <div>
                    <p className="text-red-400 font-semibold">Deployment Blocked</p>
                    <p className="text-red-400/70 text-sm">Policy violations detected</p>
                  </div>
                </>
              )}
            </div>

            {evaluation.violations && evaluation.violations.length > 0 && (
              <div className="space-y-2">
                <p className="text-white font-medium">Violations:</p>
                {evaluation.violations.map((violation, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {violation}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!evaluation && (
          <p className="text-dark-500 text-center py-4">
            Click "Evaluate Now" to check current security status against policy
          </p>
        )}
      </div>

      {/* Change Password Section */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Lock className="w-5 h-5 text-yellow-400" />
          <h2 className="text-xl font-semibold text-white">Change Password</h2>
        </div>

        {passwordMessage && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            passwordMessage.type === 'success' 
              ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {passwordMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {passwordMessage.text}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div>
            <label className="block text-white font-medium mb-2">Current Password</label>
            <input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              className="w-full px-4 py-2 bg-dark-900 text-white rounded-lg border border-dark-700/50 outline-none focus:border-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-white font-medium mb-2">New Password</label>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              className="w-full px-4 py-2 bg-dark-900 text-white rounded-lg border border-dark-700/50 outline-none focus:border-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-white font-medium mb-2">Confirm New Password</label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              className="w-full px-4 py-2 bg-dark-900 text-white rounded-lg border border-dark-700/50 outline-none focus:border-primary-500"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={passwordLoading}
            className="btn-primary inline-flex items-center gap-2"
          >
            {passwordLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            Change Password
          </button>
        </form>
      </div>

      {/* Notifications Section */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-5 h-5 text-primary-400" />
          <h2 className="text-xl font-semibold text-white">Notifications</h2>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Email Notifications</p>
                <p className="text-dark-500 text-sm">Receive alerts via email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications.email}
                  onChange={(e) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, email: e.target.checked }
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Slack Integration</p>
                <p className="text-dark-500 text-sm">Send alerts to Slack channel</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications.slack}
                  onChange={(e) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, slack: e.target.checked }
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>

          <div className="border-t border-dark-700/50 pt-6">
            <p className="text-dark-400 text-sm mb-4">Alert for severity levels:</p>
            <div className="flex flex-wrap gap-4">
              {['critical', 'high', 'medium', 'low'].map((level) => (
                <label key={level} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications[level]}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, [level]: e.target.checked }
                    })}
                    className="w-4 h-4 text-primary-600 bg-dark-700 border-dark-600 rounded focus:ring-primary-500"
                  />
                  <span className="text-white capitalize">{level}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scanning Section */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-green-400" />
          <h2 className="text-xl font-semibold text-white">Scanning Options</h2>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Automatic Scanning</p>
              <p className="text-dark-500 text-sm">Run scans automatically on schedule</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.scanning.autoScan}
                onChange={(e) => setSettings({
                  ...settings,
                  scanning: { ...settings.scanning, autoScan: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-white font-medium mb-2">Scan Interval</label>
            <select
              value={settings.scanning.scanInterval}
              onChange={(e) => setSettings({
                ...settings,
                scanning: { ...settings.scanning, scanInterval: e.target.value }
              })}
              className="px-4 py-2 bg-dark-900 text-white rounded-lg border border-dark-700/50 outline-none"
            >
              <option value="1">Every hour</option>
              <option value="6">Every 6 hours</option>
              <option value="12">Every 12 hours</option>
              <option value="24">Every 24 hours</option>
              <option value="168">Weekly</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Include Dev Dependencies</p>
              <p className="text-dark-500 text-sm">Scan development dependencies too</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.scanning.includeDev}
                onChange={(e) => setSettings({
                  ...settings,
                  scanning: { ...settings.scanning, includeDev: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Display Section */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Palette className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-white">Display Options</h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-white font-medium mb-2">Theme</label>
            <select
              value={settings.display.theme}
              onChange={(e) => setSettings({
                ...settings,
                display: { ...settings.display, theme: e.target.value }
              })}
              className="px-4 py-2 bg-dark-900 text-white rounded-lg border border-dark-700/50 outline-none"
            >
              <option value="dark">Dark Mode</option>
              <option value="light">Light Mode (Coming Soon)</option>
              <option value="system">System Default</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Compact View</p>
              <p className="text-dark-500 text-sm">Show more items with less spacing</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.display.compactView}
                onChange={(e) => setSettings({
                  ...settings,
                  display: { ...settings.display, compactView: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Show Confidence Level</p>
              <p className="text-dark-500 text-sm">Display confidence badges on issues</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.display.showConfidence}
                onChange={(e) => setSettings({
                  ...settings,
                  display: { ...settings.display, showConfidence: e.target.checked }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-semibold text-white">Data Management</h2>
        </div>

        <div className="space-y-4">
          <button className="btn-secondary inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Clear Cache
          </button>
          <p className="text-dark-500 text-sm">
            Clear locally cached scan results. New data will be fetched on next load.
          </p>
        </div>
      </div>

      {/* Pipeline Configuration */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Pipeline Configuration</h2>
          </div>
          {isAdmin() && (
            <button 
              onClick={handleConfigSave} 
              disabled={configSaving}
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              {configSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Config
            </button>
          )}
        </div>

        {configMessage && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            configMessage.type === 'success' 
              ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {configMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {configMessage.text}
          </div>
        )}

        {configLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 text-primary-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-dark-400 text-sm mb-2 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  GitHub Repository URL
                </label>
                <input
                  type="text"
                  value={pipelineConfig.github_repo_url}
                  onChange={(e) => setPipelineConfig({ ...pipelineConfig, github_repo_url: e.target.value })}
                  placeholder="https://github.com/user/repo.git"
                  disabled={!isAdmin()}
                  className="input-field"
                />
                <p className="text-dark-500 text-xs mt-1">Repository to monitor for pushes</p>
              </div>

              <div>
                <label className="block text-dark-400 text-sm mb-2 flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  Branch to Watch
                </label>
                <input
                  type="text"
                  value={pipelineConfig.github_branch}
                  onChange={(e) => setPipelineConfig({ ...pipelineConfig, github_branch: e.target.value })}
                  placeholder="main"
                  disabled={!isAdmin()}
                  className="input-field"
                />
                <p className="text-dark-500 text-xs mt-1">Only trigger scans for this branch</p>
              </div>

              <div>
                <label className="block text-dark-400 text-sm mb-2 flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Target Docker Image
                </label>
                <input
                  type="text"
                  value={pipelineConfig.target_image}
                  onChange={(e) => setPipelineConfig({ ...pipelineConfig, target_image: e.target.value })}
                  placeholder="sentinelops-app"
                  disabled={!isAdmin()}
                  className="input-field"
                />
                <p className="text-dark-500 text-xs mt-1">Docker image name for Trivy scan</p>
              </div>

              <div>
                <label className="block text-dark-400 text-sm mb-2 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  Local Directory (Optional)
                </label>
                <input
                  type="text"
                  value={pipelineConfig.target_directory}
                  onChange={(e) => setPipelineConfig({ ...pipelineConfig, target_directory: e.target.value })}
                  placeholder="/path/to/code"
                  disabled={!isAdmin()}
                  className="input-field"
                />
                <p className="text-dark-500 text-xs mt-1">Override with local directory for scanning</p>
              </div>
            </div>

            <div className="border-t border-dark-700 pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Auto-Scan on Push</p>
                  <p className="text-dark-500 text-sm">Automatically run security scans when code is pushed</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pipelineConfig.scan_on_push}
                    onChange={(e) => setPipelineConfig({ ...pipelineConfig, scan_on_push: e.target.checked })}
                    disabled={!isAdmin()}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>

            {/* Webhook Info */}
            <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-700">
              <h3 className="text-white font-medium mb-2">GitHub Webhook Setup</h3>
              <p className="text-dark-400 text-sm mb-3">
                To enable automatic scanning on push, add this webhook to your GitHub repository:
              </p>
              <div className="bg-dark-900 rounded p-3 font-mono text-sm text-primary-400 break-all">
                {window.location.origin}/webhook/github
              </div>
              <p className="text-dark-500 text-xs mt-2">
                Set Content type to <code className="text-primary-400">application/json</code> and select "Just the push event"
              </p>
            </div>
          </div>
        )}
      </div>

      {/* About */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-primary-400" />
          <h2 className="text-xl font-semibold text-white">About</h2>
        </div>
        <div className="text-dark-400 space-y-2">
          <p><span className="text-white">SentinelOps Dashboard</span> v1.0.0</p>
          <p>A comprehensive DevSecOps security monitoring dashboard.</p>
          <p className="text-sm">
            Integrates with Bandit for Python code analysis and Trivy for container scanning.
          </p>
        </div>
      </div>
    </div>
  )
}
