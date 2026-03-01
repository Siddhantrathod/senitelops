import { useState, useCallback } from 'react'
import { User, Mail, Building2, Globe2, Clock, Languages, Camera, Save, RotateCcw } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { SettingsCard, FormField, SettingsSkeleton } from '../components'
import { TextInput, Select } from '../components/FormInputs'
import { useSettings } from '../hooks/useSettings'
import { fetchProfile, updateProfile } from '../services/settingsApi'

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
  { value: 'hi', label: 'Hindi' },
]

const DEFAULTS = {
  fullName: '',
  email: '',
  organization: '',
  defaultRepoUrl: '',
  timezone: 'UTC',
  preferredLanguage: 'en',
  avatarUrl: '',
}

export default function ProfileTab({ showToast }) {
  const { user } = useAuth()
  const { data, loading, saving, dirty, update, save, reset } = useSettings(fetchProfile, updateProfile, {
    ...DEFAULTS,
    fullName: user?.fullName || user?.username || '',
    email: user?.email || '',
    organization: user?.organization || '',
  })
  const [avatarPreview, setAvatarPreview] = useState(null)

  const handleAvatarChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be under 2MB', 'error')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => setAvatarPreview(reader.result)
    reader.readAsDataURL(file)
  }, [showToast])

  const handleSave = async () => {
    if (!data.fullName?.trim()) {
      showToast('Full name is required', 'error')
      return
    }
    const result = await save()
    showToast(result.success ? 'Profile updated successfully' : result.error, result.success ? 'success' : 'error')
  }

  if (loading) return <SettingsSkeleton />

  return (
    <div className="space-y-6">
      {/* Avatar & basic info */}
      <SettingsCard title="Profile Information" icon={User} description="Manage your personal details">
        <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-theme bg-theme-accent flex items-center justify-center">
              {avatarPreview || data.avatarUrl ? (
                <img src={avatarPreview || data.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-steel-500" />
              )}
            </div>
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <Camera className="w-6 h-6 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-lg font-semibold text-steel-50">{data.fullName || user?.username}</h3>
            <p className="text-sm text-steel-400 font-mono">{data.email}</p>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20 mt-1">
              {user?.role || 'user'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField label="Full Name" required>
            <TextInput
              value={data.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              placeholder="Enter your full name"
            />
          </FormField>

          <FormField label="Email" hint="Cannot be changed here">
            <TextInput value={data.email} disabled />
          </FormField>

          <FormField label="Organization">
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-500" />
              <TextInput
                value={data.organization}
                onChange={(e) => update('organization', e.target.value)}
                placeholder="Your company or team"
                className="pl-10"
              />
            </div>
          </FormField>

          <FormField label="Default Repository URL">
            <div className="relative">
              <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-500" />
              <TextInput
                value={data.defaultRepoUrl}
                onChange={(e) => update('defaultRepoUrl', e.target.value)}
                placeholder="https://github.com/org/repo"
                className="pl-10"
              />
            </div>
          </FormField>

          <FormField label="Timezone">
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-500 z-10" />
              <Select
                value={data.timezone}
                onChange={(e) => update('timezone', e.target.value)}
                options={TIMEZONES}
                className="pl-10"
              />
            </div>
          </FormField>

          <FormField label="Preferred Language">
            <div className="relative">
              <Languages className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-500 z-10" />
              <Select
                value={data.preferredLanguage}
                onChange={(e) => update('preferredLanguage', e.target.value)}
                options={LANGUAGES}
                className="pl-10"
              />
            </div>
          </FormField>
        </div>

        {/* Save / Cancel */}
        <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-theme-subtle">
          <button
            onClick={reset}
            disabled={!dirty || saving}
            className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-40"
          >
            <RotateCcw className="w-4 h-4" />
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </SettingsCard>
    </div>
  )
}
