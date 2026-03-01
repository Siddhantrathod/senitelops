import { useState, useEffect } from 'react'
import { Navigate, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Crown, User, Lock, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function AdminLogin() {
  const { login, loginWithToken, isAuthenticated, isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      loginWithToken(token).then(() => {
        // After login, check if user is admin
        // The redirect will happen via the isAuthenticated/isAdmin checks below
      })
    }
  }, [searchParams])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  // If authenticated and admin, go to admin dashboard
  if (isAuthenticated && isAdmin()) return <Navigate to="/admin" replace />

  // If authenticated but NOT admin, show access denied
  if (isAuthenticated && !isAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 grid-bg opacity-30" />
        </div>
        <div className="relative w-full max-w-md text-center">
          <div className="glass-card p-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
              <Crown className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-steel-50 mb-2">Access Denied</h2>
            <p className="text-steel-400 mb-6">
              Admin privileges are required to access this console. Contact your administrator for access.
            </p>
            <div className="flex gap-3 justify-center">
              <Link to="/dashboard" className="btn-primary px-6 py-2.5 text-sm">
                Go to Dashboard
              </Link>
              <Link to="/" className="btn-secondary px-6 py-2.5 text-sm">
                Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const result = await login(username, password)
    if (result.success) {
      // login() sets user state; after re-render, the isAdmin check above handles redirect
      // But we need to wait for user state to populate
      // Small delay to let auth state settle
      setTimeout(() => {
        setIsLoading(false)
      }, 500)
    } else {
      setError(result.error)
      setIsLoading(false)
    }
  }

  const inputClass = 'w-full py-3 bg-theme-input text-steel-50 rounded-xl border border-theme-strong focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 outline-none transition-all placeholder-theme font-mono text-sm'

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 grid-bg opacity-30" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 shadow-glow-sm mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-steel-50">SentinelOps</h1>
          <p className="text-red-400 mt-2 font-semibold text-sm tracking-wider uppercase">Admin Console</p>
        </div>

        {/* Login Form */}
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-xs">
              This is a restricted area. Only administrator accounts can access the admin console.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-steel-300 font-medium mb-2 text-sm">Admin Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-steel-600" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`${inputClass} pl-12 pr-4`}
                  placeholder="Enter admin username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-steel-300 font-medium mb-2 text-sm">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-steel-600" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pl-12 pr-12`}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-steel-600 hover:text-steel-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 text-white hover:from-red-500 hover:to-orange-400 transition-all shadow-lg hover:shadow-red-500/25"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Crown className="w-5 h-5" />
                  Sign In as Admin
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-theme">
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-steel-500 hover:text-steel-300 text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to User Login
            </Link>
          </div>
        </div>

        <p className="text-center text-steel-600 text-sm mt-6">
          SentinelOps Admin Console — Restricted Access
        </p>
      </div>
    </div>
  )
}
