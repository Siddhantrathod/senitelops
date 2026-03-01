import { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Shield,
  LayoutDashboard,
  Users,
  GitBranch,
  Settings,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Crown,
  Sun,
  Moon,
  ArrowLeft,
  AlertTriangle,
  FileText,
} from 'lucide-react'
import { cn } from '../utils/helpers'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const adminNav = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard, end: true },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Pipelines', href: '/admin/pipelines', icon: GitBranch },
  { name: 'Vulnerabilities', href: '/admin/vulnerabilities', icon: AlertTriangle },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
  { name: 'Logs', href: '/admin/logs', icon: FileText },
]

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { toggleTheme, isDark } = useTheme()

  const getBreadcrumb = () => {
    const path = location.pathname
    if (path === '/admin') return 'Overview'
    if (path.includes('/users')) return 'User Management'
    if (path.includes('/pipelines')) return 'Pipelines & Logs'
    if (path.includes('/vulnerabilities')) return 'Vulnerabilities'
    if (path.includes('/settings')) return 'Settings'
    if (path.includes('/logs')) return 'System Logs'
    return 'Admin'
  }

  return (
    <div className="min-h-screen bg-surface grid-bg">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 dark:bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-72 bg-surface-secondary/95 dark:bg-surface-secondary/80 backdrop-blur-2xl border-r border-theme transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-theme">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-orange-500 shadow-glow-sm">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-steel-50 tracking-tight">SentinelOps</h1>
            <p className="text-xs text-red-400 font-mono font-semibold">ADMIN CONSOLE</p>
          </div>
          <button
            className="ml-auto lg:hidden text-steel-400 hover:text-steel-50"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          <p className="px-4 py-2 text-[10px] font-semibold text-steel-500 uppercase tracking-[0.2em] font-mono">
            Management
          </p>
          {adminNav.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.end}
              className={({ isActive }) =>
                cn('nav-link', isActive && 'active')
              }
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}

          {/* Separator & back link */}
          <div className="pt-4 border-t border-theme mt-4">
            <p className="px-4 py-2 text-[10px] font-semibold text-steel-500 uppercase tracking-[0.2em] font-mono">
              Navigation
            </p>
            <NavLink
              to="/dashboard"
              className="nav-link"
              onClick={() => setSidebarOpen(false)}
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </NavLink>
          </div>
        </nav>

        {/* Admin badge card */}
        <div className="absolute bottom-6 left-4 right-4">
          <div className="glass-card p-4 border-red-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="text-sm font-medium text-steel-200">Admin Console</span>
            </div>
            <p className="text-xs text-steel-400 font-mono">
              Full platform access enabled
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-72">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-surface/80 dark:bg-surface/70 backdrop-blur-2xl border-b border-theme">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden text-steel-400 hover:text-steel-50"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>

              {/* Breadcrumb */}
              <div className="flex items-center text-sm">
                <span className="text-red-400 font-semibold">Admin</span>
                <ChevronRight className="w-4 h-4 mx-2 text-steel-600" />
                <span className="text-steel-200 font-medium">{getBreadcrumb()}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="relative p-2.5 rounded-xl border border-theme hover:border-violet-500/30 bg-theme-hover hover:bg-violet-500/10 transition-all duration-300 group"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <div className="relative w-5 h-5 overflow-hidden">
                  <Sun className={cn(
                    'w-5 h-5 text-amber-500 absolute inset-0 transition-all duration-500',
                    isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
                  )} />
                  <Moon className={cn(
                    'w-5 h-5 text-violet-400 absolute inset-0 transition-all duration-500',
                    isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
                  )} />
                </div>
              </button>

              {/* Profile */}
              <div className="relative flex items-center gap-3 pl-4 border-l border-theme">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white shadow-glow-sm">
                    <span className="text-sm font-semibold">
                      {user?.username?.charAt(0).toUpperCase() || 'A'}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-steel-200">{user?.username || 'Admin'}</p>
                    <p className="text-xs text-red-400 font-semibold">Administrator</p>
                  </div>
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-surface-secondary/98 dark:bg-surface-secondary/95 backdrop-blur-2xl border border-theme-strong rounded-xl shadow-2xl z-50 overflow-hidden">
                      <div className="p-4 border-b border-theme">
                        <p className="text-steel-100 font-medium">{user?.username}</p>
                        <p className="text-steel-500 text-sm">{user?.email}</p>
                        <span className="inline-block mt-2 px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded-lg font-medium border border-red-500/20">
                          Admin
                        </span>
                      </div>
                      <div className="p-2">
                        <button
                          onClick={() => {
                            setShowUserMenu(false)
                            navigate('/dashboard')
                          }}
                          className="flex items-center gap-3 w-full px-3 py-2 text-steel-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back to Dashboard
                        </button>
                        <button
                          onClick={() => {
                            setShowUserMenu(false)
                            logout()
                          }}
                          className="flex items-center gap-3 w-full px-3 py-2 text-neon-red hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
