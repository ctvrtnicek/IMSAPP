import api from './auth.js'

export const getPOs = (params = {}) => api.get('/purchase-orders', { params })
export const getPO = (id) => api.get(`/purchase-orders/${id}`)
export const getPOByNumber = (poNumber) => api.get(`/purchase-orders/by-number/${poNumber}`)
export const createPO = (data) => api.post('/purchase-orders', data)
export const updatePO = (id, data) => api.put(`/purchase-orders/${id}`, data)
export const issuePO = (id) => api.post(`/purchase-orders/${id}/issue`)
export const importSerials = (id, data) => api.post(`/purchase-orders/${id}/import-serials`, data)
export const receiveAll = (id) => api.post(`/purchase-orders/${id}/receive-all`)
export const receiveSerial = (id, serialId) => api.post(`/purchase-orders/${id}/receive-serial/${serialId}`)
export const getPOSerials = (id) => api.get(`/purchase-orders/${id}/serials`)
export const uploadDocumentForExtraction = (id, file) => {
  const fd = new FormData(); fd.append('file', file)
  return api.post(`/purchase-orders/${id}/extract-document`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
