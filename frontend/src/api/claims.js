import api from './auth.js'

export const listClaimTypes = () => api.get('/claims/types')
export const createClaimType = (data) => api.post('/claims/types', data)
export const updateClaimType = (id, data) => api.put(`/claims/types/${id}`, data)
export const deleteClaimType = (id) => api.delete(`/claims/types/${id}`)

export const listClaims = (params = {}) => api.get('/claims', { params })
export const getClaim = (id) => api.get(`/claims/${id}`)
export const createClaim = (data) => api.post('/claims', data)
export const updateClaim = (id, data) => api.put(`/claims/${id}`, data)

export const uploadClaimAttachment = (claimId, formData) => api.post(`/claims/${claimId}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const listClaimAttachments  = (claimId) => api.get(`/claims/${claimId}/attachments`)
export const deleteClaimAttachment = (claimId, attId) => api.delete(`/claims/${claimId}/attachments/${attId}`)
export const downloadClaimAttachment = (claimId, attId) => api.get(`/claims/${claimId}/attachments/${attId}`, { responseType: 'blob' })
