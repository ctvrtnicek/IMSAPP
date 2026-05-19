import api from './auth.js'

export const getUsers = (params = {}) => api.get('/users', { params })
export const createUser = (data) => api.post('/users', data)
export const updateUser = (id, data) => api.put(`/users/${id}`, data)
export const resetPassword = (id, data) => api.post(`/users/${id}/reset-password`, data)
export const deactivateUser = (id) => api.delete(`/users/${id}`)
