import axios from 'axios'

const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const listSystemConfig = () => api.get('/system-config')
export const updateSystemConfig = (key, value) => api.put(`/system-config/${key}`, { current_value: String(value) })
