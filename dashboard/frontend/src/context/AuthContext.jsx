import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { signupUser } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (storedToken) {
      setToken(storedToken)
      fetchUser(storedToken)
    } else {
      setLoading(false)
    }
  }, [])

  const fetchUser = async (authToken) => {
    try {
      const response = await api.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      })
      setUser(response.data)
      return response.data
    } catch (error) {
      console.error('Failed to fetch user:', error)
      // Clear invalid token
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password })
      const { token: newToken, user: userData } = response.data

      // Store token first
      localStorage.setItem('token', newToken)
      setToken(newToken)
      setUser(userData)
      setLoading(false)

      return { success: true, user: userData }
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed'
      return { success: false, error: message }
    }
  }

  const signup = async (userData) => {
    try {
      const response = await signupUser(userData)
      return { success: true, message: response.message }
    } catch (error) {
      const message = error.response?.data?.error || 'Signup failed'
      const errors = error.response?.data?.errors || [message]
      return { success: false, error: message, errors }
    }
  }

  const loginWithToken = async (authToken) => {
    localStorage.setItem('token', authToken)
    setToken(authToken)
    const userData = await fetchUser(authToken)
    return { success: true, user: userData }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    navigate('/')
  }

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword })
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to change password'
      return { success: false, error: message }
    }
  }

  const isAdmin = () => {
    return user?.role === 'admin'
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      isAuthenticated: !!token && !!user,
      isAdmin,
      login,
      signup,
      loginWithToken,
      logout,
      changePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
