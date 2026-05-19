import api from './auth.js'

// Activity Cost Master
export const listActivityCosts   = ()          => api.get('/cost/activity-costs')
export const createActivityCost  = (data)      => api.post('/cost/activity-costs', data)
export const updateActivityCost  = (id, data)  => api.put(`/cost/activity-costs/${id}`, data)
export const deleteActivityCost  = (id)        => api.delete(`/cost/activity-costs/${id}`)

// Exchange Rate Master
export const listExchangeRates   = ()          => api.get('/cost/exchange-rates')
export const createExchangeRate  = (data)      => api.post('/cost/exchange-rates', data)
export const updateExchangeRate  = (id, data)  => api.put(`/cost/exchange-rates/${id}`, data)
export const deleteExchangeRate  = (id)        => api.delete(`/cost/exchange-rates/${id}`)
