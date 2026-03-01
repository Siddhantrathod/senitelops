import { useState, useCallback } from 'react'
import {
  GitBranch, Webhook, Copy, RefreshCw, CheckCircle, Eye, EyeOff,
  Clock, ExternalLink, Save, RotateCcw, Zap, AlertTriangle,
} from 'lucide-react'
import { SettingsCard, FormField, SectionHeader, ConfirmationModal, SettingsSkeleton } from '../components'
import { TextInput, Select } from '../components/FormInputs'
import { useSettings } from '../hooks/useSettings'
import { fetchGitIntegration, updateGitIntegration, regenerateWebhookSecret, testWebhook } from '../services/settingsApi'
import { cn } from '../../../utils/helpers'

const DEFAULTS = {
  provider: 'github',
  webhookUrl: '',
  webhookSecret: '',
  lastWebhookAt: null,
}

const PROVIDERS = [
  { value: 'github', label: 'GitHub' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'bitbucket', label: 'Bitbucket (Coming Soon)' },
]

export default function GitIntegrationTab({ showToast }) {
  const { data, loading, saving, dirty, update, save, reset, reload } = useSettings(
    fetchGitIntegration, updateGitIntegration, DEFAULTS
  )
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(null) // 'url' | 'secret'
  const [regenModal, setRegenModal] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)

  const copyToClipboard = useCallback(async (text, type) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
      showToast(`Copied to clipboard`)
    } catch {
      showToast('Failed to copy', 'error')
    }
  }, [showToast])

  const handleRegenerate = async () => {
    setRegenLoading(true)
    try {
      await regenerateWebhookSecret()
      showToast('Webhook secret regenerated')
      setRegenModal(false)
      reload()
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to regenerate', 'error')
    } finally {
      setRegenLoading(false)
    }
  }

  const handleTestWebhook = async () => {
    setTestLoading(true)
    try {
      await testWebhook()
      showToast('Webhook test sent successfully')
    } catch (err) {
      showToast(err?.response?.data?.error || 'Webhook test failed', 'error')
    } finally {
      setTestLoading(false)
    }
  }

  const handleSave = async () => {
    const result = await save()
    showToast(result.success ? 'Git integration saved' : result.error, result.success ? 'success' : 'error')
  }

  if (loading) return <SettingsSkeleton />

  const maskedSecret = data.webhookSecret
    ? data.webhookSecret.slice(0, 8) + '••••••••••••••••'
    : 'Not generated'

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <SettingsCard title="Git Provider" icon={GitBranch} description="Configure your source control integration">
        <div className="space-y-5">
          <FormField label="Provider">
            <Select
              value={data.provider}
              onChange={(e) => update('provider', e.target.value)}
              options={PROVIDERS}
            />
          </FormField>

          {data.provider === 'bitbucket' && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-400">Bitbucket integration is coming soon.</p>
            </div>
          )}
        </div>
      </SettingsCard>

      {/* Webhook Configuration */}
      <SettingsCard title="Webhook Configuration" icon={Webhook} description="Manage incoming webhook for scan triggers">
        <div className="space-y-5">
          {/* Webhook URL */}
          <FormField label="Webhook URL" hint="Share this URL in your repository webhook settings">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <TextInput
                  value={data.webhookUrl || `${window.location.origin}/api/webhook/${data.provider}`}
                  readOnly
                  className="pr-10 font-mono text-xs"
                />
                <button
                  onClick={() => copyToClipboard(data.webhookUrl || `${window.location.origin}/api/webhook/${data.provider}`, 'url')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-steel-500 hover:text-steel-300 transition-colors"
                >
                  {copied === 'url' ? <CheckCircle className="w-4 h-4 text-lime-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <a href={data.webhookUrl || '#'} target="_blank" rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-theme-accent border border-theme text-steel-400 hover:text-steel-200 transition-colors">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </FormField>

          {/* Webhook Secret */}
          <FormField label="Webhook Secret" hint="Used to verify webhook payloads">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <TextInput
                  value={showSecret ? (data.webhookSecret || 'Not generated') : maskedSecret}
                  readOnly
                  className="pr-20 font-mono text-xs"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-steel-500 hover:text-steel-300 transition-colors"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(data.webhookSecret || '', 'secret')}
                    className="text-steel-500 hover:text-steel-300 transition-colors"
                  >
                    {copied === 'secret' ? <CheckCircle className="w-4 h-4 text-lime-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setRegenModal(true)}
                className="btn-secondary inline-flex items-center gap-2 text-sm whitespace-nowrap"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
            </div>
          </FormField>

          {/* Last webhook + Test */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-theme-base border border-theme-subtle">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-theme-accent">
                <Clock className="w-4 h-4 text-steel-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-steel-100">Last Webhook Received</p>
                <p className="text-xs text-steel-500 font-mono">
                  {data.lastWebhookAt
                    ? new Date(data.lastWebhookAt).toLocaleString()
                    : 'No webhook received yet'}
                </p>
              </div>
            </div>
            <button
              onClick={handleTestWebhook}
              disabled={testLoading}
              className="btn-secondary inline-flex items-center gap-2 text-sm"
            >
              {testLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Test Webhook
            </button>
          </div>
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
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Regenerate confirmation */}
      <ConfirmationModal
        open={regenModal}
        onClose={() => setRegenModal(false)}
        onConfirm={handleRegenerate}
        loading={regenLoading}
        title="Regenerate Webhook Secret"
        message="This will invalidate the current secret. Any existing webhook integrations will stop working until updated with the new secret."
        confirmText="Regenerate"
        confirmVariant="warning"
      />
    </div>
  )
}
