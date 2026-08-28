import api from './auth.js'

export const getTraceability = (serialNumber) => api.get(`/traceability/serial/${encodeURIComponent(serialNumber)}`)
export const initiateRMA = (data) => api.post('/traceability/initiate-rma', data)
