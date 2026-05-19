import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Attach JWT to every request if present
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const login = async (username, password) => {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  const res = await api.post('/auth/login', form)
  return res.data
}

export const getMe = () => api.get('/auth/me')

export default api
