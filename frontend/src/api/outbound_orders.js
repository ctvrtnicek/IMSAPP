import api from './auth.js'

export const getOutboundOrders = (params = {}) => api.get('/outbound-orders', { params })
export const getOutboundOrder = (id) => api.get(`/outbound-orders/${id}`)
export const getOutboundOrderByNumber = (orderNumber) => api.get(`/outbound-orders/by-number/${orderNumber}`)
export const createOutboundOrder = (data) => api.post('/outbound-orders', data)
export const updateOutboundOrder = (id, data) => api.put(`/outbound-orders/${id}`, data)
export const issueOrder = (id) => api.post(`/outbound-orders/${id}/issue`)
export const allocateOrder = (id, data) => api.post(`/outbound-orders/${id}/allocate`, data)
export const shipOrder = (id, data) => api.post(`/outbound-orders/${id}/ship`, data)
export const deliverOrder = (id) => api.post(`/outbound-orders/${id}/deliver`)
export const cancelOrder = (id) => api.post(`/outbound-orders/${id}/cancel`)
export const getAvailableSerials = (params) => api.get('/outbound-orders/available-serials', { params })
