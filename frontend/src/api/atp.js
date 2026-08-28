import api from './auth.js'

// Customer Segments
export const listSegments = () => api.get('/atp/segments')
export const createSegment = (data) => api.post('/atp/segments', data)
export const updateSegment = (id, data) => api.put(`/atp/segments/${id}`, data)

// ATP Rules
export const listRules = () => api.get('/atp/rules')
export const createRule = (data) => api.post('/atp/rules', data)
export const deleteRule = (id) => api.delete(`/atp/rules/${id}`)

// ATP Operations
export const runATP = (orderId) => api.post(`/atp/run/${orderId}`)
export const unpegOrder = (orderId) => api.post(`/atp/unpeg/${orderId}`)
export const getAlternatives = (productId) => api.get(`/atp/alternatives/${productId}`)

// Allocation
export const getAllocation = () => api.get('/atp/allocation')
export const reallocate = (data) => api.post('/atp/reallocate', data)
