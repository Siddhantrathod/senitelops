import { useState, useEffect, useCallback } from 'react'
import {
  Shield, Save, RotateCcw, CheckCircle, AlertTriangle,
  Sliders, Lock, Zap, FileText, RefreshCw, History,
} from 'lucide-react'
import { cn } from '../../utils/helpers'
import { KpiCard, StatusBadge, Modal, DataTable } from '../../components/admin'
import { fetchPolicy, updatePolicy, fetchConfig, updateConfig } from '../../services/api'

const DEFAULT_POLICY = {
  minScore: 70,
  blockCritical: true,
  autoBlock: true,
  maxCritical: 0,
  maxHigh: 5,
  severityWeights: { CRITICAL: 40, HIGH: 25, MEDIUM: 10, LOW: 2 },
  secretPenalty: 30,
  dastPenalty: 15,
}

export default function AdminSettings() {
  const [policy, setPolicy] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionMsg, setActionMsg] = useState(null)
  const [resetModal, setResetModal] = useState(false)
  const [activeTab, setActiveTab] = useState('policy')

  const showMsg = (text, type = 'success') => {
    setActionMsg({ text, type })
    setTimeout(() => setActionMsg(null), 4000)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [policyData, configData] = await Promise.all([
        fetchPolicy().catch(() => DEFAULT_POLICY),
        fetchConfig().catch(() => ({})),
      ])
      setPolicy({ ...DEFAULT_POLICY, ...policyData })
      setConfig(configData)
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSavePolicy = async () => {
    setSaving(true)
    try {
      await updatePolicy(policy)
      showMsg('Security policy updated successfully')
    } catch (err) {
      showMsg(err.response?.data?.message || 'Failed to save policy', 'error')
    }
    setSaving(false)
  }

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      await updateConfig(config)
      showMsg('Configuration updated successfully')
    } catch (err) {
      showMsg(err.response?.data?.message || 'Failed to save config', 'error')
    }
    setSaving(false)
  }

  const handleReset = () => {
    setPolicy({ ...DEFAULT_POLICY })
    setResetModal(false)
    showMsg('Policy reset to defaults — save to apply')
  }

  const updateWeight = (sev, value) => {
    setPolicy(p => ({
      ...p,
      severityWeights: {
        ...p.severityWeights,
        [sev]: Math.max(0, Math.min(100, parseInt(value) || 0)),
      },
    }))
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-white/[0.06] rounded-lg animate-pulse" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="h-6 w-32 bg-white/[0.06] rounded mb-4" />
            <div className="space-y-3">
              <div className="h-10 bg-white/[0.04] rounded-xl" />
              <div className="h-10 bg-white/[0.04] rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Notification */}
      {actionMsg && (
        <div className={cn(
          'fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl border shadow-2xl backdrop-blur-xl animate-fade-in flex items-center gap-2 text-sm font-medium',
          actionMsg.type === 'success'
            ? 'bg-lime-500/10 border-lime-500/30 text-lime-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        )}>
          {actionMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {actionMsg.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-steel-50 mb-1">Settings</h1>
          <p className="text-steel-400 text-sm">Security policy, deployment thresholds & configuration</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setResetModal(true)} className="btn-secondary flex items-center gap-2 text-sm text-amber-400">
            <RotateCcw className="w-4 h-4" /> Reset Defaults
          </button>
          <button onClick={loadData} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Reload
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] w-fit">
        {[
          { id: 'policy', label: 'Security Policy', icon: Shield },
          { id: 'config', label: 'Project Config', icon: Sliders },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
              activeTab === t.id
                ? 'bg-violet-500/15 text-violet-400 border border-violet-500/25'
                : 'text-steel-400 hover:text-steel-200'
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Policy Tab */}
      {activeTab === 'policy' && policy && (
        <div className="space-y-6">
          {/* Deployment Thresholds */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-steel-50 flex items-center gap-2 mb-6">
              <Zap className="w-5 h-5 text-lime-400" /> Deployment Thresholds
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wider mb-2 font-mono">
                  Minimum Security Score
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={policy.minScore}
                    onChange={e => setPolicy(p => ({ ...p, minScore: parseInt(e.target.value) }))}
                    className="flex-1 accent-violet-500"
                  />
                  <span className={cn(
                    'text-2xl font-black font-mono w-16 text-right',
                    policy.minScore >= 70 ? 'text-lime-400' : policy.minScore >= 40 ? 'text-amber-400' : 'text-red-400'
                  )}>
                    {policy.minScore}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer">
                  <div>
                    <span className="text-sm text-steel-200 block">Block Critical Vulnerabilities</span>
                    <span className="text-[10px] text-steel-500">Auto-block deploys with critical findings</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={policy.blockCritical}
                    onChange={e => setPolicy(p => ({ ...p, blockCritical: e.target.checked }))}
                    className="w-5 h-5 rounded accent-violet-500"
                  />
                </label>
                <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer">
                  <div>
                    <span className="text-sm text-steel-200 block">Auto Block Below Threshold</span>
                    <span className="text-[10px] text-steel-500">Automatically block if score {'<'} min</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={policy.autoBlock}
                    onChange={e => setPolicy(p => ({ ...p, autoBlock: e.target.checked }))}
                    className="w-5 h-5 rounded accent-violet-500"
                  />
                </label>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <div>
                <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wider mb-2 font-mono">
                  Max Critical Allowed
                </label>
                <input
                  type="number"
                  min="0"
                  value={policy.maxCritical}
                  onChange={e => setPolicy(p => ({ ...p, maxCritical: parseInt(e.target.value) || 0 }))}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wider mb-2 font-mono">
                  Max High Allowed
                </label>
                <input
                  type="number"
                  min="0"
                  value={policy.maxHigh}
                  onChange={e => setPolicy(p => ({ ...p, maxHigh: parseInt(e.target.value) || 0 }))}
                  className="input-field w-full"
                />
              </div>
            </div>
          </div>

          {/* Severity Weights */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-steel-50 flex items-center gap-2 mb-6">
              <Sliders className="w-5 h-5 text-violet-400" /> Severity Weights
            </h3>
            <p className="text-xs text-steel-500 mb-4">Points deducted from security score per finding (base 100)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(policy.severityWeights || {}).map(([sev, weight]) => (
                <div key={sev} className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-3 font-mono" style={{
                    color: sev === 'CRITICAL' ? '#ef4444' : sev === 'HIGH' ? '#f97316' : sev === 'MEDIUM' ? '#eab308' : '#22c55e'
                  }}>
                    {sev}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weight}
                    onChange={e => updateWeight(sev, e.target.value)}
                    className="input-field w-full text-center text-lg font-mono font-bold"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Penalties */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-steel-50 flex items-center gap-2 mb-6">
              <Lock className="w-5 h-5 text-orange-400" /> Additional Penalties
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wider mb-2 font-mono">
                  Secret Detection Penalty
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={policy.secretPenalty}
                    onChange={e => setPolicy(p => ({ ...p, secretPenalty: parseInt(e.target.value) }))}
                    className="flex-1 accent-orange-500"
                  />
                  <span className="text-xl font-black font-mono text-orange-400 w-12 text-right">{policy.secretPenalty}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wider mb-2 font-mono">
                  DAST Finding Penalty
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={policy.dastPenalty}
                    onChange={e => setPolicy(p => ({ ...p, dastPenalty: parseInt(e.target.value) }))}
                    className="flex-1 accent-cyan-500"
                  />
                  <span className="text-xl font-black font-mono text-cyan-400 w-12 text-right">{policy.dastPenalty}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSavePolicy}
              disabled={saving}
              className="btn-primary flex items-center gap-2 px-6 py-3 text-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Security Policy'}
            </button>
          </div>
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && config && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-steel-50 flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-blue-400" /> Repository Configuration
            </h3>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wider mb-2 font-mono">
                  Repository URL
                </label>
                <input
                  type="text"
                  value={config.repo_url || ''}
                  onChange={e => setConfig(c => ({ ...c, repo_url: e.target.value }))}
                  className="input-field w-full"
                  placeholder="https://github.com/org/repo"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wider mb-2 font-mono">
                    Branch
                  </label>
                  <input
                    type="text"
                    value={config.branch || ''}
                    onChange={e => setConfig(c => ({ ...c, branch: e.target.value }))}
                    className="input-field w-full"
                    placeholder="main"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wider mb-2 font-mono">
                    Scan Interval (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={config.scan_interval || 30}
                    onChange={e => setConfig(c => ({ ...c, scan_interval: parseInt(e.target.value) || 30 }))}
                    className="input-field w-full"
                  />
                </div>
              </div>
              <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer">
                <div>
                  <span className="text-sm text-steel-200 block">Auto Scan on Push</span>
                  <span className="text-[10px] text-steel-500">Trigger scans automatically on webhook events</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.auto_scan || false}
                  onChange={e => setConfig(c => ({ ...c, auto_scan: e.target.checked }))}
                  className="w-5 h-5 rounded accent-violet-500"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="btn-primary flex items-center gap-2 px-6 py-3 text-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      <Modal
        open={resetModal}
        onClose={() => setResetModal(false)}
        title="Reset to Defaults"
        description="This will reset all policy settings"
        size="sm"
        danger
      >
        <p className="text-sm text-steel-300 py-2">
          Are you sure you want to reset all security policy settings to their default values? You'll still need to save after resetting.
        </p>
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/[0.06]">
          <button onClick={() => setResetModal(false)} className="btn-secondary text-sm px-4 py-2">Cancel</button>
          <button onClick={handleReset}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors">
            Reset Defaults
          </button>
        </div>
      </Modal>
    </div>
  )
}
