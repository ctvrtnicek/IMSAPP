import api from './auth.js'

// Regions
export const listRegions = () => api.get('/network-design/regions')
export const createRegion = (data) => api.post('/network-design/regions', data)
export const updateRegion = (id, data) => api.put(`/network-design/regions/${id}`, data)

// Countries
export const listCountries = () => api.get('/network-design/countries')
export const createCountry = (data) => api.post('/network-design/countries', data)
export const updateCountry = (id, data) => api.put(`/network-design/countries/${id}`, data)

// Network Versions
export const listVersions = () => api.get('/network-design/versions')
export const createVersion = (data) => api.post('/network-design/versions', data)
export const commitBaseline = (id, data) => api.post(`/network-design/versions/${id}/commit-baseline`, data)
export const deleteVersion = (id) => api.delete(`/network-design/versions/${id}`)
export const setCurrentBaseline = (id) => api.post(`/network-design/versions/${id}/set-current`)

// Supply Flows
export const listFlows = (versionId) => api.get(`/network-design/versions/${versionId}/flows`)
export const addFlow = (versionId, data) => api.post(`/network-design/versions/${versionId}/flows`, data)
export const updateFlow = (flowId, data) => api.put(`/network-design/flows/${flowId}`, data)
export const deleteFlow = (flowId) => api.delete(`/network-design/flows/${flowId}`)

// Transit Lane Lookup
export const lookupTransitLane = (fromId, toId) => api.get(`/network-design/transit-lane-lookup?from_location_id=${fromId}&to_location_id=${toId}`)

// Flow Constraints
export const addConstraint = (flowId, data) => api.post(`/network-design/flows/${flowId}/constraints`, data)
export const deleteConstraint = (constraintId) => api.delete(`/network-design/constraints/${constraintId}`)
