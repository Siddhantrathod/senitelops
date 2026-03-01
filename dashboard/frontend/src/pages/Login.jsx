import { useState, useEffect } from 'react'
import { Navigate, useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom'
import { Shield, User, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getGoogleAuthUrl } from '../services/api'

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
)

export default function Login() {
  const { login, loginWithToken, isAuthenticated, isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const token = searchParams.get('token')
    const provider = searchParams.get('provider')
    const oauthError = searchParams.get('error')
    if (oauthError) {
      setError(oauthError === 'google_auth_failed' ? 'Google authentication failed' :
        oauthError === 'no_email' ? 'No email returned from Google' :
          searchParams.get('message') || 'Authentication error')
    } else if (token && provider === 'google') {
      loginWithToken(token).then((result) => {
        const dest = result.user?.role === 'admin' ? '/admin' : '/dashboard'
        navigate(dest, { replace: true })
      })
    }
  }, [searchParams])

  const successMessage = location.state?.message

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (isAuthenticated) return <Navigate to={isAdmin() ? '/admin' : '/dashboard'} replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const result = await login(username, password)
    if (result.success) {
      const dest = result.user?.role === 'admin' ? '/admin' : '/dashboard'
      navigate(dest, { replace: true })
    } else {
      setError(result.error)
    }
    setIsLoading(false)
  }

  const handleGoogleLogin = () => {
    window.location.href = getGoogleAuthUrl()
  }

  const inputClass = 'w-full py-3 bg-theme-input text-steel-50 rounded-xl border border-theme-strong focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all placeholder-theme font-mono text-sm'

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute inset-0 grid-bg opacity-30" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-glow-sm mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </Link>
          <h1 className="text-3xl font-bold text-steel-50">SentinelOps</h1>
          <p className="text-steel-500 mt-2">Security Dashboard Login</p>
        </div>

        {/* Login Form */}
        <div className="glass-card p-8">
          {/* Success Message */}
          {successMessage && (
            <div className="flex items-center gap-3 p-4 bg-lime-500/10 border border-lime-500/20 rounded-xl mb-6">
              <CheckCircle className="w-5 h-5 text-lime-400 flex-shrink-0" />
              <p className="text-lime-300 text-sm">{successMessage}</p>
            </div>
          )}

          {/* Google Sign In */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-theme-input border border-theme-strong rounded-xl font-medium text-steel-200 hover:bg-theme-hover hover:border-theme-strong transition-all"
          >
            <GoogleIcon />
            Continue with Google
          </button>

            <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-theme" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-surface-secondary text-steel-500">or sign in with username</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-steel-300 font-medium mb-2 text-sm">Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-steel-600" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`${inputClass} pl-12 pr-4`}
                  placeholder="Enter your username"
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
              className="w-full btn-primary py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-theme">
            <p className="text-steel-500 text-sm text-center">
              Don't have an account?{' '}
              <Link to="/signup" className="font-semibold text-violet-400 hover:text-violet-300">
                Create one
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-steel-600 text-sm mt-6">
          Protected by SentinelOps Security
        </p>
      </div>
    </div>
  )
}
