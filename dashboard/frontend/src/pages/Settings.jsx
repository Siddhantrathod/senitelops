import { useState } from 'react'
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Palette,
  Globe,
  Database,
  Save,
  RefreshCw,
} from 'lucide-react'

export default function Settings() {
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
