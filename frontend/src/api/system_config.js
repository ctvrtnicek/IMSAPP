import axios from 'axios'

const api = axios.create({ baseURL: (import.meta.env.VITE_API_URL || '') + '/api' })
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const listSystemConfig = () => api.get('/system-config')
export const updateSystemConfig = (key, value) => api.put(`/system-config/${key}`, { current_value: String(value) })
export const runAgentNow = (agentName) => api.post(`/agents/${agentName}/run-now`)
