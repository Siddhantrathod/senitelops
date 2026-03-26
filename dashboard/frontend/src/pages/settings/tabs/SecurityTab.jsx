import { useState, useCallback, useEffect } from 'react'
import {
  Lock, Eye, EyeOff, Shield, ShieldCheck, Smartphone, Monitor,
  LogOut, Chrome, KeyRound, RefreshCw, MapPin, Clock, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { SettingsCard, FormField, SectionHeader, ToggleSwitch, ConfirmationModal, SettingsSkeleton } from '../components'
import { TextInput } from '../components/FormInputs'
import { validatePassword, getPasswordStrength } from '../hooks/useSettings'
import { changePassword } from '../services/settingsApi'
import { cn } from '../../../utils/helpers'
import api from '../../../services/api'

export default function SecurityTab({ showToast }) {
  const { user } = useAuth()

  // Password state
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' })
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwErrors, setPwErrors] = useState([])

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false)

  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [revokeModal, setRevokeModal] = useState({ open: false, sessionId: null })

  useEffect(() => {
    let mounted = true
    const fetchSessions = async () => {
      try {
        const res = await api.get('/auth/sessions')
        if (mounted && res.data?.sessions) {
          setSessions(res.data.sessions)
        }
      } catch (err) {
        console.error('Failed to fetch sessions', err)
      } finally {
        if (mounted) setLoadingSessions(false)
      }
    }
    fetchSessions()
    return () => { mounted = false }
  }, [])

  const strength = getPasswordStrength(pwForm.new)
  const isGoogleUser = user?.authProvider === 'google'

  const handlePasswordChange = useCallback(async (e) => {
    e.preventDefault()
    const errors = validatePassword(pwForm.new)
    if (errors.length > 0) {
      setPwErrors(errors)
      return
    }
    if (pwForm.new !== pwForm.confirm) {
      showToast('Passwords do not match', 'error')
      return
    }
    setPwLoading(true)
    setPwErrors([])
    try {
      await changePassword(pwForm.current, pwForm.new)
      showToast('Password changed successfully')
      setPwForm({ current: '', new: '', confirm: '' })
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to change password', 'error')
    } finally {
      setPwLoading(false)
    }
  }, [pwForm, showToast])

  const PasswordField = ({ id, label, value, onChange }) => (
    <FormField label={label}>
      <div className="relative">
        <TextInput
          type={showPw[id] ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder="••••••••"
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPw(p => ({ ...p, [id]: !p[id] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-steel-500 hover:text-steel-300 transition-colors"
        >
          {showPw[id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </FormField>
  )

  return (
    <div className="space-y-6">
      {/* Password Management */}
      <SettingsCard title="Password" icon={Lock} description="Manage your account password">
        {isGoogleUser ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-400">Google Account</p>
              <p className="text-xs text-steel-400">Password is managed by Google. You can set a local password to enable direct login.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <PasswordField id="current" label="Current Password" value={pwForm.current}
              onChange={(e) => setPwForm(p => ({ ...p, current: e.target.value }))} />

            <PasswordField id="new" label="New Password" value={pwForm.new}
              onChange={(e) => setPwForm(p => ({ ...p, new: e.target.value }))} />

            {/* Strength bar */}
            {pwForm.new && (
              <div className="space-y-2">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= strength.score ? strength.color : 'bg-steel-600/30 dark:bg-white/[0.08]')} />
                  ))}
                </div>
                <p className="text-xs text-steel-400">{strength.label}</p>
                {pwErrors.length > 0 && (
                  <ul className="text-xs text-red-400 space-y-0.5">
                    {pwErrors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                )}
              </div>
            )}

            <PasswordField id="confirm" label="Confirm Password" value={pwForm.confirm}
              onChange={(e) => setPwForm(p => ({ ...p, confirm: e.target.value }))} />

            <div className="pt-2">
              <button type="submit" disabled={pwLoading || !pwForm.current || !pwForm.new || !pwForm.confirm}
                className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50">
                {pwLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Change Password
              </button>
            </div>
          </form>
        )}
      </SettingsCard>

      {/* Removed Multi-Factor Authentication */}

      {/* Active Sessions */}
      <SettingsCard
        title="Active Sessions"
        icon={Monitor}
        description="Manage devices logged into your account"
        actions={
          <button
            onClick={() => showToast('All other sessions revoked')}
            className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
          >
            Revoke All Others
          </button>
        }
      >
        <div className="space-y-3">
          {sessions.map(session => (
            <div key={session.id} className="flex items-center justify-between p-4 rounded-xl bg-theme-base border border-theme-subtle group">
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', session.current ? 'bg-lime-500/10' : 'bg-theme-accent')}>
                  {session.device.includes('Mobile') ? (
                    <Smartphone className={cn('w-4 h-4', session.current ? 'text-lime-400' : 'text-steel-400')} />
                  ) : (
                    <Monitor className={cn('w-4 h-4', session.current ? 'text-lime-400' : 'text-steel-400')} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-steel-100">{session.device}</p>
                    {session.current && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-lime-400 bg-lime-500/10 px-2 py-0.5 rounded-full border border-lime-500/20">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-steel-500 mt-0.5">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{session.ip}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(session.lastActive).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              {!session.current && (
                <button
                  onClick={() => setRevokeModal({ open: true, sessionId: session.id })}
                  className="text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-all font-medium"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* OAuth Status */}
      <SettingsCard title="Connected Accounts" icon={KeyRound} description="Manage third-party connections">
        <div className="flex items-center justify-between p-4 rounded-xl bg-theme-base border border-theme-subtle">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Chrome className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-steel-100">Google</p>
              <p className="text-xs text-steel-500">
                {isGoogleUser ? `Connected as ${user?.email}` : 'Not connected'}
              </p>
            </div>
          </div>
          {isGoogleUser ? (
            <button className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors">
              Disconnect
            </button>
          ) : (
            <button className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Connect
            </button>
          )}
        </div>
      </SettingsCard>

      {/* Session revoke confirmation */}
      <ConfirmationModal
        open={revokeModal.open}
        onClose={() => setRevokeModal({ open: false, sessionId: null })}
        onConfirm={() => {
          showToast('Session revoked')
          setRevokeModal({ open: false, sessionId: null })
        }}
        title="Revoke Session"
        message="This device will be logged out immediately. You can log back in anytime."
        confirmText="Revoke"
      />
    </div>
  )
}
