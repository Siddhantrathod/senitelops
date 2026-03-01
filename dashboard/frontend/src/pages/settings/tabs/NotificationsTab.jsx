import { useState } from 'react'
import {
  Bell, Mail, MessageSquare, AlertTriangle, ShieldAlert, KeyRound,
  Globe2, Zap, BarChart3, Save, RotateCcw, Eye,
} from 'lucide-react'
import { SettingsCard, FormField, SectionHeader, ToggleSwitch, SettingsSkeleton } from '../components'
import { useSettings } from '../hooks/useSettings'
import { fetchNotificationPrefs, updateNotificationPrefs } from '../services/settingsApi'
import { cn } from '../../../utils/helpers'

const DEFAULTS = {
  email: {
    pipelineSuccess: true,
    pipelineFailure: true,
    criticalVuln: true,
    secretDetected: true,
    deploymentBlocked: false,
  },
  inApp: true,
  weeklySummary: true,
  realtimeWebhook: false,
}

const EMAIL_EVENTS = [
  { key: 'pipelineSuccess', label: 'Pipeline Success', desc: 'When a scan pipeline completes successfully', icon: Zap, color: 'text-lime-400' },
  { key: 'pipelineFailure', label: 'Pipeline Failure', desc: 'When a scan pipeline fails or times out', icon: AlertTriangle, color: 'text-red-400' },
  { key: 'criticalVuln', label: 'Critical Vulnerability', desc: 'When a critical/high severity issue is found', icon: ShieldAlert, color: 'text-orange-400' },
  { key: 'secretDetected', label: 'Secret Detected', desc: 'When Gitleaks finds exposed secrets', icon: KeyRound, color: 'text-amber-400' },
  { key: 'deploymentBlocked', label: 'Deployment Blocked', desc: 'When policy engine blocks deployment', icon: Globe2, color: 'text-red-400' },
]

export default function NotificationsTab({ showToast }) {
  const { data, loading, saving, dirty, update, updateNested, save, reset } = useSettings(
    fetchNotificationPrefs, updateNotificationPrefs, DEFAULTS
  )
  const [previewOpen, setPreviewOpen] = useState(false)

  const handleSave = async () => {
    const result = await save()
    showToast(result.success ? 'Notification preferences saved' : result.error, result.success ? 'success' : 'error')
  }

  if (loading) return <SettingsSkeleton />

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <SettingsCard title="Email Notifications" icon={Mail} description="Choose which events trigger email alerts">
        <div className="space-y-3">
          {EMAIL_EVENTS.map(evt => (
            <div key={evt.key} className="flex items-center justify-between p-4 rounded-xl bg-theme-base border border-theme-subtle hover:bg-theme-hover transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-theme-accent">
                  <evt.icon className={cn('w-4 h-4', evt.color)} />
                </div>
                <div>
                  <p className="text-sm font-medium text-steel-100">{evt.label}</p>
                  <p className="text-xs text-steel-500">{evt.desc}</p>
                </div>
              </div>
              <ToggleSwitch
                checked={data.email?.[evt.key] ?? false}
                onChange={(val) => updateNested('email', evt.key, val)}
              />
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* Global Toggles */}
      <SettingsCard title="Additional Channels" icon={Bell} description="Configure in-app and webhook alerts">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-theme-base border border-theme-subtle">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Bell className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-steel-100">In-App Notifications</p>
                <p className="text-xs text-steel-500">Show notification badge and dropdown alerts</p>
              </div>
            </div>
            <ToggleSwitch checked={data.inApp} onChange={(val) => update('inApp', val)} />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-theme-base border border-theme-subtle">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-steel-100">Weekly Security Summary</p>
                <p className="text-xs text-steel-500">Receive a digest of scan results every Monday</p>
              </div>
            </div>
            <ToggleSwitch checked={data.weeklySummary} onChange={(val) => update('weeklySummary', val)} />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-theme-base border border-theme-subtle">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-steel-100">Real-time Webhook Alerts</p>
                <p className="text-xs text-steel-500">Push alerts to configured webhook endpoints</p>
              </div>
            </div>
            <ToggleSwitch checked={data.realtimeWebhook} onChange={(val) => update('realtimeWebhook', val)} />
          </div>
        </div>
      </SettingsCard>

      {/* Preview */}
      <SettingsCard title="Preview" icon={Eye} description="See what a notification looks like">
        <button
          onClick={() => setPreviewOpen(!previewOpen)}
          className="btn-secondary inline-flex items-center gap-2 text-sm"
        >
          <Eye className="w-4 h-4" />
          {previewOpen ? 'Hide Preview' : 'Show Example'}
        </button>
        {previewOpen && (
          <div className="mt-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-red-500/10 mt-0.5">
                <ShieldAlert className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-steel-100">Critical Vulnerability Detected</p>
                <p className="text-xs text-steel-400 mt-1">
                  SQL Injection found in <code className="text-red-400 bg-theme-code px-1.5 py-0.5 rounded">src/api/users.py:42</code>
                </p>
                <p className="text-xs text-steel-500 mt-2">Pipeline #127 • 2 minutes ago</p>
              </div>
            </div>
          </div>
        )}
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
