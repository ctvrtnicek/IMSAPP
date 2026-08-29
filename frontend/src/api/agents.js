import axios from 'axios'

const api = axios.create({ baseURL: (import.meta.env.VITE_API_URL || '') + '/api' })
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const getAgentStatus = () => api.get('/agents/status')
export const runAgentNow    = (agentName) => api.post(`/agents/${agentName}/run-now`)
export const getAgentRuns   = (limit = 50) => api.get('/agents/runs', { params: { limit } })
export const getRunLogs     = (runId) => api.get(`/agents/runs/${runId}/logs`)
export const getAgentIntents = (status) => api.get('/agents/intents', { params: status ? { status } : {} })
export const cancelIntent   = (id) => api.put(`/agents/intents/${id}/cancel`)
export const getRecommendations = (status) => api.get('/agents/recommendations', { params: status ? { status } : {} })
export const actionRecommendation = (id, action) => api.put(`/agents/recommendations/${id}/action`, { action })
export const listSystemConfig  = () => api.get('/system-config')
export const updateSystemConfig = (key, value) => api.put(`/system-config/${key}`, { current_value: String(value) })
