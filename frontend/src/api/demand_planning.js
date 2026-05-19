import api from './auth.js'

export const listSignals  = (params = {}) => api.get('/demand/signals', { params })
export const createSignal = (data)         => api.post('/demand/signals', data)
export const updateSignal = (id, data)     => api.put(`/demand/signals/${id}`, data)
export const deleteSignal = (id)           => api.delete(`/demand/signals/${id}`)
export const getForecast  = (params = {})  => api.get('/demand/forecast', { params })
export const uploadSignalsCSV = (formData) => api.post('/demand/signals/upload-csv', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
