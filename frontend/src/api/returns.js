import api from './auth.js'

// Return Orders
export const getReturnOrders = (params = {}) => api.get('/returns/return-orders', { params })
export const getReturnOrder = (id) => api.get(`/returns/return-orders/${id}`)
export const getReturnOrderByNumber = (n) => api.get(`/returns/return-orders/by-number/${n}`)
export const createReturnOrder = (data) => api.post('/returns/return-orders', data)
export const updateReturnOrder = (id, data) => api.put(`/returns/return-orders/${id}`, data)
export const receiveReturnOrder = (id) => api.post(`/returns/return-orders/${id}/receive`)

// Repair Orders
export const getRepairOrders = (params = {}) => api.get('/returns/repair-orders', { params })
export const getRepairOrder = (id) => api.get(`/returns/repair-orders/${id}`)
export const getRepairOrderByNumber = (n) => api.get(`/returns/repair-orders/by-number/${n}`)
export const createRepairOrder = (data) => api.post('/returns/repair-orders', data)
export const updateRepairOrder = (id, data) => api.put(`/returns/repair-orders/${id}`, data)
