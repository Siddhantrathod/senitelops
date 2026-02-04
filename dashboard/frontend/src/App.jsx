import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import BanditReport from './pages/BanditReport'
import TrivyReport from './pages/TrivyReport'
import VulnerabilityDetails from './pages/VulnerabilityDetails'
import Settings from './pages/Settings'
import Pipeline from './pages/Pipeline'
import Login from './pages/Login'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="bandit" element={<BanditReport />} />
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
