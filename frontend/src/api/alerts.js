import api from './auth.js'

export const getAlerts = (params = {}) => api.get('/alerts', { params })
export const getAlertSummary = () => api.get('/alerts/summary')
export const runAlerts = () => api.post('/alerts/run')
export const acknowledgeAlert = (id) => api.post(`/alerts/${id}/acknowledge`)
export const getAlertRules = () => api.get('/alerts/rules')
export const updateAlertRule = (id, data) => api.put(`/alerts/rules/${id}`, data)
