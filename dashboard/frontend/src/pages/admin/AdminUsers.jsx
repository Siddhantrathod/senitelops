import { useState, useCallback } from 'react'
import {
  Users, UserPlus, Edit3, Trash2, KeyRound, ShieldAlert,
  ShieldCheck, Filter, RefreshCw, AlertTriangle, CheckCircle,
  Mail, Calendar, Globe, Lock,
} from 'lucide-react'
import { cn } from '../../utils/helpers'
import { DataTable, StatusBadge, Modal, KpiCard, SkeletonTable } from '../../components/admin'
import { useAdminData } from '../../hooks/useAdminData'
import {
  fetchAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  resetAdminUserPassword,
} from '../../services/api'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', icon: ShieldAlert },
  { value: 'user', label: 'User', icon: Users },
  { value: 'viewer', label: 'Viewer', icon: Globe },
]

export default function AdminUsers() {
  const { data: users, loading, error, refresh } = useAdminData(fetchAdminUsers)
  const [roleFilter, setRoleFilter] = useState('all')
  const [authFilter, setAuthFilter] = useState('all')

  // Modal states
  const [editModal, setEditModal] = useState({ open: false, user: null })
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null })
  const [resetPwModal, setResetPwModal] = useState({ open: false, user: null })
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
    if (authFilter !== 'all' && u.auth_type !== authFilter) return false
    return true
  })

  // Stats
  const totalUsers = users?.length || 0
  const admins = users?.filter(u => u.role === 'admin').length || 0
  const googleUsers = users?.filter(u => u.auth_type === 'google').length || 0
  const recent7d = users?.filter(u => {
    if (!u.created_at) return false
    const d = new Date(u.created_at)
    return (Date.now() - d.getTime()) < 7 * 86400 * 1000
  }).length || 0

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
            row.role === 'user' ? 'bg-gradient-to-br from-violet-500 to-blue-500' :
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
      key: 'auth_type',
      label: 'Auth',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {row.auth_type === 'google' ? (
            <Globe className="w-3.5 h-3.5 text-blue-400" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-steel-400" />
          )}
          <span className="text-xs text-steel-300 font-mono">{row.auth_type || 'local'}</span>
        </div>
      ),
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
        <KpiCard label="Total Users" value={totalUsers} icon={Users} accent="violet" />
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
          {['all', 'admin', 'user', 'viewer'].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                roleFilter === r
                  ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
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
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
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
        actions={(row) => (
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); openEdit(row) }}
              className="p-2 rounded-lg text-steel-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
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
                      ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
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
    </div>
  )
}
