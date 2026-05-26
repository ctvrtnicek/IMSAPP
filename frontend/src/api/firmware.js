import api from './auth.js'

export const listFirmware = () => api.get('/firmware')
export const getFirmware = (id) => api.get(`/firmware/${id}`)
export const createFirmware = (data) => api.post('/firmware', data)
export const updateFirmware = (id, data) => api.put(`/firmware/${id}`, data)
export const deleteFirmware = (id) => api.delete(`/firmware/${id}`)
export const uploadFirmwareFile = (id, file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post(`/firmware/${id}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}

// Product-level firmware sub-resources
export const listProductPricing = (productId) => api.get(`/products/${productId}/pricing`)
export const addProductPricing = (productId, data) => api.post(`/products/${productId}/pricing`, data)
export const updateProductPricing = (productId, pricingId, data) => api.put(`/products/${productId}/pricing/${pricingId}`, data)
export const deleteProductPricing = (productId, pricingId) => api.delete(`/products/${productId}/pricing/${pricingId}`)

export const listProductAlternatives = (productId) => api.get(`/products/${productId}/alternatives`)
export const addProductAlternative = (productId, data) => api.post(`/products/${productId}/alternatives`, data)
export const updateProductAlternative = (productId, altId, data) => api.put(`/products/${productId}/alternatives/${altId}`, data)
export const deleteProductAlternative = (productId, altId) => api.delete(`/products/${productId}/alternatives/${altId}`)

export const listProductBom = (productId) => api.get(`/products/${productId}/bom`)
export const addProductBomComponent = (productId, data) => api.post(`/products/${productId}/bom`, data)
export const updateProductBomComponent = (productId, bomId, data) => api.put(`/products/${productId}/bom/${bomId}`, data)
export const deleteProductBomComponent = (productId, bomId) => api.delete(`/products/${productId}/bom/${bomId}`)

export const setProductLatestFirmware = (productId, firmwareId) =>
  api.put(`/products/${productId}/latest-firmware`, { firmware_id: firmwareId })
