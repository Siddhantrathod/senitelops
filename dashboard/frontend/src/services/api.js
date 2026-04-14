// System Logs API (Admin)
export const fetchSystemLogs = async ({ level = 'all', search = '', limit = 100, offset = 0, sort = 'desc' } = {}) => {
  try {
    const params = new URLSearchParams()
    if (level && level !== 'all') params.append('level', level)
    if (search) params.append('search', search)
    params.append('limit', limit)
    params.append('offset', offset)
    params.append('sort', sort)
    const response = await api.get(`/admin/logs?${params.toString()}`)
    return response.data
  } catch (error) {
    console.error('Error fetching system logs:', error)
    throw error
  }
}
import axios from 'axios'

// In production (Vercel), set VITE_API_URL to your Railway backend URL
// e.g. https://api.senitelops.com
// In local dev, Vite proxy forwards /api → http://localhost:5000
const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})


// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Handle 401 responses (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect on 401, not 422 (which might be a transient issue)
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname
      if (currentPath !== '/login' && currentPath !== '/') {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const fetchBanditReport = async (repoUrl) => {
  try {
    const url = repoUrl ? `/bandit?repo=${encodeURIComponent(repoUrl)}` : '/bandit'
    const response = await api.get(url)
    return response.data
  } catch (error) {
    console.error('Error fetching Bandit report:', error)
    throw error
  }
}

export const fetchSASTReport = async (repoUrl) => {
  try {
    const url = repoUrl ? `/sast?repo=${encodeURIComponent(repoUrl)}` : '/sast'
    const response = await api.get(url)
    return response.data
  } catch (error) {
    console.error('Error fetching SAST report:', error)
    throw error
  }
}

export const fetchSASTLanguages = async () => {
  try {
    const response = await api.get('/sast/languages')
    return response.data
  } catch (error) {
    console.error('Error fetching SAST languages:', error)
    throw error
  }
}

export const fetchTrivyReport = async (repoUrl) => {
  try {
    const url = repoUrl ? `/trivy?repo=${encodeURIComponent(repoUrl)}` : '/trivy'
    const response = await api.get(url)
    return response.data
  } catch (error) {
    console.error('Error fetching Trivy report:', error)
    throw error
  }
}

export const fetchSecuritySummary = async (repoUrl) => {
  try {
    // Fetch SAST, bandit (fallback), and trivy reports
    const [sastResult, banditResult, trivyResult] = await Promise.allSettled([
      fetchSASTReport(repoUrl),
      fetchBanditReport(repoUrl),
      fetchTrivyReport(repoUrl),
    ])

    const sast = sastResult.status === 'fulfilled' ? sastResult.value : null
    const bandit = banditResult.status === 'fulfilled' ? banditResult.value : null
    const trivy = trivyResult.status === 'fulfilled' ? trivyResult.value : null

    return { sast, bandit, trivy }
  } catch (error) {
    console.error('Error fetching security summary:', error)
    throw error
  }
}

// Policy API endpoints
export const fetchPolicy = async () => {
  try {
    const response = await api.get('/policy')
    return response.data
  } catch (error) {
    console.error('Error fetching policy:', error)
    throw error
  }
}

export const updatePolicy = async (policyData) => {
  try {
    const response = await api.put('/policy', policyData)
    return response.data
  } catch (error) {
    console.error('Error updating policy:', error)
    throw error
  }
}

export const evaluatePolicy = async () => {
  try {
    const response = await api.get('/policy/evaluate')
    return response.data
  } catch (error) {
    console.error('Error evaluating policy:', error)
    throw error
  }
}

// Pipeline API endpoints
export const fetchPipelines = async (limit = 20, repoUrl = null) => {
  try {
    const url = repoUrl ? `/pipelines?limit=${limit}&repo=${encodeURIComponent(repoUrl)}` : `/pipelines?limit=${limit}`
    const response = await api.get(url)
    return response.data
  } catch (error) {
    console.error('Error fetching pipelines:', error)
    throw error
  }
}

export const fetchPipelineById = async (pipelineId) => {
  try {
    const response = await api.get(`/pipelines/${pipelineId}`)
    return response.data
  } catch (error) {
    console.error('Error fetching pipeline:', error)
    throw error
  }
}

export const fetchLatestPipeline = async (repoUrl) => {
  try {
    const url = repoUrl ? `/pipelines/latest?repo=${encodeURIComponent(repoUrl)}` : '/pipelines/latest'
    const response = await api.get(url)
    return response.data
  } catch (error) {
    // Return null if no pipelines exist
    if (error.response?.status === 404) {
      return null
    }
    console.error('Error fetching latest pipeline:', error)
    throw error
  }
}

export const triggerPipeline = async (options = {}) => {
  try {
    const response = await api.post('/pipelines/trigger', options)
    return response.data
  } catch (error) {
    console.error('Error triggering pipeline:', error)
    throw error
  }
}

export const triggerLocalScan = async (options) => {
  try {
    const response = await api.post('/scan/local', options)
    return response.data
  } catch (error) {
    console.error('Error triggering local scan:', error)
    throw error
  }
}

// Gitleaks API endpoints
export const fetchGitleaksReport = async (repoUrl) => {
  try {
    const url = repoUrl ? `/gitleaks?repo=${encodeURIComponent(repoUrl)}` : '/gitleaks'
    const response = await api.get(url)
    return response.data
  } catch (error) {
    if (error.response?.status === 404) return null
    console.error('Error fetching Gitleaks report:', error)
    throw error
  }
}

// DAST API endpoints
export const fetchDastReport = async (repoUrl) => {
  try {
    const url = repoUrl ? `/dast?repo=${encodeURIComponent(repoUrl)}` : '/dast'
    const response = await api.get(url)
    return response.data
  } catch (error) {
    if (error.response?.status === 404) return null
    console.error('Error fetching DAST report:', error)
    throw error
  }
}

// Config API endpoints
export const fetchConfig = async () => {
  try {
    const response = await api.get('/config')
    return response.data
  } catch (error) {
    console.error('Error fetching config:', error)
    throw error
  }
}

export const updateConfig = async (configData) => {
  try {
    const response = await api.put('/config', configData)
    return response.data
  } catch (error) {
    console.error('Error updating config:', error)
    throw error
  }
}

// Setup API endpoints
export const fetchSetupStatus = async () => {
  try {
    const response = await api.get('/setup/status')
    return response.data
  } catch (error) {
    console.error('Error fetching setup status:', error)
    throw error
  }
}

export const fetchProfile = async () => {
  try {
    const response = await api.get('/settings/profile')
    return response.data
  } catch (error) {
    console.error('Error fetching profile:', error)
    throw error
  }
}

export const completeSetup = async (setupData) => {
  try {
    const response = await api.post('/setup/complete', setupData)
    return response.data
  } catch (error) {
    console.error('Error completing setup:', error)
    throw error
  }
}

export const resetSetup = async () => {
  try {
    const response = await api.post('/setup/reset')
    return response.data
  } catch (error) {
    console.error('Error resetting setup:', error)
    throw error
  }
}

// Auth API endpoints
export const signupUser = async (userData) => {
  try {
    const response = await api.post('/auth/signup', userData)
    return response.data
  } catch (error) {
    console.error('Error during signup:', error)
    throw error
  }
}

export const getGoogleAuthUrl = () => {
  // Always needs an absolute URL for the OAuth redirect
  const backendBase = import.meta.env.VITE_API_URL || ''
  return `${backendBase}/api/auth/google`
}


// ==================== REPOSITORIES API ====================

export const fetchRepositories = async () => {
  try {
    const response = await api.get('/repositories')
    return response.data
  } catch (error) {
    console.error('Error fetching repositories:', error)
    throw error
  }
}

// ==================== ADMIN API ====================

export const fetchAdminOverviewAnalytics = async () => {
  try {
    const response = await api.get('/admin/analytics')
    return response.data
  } catch (error) {
    console.error('Error fetching admin analytics:', error)
    throw error
  }
}

export const fetchAdminStats = async () => {
  try {
    const response = await api.get('/admin/stats')
    return response.data
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    throw error
  }
}

export const fetchAdminUsers = async () => {
  try {
    const response = await api.get('/admin/users')
    return response.data.users || response.data
  } catch (error) {
    console.error('Error fetching admin users:', error)
    throw error
  }
}

export const updateAdminUser = async (userId, data) => {
  try {
    const response = await api.put(`/admin/users/${userId}`, data)
    return response.data
  } catch (error) {
    console.error('Error updating user:', error)
    throw error
  }
}

export const fetchAdminUserDetails = async (userId) => {
  try {
    const response = await api.get(`/admin/users/${userId}/details`)
    return response.data
  } catch (error) {
    console.error('Error fetching user details:', error)
    throw error
  }
}

export const deleteAdminUser = async (userId) => {
  try {
    const response = await api.delete(`/admin/users/${userId}`)
    return response.data
  } catch (error) {
    console.error('Error deleting user:', error)
    throw error
  }
}

export const resetAdminUserPassword = async (userId, newPassword) => {
  try {
    const response = await api.post(`/admin/users/${userId}/reset-password`, { newPassword })
    return response.data
  } catch (error) {
    console.error('Error resetting password:', error)
    throw error
  }
}

export const fetchAdminPipelines = async (limit = 50, status = null) => {
  try {
    let url = `/admin/pipelines?limit=${limit}`
    if (status) url += `&status=${status}`
    const response = await api.get(url)
    return response.data
  } catch (error) {
    console.error('Error fetching admin pipelines:', error)
    throw error
  }
}

export const fetchAdminVulnSummary = async () => {
  try {
    const response = await api.get('/admin/vulnerabilities/summary')
    return response.data
  } catch (error) {
    console.error('Error fetching admin vuln summary:', error)
    throw error
  }
}

// --- Feedback APIs ---
export const submitFeedback = async (message) => {
  const response = await api.post('/feedback', { message })
  return response.data
}

export const fetchUserFeedback = async () => {
  const response = await api.get('/feedback')
  return response.data
}

export const fetchAdminFeedbacks = async () => {
  const response = await api.get('/admin/feedback')
  return response.data
}

export const replyAdminFeedback = async (id, reply) => {
  const response = await api.post(`/admin/feedback/${id}/reply`, { reply })
  return response.data
}


// --- Trends API ---
export const fetchTrends = async (limit = 30, repoUrl = null) => {
  const url = repoUrl ? `/pipelines/trends?limit=${limit}&repo=${encodeURIComponent(repoUrl)}` : `/pipelines/trends?limit=${limit}`
  const response = await api.get(url)
  return response.data
}

// --- Threat Intelligence API ---
export const fetchCveDetail = async (cveId) => {
  const response = await api.get(`/cve/${cveId}`)
  return response.data
}

// --- AI Fix Generation API ---
export const generateAiFix = async (pipelineId, vulnIndex) => {
  const response = await api.post(`/pipelines/${pipelineId}/fix`, { vuln_index: vulnIndex })
  return response.data
}
export default api
