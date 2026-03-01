import api from '../../../services/api'

// ── Profile ──────────────────────────────────────
export const fetchProfile = async () => {
  const { data } = await api.get('/settings/profile')
  return data
}

export const updateProfile = async (profile) => {
  const { data } = await api.put('/settings/profile', profile)
  return data
}

export const uploadAvatar = async (file) => {
  const formData = new FormData()
  formData.append('avatar', file)
  const { data } = await api.post('/settings/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// ── Security ─────────────────────────────────────
export const changePassword = async (currentPassword, newPassword) => {
  const { data } = await api.post('/auth/change-password', { currentPassword, newPassword })
  return data
}

export const fetchSessions = async () => {
  const { data } = await api.get('/settings/security/sessions')
  return data
}

export const revokeSession = async (sessionId) => {
  const { data } = await api.delete(`/settings/security/sessions/${sessionId}`)
  return data
}

export const revokeAllSessions = async () => {
  const { data } = await api.post('/settings/security/sessions/revoke-all')
  return data
}

export const fetchOAuthStatus = async () => {
  const { data } = await api.get('/settings/security/oauth')
  return data
}

export const revokeOAuth = async (provider) => {
  const { data } = await api.post(`/settings/security/oauth/${provider}/revoke`)
  return data
}

// ── Notifications ────────────────────────────────
export const fetchNotificationPrefs = async () => {
  const { data } = await api.get('/settings/notifications')
  return data
}

export const updateNotificationPrefs = async (prefs) => {
  const { data } = await api.put('/settings/notifications', prefs)
  return data
}

// ── Scan Preferences ─────────────────────────────
export const fetchScanPrefs = async () => {
  const { data } = await api.get('/settings/scan-preferences')
  return data
}

export const updateScanPrefs = async (prefs) => {
  const { data } = await api.put('/settings/scan-preferences', prefs)
  return data
}

// ── Git Integration ──────────────────────────────
export const fetchGitIntegration = async () => {
  const { data } = await api.get('/settings/git-integration')
  return data
}

export const regenerateWebhookSecret = async () => {
  const { data } = await api.post('/settings/git-integration/regenerate-secret')
  return data
}

export const testWebhook = async () => {
  const { data } = await api.post('/settings/git-integration/test')
  return data
}

export const updateGitIntegration = async (config) => {
  const { data } = await api.put('/settings/git-integration', config)
  return data
}

// ── Appearance ───────────────────────────────────
export const fetchAppearancePrefs = async () => {
  const { data } = await api.get('/settings/appearance')
  return data
}

export const updateAppearancePrefs = async (prefs) => {
  const { data } = await api.put('/settings/appearance', prefs)
  return data
}

// ── API Tokens ───────────────────────────────────
export const fetchApiTokens = async () => {
  const { data } = await api.get('/settings/api-tokens')
  return data
}

export const generateApiToken = async (name, expiresIn) => {
  const { data } = await api.post('/settings/api-tokens', { name, expiresIn })
  return data
}

export const revokeApiToken = async (tokenId) => {
  const { data } = await api.delete(`/settings/api-tokens/${tokenId}`)
  return data
}

// ── Advanced ─────────────────────────────────────
export const exportData = async () => {
  const { data } = await api.get('/settings/advanced/export', { responseType: 'blob' })
  return data
}

export const resetPreferences = async () => {
  const { data } = await api.post('/settings/advanced/reset')
  return data
}

export const deleteAccount = async (password) => {
  const { data } = await api.post('/settings/advanced/delete-account', { password })
  return data
}

export const toggleDebugMode = async (enabled) => {
  const { data } = await api.put('/settings/advanced/debug', { enabled })
  return data
}
