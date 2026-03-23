import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminProtectedRoute from './components/AdminProtectedRoute'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import { LanguageProvider } from './context/LanguageContext'
import Dashboard from './pages/Dashboard'
import SASTReport from './pages/SASTReport'
import BanditReport from './pages/BanditReport'
import TrivyReport from './pages/TrivyReport'
import DastReport from './pages/DastReport'
import VulnerabilityDetails from './pages/VulnerabilityDetails'
import Settings from './pages/Settings'
import Pipeline from './pages/Pipeline'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Setup from './pages/Setup'
import LandingPage from './pages/LandingPage'
import DocumentationPage from './pages/DocumentationPage'
import AdminLogin from './pages/AdminLogin'
import AdminOverview from './pages/admin/AdminOverview'
import AdminUsers from './pages/admin/AdminUsers'
import AdminSettings from './pages/admin/AdminSettings'
import AdminLogs from './pages/admin/AdminLogs'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs" element={<DocumentationPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/setup" element={
          <ProtectedRoute>
            <Setup />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="sast" element={<SASTReport />} />
          <Route path="bandit" element={<Navigate to="/dashboard/sast" replace />} />
          <Route path="trivy" element={<TrivyReport />} />
          <Route path="dast" element={<DastReport />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="vulnerability/:id" element={<VulnerabilityDetails />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Separate Admin Console */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={
          <AdminProtectedRoute>
            <AdminLayout />
          </AdminProtectedRoute>
        }>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="logs" element={<AdminLogs />} />
        </Route>
          </Routes>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
