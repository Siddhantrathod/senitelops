import { useState } from 'react'
import {
  GitBranch, Shield, Rocket, CheckCircle, AlertCircle,
  Loader2, ArrowRight, ArrowLeft, Settings, Link as LinkIcon,
} from 'lucide-react'

const inputClass = 'w-full py-2.5 px-4 bg-white/[0.04] text-white rounded-xl border border-white/[0.08] focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all placeholder-steel-600 font-mono text-sm'

export default function SetupWizard({ onComplete, onCancel }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [formData, setFormData] = useState({
    repo_url: '',
    branch: 'main',
    policy: {
      minScore: 70, blockCritical: true, blockHigh: false,
      maxCriticalVulns: 0, maxHighVulns: 5, autoBlock: true,
    }
  })

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePolicyChange = (field, value) => {
    setFormData(prev => ({ ...prev, policy: { ...prev.policy, [field]: value } }))
  }

  const validateStep1 = () => {
    if (!formData.repo_url.trim()) { setError('Repository URL is required'); return false }
    const urlPattern = /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+(?:\.git)?$/
    if (!urlPattern.test(formData.repo_url)) {
      setError('Please enter a valid GitHub repository URL (e.g., https://github.com/user/repo)')
      return false
    }
    setError(null)
    return true
  }

  const handleNext = () => { if (step === 1 && !validateStep1()) return; setStep(prev => prev + 1) }
  const handleBack = () => { setError(null); setStep(prev => prev - 1) }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Setup failed')
      onComplete(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/20 mb-4">
            <Shield className="w-8 h-8 text-violet-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to SentinelOps</h1>
          <p className="text-steel-500">Let's set up your security scanning platform</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold font-mono text-sm transition-all ${
                step >= s
                  ? 'bg-violet-500 text-white shadow-glow-sm'
                  : 'bg-white/[0.04] border border-white/[0.08] text-steel-600'
              }`}>
                {step > s ? <CheckCircle className="w-5 h-5" /> : s}
              </div>
              {s < 3 && (
                <div className={`w-20 h-1 mx-2 rounded-full transition-all ${step > s ? 'bg-violet-500' : 'bg-white/[0.06]'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="glass-card p-8">
          {/* Step 1: Repository Configuration */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <GitBranch className="w-6 h-6 text-violet-400" />
                <h2 className="text-xl font-semibold text-white">Connect Your Repository</h2>
              </div>
              <p className="text-steel-400 mb-6">
                Enter the GitHub repository URL that SentinelOps should monitor and scan for security vulnerabilities.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] font-mono text-steel-500 mb-2">GitHub Repository URL *</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-steel-600" />
                    <input type="url" value={formData.repo_url} onChange={(e) => handleInputChange('repo_url', e.target.value)}
                      placeholder="https://github.com/username/repository" className={`${inputClass} pl-10`} />
                  </div>
                  <p className="text-xs text-steel-600 mt-1 font-mono">
                    Example: https://github.com/Siddhantrathod/sentinelops-secure-app
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] font-mono text-steel-500 mb-2">Branch</label>
                  <input type="text" value={formData.branch} onChange={(e) => handleInputChange('branch', e.target.value)}
                    placeholder="main" className={inputClass} />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Security Policy */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <Settings className="w-6 h-6 text-violet-400" />
                <h2 className="text-xl font-semibold text-white">Configure Security Policy</h2>
              </div>
              <p className="text-steel-400 mb-6">
                Set your security thresholds. The pipeline will be blocked if these policies are violated.
              </p>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] font-mono text-steel-500 mb-2">Minimum Security Score (0-100)</label>
                  <input type="number" min="0" max="100" value={formData.policy.minScore}
                    onChange={(e) => handlePolicyChange('minScore', parseInt(e.target.value))} className={inputClass} />
                  <p className="text-xs text-steel-600 mt-1 font-mono">Pipeline will be blocked if score falls below this threshold</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.15em] font-mono text-steel-500 mb-2">Max Critical Vulnerabilities</label>
                    <input type="number" min="0" value={formData.policy.maxCriticalVulns}
                      onChange={(e) => handlePolicyChange('maxCriticalVulns', parseInt(e.target.value))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.15em] font-mono text-steel-500 mb-2">Max High Vulnerabilities</label>
                    <input type="number" min="0" value={formData.policy.maxHighVulns}
                      onChange={(e) => handlePolicyChange('maxHighVulns', parseInt(e.target.value))} className={inputClass} />
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { field: 'blockCritical', label: 'Block on Critical Vulnerabilities' },
                    { field: 'blockHigh', label: 'Block on High Vulnerabilities' },
                    { field: 'autoBlock', label: 'Enable Auto-blocking' },
                  ].map(({ field, label }) => (
                    <label key={field} className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={formData.policy[field]}
                        onChange={(e) => handlePolicyChange(field, e.target.checked)}
                        className="w-5 h-5 rounded bg-white/[0.04] border-white/[0.12] text-violet-500 focus:ring-violet-500/30" />
                      <span className="text-steel-200 group-hover:text-white transition-colors">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review & Launch */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <Rocket className="w-6 h-6 text-violet-400" />
                <h2 className="text-xl font-semibold text-white">Review & Launch</h2>
              </div>
              <p className="text-steel-400 mb-6">Review your configuration and launch the initial security scan.</p>

              <div className="space-y-4">
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <h3 className="text-[10px] uppercase tracking-[0.15em] font-mono text-steel-500 mb-2">Repository</h3>
                  <p className="text-white font-mono text-sm">{formData.repo_url}</p>
                  <p className="text-steel-500 text-sm mt-1 font-mono">Branch: {formData.branch}</p>
                </div>

                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <h3 className="text-[10px] uppercase tracking-[0.15em] font-mono text-steel-500 mb-2">Security Policy</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      ['Minimum Score', formData.policy.minScore],
                      ['Max Critical', formData.policy.maxCriticalVulns],
                      ['Max High', formData.policy.maxHighVulns],
                      ['Block Critical', formData.policy.blockCritical ? 'Yes' : 'No'],
                      ['Auto-block', formData.policy.autoBlock ? 'Enabled' : 'Disabled'],
                    ].map(([label, value]) => (
                      <div key={label} className="contents">
                        <div className="text-steel-500">{label}:</div>
                        <div className="text-white font-mono">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-violet-400 mt-0.5" />
                    <div>
                      <p className="text-violet-300 font-medium">Initial Scan</p>
                      <p className="text-violet-400/80 text-sm mt-1">
                        Clicking "Launch" will trigger a full security scan using both Bandit (code analysis)
                        and Trivy (container scanning). This may take a few minutes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
            <button onClick={step === 1 ? onCancel : handleBack} disabled={loading}
              className="px-5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-steel-300 font-medium hover:bg-white/[0.06] transition-all flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            {step < 3 ? (
              <button onClick={handleNext} className="btn-primary flex items-center gap-2">
                Next <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-2">
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Running Scan...</>
                ) : (
                  <><Rocket className="w-4 h-4" /> Launch Security Scan</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
