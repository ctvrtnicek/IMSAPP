import api from './auth.js'

export const uploadRepairDocument = (rrId, file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post(`/returns/repair/${rrId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const listRepairDocuments = (rrId) => api.get(`/returns/repair/${rrId}/documents`)
export const downloadRepairDocument = (rrId, docId) =>
  api.get(`/returns/repair/${rrId}/documents/${docId}`, { responseType: 'blob' })
