import { useState, useCallback } from 'react'
import {
  Users, UserPlus, Edit3, Trash2, KeyRound, ShieldAlert,
  ShieldCheck, Filter, RefreshCw, AlertTriangle, CheckCircle,
  Mail, Calendar, Globe, Lock, Activity, GitBranch,
} from 'lucide-react'
import { cn } from '../../utils/helpers'
import { DataTable, StatusBadge, Modal, KpiCard, SkeletonTable } from '../../components/admin'
import { useAdminData } from '../../hooks/useAdminData'
import {
  fetchAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  resetAdminUserPassword,
  fetchAdminUserDetails,
} from '../../services/api'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', icon: ShieldAlert },
  { value: 'user', label: 'User', icon: Users },
]

export default function AdminUsers() {
  const { data: users, loading, error, refresh } = useAdminData(fetchAdminUsers)
  const [roleFilter, setRoleFilter] = useState('all')
  const [authFilter, setAuthFilter] = useState('all')

  // Modal states
  const [editModal, setEditModal] = useState({ open: false, user: null })
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null })
  const [resetPwModal, setResetPwModal] = useState({ open: false, user: null })
  const [detailsModal, setDetailsModal] = useState({ open: false, data: null })
  const [editForm, setEditForm] = useState({ role: '', email: '' })
  const [newPassword, setNewPassword] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState(null)

  const showMsg = (text, type = 'success') => {
    setActionMsg({ text, type })
    setTimeout(() => setActionMsg(null), 4000)
  }

  // Filtered data
  const filteredUsers = (users || []).filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    const auth = u.authProvider || u.auth_type
    if (authFilter !== 'all' && auth !== authFilter) return false
    return true
  })

  // Stats (driven by filtered results)
  const totalUsers = filteredUsers.length
  const admins = filteredUsers.filter(u => u.role === 'admin').length
  const googleUsers = filteredUsers.filter(u => (u.authProvider === 'google' || u.auth_type === 'google')).length
  const recent7d = filteredUsers.filter(u => {
    if (!u.created_at) return false
    const d = new Date(u.created_at)
    return (Date.now() - d.getTime()) < 7 * 86400 * 1000
  }).length

  // Handlers
  const openEdit = (user) => {
    setEditForm({ role: user.role, email: user.email || '' })
    setEditModal({ open: true, user })
  }

  const handleUpdate = async () => {
    setActionLoading(true)
    try {
      await updateAdminUser(editModal.user.id, editForm)
      showMsg(`Updated user "${editModal.user.username}"`)
      setEditModal({ open: false, user: null })
      refresh()
    } catch (err) {
      showMsg(err.response?.data?.message || 'Update failed', 'error')
    }
    setActionLoading(false)
  }

  const handleDelete = async () => {
    setActionLoading(true)
    try {
      await deleteAdminUser(deleteModal.user.id)
      showMsg(`Deleted user "${deleteModal.user.username}"`)
      setDeleteModal({ open: false, user: null })
      refresh()
    } catch (err) {
      showMsg(err.response?.data?.message || 'Delete failed', 'error')
    }
    setActionLoading(false)
  }

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showMsg('Password must be at least 6 characters', 'error')
      return
    }
    setActionLoading(true)
    try {
      await resetAdminUserPassword(resetPwModal.user.id, newPassword)
      showMsg(`Password reset for "${resetPwModal.user.username}"`)
      setResetPwModal({ open: false, user: null })
      setNewPassword('')
      refresh()
    } catch (err) {
      showMsg(err.response?.data?.message || 'Reset failed', 'error')
    }
    setActionLoading(false)
  }

  const handleUserClick = async (user) => {
    setDetailsModal({ open: true, data: null })
    setActionLoading(true)
    try {
      const resp = await fetchAdminUserDetails(user.id)
      setDetailsModal({ open: true, data: resp })
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to fetch details', 'error')
      setDetailsModal({ open: false, data: null })
    }
    setActionLoading(false)
  }

  const columns = [
    {
      key: 'username',
      label: 'User',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold',
            row.role === 'admin' ? 'bg-gradient-to-br from-red-500 to-orange-500' :
            row.role === 'user' ? 'bg-gradient-to-br from-emerald-500 to-emerald-500' :
            'bg-gradient-to-br from-steel-500 to-steel-600'
          )}>
            {row.username?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-steel-100">{row.username}</p>
            <p className="text-xs text-steel-500 font-mono">{row.email || '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (row) => <StatusBadge status={row.role} />,
    },
    {
      key: 'authProvider',
      label: 'Auth',
      sortable: true,
      render: (row) => {
        const auth = row.authProvider || row.auth_type || 'local'
        return (
          <div className="flex items-center gap-1.5">
            {auth === 'google' ? (
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-steel-400" />
            )}
            <span className="text-xs text-steel-300 font-mono">{auth}</span>
          </div>
        )
      },
    },
    {
      key: 'created_at',
      label: 'Joined',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-steel-400 font-mono">
          {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-48 bg-white/[0.06] rounded-lg animate-pulse mb-2" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="h-4 w-20 bg-white/[0.06] rounded mb-3" />
              <div className="h-8 w-16 bg-white/[0.06] rounded" />
            </div>
          ))}
        </div>
        <SkeletonTable rows={8} cols={5} />
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
          <h1 className="text-3xl font-bold text-steel-50 mb-1">User Management</h1>
          <p className="text-steel-400 text-sm">Manage platform users, roles & permissions</p>
        </div>
        <button onClick={refresh} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Users" value={totalUsers} icon={Users} accent="blue" />
        <KpiCard label="Admins" value={admins} icon={ShieldAlert} accent="red" />
        <KpiCard label="Google Auth" value={googleUsers} icon={Globe} accent="blue" />
        <KpiCard label="New (7d)" value={recent7d} icon={UserPlus} accent="lime"
          trend={{ value: recent7d, direction: recent7d > 0 ? 'up' : 'flat', label: 'this week' }} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-steel-400">
          <Filter className="w-3.5 h-3.5" /> Filters:
        </div>
        <div className="flex items-center gap-1.5">
          {['all', 'admin', 'user'].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                roleFilter === r
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'border-white/[0.06] text-steel-400 hover:text-steel-200 hover:bg-white/[0.04]'
              )}
            >
              {r === 'all' ? 'All Roles' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-white/[0.08]" />
        <div className="flex items-center gap-1.5">
          {['all', 'local', 'google'].map(a => (
            <button
              key={a}
              onClick={() => setAuthFilter(a)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                authFilter === a
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'border-white/[0.06] text-steel-400 hover:text-steel-200 hover:bg-white/[0.04]'
              )}
            >
              {a === 'all' ? 'All Auth' : a.charAt(0).toUpperCase() + a.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredUsers}
        searchable
        searchKeys={['username', 'email', 'role']}
        pageSize={10}
        emptyMessage="No users match the current filters"
        onRowClick={handleUserClick}
        actions={(row) => (
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); openEdit(row) }}
              className="p-2 rounded-lg text-steel-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Edit user"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            {row.auth_type !== 'google' && (
              <button
                onClick={(e) => { e.stopPropagation(); setResetPwModal({ open: true, user: row }); setNewPassword('') }}
                className="p-2 rounded-lg text-steel-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                title="Reset password"
              >
                <KeyRound className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, user: row }) }}
              className="p-2 rounded-lg text-steel-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete user"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      />

      {/* Edit Modal */}
      <Modal
        open={editModal.open}
        onClose={() => setEditModal({ open: false, user: null })}
        title="Edit User"
        description={`Editing "${editModal.user?.username}"`}
        size="md"
      >
        <div className="space-y-5 p-1">
          <div>
            <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wider mb-2 font-mono">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setEditForm(f => ({ ...f, role: opt.value }))}
                  className={cn(
                    'flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all',
                    editForm.role === opt.value
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'border-white/[0.08] text-steel-400 hover:border-white/[0.15] hover:text-steel-200'
                  )}
                >
                  <opt.icon className="w-4 h-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wider mb-2 font-mono">Email</label>
            <input
              type="email"
              value={editForm.email}
              onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
              className="input-field w-full"
              placeholder="user@example.com"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/[0.06]">
          <button onClick={() => setEditModal({ open: false, user: null })} className="btn-secondary text-sm px-4 py-2">
            Cancel
          </button>
          <button onClick={handleUpdate} disabled={actionLoading} className="btn-primary text-sm px-4 py-2">
            {actionLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, user: null })}
        title="Delete User"
        description="This action cannot be undone"
        size="sm"
        danger
      >
        <div className="py-2">
          <p className="text-sm text-steel-300">
            Are you sure you want to permanently delete the user{' '}
            <span className="font-bold text-red-400">"{deleteModal.user?.username}"</span>?
          </p>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/[0.06]">
          <button onClick={() => setDeleteModal({ open: false, user: null })} className="btn-secondary text-sm px-4 py-2">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={actionLoading}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-50"
          >
            {actionLoading ? 'Deleting...' : 'Delete User'}
          </button>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={resetPwModal.open}
        onClose={() => { setResetPwModal({ open: false, user: null }); setNewPassword('') }}
        title="Reset Password"
        description={`Reset password for "${resetPwModal.user?.username}"`}
        size="sm"
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-semibold text-steel-400 uppercase tracking-wider mb-2 font-mono">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="input-field w-full"
              placeholder="Min 6 characters"
              minLength={6}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/[0.06]">
          <button onClick={() => { setResetPwModal({ open: false, user: null }); setNewPassword('') }} className="btn-secondary text-sm px-4 py-2">
            Cancel
          </button>
          <button onClick={handleResetPassword} disabled={actionLoading} className="btn-primary text-sm px-4 py-2">
            {actionLoading ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </Modal>

      {/* User Details Modal */}
      <Modal
        open={detailsModal.open}
        onClose={() => setDetailsModal({ open: false, data: null })}
        title="User Overview"
        description={detailsModal.data ? `Platform usage for "${detailsModal.data.user.username}"` : 'Loading details...'}
        size="md"
      >
        <div className="py-2">
          {actionLoading && !detailsModal.data ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            </div>
          ) : detailsModal.data ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Profile Header */}
              <div className="relative pt-4 pb-8 flex flex-col items-center border-b border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent rounded-t-[2rem] -mx-8 -mt-8">
                <div className={cn(
                  "w-28 h-28 rounded-[2rem] flex items-center justify-center text-4xl font-black shadow-2xl transition-all hover:scale-105 duration-500 relative group",
                  detailsModal.data.user.role === 'admin' ? 'bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 shadow-red-500/40 ring-4 ring-red-500/20' :
                  detailsModal.data.user.role === 'user' ? 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 shadow-emerald-500/40 ring-4 ring-emerald-500/20' :
                  'bg-gradient-to-br from-steel-500 to-steel-600 shadow-steel-500/40 ring-4 ring-white/10'
                )}>
                  {detailsModal.data.user.username?.charAt(0).toUpperCase()}
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-[#0B0F17] border border-white/10 flex items-center justify-center">
                    {detailsModal.data.user.auth_type === 'google' ? (
                      <Globe className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Lock className="w-4 h-4 text-steel-400" />
                    )}
                  </div>
                </div>
                <h4 className="mt-4 text-2xl font-black text-white tracking-tight">{detailsModal.data.user.username}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={detailsModal.data.user.role} />
                  <div className="w-1 h-1 rounded-full bg-steel-700" />
                  <span className="text-xs text-steel-500 font-mono italic">#{detailsModal.data.user.id}</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="relative group overflow-hidden p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center gap-3 text-emerald-400 mb-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <Globe className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-steel-400">Repositories</span>
                  </div>
                  <p className="text-3xl font-black text-white font-mono">{detailsModal.data.stats.repositories}</p>
                  <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="relative group overflow-hidden p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center gap-3 text-blue-400 mb-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <Activity className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-steel-400">Pipelines</span>
                  </div>
                  <p className="text-3xl font-black text-white font-mono">{detailsModal.data.stats.pipeline_runs}</p>
                  <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="relative group overflow-hidden p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center gap-3 text-red-400 mb-3">
                    <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-steel-400">Total Vulns</span>
                  </div>
                  <p className="text-3xl font-black text-white font-mono">{detailsModal.data.stats.vulnerabilities_found}</p>
                  <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* Detail Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Identity */}
                <div className="space-y-5">
                  <h5 className="text-[11px] font-black text-steel-500 uppercase tracking-[0.2em] border-l-2 border-emerald-500 pl-3">Identity Details</h5>
                  <div className="space-y-4">
                    <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <p className="text-[10px] uppercase font-bold text-steel-500 mb-1 flex items-center gap-2"><Users className="w-3 h-3" /> Full Name</p>
                      <p className="text-sm font-semibold text-white">{detailsModal.data.user.fullName || '—'}</p>
                    </div>
                    <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <p className="text-[10px] uppercase font-bold text-steel-500 mb-1 flex items-center gap-2"><Mail className="w-3 h-3" /> Email Address</p>
                      <p className="text-sm font-semibold text-white font-mono break-all">{detailsModal.data.user.email || '—'}</p>
                    </div>
                    <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <p className="text-[10px] uppercase font-bold text-steel-500 mb-1 flex items-center gap-2"><Calendar className="w-3 h-3" /> Joined Platform</p>
                      <p className="text-sm font-semibold text-white font-mono">{detailsModal.data.user.created_at ? new Date(detailsModal.data.user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Joined Recently'}</p>
                    </div>
                  </div>
                </div>

                {/* System Access */}
                <div className="space-y-5">
                  <h5 className="text-[11px] font-black text-steel-500 uppercase tracking-[0.2em] border-l-2 border-blue-500 pl-3">System Access</h5>
                  <div className="space-y-4">
                    <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <p className="text-[10px] uppercase font-bold text-steel-500 mb-1 flex items-center gap-2"><ShieldCheck className="w-3 h-3" /> Organization</p>
                      <p className="text-sm font-semibold text-white">{detailsModal.data.user.organization || 'Corporate'}</p>
                    </div>
                    <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <p className="text-[10px] uppercase font-bold text-steel-500 mb-1 flex items-center gap-2"><Globe className="w-3 h-3" /> Auth Context</p>
                      <p className="text-sm font-semibold text-emerald-400 font-mono uppercase tracking-widest text-xs">{detailsModal.data.user.auth_type || 'local'}</p>
                    </div>
                    <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <p className="text-[10px] uppercase font-bold text-steel-500 mb-1 flex items-center gap-2"><RefreshCw className="w-3 h-3" /> Last Activity</p>
                      <p className="text-sm font-semibold text-white font-mono">{detailsModal.data.user.last_login_at ? new Date(detailsModal.data.user.last_login_at).toLocaleTimeString() : '—'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Repositories List */}
              <div className="space-y-5">
                <h5 className="text-[11px] font-black text-steel-500 uppercase tracking-[0.2em] border-l-2 border-indigo-500 pl-3">Connected Repositories</h5>
                {detailsModal.data.repositories_list?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {detailsModal.data.repositories_list.map((repo, i) => (
                      <div key={i} className="group flex flex-col p-4 rounded-2xl bg-[#0B0F17] border border-white/[0.06] hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.05] flex items-center justify-center text-steel-400 group-hover:text-emerald-400 transition-colors">
                            <GitBranch className="w-4 h-4" />
                          </div>
                          <p className="text-sm font-bold text-white truncate">{repo.name || 'Unnamed'}</p>
                        </div>
                        <a href={repo.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:text-blue-300 truncate block font-mono bg-blue-500/5 px-2 py-1 rounded-md border border-blue-500/10 mb-2">
                          {repo.url}
                        </a>
                        <div className="mt-auto flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-[9px] font-black text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
                            {repo.branch || 'main'}
                          </span>
                          <span className="text-[9px] text-steel-600 font-bold uppercase">Active</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center rounded-3xl border border-dashed border-white/[0.1] bg-white/[0.01]">
                    <Globe className="w-10 h-10 text-steel-700 mx-auto mb-3" />
                    <p className="text-sm text-steel-500">No active repositories linked.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-red-400 py-8">Failed to load details</div>
          )}
        </div>
        <div className="flex justify-end mt-6 pt-4 border-t border-white/[0.06]">
          <button onClick={() => setDetailsModal({ open: false, data: null })} className="btn-secondary text-sm px-4 py-2">
            Close
          </button>
        </div>
      </Modal>
    </div>
  )
}
