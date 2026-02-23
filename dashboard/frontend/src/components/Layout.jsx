import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  Shield,
  LayoutDashboard,
  Bug,
  Container,
  Settings,
  Menu,
  X,
  ChevronRight,
  LogOut,
  User,
  GitBranch,
  Code2,
  Globe,
  Crown,
} from 'lucide-react'
import { cn } from '../utils/helpers'
import { useAuth } from '../context/AuthContext'
import NotificationDropdown from './NotificationDropdown'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Pipeline', href: '/dashboard/pipeline', icon: GitBranch },
  { name: 'Code Analysis', href: '/dashboard/sast', icon: Code2 },
  { name: 'Trivy Scan', href: '/dashboard/trivy', icon: Container },
  { name: 'DAST Scan', href: '/dashboard/dast', icon: Globe },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const location = useLocation()
  const { user, logout, isAdmin } = useAuth()

  const getBreadcrumb = () => {
    const path = location.pathname
    if (path === '/dashboard') return 'Dashboard'
    if (path.includes('/pipeline')) return 'Pipeline'
    if (path.includes('/sast')) return 'Code Analysis'
    if (path.includes('/bandit')) return 'Code Analysis'
    if (path.includes('/trivy')) return 'Trivy Scan'
    if (path.includes('/dast')) return 'DAST Scan'
    if (path.includes('/admin')) return 'Admin Panel'
    if (path.includes('/settings')) return 'Settings'
    return 'Dashboard'
  }

  return (
    <div className="min-h-screen bg-[#0B0E11] grid-bg">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — Glassmorphism */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-72 bg-[#161b22]/80 backdrop-blur-2xl border-r border-white/[0.06] transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/[0.06]">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-violet-400 shadow-glow-sm">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">SentinelOps</h1>
            <p className="text-xs text-steel-400 font-mono">COMMAND CENTER</p>
          </div>
          <button
            className="ml-auto lg:hidden text-steel-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          <p className="px-4 py-2 text-[10px] font-semibold text-steel-500 uppercase tracking-[0.2em] font-mono">
            Operations
          </p>
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn('nav-link', isActive && 'active')
              }
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}

          {/* Admin Section */}
          {isAdmin() && (
            <>
              <p className="px-4 pt-4 pb-2 text-[10px] font-semibold text-steel-500 uppercase tracking-[0.2em] font-mono">
                Administration
              </p>
              <NavLink
                to="/dashboard/admin"
                className={({ isActive }) =>
                  cn('nav-link', isActive && 'active')
                }
                onClick={() => setSidebarOpen(false)}
              >
                <Crown className="w-5 h-5" />
                Admin Panel
              </NavLink>
            </>
          )}
        </nav>

        {/* System Status Card */}
        <div className="absolute bottom-6 left-4 right-4">
          <div className="glass-card p-4 card-glow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full bg-lime-400 animate-pulse shadow-glow-lime" />
              <span className="text-sm font-medium text-steel-200">System Active</span>
            </div>
            <p className="text-xs text-steel-400 mb-3 font-mono">
              Last scan: Today at 10:30 AM
            </p>
            <button className="btn-primary w-full text-sm">
              Run Full Scan
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-72">
        {/* Top Header — Frosted glass */}
        <header className="sticky top-0 z-30 bg-[#0B0E11]/70 backdrop-blur-2xl border-b border-white/[0.06]">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden text-steel-400 hover:text-white"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>

              {/* Breadcrumb */}
              <div className="flex items-center text-sm">
                <span className="text-steel-500">Home</span>
                <ChevronRight className="w-4 h-4 mx-2 text-steel-600" />
                <span className="text-steel-200 font-medium">{getBreadcrumb()}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Notifications */}
              <NotificationDropdown />

              {/* Profile */}
              <div className="relative flex items-center gap-3 pl-4 border-l border-white/[0.06]">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white shadow-glow-sm">
                    <span className="text-sm font-semibold">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-steel-200">{user?.username || 'User'}</p>
                    <p className="text-xs text-steel-500">{user?.email || ''}</p>
                  </div>
                </button>

                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-[#161b22]/95 backdrop-blur-2xl border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden">
                      <div className="p-4 border-b border-white/[0.06]">
                        <p className="text-steel-100 font-medium">{user?.username}</p>
                        <p className="text-steel-500 text-sm">{user?.email}</p>
                        {isAdmin() && (
                          <span className="inline-block mt-2 px-2 py-1 text-xs bg-violet-500/10 text-violet-400 rounded-lg font-medium border border-violet-500/20">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <NavLink
                          to="/dashboard/settings"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-3 px-3 py-2 text-steel-300 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
                        >
                          <User className="w-4 h-4" />
                          Profile Settings
                        </NavLink>
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
