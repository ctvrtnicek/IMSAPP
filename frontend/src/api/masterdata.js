import api from './auth.js'

// ── Location Types ──────────────────────────────────────────────────────────
export const getLocationTypes = () => api.get('/location-types')
export const createLocationType = (data) => api.post('/location-types', data)
export const updateLocationType = (id, data) => api.put(`/location-types/${id}`, data)

// ── Locations ───────────────────────────────────────────────────────────────
export const getLocations = () => api.get('/locations')
export const createLocation = (data) => api.post('/locations', data)
export const updateLocation = (id, data) => api.put(`/locations/${id}`, data)
export const deleteLocation = (id) => api.delete(`/locations/${id}`)

// ── Suppliers ───────────────────────────────────────────────────────────────
export const getSuppliers = () => api.get('/suppliers')
export const createSupplier = (data) => api.post('/suppliers', data)
export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data)
export const deleteSupplier = (id) => api.delete(`/suppliers/${id}`)

// ── Products ────────────────────────────────────────────────────────────────
export const getProducts = () => api.get('/products')
export const createProduct = (data) => api.post('/products', data)
export const updateProduct = (id, data) => api.put(`/products/${id}`, data)
export const deleteProduct = (id) => api.delete(`/products/${id}`)
export const uploadProductImage = (id, file) => {
  const fd = new FormData(); fd.append('file', file)
  return api.post(`/products/${id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const deleteProductImage = (id) => api.delete(`/products/${id}/image`)
export const fetchProductImageBlob = (id) =>
  api.get(`/products/${id}/image`, { responseType: 'blob' })
    .then((r) => URL.createObjectURL(r.data))

// ── Customers ───────────────────────────────────────────────────────────────
export const getCustomers = () => api.get('/customers')
export const createCustomer = (data) => api.post('/customers', data)
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data)
export const deleteCustomer = (id) => api.delete(`/customers/${id}`)
