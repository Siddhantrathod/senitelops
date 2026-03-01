import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from './LoadingSpinner'

export default function AdminProtectedRoute({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()

  if (loading) {
    return <PageLoader />
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }

  if (!isAdmin()) {
    return <Navigate to="/admin/login" replace />
  }

  return children
}
