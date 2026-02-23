import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Shield,
  GitBranch,
  Activity,
  Trash2,
  Edit3,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Eye,
  UserPlus,
  Key,
  BarChart3,
  FileCode,
  Container,
  Globe,
  KeyRound,
  Gauge,
  Info,
  X,
  Save,
} from 'lucide-react'
import { cn } from '../utils/helpers'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import {
  fetchAdminStats,
  fetchAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  resetAdminUserPassword,
  fetchAdminPipelines,
  fetchAdminVulnSummary,
} from '../services/api'

/* ======================================================================
   CONFIG
   ====================================================================== */

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'pipelines', label: 'Pipelines & Logs', icon: GitBranch },
  { id: 'vulnerabilities', label: 'Vulnerabilities', icon: Shield },
]

const roleBadge = {
  admin: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  user: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  viewer: 'bg-steel-500/15 text-steel-400 border-steel-500/25',
}

const statusBadge = {
  success: 'bg-lime-500/15 text-lime-400 border-lime-500/25',
  failed: 'bg-red-500/15 text-red-400 border-red-500/25',
  running: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  queued: 'bg-steel-500/15 text-steel-400 border-steel-500/25',
}

const severityBadge = {
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/25',
  HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  LOW: 'bg-green-500/15 text-green-400 border-green-500/25',
}

const sourceIcon = {
  SAST: FileCode,
  Trivy: Container,
  Gitleaks: KeyRound,
  DAST: Globe,
}

/* ======================================================================
   SMALL COMPONENTS
   ====================================================================== */

function Badge({ children, className }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-full border', className)}>
      {children}
    </span>
  )
}

function StatBox({ label, value, icon: Icon, accent = 'violet' }) {
  const colors = {
    violet: 'from-violet-500/10 to-violet-500/5 border-violet-500/20 text-violet-400',
    lime: 'from-lime-500/10 to-lime-500/5 border-lime-500/20 text-lime-400',
    red: 'from-red-500/10 to-red-500/5 border-red-500/20 text-red-400',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-400',
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-400',
    cyan: 'from-cyan-500/10 to-cyan-500/5 border-cyan-500/20 text-cyan-400',
  }
  return (
    <div className={cn('rounded-xl border bg-gradient-to-br p-4', colors[accent])}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-steel-400">{label}</span>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <p className="text-2xl font-black font-mono text-white">{value}</p>
    </div>
  )
}

/* ======================================================================
   MODAL: EDIT USER
   ====================================================================== */

function EditUserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({
    role: user.role,
    fullName: user.fullName || '',
    organization: user.organization || '',
    roleTitle: user.roleTitle || '',
    phone: user.phone || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(user.id, form)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#161b22] border border-white/[0.08] rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Edit User — {user.username}</h3>
          <button onClick={onClose} className="text-steel-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wider mb-1">Role</label>
            <select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/[0.04] text-white rounded-xl border border-white/[0.08] outline-none text-sm focus:ring-2 focus:ring-violet-500/30"
            >
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wider mb-1">Full Name</label>
            <input
              type="text" value={form.fullName}
              onChange={e => setForm({ ...form, fullName: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/[0.04] text-white rounded-xl border border-white/[0.08] outline-none text-sm focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wider mb-1">Organization</label>
            <input
              type="text" value={form.organization}
              onChange={e => setForm({ ...form, organization: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/[0.04] text-white rounded-xl border border-white/[0.08] outline-none text-sm focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wider mb-1">Job Title</label>
            <input
              type="text" value={form.roleTitle}
              onChange={e => setForm({ ...form, roleTitle: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/[0.04] text-white rounded-xl border border-white/[0.08] outline-none text-sm focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm px-4 py-2 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

/* ======================================================================
   MODAL: RESET PASSWORD
   ====================================================================== */

function ResetPasswordModal({ user, onClose, onReset }) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleReset = async () => {
    if (password.length < 6) { setError('Minimum 6 characters'); return }
    setSaving(true)
    await onReset(user.id, password)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-[#161b22] border border-white/[0.08] rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Reset Password</h3>
          <button onClick={onClose} className="text-steel-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-steel-400 mb-4">Set a new password for <span className="text-white font-medium">{user.username}</span></p>
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(null) }}
          placeholder="New password (min 6 chars)"
          className="w-full px-4 py-2.5 bg-white/[0.04] text-white rounded-xl border border-white/[0.08] outline-none text-sm focus:ring-2 focus:ring-violet-500/30 mb-4"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">Cancel</button>
          <button onClick={handleReset} disabled={saving} className="btn-primary text-sm px-4 py-2 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

/* ======================================================================
   MAIN ADMIN PANEL
   ====================================================================== */

export default function AdminPanel() {
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  // Data
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [pipelines, setPipelines] = useState([])
  const [vulnFindings, setVulnFindings] = useState([])

  // UI state
  const [userSearch, setUserSearch] = useState('')
  const [pipelineFilter, setPipelineFilter] = useState('all')
  const [expandedPipeline, setExpandedPipeline] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [resetPwUser, setResetPwUser] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/dashboard')
      return
    }
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [statsRes, usersRes, pipeRes, vulnRes] = await Promise.allSettled([
        fetchAdminStats(),
        fetchAdminUsers(),
        fetchAdminPipelines(),
        fetchAdminVulnSummary(),
      ])
      if (statsRes.status === 'fulfilled') setStats(statsRes.value)
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.users || [])
      if (pipeRes.status === 'fulfilled') setPipelines(pipeRes.value.pipelines || [])
      if (vulnRes.status === 'fulfilled') setVulnFindings(vulnRes.value.findings || [])
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  // ── User management handlers ──
  const handleSaveUser = async (userId, data) => {
    try {
      await updateAdminUser(userId, data)
      setMessage({ type: 'success', text: 'User updated successfully' })
      setEditingUser(null)
      const res = await fetchAdminUsers()
      setUsers(res.users || [])
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update user' })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return
    try {
      await deleteAdminUser(userId)
      setMessage({ type: 'success', text: `User "${username}" deleted` })
      const res = await fetchAdminUsers()
      setUsers(res.users || [])
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to delete user' })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  const handleResetPassword = async (userId, newPassword) => {
    try {
      await resetAdminUserPassword(userId, newPassword)
      setMessage({ type: 'success', text: 'Password reset successfully' })
      setResetPwUser(null)
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to reset password' })
    }
    setTimeout(() => setMessage(null), 3000)
  }

  // ── Filtered data ──
  const filteredUsers = useMemo(() => {
    if (!userSearch) return users
    const q = userSearch.toLowerCase()
    return users.filter(u =>
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.fullName?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    )
  }, [users, userSearch])

  const filteredPipelines = useMemo(() => {
    if (pipelineFilter === 'all') return pipelines
    return pipelines.filter(p => p.status === pipelineFilter)
  }, [pipelines, pipelineFilter])

  if (loading) return <PageLoader />

  if (!isAdmin()) {
    return <Alert variant="error" title="Access Denied">Admin privileges required.</Alert>
  }

  /* ====================================================================
     RENDER : TAB CONTENTS
     ==================================================================== */

  const renderOverview = () => {
    if (!stats) return null
    const { users: uStats, pipelines: pStats, config, policy, reports } = stats
    return (
      <div className="space-y-6">
        {/* Quick stat boxes */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatBox label="Total Users" value={uStats.total} icon={Users} accent="violet" />
          <StatBox label="Admins" value={uStats.admins} icon={Shield} accent="red" />
          <StatBox label="Total Pipelines" value={pStats.total} icon={GitBranch} accent="blue" />
          <StatBox label="Successful" value={pStats.successful} icon={CheckCircle} accent="lime" />
          <StatBox label="Failed" value={pStats.failed} icon={XCircle} accent="red" />
          <StatBox label="Avg Score" value={pStats.avg_security_score} icon={Gauge} accent="amber" />
        </div>

        {/* Project/Repo info */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-violet-400" /> Project & Repository
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-steel-500 uppercase w-32">Repo URL</span>
                <span className="text-sm text-white font-mono break-all">{config.repo_url || '—'}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-steel-500 uppercase w-32">Branch</span>
                <span className="text-sm text-white font-mono">{config.branch}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-steel-500 uppercase w-32">Auto Scan</span>
                <Badge className={config.auto_scan ? 'bg-lime-500/15 text-lime-400 border-lime-500/25' : 'bg-steel-500/15 text-steel-400 border-steel-500/25'}>
                  {config.auto_scan ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-steel-500 uppercase w-32">Scan on Push</span>
                <Badge className={config.scan_on_push ? 'bg-lime-500/15 text-lime-400 border-lime-500/25' : 'bg-steel-500/15 text-steel-400 border-steel-500/25'}>
                  {config.scan_on_push ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-steel-500 uppercase w-32">Setup</span>
                <Badge className={config.setup_completed ? 'bg-lime-500/15 text-lime-400 border-lime-500/25' : 'bg-amber-500/15 text-amber-400 border-amber-500/25'}>
                  {config.setup_completed ? 'Completed' : 'Pending'}
                </Badge>
              </div>
            </div>

            {/* Policy snapshot */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-steel-300 uppercase tracking-wider">Security Policy</h4>
              <div className="flex items-center gap-3">
                <span className="text-xs text-steel-500 w-32">Min Score</span>
                <span className="text-sm text-white font-mono">{policy.minScore}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-steel-500 w-32">Block Critical</span>
                <span className="text-sm text-white">{policy.blockCritical ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-steel-500 w-32">Block on Secrets</span>
                <span className="text-sm text-white">{policy.blockOnSecrets ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-steel-500 w-32">Auto Block</span>
                <span className="text-sm text-white">{policy.autoBlock ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          {/* Reports availability */}
          <div className="mt-6 pt-4 border-t border-white/[0.06]">
            <h4 className="text-sm font-bold text-steel-300 uppercase tracking-wider mb-3">Report Status</h4>
            <div className="flex flex-wrap gap-3">
              {Object.entries(reports).map(([key, available]) => (
                <Badge key={key} className={available ? 'bg-lime-500/15 text-lime-400 border-lime-500/25' : 'bg-red-500/15 text-red-400 border-red-500/25'}>
                  {available ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                  {key}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Deployment stats */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Deployment Decisions</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-lime-500/5 rounded-xl border border-lime-500/20">
                <p className="text-3xl font-black text-lime-400 font-mono">{pStats.deployable}</p>
                <p className="text-xs text-steel-400 mt-1 uppercase">Approved</p>
              </div>
              <div className="text-center p-4 bg-red-500/5 rounded-xl border border-red-500/20">
                <p className="text-3xl font-black text-red-400 font-mono">{pStats.blocked}</p>
                <p className="text-xs text-steel-400 mt-1 uppercase">Blocked</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4">User Distribution</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-violet-500/5 rounded-xl border border-violet-500/20">
                <p className="text-3xl font-black text-violet-400 font-mono">{uStats.admins}</p>
                <p className="text-xs text-steel-400 mt-1 uppercase">Admin</p>
              </div>
              <div className="text-center p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
                <p className="text-3xl font-black text-blue-400 font-mono">{uStats.users}</p>
                <p className="text-xs text-steel-400 mt-1 uppercase">Users</p>
              </div>
              <div className="text-center p-4 bg-steel-500/5 rounded-xl border border-steel-500/20">
                <p className="text-3xl font-black text-steel-400 font-mono">{uStats.viewers}</p>
                <p className="text-xs text-steel-400 mt-1 uppercase">Viewers</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderUsers = () => (
    <div className="space-y-4">
      {/* Search + count */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-steel-500" />
            <input
              type="text"
              placeholder="Search users..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] text-white rounded-xl border border-white/[0.08] outline-none text-sm focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
        </div>
        <span className="text-sm text-steel-500">{filteredUsers.length} users</span>
      </div>

      {/* Users table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-steel-500 uppercase tracking-wider">User</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-steel-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-steel-500 uppercase tracking-wider hidden md:table-cell">Organization</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-steel-500 uppercase tracking-wider hidden lg:table-cell">Auth</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-steel-500 uppercase tracking-wider hidden lg:table-cell">Last Login</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-steel-500 uppercase tracking-wider hidden lg:table-cell">Created</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold text-steel-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                        {u.username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{u.fullName || u.username}</p>
                        <p className="text-xs text-steel-500 font-mono">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge className={roleBadge[u.role] || roleBadge.viewer}>{u.role}</Badge>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <span className="text-sm text-steel-300">{u.organization || '—'}</span>
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <Badge className={u.authProvider === 'google' ? 'bg-blue-500/15 text-blue-400 border-blue-500/25' : 'bg-steel-500/15 text-steel-400 border-steel-500/25'}>
                      {u.authProvider || 'local'}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <span className="text-xs text-steel-500 font-mono">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</span>
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <span className="text-xs text-steel-500 font-mono">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="p-2 rounded-lg text-steel-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                        title="Edit user"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setResetPwUser(u)}
                        className="p-2 rounded-lg text-steel-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                        title="Reset password"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.username)}
                        disabled={u.id === user.id}
                        className="p-2 rounded-lg text-steel-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-steel-500 text-sm">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderPipelines = () => (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {['all', 'success', 'failed', 'running'].map(f => (
          <button
            key={f}
            onClick={() => setPipelineFilter(f)}
            className={cn(
              'px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border transition-colors',
              pipelineFilter === f
                ? 'bg-violet-500/15 text-violet-400 border-violet-500/25'
                : 'text-steel-500 border-white/[0.06] hover:border-white/[0.12] hover:text-steel-300'
            )}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
        <span className="ml-auto text-sm text-steel-500">{filteredPipelines.length} pipelines</span>
      </div>

      {/* Pipeline list */}
      <div className="space-y-3">
        {filteredPipelines.map(p => {
          const isExpanded = expandedPipeline === p.id
          return (
            <div key={p.id} className="glass-card overflow-hidden">
              {/* Header row */}
              <button
                onClick={() => setExpandedPipeline(isExpanded ? null : p.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-steel-500" /> : <ChevronRight className="w-4 h-4 text-steel-500" />}
                <Badge className={statusBadge[p.status] || statusBadge.queued}>{p.status}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    #{p.id} — {p.repo_name}/{p.branch}
                  </p>
                  <p className="text-xs text-steel-500 font-mono truncate">{p.commit_message}</p>
                </div>
                {p.security_score != null && (
                  <span className={cn('text-sm font-mono font-bold', p.security_score >= 70 ? 'text-lime-400' : p.security_score >= 40 ? 'text-amber-400' : 'text-red-400')}>
                    {p.security_score}/100
                  </span>
                )}
                <span className="text-xs text-steel-500 hidden sm:block">{p.triggered_at ? new Date(p.triggered_at).toLocaleString() : ''}</span>
                {p.is_deployable === true && <CheckCircle className="w-4 h-4 text-lime-400" />}
                {p.is_deployable === false && <XCircle className="w-4 h-4 text-red-400" />}
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-white/[0.06] pt-4 space-y-4">
                  {/* Meta */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div><span className="text-steel-500 block">Author</span><span className="text-white">{p.author}</span></div>
                    <div><span className="text-steel-500 block">Commit</span><span className="text-white font-mono">{p.commit_sha}</span></div>
                    <div><span className="text-steel-500 block">Duration</span><span className="text-white font-mono">{p.duration_seconds ? `${Math.round(p.duration_seconds)}s` : '—'}</span></div>
                    <div><span className="text-steel-500 block">Triggered By</span><span className="text-white">{p.triggered_by?.username || p.author}</span></div>
                  </div>

                  {/* Failure reasons */}
                  {p.failure_reasons?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Failure Reasons</h4>
                      <div className="space-y-1">
                        {p.failure_reasons.map((f, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-red-500/5 rounded-lg border border-red-500/10">
                            <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm text-white font-medium">{f.stage}</p>
                              <p className="text-xs text-red-300/80 font-mono">{f.error}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Short stage logs */}
                  {p.stage_logs?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-steel-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Info className="w-3 h-3" /> Stage Logs</h4>
                      <div className="space-y-1">
                        {p.stage_logs.map((s, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                            <CheckCircle className="w-4 h-4 text-steel-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-steel-300">{s.stage}</p>
                              <p className="text-xs text-steel-500 font-mono">{s.log}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vulnerability summary */}
                  {p.vulnerability_summary && (
                    <div>
                      <h4 className="text-xs font-bold text-steel-400 uppercase tracking-wider mb-2">Vulnerability Summary</h4>
                      <div className="flex flex-wrap gap-3">
                        {p.vulnerability_summary.critical > 0 && <Badge className={severityBadge.CRITICAL}>{p.vulnerability_summary.critical} Critical</Badge>}
                        {p.vulnerability_summary.high > 0 && <Badge className={severityBadge.HIGH}>{p.vulnerability_summary.high} High</Badge>}
                        {p.vulnerability_summary.medium > 0 && <Badge className={severityBadge.MEDIUM}>{p.vulnerability_summary.medium} Medium</Badge>}
                        {p.vulnerability_summary.low > 0 && <Badge className={severityBadge.LOW}>{p.vulnerability_summary.low} Low</Badge>}
                        {p.vulnerability_summary.secrets_found > 0 && <Badge className={severityBadge.CRITICAL}>{p.vulnerability_summary.secrets_found} Secrets</Badge>}
                        {p.vulnerability_summary.dast_alerts > 0 && <Badge className={severityBadge.HIGH}>{p.vulnerability_summary.dast_alerts} DAST Alerts</Badge>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {filteredPipelines.length === 0 && (
          <div className="text-center py-12 text-steel-500 text-sm">No pipelines found</div>
        )}
      </div>
    </div>
  )

  const renderVulnerabilities = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-steel-400">
          Top critical & high severity findings across all scanners
        </p>
        <span className="text-sm text-steel-500">{vulnFindings.length} findings</span>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-steel-500 uppercase tracking-wider">Source</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-steel-500 uppercase tracking-wider">Severity</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-steel-500 uppercase tracking-wider">Finding</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-steel-500 uppercase tracking-wider hidden md:table-cell">Location</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-steel-500 uppercase tracking-wider hidden lg:table-cell">Tool</th>
              </tr>
            </thead>
            <tbody>
              {vulnFindings.slice(0, 50).map((f, i) => {
                const SrcIcon = sourceIcon[f.source] || Shield
                return (
                  <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <SrcIcon className="w-4 h-4 text-steel-400" />
                        <span className="text-xs font-semibold text-steel-300">{f.source}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge className={severityBadge[f.severity] || severityBadge.MEDIUM}>{f.severity}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-white max-w-md truncate">{f.message}</p>
                      {f.rule_id && <p className="text-xs text-steel-500 font-mono">{f.rule_id}</p>}
                      {f.vulnerability_id && <p className="text-xs text-steel-500 font-mono">{f.vulnerability_id}</p>}
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <span className="text-xs text-steel-400 font-mono truncate block max-w-[200px]">
                        {f.file || f.url || '—'}
                        {f.line > 0 && `:${f.line}`}
                      </span>
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      <span className="text-xs text-steel-500">{f.tool}</span>
                    </td>
                  </tr>
                )
              })}
              {vulnFindings.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-steel-500 text-sm">No findings — scan your project first</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  /* ====================================================================
     MAIN RETURN
     ==================================================================== */

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Admin Panel</h1>
          <p className="text-steel-400 text-sm">Platform management & monitoring</p>
        </div>
        <button onClick={loadAll} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Status message */}
      {message && (
        <Alert variant={message.type === 'success' ? 'success' : 'error'} title={message.type === 'success' ? 'Success' : 'Error'}>
          {message.text}
        </Alert>
      )}

      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-xl border border-white/[0.06] overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-violet-500/15 text-violet-400 border border-violet-500/25'
                  : 'text-steel-500 hover:text-steel-300 hover:bg-white/[0.03] border border-transparent'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'users' && renderUsers()}
      {activeTab === 'pipelines' && renderPipelines()}
      {activeTab === 'vulnerabilities' && renderVulnerabilities()}

      {/* Modals */}
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleSaveUser} />}
      {resetPwUser && <ResetPasswordModal user={resetPwUser} onClose={() => setResetPwUser(null)} onReset={handleResetPassword} />}
    </div>
  )
}
