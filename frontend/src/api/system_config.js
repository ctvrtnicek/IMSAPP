import axios from 'axios'

const api = axios.create({ baseURL: (import.meta.env.VITE_API_URL || '') + '/api' })
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const listSystemConfig = () => api.get('/system-config')
export const updateSystemConfig = (key, value) => api.put(`/system-config/${key}`, { current_value: String(value) })
// R3 #12 — choices for the platform AI model and the roles list for AI_ASSISTANT_ROLES
export const listAiModels = () => api.get('/system-config/meta/ai-models')
export const listRoles = () => api.get('/users/meta/roles')
export const runAgentNow = (agentName) => api.post(`/agents/${agentName}/run-now`)
