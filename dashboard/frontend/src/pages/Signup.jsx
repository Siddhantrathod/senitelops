import { useState } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { Shield, User, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight, Building, Briefcase, Phone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getGoogleAuthUrl } from '../services/api'

// Google icon component
const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
    </svg>
)

export default function Signup() {
    const { isAuthenticated, loading, signup } = useAuth()
    const navigate = useNavigate()
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        fullName: '',
        organization: '',
        roleTitle: '',
        phone: '',
        password: '',
        confirmPassword: '',
    })
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [fieldErrors, setFieldErrors] = useState([])
    const [isLoading, setIsLoading] = useState(false)

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
            </div>
        )
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />
    }

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
        // Clear errors when user starts typing
        if (error) setError('')
        if (fieldErrors.length) setFieldErrors([])
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setFieldErrors([])

        // Client-side validation
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match')
            return
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters')
            return
        }

        if (formData.username.length < 3) {
            setError('Username must be at least 3 characters')
            return
        }

        setIsLoading(true)

        const result = await signup({
            username: formData.username,
            email: formData.email,
            password: formData.password,
            fullName: formData.fullName,
            organization: formData.organization,
            roleTitle: formData.roleTitle,
            phone: formData.phone,
        })

        if (result.success) {
            navigate('/login', { state: { message: result.message || 'Account created successfully! Please sign in.' } })
        } else {
            setError(result.error)
            if (result.errors) setFieldErrors(result.errors)
        }

        setIsLoading(false)
    }

    const handleGoogleSignup = () => {
        window.location.href = getGoogleAuthUrl()
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200/30 rounded-full blur-3xl opacity-50" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl opacity-50" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-block">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-500 shadow-lg shadow-primary-500/20 mb-4">
                            <Shield className="w-8 h-8 text-white" />
                        </div>
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900">Create Account</h1>
                    <p className="text-slate-500 mt-2">Get started with SentinelOps</p>
                </div>

                {/* Signup Form */}
                <div className="glass-card p-8 bg-white border border-slate-200 shadow-xl rounded-2xl">
                    {/* Google Sign Up */}
                    <button
                        onClick={handleGoogleSignup}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                    >
                        <GoogleIcon />
                        Continue with Google
                    </button>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-slate-400">or sign up with email</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-red-600 text-sm font-medium">{error}</p>
                                    {fieldErrors.length > 1 && (
                                        <ul className="text-red-500 text-xs mt-1 list-disc list-inside">
                                            {fieldErrors.slice(1).map((err, i) => (
                                                <li key={i}>{err}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Full Name */}
                        <div>
                            <label className="block text-slate-700 font-medium mb-1.5 text-sm">Full Name <span className="text-red-400">*</span></label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 text-slate-900 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-400 text-sm"
                                    placeholder="John Doe"
                                    required
                                />
                            </div>
                        </div>

                        {/* Username & Email row */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-slate-700 font-medium mb-1.5 text-sm">Username <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-slate-50 text-slate-900 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-400 text-sm"
                                    placeholder="johndoe"
                                    required
                                    minLength={3}
                                />
                            </div>
                            <div>
                                <label className="block text-slate-700 font-medium mb-1.5 text-sm">Email <span className="text-red-400">*</span></label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-slate-50 text-slate-900 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-400 text-sm"
                                    placeholder="john@company.com"
                                    required
                                />
                            </div>
                        </div>

                        {/* Organization & Role */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-slate-700 font-medium mb-1.5 text-sm">Organization</label>
                                <div className="relative">
                                    <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        name="organization"
                                        value={formData.organization}
                                        onChange={handleChange}
                                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 text-slate-900 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-400 text-sm"
                                        placeholder="Acme Inc."
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-700 font-medium mb-1.5 text-sm">Role / Title</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        name="roleTitle"
                                        value={formData.roleTitle}
                                        onChange={handleChange}
                                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 text-slate-900 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-400 text-sm"
                                        placeholder="DevOps Engineer"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-slate-700 font-medium mb-1.5 text-sm">Phone <span className="text-slate-400 font-normal">(optional)</span></label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 text-slate-900 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-400 text-sm"
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-slate-700 font-medium mb-1.5 text-sm">Password <span className="text-red-400">*</span></label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full pl-12 pr-12 py-2.5 bg-slate-50 text-slate-900 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-400 text-sm"
                                    placeholder="Min. 6 characters"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-slate-700 font-medium mb-1.5 text-sm">Confirm Password <span className="text-red-400">*</span></label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 text-slate-900 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder-slate-400 text-sm"
                                    placeholder="Confirm your password"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full btn-primary py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                                    Creating account...
                                </>
                            ) : (
                                <>
                                    Create Account
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                        <p className="text-slate-500 text-sm">
                            Already have an account?{' '}
                            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-slate-400 text-sm mt-6">
                    By creating an account, you agree to our Terms of Service
                </p>
            </div>
        </div>
    )
}
