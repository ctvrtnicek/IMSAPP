import api from './auth.js'

export const listWorkOrders = (params = {}) => api.get('/work-orders', { params })
export const getWorkOrder = (id) => api.get(`/work-orders/${id}`)
export const getWorkOrderByNumber = (n) => api.get(`/work-orders/by-number/${n}`)
export const acknowledgeWorkOrder = (id) => api.post(`/work-orders/${id}/acknowledge`)
export const startWorkOrder = (id) => api.post(`/work-orders/${id}/start`)
export const completeWorkOrder = (id, payload) => api.post(`/work-orders/${id}/complete`, payload)
export const cancelWorkOrder = (id) => api.post(`/work-orders/${id}/cancel`)
export const reverseWorkOrder = (id) => api.post(`/work-orders/${id}/reverse`)
export const getSerialsAtLocation = (locationId, search) =>
  api.get(`/work-orders/serials-at-location/${locationId}`, { params: search ? { search } : {} })
export const completeRechargeWO = (id, payload) => api.post(`/work-orders/${id}/complete-recharge`, payload)
export const createRechargeWO = (payload) => api.post('/work-orders/recharge', payload)
