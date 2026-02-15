import { useState, useEffect, useCallback } from 'react'
import {
    Bell,
    X,
    AlertTriangle,
    CheckCircle,
    Info,
    Shield,
    Clock,
    Trash2,
    Loader2,
} from 'lucide-react'
import { cn } from '../utils/helpers'

const API_BASE = 'http://localhost:5000/api'

const typeConfig = {
    critical: {
        icon: AlertTriangle,
        color: 'text-red-500',
        bg: 'bg-red-50',
        border: 'border-red-100',
    },
    warning: {
        icon: AlertTriangle,
        color: 'text-orange-500',
        bg: 'bg-orange-50',
        border: 'border-orange-100',
    },
    success: {
        icon: CheckCircle,
        color: 'text-green-500',
        bg: 'bg-green-50',
        border: 'border-green-100',
    },
    info: {
        icon: Info,
        color: 'text-blue-500',
        bg: 'bg-blue-50',
        border: 'border-blue-100',
    },
}

function formatTimeAgo(isoString) {
    if (!isoString) return ''
    const date = new Date(isoString)
    const now = new Date()
    const seconds = Math.floor((now - date) / 1000)

    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return date.toLocaleDateString()
}

export default function NotificationDropdown() {
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token')
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        }
    }

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/notifications`, {
                headers: getAuthHeaders(),
            })
            if (response.ok) {
                const data = await response.json()
                setNotifications(data.notifications || [])
                setUnreadCount(data.unreadCount || 0)
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error)
        }
    }, [])

    useEffect(() => {
        fetchNotifications()
        // Poll for new notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000)
        return () => clearInterval(interval)
    }, [fetchNotifications])

    const markAsRead = async (id) => {
        try {
            await fetch(`${API_BASE}/notifications/${id}/read`, {
                method: 'POST',
                headers: getAuthHeaders(),
            })
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, read: true } : n))
            )
            setUnreadCount((prev) => Math.max(0, prev - 1))
        } catch (error) {
            console.error('Failed to mark as read:', error)
        }
    }

    const markAllAsRead = async () => {
        try {
            await fetch(`${API_BASE}/notifications/read-all`, {
                method: 'POST',
                headers: getAuthHeaders(),
            })
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
            setUnreadCount(0)
        } catch (error) {
            console.error('Failed to mark all as read:', error)
        }
    }

    const deleteNotification = async (id) => {
        try {
            await fetch(`${API_BASE}/notifications/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            })
            setNotifications((prev) => prev.filter((n) => n.id !== id))
        } catch (error) {
            console.error('Failed to delete notification:', error)
        }
    }

    const clearAll = async () => {
        try {
            await fetch(`${API_BASE}/notifications/clear`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            })
            setNotifications([])
            setUnreadCount(0)
        } catch (error) {
            console.error('Failed to clear notifications:', error)
        }
    }

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                onClick={() => {
                    setIsOpen(!isOpen)
                    if (!isOpen) fetchNotifications()
                }}
                className="relative p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Panel */}
                    <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-primary-600" />
                                <h3 className="font-semibold text-slate-800">Notifications</h3>
                                {unreadCount > 0 && (
                                    <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                                        {unreadCount} new
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Notifications List */}
                        <div className="max-h-96 overflow-y-auto">
                            {loading ? (
                                <div className="py-12 text-center">
                                    <Loader2 className="w-6 h-6 text-primary-500 mx-auto animate-spin" />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="py-12 text-center">
                                    <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-500 font-medium">No notifications</p>
                                    <p className="text-slate-400 text-sm">You're all caught up!</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {notifications.map((notification) => {
                                        const config = typeConfig[notification.type] || typeConfig.info
                                        const Icon = config.icon

                                        return (
                                            <div
                                                key={notification.id}
                                                onClick={() => markAsRead(notification.id)}
                                                className={cn(
                                                    'px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors relative group',
                                                    !notification.read && 'bg-primary-50/30'
                                                )}
                                            >
                                                <div className="flex gap-3">
                                                    <div
                                                        className={cn(
                                                            'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border',
                                                            config.bg,
                                                            config.border
                                                        )}
                                                    >
                                                        <Icon className={cn('w-4 h-4', config.color)} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className={cn(
                                                                'text-sm text-slate-800 truncate',
                                                                !notification.read && 'font-semibold'
                                                            )}>
                                                                {notification.title}
                                                            </p>
                                                            {!notification.read && (
                                                                <span className="flex-shrink-0 w-2 h-2 bg-primary-500 rounded-full mt-1.5" />
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                                            {notification.message}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <Clock className="w-3 h-3 text-slate-400" />
                                                            <span className="text-xs text-slate-400">
                                                                {formatTimeAgo(notification.time)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            deleteNotification(notification.id)
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-all"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {notifications.length > 0 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                                <button
                                    onClick={markAllAsRead}
                                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                                >
                                    Mark all as read
                                </button>
                                <button
                                    onClick={clearAll}
                                    className="text-sm text-slate-500 hover:text-slate-700 font-medium"
                                >
                                    Clear all
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
