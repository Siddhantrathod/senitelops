import axios from 'axios'

const API_BASE_URL = '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

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

export default api
