import api from './auth.js'

export const getRROrders = (params = {}) => api.get('/repair-rework', { params })
export const getRROrder = (id) => api.get(`/repair-rework/${id}`)
export const createRROrder = (data) => api.post('/repair-rework', data)
export const updateRROrder = (id, data) => api.put(`/repair-rework/${id}`, data)
export const dispatchRROrder = (id) => api.post(`/repair-rework/${id}/dispatch`)
export const receiveBackRROrder = (id) => api.post(`/repair-rework/${id}/receive-back`)
