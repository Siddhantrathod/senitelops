import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import SASTReport from './pages/SASTReport'
import BanditReport from './pages/BanditReport'
import TrivyReport from './pages/TrivyReport'
import VulnerabilityDetails from './pages/VulnerabilityDetails'
import Settings from './pages/Settings'
import Pipeline from './pages/Pipeline'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Setup from './pages/Setup'
import LandingPage from './pages/LandingPage'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
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
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="vulnerability/:id" element={<VulnerabilityDetails />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
