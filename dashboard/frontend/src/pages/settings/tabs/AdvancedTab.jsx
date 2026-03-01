import { useState, useCallback } from 'react'
import {
  Download, Trash2, RotateCcw, Bug, AlertTriangle, RefreshCw,
  FileJson, Shield, Eye, EyeOff,
} from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { SettingsCard, SectionHeader, ToggleSwitch, ConfirmationModal, SettingsSkeleton } from '../components'
import { TextInput } from '../components/FormInputs'
import { cn } from '../../../utils/helpers'

export default function AdvancedTab({ showToast }) {
  const { user } = useAuth()
  const [debugMode, setDebugMode] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [resetModal, setResetModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [showDeletePw, setShowDeletePw] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const isViewer = user?.role === 'viewer'

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      // Simulate export
      await new Promise(r => setTimeout(r, 1200))
      const exportData = {
        exportedAt: new Date().toISOString(),
        user: user?.username,
        scans: 'history_placeholder',
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sentinelops-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Data exported successfully')
    } catch {
      showToast('Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }, [user, showToast])

  const handleResetPreferences = useCallback(async () => {
    await new Promise(r => setTimeout(r, 500))
    setResetModal(false)
    showToast('All preferences reset to defaults')
  }, [showToast])

  const handleDeleteAccount = useCallback(async () => {
    if (!deletePassword) {
      showToast('Password required for confirmation', 'error')
      return
    }
    setDeleteLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setDeleteLoading(false)
    setDeleteConfirmModal(false)
    showToast('Account deletion is not available in demo mode', 'info')
  }, [deletePassword, showToast])

  return (
    <div className="space-y-6">
      {/* Data Export */}
      <SettingsCard title="Data Export" icon={FileJson} description="Download your scan history and settings">
        <div className="flex items-center justify-between p-4 rounded-xl bg-theme-base border border-theme-subtle">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Download className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-steel-100">Export Scan History</p>
              <p className="text-xs text-steel-500">Download all scan results and configuration as JSON</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-secondary inline-flex items-center gap-2 text-sm"
          >
            {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Exporting...' : 'Export Data'}
          </button>
        </div>
      </SettingsCard>

      {/* Debug Mode (hidden for viewers) */}
      {!isViewer && (
        <SettingsCard title="Developer Options" icon={Bug} description="Advanced debugging features">
          <div className="flex items-center justify-between p-4 rounded-xl bg-theme-base border border-theme-subtle">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', debugMode ? 'bg-amber-500/10' : 'bg-theme-accent')}>
                <Bug className={cn('w-5 h-5', debugMode ? 'text-amber-400' : 'text-steel-400')} />
              </div>
              <div>
                <p className="text-sm font-medium text-steel-100">Debug Mode</p>
                <p className="text-xs text-steel-500">Show additional logging and diagnostic info</p>
              </div>
            </div>
            <ToggleSwitch checked={debugMode} onChange={setDebugMode} />
          </div>
          {debugMode && (
            <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
              <p className="text-xs text-amber-400">
                Debug mode enabled. Check browser console for verbose logs.
              </p>
            </div>
          )}
        </SettingsCard>
      )}

      {/* Reset Preferences */}
      <SettingsCard title="Reset Preferences" icon={RotateCcw} description="Restore all settings to factory defaults">
        <div className="flex items-center justify-between p-4 rounded-xl bg-theme-base border border-theme-subtle">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <RotateCcw className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-steel-100">Reset All Settings</p>
              <p className="text-xs text-steel-500">This will restore all preferences to their default values</p>
            </div>
          </div>
          <button
            onClick={() => setResetModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors"
          >
            Reset
          </button>
        </div>
      </SettingsCard>

      {/* Danger Zone */}
      <SettingsCard
        title="Danger Zone"
        icon={AlertTriangle}
        description="Irreversible account actions"
        className="border border-red-500/20"
      >
        <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/15">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-400">Delete Account</p>
              <p className="text-xs text-steel-500">Permanently remove your account and all associated data</p>
            </div>
          </div>
          <button
            onClick={() => setDeleteModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >
            Delete Account
          </button>
        </div>
      </SettingsCard>

      {/* Reset confirmation */}
      <ConfirmationModal
        open={resetModal}
        onClose={() => setResetModal(false)}
        onConfirm={handleResetPreferences}
        title="Reset All Preferences"
        message="All your settings will be restored to defaults. This includes notification preferences, scan settings, appearance, and more."
        confirmText="Reset Everything"
        confirmVariant="warning"
      />

      {/* Delete step 1 */}
      <ConfirmationModal
        open={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={() => { setDeleteModal(false); setDeleteConfirmModal(true) }}
        title="Delete Account"
        message="Are you sure? This action cannot be undone. All your data, scan history, and settings will be permanently deleted."
        confirmText="Continue"
      />

      {/* Delete step 2 — password confirmation */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirmModal(false)}>
          <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-md glass-card p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-6">
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-400">Final Confirmation</h3>
                <p className="text-sm text-steel-400 mt-1">Enter your password to confirm account deletion.</p>
              </div>
            </div>
            <div className="relative mb-6">
              <TextInput
                type={showDeletePw ? 'text' : 'password'}
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowDeletePw(!showDeletePw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-steel-500"
              >
                {showDeletePw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => { setDeleteConfirmModal(false); setDeletePassword('') }} className="btn-secondary text-sm">
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || !deletePassword}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
