import axios from 'axios'

const API_BASE_URL = '/api'

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
      if (currentPath !== '/login') {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const fetchBanditReport = async () => {
  try {
    const response = await api.get('/bandit')
    return response.data
  } catch (error) {
    console.error('Error fetching Bandit report:', error)
    throw error
  }
}

export const fetchTrivyReport = async () => {
  try {
    const response = await api.get('/trivy')
    return response.data
  } catch (error) {
    console.error('Error fetching Trivy report:', error)
    throw error
  }
}

export const fetchSecuritySummary = async () => {
  try {
    const [bandit, trivy] = await Promise.all([
      fetchBanditReport(),
      fetchTrivyReport(),
    ])
    return { bandit, trivy }
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
export const fetchPipelines = async (limit = 20) => {
  try {
    const response = await api.get(`/pipelines?limit=${limit}`)
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

export const fetchLatestPipeline = async () => {
  try {
    const response = await api.get('/pipelines/latest')
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

export default api
