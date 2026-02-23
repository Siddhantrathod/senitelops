import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield,
  GitBranch,
  Settings,
  Rocket,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Link as LinkIcon,
  Lock,
  Zap,
  BarChart3,
  FileSearch,
  ChevronRight,
} from 'lucide-react'
import { completeSetup, fetchSetupStatus } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from '../components/LoadingSpinner'

const features = [
  {
    icon: FileSearch,
    title: 'Code Analysis',
    description: 'Bandit SAST scanning for Python vulnerabilities'
  },
  {
    icon: Shield,
    title: 'Container Security',
    description: 'Trivy scanning for CVEs in dependencies'
  },
  {
    icon: BarChart3,
    title: 'Security Scoring',
    description: 'Automated security score calculation'
  },
  {
    icon: Zap,
    title: 'CI/CD Integration',
    description: 'Automated pipeline with deployment gates'
  }
]

export default function Setup() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [step, setStep] = useState(0) // 0 = welcome, 1 = repo, 2 = policy, 3 = scanning
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const [scanProgress, setScanProgress] = useState('')

  const [formData, setFormData] = useState({
    repo_url: '',
    branch: 'main',
    policy: {
      minScore: 70,
      blockCritical: true,
      blockHigh: false,
      maxCriticalVulns: 0,
      maxHighVulns: 5,
      autoBlock: true,
    }
  })

  useEffect(() => {
    checkSetup()
  }, [isAuthenticated])

  const checkSetup = async () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    try {
      const status = await fetchSetupStatus()
      if (status.setup_completed) {
        navigate('/')
      }
    } catch (err) {
      console.error('Error checking setup:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handlePolicyChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      policy: { ...prev.policy, [field]: value }
    }))
  }

  const validateRepoUrl = () => {
    if (!formData.repo_url.trim()) {
      setError('Repository URL is required')
      return false
    }
    const urlPattern = /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+(?:\.git)?$/
    if (!urlPattern.test(formData.repo_url)) {
      setError('Please enter a valid GitHub repository URL (e.g., https://github.com/user/repo)')
      return false
    }
    return true
  }

  const handleNext = () => {
    if (step === 1 && !validateRepoUrl()) return
    setError(null)
    setStep(prev => prev + 1)
  }

  const handleBack = () => {
    setError(null)
    setStep(prev => prev - 1)
  }

  const handleSubmit = async () => {
    setScanning(true)
    setError(null)
    setStep(3)

    const progressMessages = [
      'Validating repository...',
      'Cloning repository...',
      'Running Bandit security scan...',
      'Running Trivy vulnerability scan...',
      'Analyzing results...',
      'Generating security decision...',
      'Finalizing setup...'
    ]

    let msgIndex = 0
    const progressInterval = setInterval(() => {
      if (msgIndex < progressMessages.length) {
        setScanProgress(progressMessages[msgIndex])
        msgIndex++
      }
    }, 5000)

    try {
      setScanProgress(progressMessages[0])
      await completeSetup(formData)
      clearInterval(progressInterval)
      setScanProgress('Setup complete!')

      setTimeout(() => {
        navigate('/')
      }, 1500)
    } catch (err) {
      clearInterval(progressInterval)
      setError(err.response?.data?.error || err.message || 'Setup failed')
      setScanning(false)
      setStep(2)
    }
  }

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[800px] rounded-3xl shadow-2xl overflow-hidden flex border border-slate-200">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-primary-600 to-primary-800 p-12 flex-col justify-between relative overflow-hidden">
          {/* Decorative Pattern */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0 0 L100 0 L100 100 Z" fill="white" />
            </svg>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">SentinelOps</span>
            </div>

            <h1 className="text-3xl font-bold text-white mb-4 leading-tight">
              Secure Your Code Pipeline
            </h1>
            <p className="text-primary-100 mb-8 leading-relaxed">
              Enterprise-grade DevSecOps platform that integrates security scanning directly into your CI/CD workflow.
            </p>

            <div className="space-y-5">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-4 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">{feature.title}</h3>
                    <p className="text-xs text-primary-100 mt-0.5">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 text-primary-200 text-xs">
            © 2026 SentinelOps. All rights reserved.
          </div>
        </div>

        {/* Right Side - Setup Form */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-12 bg-white relative">
          <div className="w-full max-w-lg">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">SentinelOps</span>
            </div>

            {/* Progress Indicator */}
            {step > 0 && step < 3 && (
              <div className="mb-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-500">Step {step} of 2</span>
                  <span className="text-sm font-medium text-primary-600">{step * 50}% complete</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-600 transition-all duration-500 ease-out"
                    style={{ width: `${step * 50}%` }}
                  />
                </div>
              </div>
            )}

            {/* Step 0: Welcome */}
            {step === 0 && (
              <div className="text-center animate-fade-in">
                <div className="w-20 h-20 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <Rocket className="w-10 h-10 text-primary-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-3">
                  Welcome, {user?.username || 'Admin'}!
                </h2>
                <p className="text-slate-500 mb-8 text-lg">
                  Let's get your security scanning platform ready in just 2 simple steps.
                </p>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 mb-8 text-left">
                  <h3 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wide">What you'll set up:</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm">
                        <GitBranch className="w-4 h-4 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-slate-800 font-semibold text-sm">Connect Repository</p>
                        <p className="text-xs text-slate-500 mt-0.5">Link your GitHub repository for scanning</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm">
                        <Settings className="w-4 h-4 text-primary-600" />
                      </div>
                      <div>
                        <p className="text-slate-800 font-semibold text-sm">Configure Policy</p>
                        <p className="text-xs text-slate-500 mt-0.5">Set security thresholds for deployments</p>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setStep(1)}
                  className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-2"
                >
                  Get Started
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Step 1: Repository */}
            {step === 1 && (
              <div className="animate-slide-in">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center border border-primary-100">
                    <GitBranch className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Connect Repository</h2>
                    <p className="text-slate-500 text-sm">Enter your GitHub repository details</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Repository URL *
                    </label>
                    <div className="relative">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="url"
                        value={formData.repo_url}
                        onChange={(e) => handleInputChange('repo_url', e.target.value)}
                        placeholder="https://github.com/username/repository"
                        className="w-full input-field pl-12 py-3"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Enter the full URL of your public GitHub repository
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Branch
                    </label>
                    <input
                      type="text"
                      value={formData.branch}
                      onChange={(e) => handleInputChange('branch', e.target.value)}
                      placeholder="main"
                      className="w-full input-field py-3"
                    />
                  </div>

                  {/* Repository Requirements */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                    <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Repository Requirements
                    </h4>
                    <ul className="space-y-2 text-sm text-blue-700">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span><strong>Public GitHub repository</strong> — must be accessible without auth</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span><strong>Source code files</strong> — JS, Python, Go, Java, etc. for SAST scanning</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-blue-300 mt-0.5 flex-shrink-0 flex items-center justify-center text-[8px] text-blue-400 font-bold">?</span>
                        <span><strong>Dockerfile</strong> (optional) — enables Docker image build &amp; container scan. Without it, Trivy scans dependencies via filesystem</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-blue-300 mt-0.5 flex-shrink-0 flex items-center justify-center text-[8px] text-blue-400 font-bold">?</span>
                        <span><strong>package.json / requirements.txt</strong> (optional) — improves dependency vulnerability detection</span>
                      </li>
                    </ul>
                  </div>

                  {error && (
                    <div className="flex items-start gap-3 text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  )}

                  <div className="flex gap-4 pt-6">
                    <button
                      onClick={handleBack}
                      className="flex-1 btn-secondary py-3 flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      onClick={handleNext}
                      className="flex-1 btn-primary py-3 flex items-center justify-center gap-2"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Policy */}
            {step === 2 && (
              <div className="animate-slide-in">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center border border-primary-100">
                    <Lock className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Security Policy</h2>
                    <p className="text-slate-500 text-sm">Configure deployment security rules</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Min Security Score */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-bold text-slate-700">
                        Minimum Security Score
                      </label>
                      <span className="text-2xl font-bold text-primary-600">
                        {formData.policy.minScore}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.policy.minScore}
                      onChange={(e) => handlePolicyChange('minScore', parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                      <span>0 (Allow All)</span>
                      <span>100 (Strict)</span>
                    </div>
                  </div>

                  {/* Toggle Options */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="text-slate-800 font-semibold text-sm">Block Critical Vulnerabilities</p>
                        <p className="text-xs text-slate-500 mt-0.5">Prevent deployment with critical issues</p>
                      </div>
                      <label className="relative inline-flex cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.policy.blockCritical}
                          onChange={(e) => handlePolicyChange('blockCritical', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-primary-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="text-slate-800 font-semibold text-sm">Block High Vulnerabilities</p>
                        <p className="text-xs text-slate-500 mt-0.5">Prevent deployment with high severity issues</p>
                      </div>
                      <label className="relative inline-flex cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.policy.blockHigh}
                          onChange={(e) => handlePolicyChange('blockHigh', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-primary-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm"></div>
                      </label>
                    </div>
                  </div>

                  {/* Threshold Settings */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border border-slate-200 rounded-xl">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Max Critical</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.policy.maxCriticalVulns}
                        onChange={(e) => handlePolicyChange('maxCriticalVulns', parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-50 border-0 rounded-lg py-2 px-3 text-slate-800 text-center text-lg font-bold"
                      />
                    </div>
                    <div className="p-4 border border-slate-200 rounded-xl">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Max High</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.policy.maxHighVulns}
                        onChange={(e) => handlePolicyChange('maxHighVulns', parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-50 border-0 rounded-lg py-2 px-3 text-slate-800 text-center text-lg font-bold"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-3 text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span className="text-sm font-medium">{error}</span>
                    </div>
                  )}

                  <div className="flex gap-4 pt-6">
                    <button
                      onClick={handleBack}
                      className="flex-1 btn-secondary py-3 flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      onClick={handleSubmit}
                      className="flex-1 btn-primary py-3 flex items-center justify-center gap-2"
                    >
                      <Rocket className="w-4 h-4" />
                      Launch Setup
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Scanning */}
            {step === 3 && (
              <div className="text-center py-8 animate-fade-in">
                <div className="w-24 h-24 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                  {scanning ? (
                    <>
                      <div className="absolute inset-0 border-4 border-primary-200 rounded-full animate-ping"></div>
                      <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
                    </>
                  ) : (
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  )}
                </div>

                <h2 className="text-2xl font-bold text-slate-900 mb-3">
                  {scanning ? 'Setting Up Your Platform' : 'Setup Complete!'}
                </h2>
                <p className="text-slate-500 mb-8 text-lg">
                  {scanProgress}
                </p>

                {scanning && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left max-w-sm mx-auto shadow-sm">
                    <div className="space-y-4">
                      {['Bandit SAST Scan', 'Trivy CVE Scan', 'Security Decision'].map((item, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${index < 2 ? 'bg-white border border-slate-200' : 'bg-slate-200'}`}>
                            {index < 2 ? (
                              <Loader2 className="w-3 h-3 text-primary-600 animate-spin" />
                            ) : (
                              <div className="w-2 h-2 bg-slate-400 rounded-full" />
                            )}
                          </div>
                          <span className="text-slate-600 text-sm font-medium">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!scanning && (
                  <p className="text-green-600 font-medium animate-pulse">
                    Redirecting to dashboard...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
