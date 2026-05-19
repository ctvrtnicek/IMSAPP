import api from './auth.js'

export const getSerialsByState = (params) => api.get('/warehouse/serials-by-state', { params })
export const bulkStateUpdate = (data) => api.post('/warehouse/state-update', data)
export const singleStateUpdate = (data) => api.post('/warehouse/state-update-single', data)
