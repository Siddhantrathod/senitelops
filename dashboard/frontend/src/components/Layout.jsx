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
  Bell,
  Search,
  ChevronRight,
  LogOut,
  User,
  GitBranch,
} from 'lucide-react'
import { cn } from '../utils/helpers'
import { useAuth } from '../context/AuthContext'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Pipeline', href: '/pipeline', icon: GitBranch },
  { name: 'Bandit Analysis', href: '/bandit', icon: Bug },
  { name: 'Trivy Scan', href: '/trivy', icon: Container },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const location = useLocation()
  const { user, logout, isAdmin } = useAuth()

  const getBreadcrumb = () => {
    const path = location.pathname
    if (path === '/') return 'Dashboard'
    if (path === '/pipeline') return 'Pipeline'
    if (path === '/bandit') return 'Bandit Analysis'
    if (path === '/trivy') return 'Trivy Scan'
    if (path === '/settings') return 'Settings'
    return 'Dashboard'
  }

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-72 bg-dark-900/95 backdrop-blur-xl border-r border-dark-700/50 transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-dark-700/50">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 shadow-lg shadow-primary-500/25">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">SentinelOps</h1>
            <p className="text-xs text-dark-400">Security Dashboard</p>
          </div>
          <button
            className="ml-auto lg:hidden text-dark-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          <p className="px-4 py-2 text-xs font-semibold text-dark-500 uppercase tracking-wider">
            Main Menu
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
        </nav>

        {/* Security Status Card */}
        <div className="absolute bottom-6 left-4 right-4">
          <div className="glass-card p-4 bg-gradient-to-br from-primary-900/50 to-purple-900/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-medium text-white">System Active</span>
            </div>
            <p className="text-xs text-dark-400 mb-3">
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
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-dark-900/80 backdrop-blur-xl border-b border-dark-700/50">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden text-dark-400 hover:text-white"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>
              
              {/* Breadcrumb */}
              <div className="flex items-center text-sm">
                <span className="text-dark-500">Home</span>
                <ChevronRight className="w-4 h-4 mx-2 text-dark-600" />
                <span className="text-white font-medium">{getBreadcrumb()}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-dark-800 rounded-xl border border-dark-700/50">
                <Search className="w-4 h-4 text-dark-500" />
                <input
                  type="text"
                  placeholder="Search vulnerabilities..."
                  className="bg-transparent text-sm text-white placeholder-dark-500 outline-none w-48"
                />
              </div>

              {/* Notifications */}
              <button className="relative p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-xl transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              {/* Profile */}
              <div className="relative flex items-center gap-3 pl-4 border-l border-dark-700/50">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
                    <span className="text-sm font-semibold text-white">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-white">{user?.username || 'User'}</p>
                    <p className="text-xs text-dark-500">{user?.email || ''}</p>
                  </div>
                </button>

                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-dark-800 border border-dark-700/50 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="p-4 border-b border-dark-700/50">
                        <p className="text-white font-medium">{user?.username}</p>
                        <p className="text-dark-400 text-sm">{user?.email}</p>
                        {isAdmin() && (
                          <span className="inline-block mt-2 px-2 py-1 text-xs bg-primary-500/20 text-primary-400 rounded-lg">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="p-2">
                        <NavLink
                          to="/settings"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-3 px-3 py-2 text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                        >
                          <User className="w-4 h-4" />
                          Profile Settings
                        </NavLink>
                        <button
                          onClick={() => {
                            setShowUserMenu(false)
                            logout()
                          }}
                          className="flex items-center gap-3 w-full px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
