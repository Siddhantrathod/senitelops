import { useState, useEffect, useCallback } from 'react'

/**
 * Generic hook for loading/saving a settings section.
 * Handles loading, saving, optimistic updates, and error state.
 */
export function useSettings(fetchFn, updateFn, defaults = {}) {
  const [data, setData] = useState(defaults)
  const [original, setOriginal] = useState(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchFn()
      setData(result)
      setOriginal(result)
      setDirty(false)
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load settings')
      // Keep defaults on error
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  useEffect(() => { load() }, [load])

  const update = useCallback((key, value) => {
    setData(prev => {
      const next = { ...prev, [key]: value }
      setDirty(JSON.stringify(next) !== JSON.stringify(original))
      return next
    })
  }, [original])

  const updateNested = useCallback((section, key, value) => {
    setData(prev => {
      const next = {
        ...prev,
        [section]: { ...prev[section], [key]: value },
      }
      setDirty(JSON.stringify(next) !== JSON.stringify(original))
      return next
    })
  }, [original])

  const save = useCallback(async () => {
    if (!updateFn) return { success: false, error: 'No update function' }
    try {
      setSaving(true)
      setError(null)
      const result = await updateFn(data)
      setOriginal(data)
      setDirty(false)
      return { success: true, data: result }
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || 'Failed to save'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setSaving(false)
    }
  }, [updateFn, data])

  const reset = useCallback(() => {
    setData(original)
    setDirty(false)
    setError(null)
  }, [original])

  return {
    data,
    setData,
    loading,
    saving,
    error,
    dirty,
    update,
    updateNested,
    save,
    reset,
    reload: load,
  }
}

/**
 * Validation helpers
 */
export function validatePassword(password) {
  const errors = []
  if (password.length < 8) errors.push('At least 8 characters')
  if (!/[A-Z]/.test(password)) errors.push('One uppercase letter')
  if (!/[a-z]/.test(password)) errors.push('One lowercase letter')
  if (!/[0-9]/.test(password)) errors.push('One number')
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('One special character')
  return errors
}

export function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '' }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  const levels = [
    { label: 'Very Weak', color: 'bg-red-500' },
    { label: 'Weak', color: 'bg-orange-500' },
    { label: 'Fair', color: 'bg-yellow-500' },
    { label: 'Good', color: 'bg-lime-500' },
    { label: 'Strong', color: 'bg-green-500' },
    { label: 'Very Strong', color: 'bg-emerald-500' },
  ]

  return { score, ...levels[Math.min(score, levels.length - 1)] }
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateUrl(url) {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}
