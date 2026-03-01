import { useState, useCallback } from 'react'
import {
  Key, Plus, Copy, Trash2, Eye, EyeOff, Clock, Activity,
  CheckCircle, AlertTriangle, RefreshCw, Shield,
} from 'lucide-react'
import { SettingsCard, FormField, SectionHeader, ConfirmationModal, SettingsSkeleton } from '../components'
import { TextInput, Select } from '../components/FormInputs'
import { cn } from '../../../utils/helpers'

const EXPIRY_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '1 year' },
  { value: 'never', label: 'No expiration' },
]

// Mock tokens for demo
const MOCK_TOKENS = [
  { id: 1, name: 'CI/CD Pipeline', created: '2026-02-10T10:00:00Z', expires: '2026-05-10T10:00:00Z', lastUsed: '2026-02-28T08:30:00Z', usageCount: 142 },
  { id: 2, name: 'Local Dev', created: '2026-02-20T14:00:00Z', expires: null, lastUsed: '2026-02-27T22:15:00Z', usageCount: 23 },
]

export default function ApiTokensTab({ showToast }) {
  const [tokens, setTokens] = useState(MOCK_TOKENS)
  const [showCreate, setShowCreate] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [newTokenExpiry, setNewTokenExpiry] = useState('30d')
  const [generatedToken, setGeneratedToken] = useState(null)
  const [creating, setCreating] = useState(false)
  const [revokeModal, setRevokeModal] = useState({ open: false, token: null })
  const [copiedId, setCopiedId] = useState(null)

  const handleCreate = useCallback(async () => {
    if (!newTokenName.trim()) {
      showToast('Token name is required', 'error')
      return
    }
    setCreating(true)
    // Simulate API call
    await new Promise(r => setTimeout(r, 800))
    const fakeToken = 'sntl_' + Array.from({ length: 40 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')
    const newEntry = {
      id: Date.now(),
      name: newTokenName,
      created: new Date().toISOString(),
      expires: newTokenExpiry === 'never' ? null : new Date(Date.now() + parseDuration(newTokenExpiry)).toISOString(),
      lastUsed: null,
      usageCount: 0,
    }
    setTokens(prev => [newEntry, ...prev])
    setGeneratedToken(fakeToken)
    setCreating(false)
    showToast('API token generated — copy it now, it won\'t be shown again', 'info')
  }, [newTokenName, newTokenExpiry, showToast])

  const handleRevoke = useCallback(async () => {
    const tokenId = revokeModal.token?.id
    setTokens(prev => prev.filter(t => t.id !== tokenId))
    setRevokeModal({ open: false, token: null })
    showToast('Token revoked')
  }, [revokeModal, showToast])

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      showToast('Failed to copy', 'error')
    }
  }

  const resetCreateForm = () => {
    setShowCreate(false)
    setNewTokenName('')
    setNewTokenExpiry('30d')
    setGeneratedToken(null)
  }

  return (
    <div className="space-y-6">
      {/* Generate Token */}
      <SettingsCard
        title="API Tokens"
        icon={Key}
        description="Manage personal access tokens for API authentication"
        actions={
          !showCreate && (
            <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Generate Token
            </button>
          )
        }
      >
        {showCreate && (
          <div className="mb-6 p-5 rounded-xl bg-theme-base border border-theme-subtle space-y-4">
            <SectionHeader title="New Token" description="Token will only be shown once after creation" />

            {!generatedToken ? (
              <>
                <FormField label="Token Name" required hint="A descriptive label for this token">
                  <TextInput
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="e.g., CI/CD Pipeline"
                  />
                </FormField>

                <FormField label="Expiration">
                  <Select
                    value={newTokenExpiry}
                    onChange={(e) => setNewTokenExpiry(e.target.value)}
                    options={EXPIRY_OPTIONS}
                  />
                </FormField>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button onClick={resetCreateForm} className="btn-secondary text-sm">Cancel</button>
                  <button onClick={handleCreate} disabled={creating}
                    className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50">
                    {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    Generate
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-lime-500/5 border border-lime-500/20">
                  <CheckCircle className="w-4 h-4 text-lime-400 flex-shrink-0" />
                  <p className="text-xs text-lime-400 font-medium">Token generated. Copy it now — it won't be shown again.</p>
                </div>
                <div className="relative">
                  <TextInput value={generatedToken} readOnly className="pr-10 font-mono text-xs" />
                  <button
                    onClick={() => copyToClipboard(generatedToken, 'new')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-steel-500 hover:text-steel-300 transition-colors"
                  >
                    {copiedId === 'new' ? <CheckCircle className="w-4 h-4 text-lime-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <button onClick={resetCreateForm} className="btn-secondary text-sm">Done</button>
              </div>
            )}
          </div>
        )}

        {/* Token List */}
        {tokens.length === 0 ? (
          <div className="text-center py-12">
            <Key className="w-10 h-10 text-steel-600 mx-auto mb-3" />
            <p className="text-steel-400 text-sm">No API tokens yet</p>
            <p className="text-steel-500 text-xs mt-1">Generate a token to authenticate with the API</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tokens.map(token => (
              <div key={token.id} className="flex items-center justify-between p-4 rounded-xl bg-theme-base border border-theme-subtle group hover:bg-theme-hover transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-violet-500/10">
                    <Key className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-steel-100 truncate">{token.name}</p>
                    <div className="flex items-center gap-3 text-xs text-steel-500 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Created {new Date(token.created).toLocaleDateString()}
                      </span>
                      {token.expires && (
                        <span className={cn(
                          'flex items-center gap-1',
                          new Date(token.expires) < new Date() ? 'text-red-400' : ''
                        )}>
                          {new Date(token.expires) < new Date() ? '⚠ Expired' : `Expires ${new Date(token.expires).toLocaleDateString()}`}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {token.usageCount} requests
                      </span>
                      {token.lastUsed && (
                        <span>Last used {new Date(token.lastUsed).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setRevokeModal({ open: true, token })}
                  className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-all p-2"
                  title="Revoke token"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      {/* Security note */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
        <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-400">Security Best Practices</p>
          <ul className="text-xs text-steel-400 mt-1 space-y-0.5 list-disc list-inside">
            <li>Never share tokens in public repositories or logs</li>
            <li>Set expiration dates on all tokens</li>
            <li>Revoke tokens you no longer use</li>
            <li>Use different tokens for different services</li>
          </ul>
        </div>
      </div>

      {/* Revoke confirmation */}
      <ConfirmationModal
        open={revokeModal.open}
        onClose={() => setRevokeModal({ open: false, token: null })}
        onConfirm={handleRevoke}
        title="Revoke API Token"
        message={`This will permanently revoke "${revokeModal.token?.name}". Any systems using this token will lose access immediately.`}
        confirmText="Revoke Token"
      />
    </div>
  )
}

function parseDuration(str) {
  const map = { d: 86400000, y: 365 * 86400000 }
  const num = parseInt(str)
  const unit = str.replace(/[0-9]/g, '')
  return num * (map[unit] || 0)
}
