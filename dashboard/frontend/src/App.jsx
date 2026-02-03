import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import BanditReport from './pages/BanditReport'
import TrivyReport from './pages/TrivyReport'
import VulnerabilityDetails from './pages/VulnerabilityDetails'
import Settings from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="bandit" element={<BanditReport />} />
        <Route path="trivy" element={<TrivyReport />} />
        <Route path="vulnerability/:id" element={<VulnerabilityDetails />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App
