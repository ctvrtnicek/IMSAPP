import api from './auth.js'

export const getTerminalStates = () => api.get('/terminal-states')
export const getSerials = (params = {}) => api.get('/inventory/serials', { params })
export const getSerialDetail = (id) => api.get(`/inventory/serials/${id}`)
export const getByState = () => api.get('/inventory/by-state')
export const getByLocation = () => api.get('/inventory/by-location')
export const getByProduct = () => api.get('/inventory/by-product')
export const getExpecting = () => api.get('/inventory/expecting')
export const getInTransit = () => api.get('/inventory/in-transit')
export const getNonSerialised = () => api.get('/inventory/non-serialised')
export const updateNonSerialised = (id, data) => api.put(`/inventory/non-serialised/${id}`, data)
export const createNonSerialised = (data) => api.post('/inventory/non-serialised', data)
