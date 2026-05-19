import { useEffect, useState } from 'react'
import Modal from '../../components/Modal.jsx'
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getSuppliers,
  uploadProductImage,
  deleteProductImage,
  fetchProductImageBlob,
} from '../../api/masterdata.js'
import {
  getProductSuppliers,
  addProductSupplier,
  updateProductSupplier,
  removeProductSupplier,
} from '../../api/supply_planning.js'

const PRODUCT_TYPES = ['Payment Terminal', 'Accessory', 'Battery']
const PRODUCT_CATEGORIES = ['PaymentDevice', 'SerializedAccessory', 'Accessory']

const EMPTY_FORM = {
  code: '', name: '', description: '',
  product_type: '', product_category: '',
  serialised: 0, is_bom: 0,
  unit_value: '', unit_currency: 'EUR',
  refurb_unit_value: '', refurb_unit_currency: '',
  hs_code: '',
  battery_life_days: '', warranty_days: '', repair_max_days: '',
}

export default function ProductsPage({ role }) {
  const isAdmin = role === 'admin'
  const canEditSuppliers = ['admin', 'supply_planner'].includes(role)

  const [products, setProducts]   = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  // blob URL cache: { [productId]: blobUrl }
  const [imageBlobUrls, setImageBlobUrls] = useState({})

  // Expanded suppliers panel
  const [expandedId, setExpandedId] = useState(null)
  const [psRows, setPsRows]         = useState([])
  const [psLoading, setPsLoading]   = useState(false)
  const [psAddSupId, setPsAddSupId] = useState('')
  const [psAddLt, setPsAddLt]       = useState('')
  const [psAddErr, setPsAddErr]     = useState(null)
  const [psEditId, setPsEditId]     = useState(null)   // supplier_id being edited
  const [psEditLt, setPsEditLt]     = useState('')

  async function fetchProducts() {
    setLoading(true); setError(null)
    try {
      const [pr, sp] = await Promise.all([getProducts(), getSuppliers()])
      const prods = Array.isArray(pr.data) ? pr.data : []
      setProducts(prods)
      setSuppliers(Array.isArray(sp.data) ? sp.data : [])
      // Load blob URLs for products that have images
      const withImages = prods.filter((p) => p.has_image)
      withImages.forEach((p) => {
        fetchProductImageBlob(p.id)
          .then((url) => setImageBlobUrls((prev) => ({ ...prev, [p.id]: url })))
          .catch(() => {})
      })
    } catch { setError('Failed to load products.') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchProducts() }, [])

  async function toggleExpand(productId) {
    if (expandedId === productId) { setExpandedId(null); return }
    setExpandedId(productId)
    setPsEditId(null); setPsAddErr(null)
    setPsLoading(true)
    try {
      const res = await getProductSuppliers(productId)
      setPsRows(Array.isArray(res.data) ? res.data : [])
    } catch { setPsRows([]) }
    finally { setPsLoading(false) }
  }

  async function handlePsAdd(productId) {
    if (!psAddSupId) { setPsAddErr('Select a supplier'); return }
    setPsAddErr(null)
    try {
      await addProductSupplier(productId, {
        supplier_id: Number(psAddSupId),
        lead_time_days: psAddLt !== '' ? Number(psAddLt) : null,
      })
      setPsAddSupId(''); setPsAddLt('')
      const res = await getProductSuppliers(productId)
      setPsRows(Array.isArray(res.data) ? res.data : [])
    } catch (err) { setPsAddErr(err.response?.data?.detail || 'Failed to add') }
  }

  async function handlePsUpdate(productId, supplierId) {
    try {
      await updateProductSupplier(productId, supplierId, {
        supplier_id: supplierId,
        lead_time_days: psEditLt !== '' ? Number(psEditLt) : null,
      })
      setPsEditId(null)
      const res = await getProductSuppliers(productId)
      setPsRows(Array.isArray(res.data) ? res.data : [])
    } catch (err) { alert(err.response?.data?.detail || 'Failed to update') }
  }

  async function handlePsRemove(productId, supplierId) {
    if (!window.confirm('Remove this supplier from the product?')) return
    try {
      await removeProductSupplier(productId, supplierId)
      const res = await getProductSuppliers(productId)
      setPsRows(Array.isArray(res.data) ? res.data : [])
    } catch (err) { alert(err.response?.data?.detail || 'Failed to remove') }
  }

  function openAdd() {
    setEditingId(null); setForm(EMPTY_FORM); setImageFile(null); setImagePreview(null); setShowModal(true)
  }

  function openEdit(row) {
    setEditingId(row.id)
    setForm({
      code: row.code, name: row.name,
      description: row.description || '',
      product_type: row.product_type,
      product_category: row.product_category,
      serialised: row.serialised, is_bom: row.is_bom,
      unit_value: row.unit_value != null ? String(row.unit_value) : '',
      unit_currency: row.unit_currency || 'EUR',
      refurb_unit_value: row.refurb_unit_value != null ? String(row.refurb_unit_value) : '',
      refurb_unit_currency: row.refurb_unit_currency || '',
      hs_code: row.hs_code || '',
      battery_life_days: row.battery_life_days != null ? String(row.battery_life_days) : '',
      warranty_days: row.warranty_days != null ? String(row.warranty_days) : '',
      repair_max_days: row.repair_max_days != null ? String(row.repair_max_days) : '',
    })
    setImageFile(null)
    // Show existing image as preview using cached blob URL
    setImagePreview(imageBlobUrls[row.id] || null)
    setShowModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true)
    const payload = {
      code: form.code, name: form.name,
      description: form.description || null,
      product_type: form.product_type, product_category: form.product_category,
      serialised: form.serialised ? 1 : 0, is_bom: form.is_bom ? 1 : 0,
      unit_value: form.unit_value !== '' ? parseFloat(form.unit_value) : null,
      unit_currency: form.unit_currency || 'EUR',
      refurb_unit_value: form.refurb_unit_value !== '' ? parseFloat(form.refurb_unit_value) : null,
      refurb_unit_currency: form.refurb_unit_currency || null,
      hs_code: form.hs_code || null,
      battery_life_days: form.battery_life_days !== '' ? parseInt(form.battery_life_days) : null,
      warranty_days: form.warranty_days !== '' ? parseInt(form.warranty_days) : null,
      repair_max_days: form.repair_max_days !== '' ? parseInt(form.repair_max_days) : null,
    }
    try {
      let savedId = editingId
      if (editingId) { await updateProduct(editingId, payload) }
      else { const res = await createProduct(payload); savedId = res.data.id }
      // Upload image if selected
      if (imageFile && savedId) {
        await uploadProductImage(savedId, imageFile)
        // Refresh blob URL cache for this product
        fetchProductImageBlob(savedId)
          .then((url) => setImageBlobUrls((prev) => ({ ...prev, [savedId]: url })))
          .catch(() => {})
      }
      setShowModal(false); setImageFile(null); setImagePreview(null)
      await fetchProducts()
    } catch (err) { alert(err?.response?.data?.detail || 'Error saving product') }
    finally { setSubmitting(false) }
  }

  async function handleDeactivate(row) {
    if (!confirm(`Deactivate product "${row.name}"?`)) return
    try { await deleteProduct(row.id); await fetchProducts() }
    catch (err) { alert(err?.response?.data?.detail || 'Error deactivating product') }
  }

  // Suppliers not yet linked to this product
  const linkedIds = new Set(psRows.map((r) => r.supplier_id))
  const availableSuppliers = suppliers.filter((s) => s.active && !linkedIds.has(s.id))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Products</h2>
        {isAdmin && (
          <button
            onClick={openAdd}
            className="text-sm px-4 py-1.5 rounded-lg text-white font-medium transition hover:opacity-90"
            style={{ backgroundColor: 'var(--cadet-dark)' }}
          >+ Add Product</button>
        )}
      </div>
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

      <div className="e2o-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="e2o-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 52 }}></th>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Category</th>
              <th>Serialised</th>
              <th>Unit Value</th>
              <th>Status</th>
              <th>Suppliers</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 10 : 9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>Loading…</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={isAdmin ? 10 : 9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>No products found.</td></tr>
            ) : products.map((row) => (
              <>
                <tr key={row.id} style={{ background: expandedId === row.id ? 'var(--bg-tint-cadet)' : 'transparent' }}>
                  <td style={{ padding: '4px 8px', width: 52 }}>
                    {imageBlobUrls[row.id] ? (
                      <img
                        src={imageBlobUrls[row.id]}
                        alt={row.code}
                        style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: '0.35rem', border: '1px solid #e5e7eb', background: '#f8fafc' }}
                      />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: '0.35rem', border: '1px dashed #d1d5db', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', fontSize: 16 }}>
                        📷
                      </div>
                    )}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)', color: 'var(--cadet-dark)' }}>{row.code}</td>
                  <td style={{ fontWeight: 'var(--fw-semibold)' }}>{row.name}</td>
                  <td>{row.product_type}</td>
                  <td style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-body-sm)' }}>{row.product_category}</td>
                  <td>
                    <span style={{ color: row.serialised ? '#166534' : '#9ca3af', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-body-sm)' }}>
                      {row.serialised ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body-sm)' }}>
                    {row.unit_value != null ? `${row.unit_value} ${row.unit_currency || ''}` : '—'}
                  </td>
                  <td>
                    <span style={{ color: row.active ? '#166534' : '#9ca3af', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-body-sm)' }}>
                      {row.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => toggleExpand(row.id)}
                      style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '3px 10px', background: expandedId === row.id ? 'var(--cadet-dark)' : '#fff', color: expandedId === row.id ? '#fff' : 'var(--fg-2)', cursor: 'pointer', fontSize: 'var(--fs-body-sm)' }}
                    >
                      {expandedId === row.id ? 'Hide' : 'Suppliers'}
                    </button>
                  </td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(row)} style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', background: '#fff', cursor: 'pointer', fontSize: 'var(--fs-body-sm)' }}>Edit</button>
                        <button onClick={() => handleDeactivate(row)} style={{ border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', padding: '4px 10px', background: '#fff', cursor: 'pointer', fontSize: 'var(--fs-body-sm)', color: '#dc2626' }}>Deactivate</button>
                      </div>
                    </td>
                  )}
                </tr>

                {/* Suppliers expansion panel */}
                {expandedId === row.id && (
                  <tr key={`sup-${row.id}`}>
                    <td colSpan={isAdmin ? 9 : 8} style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid var(--border-1)' }}>
                      <div style={{ marginBottom: 8, fontSize: 'var(--fs-label)', color: 'var(--fg-3)', fontWeight: 'var(--fw-semibold)' }}>LINKED SUPPLIERS</div>
                      {psLoading ? (
                        <div style={{ color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)' }}>Loading…</div>
                      ) : (
                        <table style={{ width: '100%', maxWidth: 600, borderCollapse: 'collapse', marginBottom: 12 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-1)' }}>
                              <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 'var(--fs-label)', color: 'var(--fg-3)', fontWeight: 'var(--fw-semibold)' }}>Supplier</th>
                              <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: 'var(--fs-label)', color: 'var(--fg-3)', fontWeight: 'var(--fw-semibold)' }}>Lead Time (days)</th>
                              {canEditSuppliers && <th></th>}
                            </tr>
                          </thead>
                          <tbody>
                            {psRows.length === 0 && (
                              <tr><td colSpan={3} style={{ padding: '8px', color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)' }}>No suppliers linked yet.</td></tr>
                            )}
                            {psRows.map((ps) => (
                              <tr key={ps.supplier_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 8px', fontSize: 'var(--fs-body-sm)' }}>
                                  <strong>{ps.supplier_code}</strong>
                                  <span style={{ color: 'var(--fg-3)', marginLeft: 6 }}>{ps.supplier_name}</span>
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body-sm)' }}>
                                  {psEditId === ps.supplier_id ? (
                                    <input
                                      type="number" min="1" value={psEditLt}
                                      onChange={(e) => setPsEditLt(e.target.value)}
                                      style={{ width: 80, border: '1px solid var(--border-1)', borderRadius: 4, padding: '2px 6px', fontSize: 'var(--fs-body-sm)', textAlign: 'right' }}
                                    />
                                  ) : (
                                    ps.lead_time_days != null ? `${ps.lead_time_days}d` : <span style={{ color: 'var(--fg-muted)' }}>—</span>
                                  )}
                                </td>
                                {canEditSuppliers && (
                                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                      {psEditId === ps.supplier_id ? (
                                        <>
                                          <button onClick={() => handlePsUpdate(row.id, ps.supplier_id)} style={{ border: '1px solid var(--border-1)', borderRadius: 4, padding: '2px 8px', background: 'var(--cadet-dark)', color: '#fff', cursor: 'pointer', fontSize: 'var(--fs-body-sm)' }}>Save</button>
                                          <button onClick={() => setPsEditId(null)} style={{ border: '1px solid var(--border-1)', borderRadius: 4, padding: '2px 8px', background: '#fff', cursor: 'pointer', fontSize: 'var(--fs-body-sm)' }}>Cancel</button>
                                        </>
                                      ) : (
                                        <>
                                          <button onClick={() => { setPsEditId(ps.supplier_id); setPsEditLt(ps.lead_time_days != null ? String(ps.lead_time_days) : '') }} style={{ border: '1px solid var(--border-1)', borderRadius: 4, padding: '2px 8px', background: '#fff', cursor: 'pointer', fontSize: 'var(--fs-body-sm)' }}>Edit</button>
                                          <button onClick={() => handlePsRemove(row.id, ps.supplier_id)} style={{ border: '1px solid #fecaca', borderRadius: 4, padding: '2px 8px', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 'var(--fs-body-sm)' }}>Remove</button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {/* Add supplier row */}
                      {canEditSuppliers && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <select
                            value={psAddSupId}
                            onChange={(e) => setPsAddSupId(e.target.value)}
                            style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', fontSize: 'var(--fs-body-sm)', background: '#fff' }}
                          >
                            <option value="">Add supplier…</option>
                            {availableSuppliers.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                          </select>
                          <input
                            type="number" min="1" placeholder="Lead time (days)"
                            value={psAddLt}
                            onChange={(e) => setPsAddLt(e.target.value)}
                            style={{ width: 140, border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', fontSize: 'var(--fs-body-sm)' }}
                          />
                          <button
                            onClick={() => handlePsAdd(row.id)}
                            className="px-3 py-1 rounded-lg text-sm font-semibold text-white transition"
                            style={{ backgroundColor: 'var(--cadet-dark)' }}
                          >Add</button>
                          {psAddErr && <span style={{ color: 'var(--alert)', fontSize: 'var(--fs-body-sm)' }}>{psAddErr}</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editingId ? 'Edit Product' : 'Add Product'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Code" required>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required placeholder="e.g. V400M-001" />
              </FormRow>
              <FormRow label="Name" required>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Verifone V400m" />
              </FormRow>
            </div>
            <FormRow label="Description">
              <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional description" />
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Product Type" required>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" value={form.product_type} onChange={(e) => setForm((f) => ({ ...f, product_type: e.target.value }))} required>
                  <option value="">-- Select --</option>
                  {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormRow>
              <FormRow label="Category" required>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" value={form.product_category} onChange={(e) => setForm((f) => ({ ...f, product_category: e.target.value }))} required>
                  <option value="">-- Select --</option>
                  {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormRow>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={!!form.serialised} onChange={(e) => setForm((f) => ({ ...f, serialised: e.target.checked ? 1 : 0 }))} className="w-4 h-4 rounded" />
                Serialised
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={!!form.is_bom} onChange={(e) => setForm((f) => ({ ...f, is_bom: e.target.checked ? 1 : 0 }))} className="w-4 h-4 rounded" />
                Bill of Materials (BOM)
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Unit Value">
                <input type="number" step="0.01" min="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" value={form.unit_value} onChange={(e) => setForm((f) => ({ ...f, unit_value: e.target.value }))} placeholder="e.g. 250.00" />
              </FormRow>
              <FormRow label="Unit Currency">
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" value={form.unit_currency} onChange={(e) => setForm((f) => ({ ...f, unit_currency: e.target.value }))} placeholder="EUR" maxLength={3} />
              </FormRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Refurb Unit Value">
                <input type="number" step="0.01" min="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" value={form.refurb_unit_value} onChange={(e) => setForm((f) => ({ ...f, refurb_unit_value: e.target.value }))} placeholder="e.g. 150.00" />
              </FormRow>
              <FormRow label="Refurb Currency">
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" value={form.refurb_unit_currency} onChange={(e) => setForm((f) => ({ ...f, refurb_unit_currency: e.target.value }))} placeholder="EUR" maxLength={3} />
              </FormRow>
            </div>
            <FormRow label="HS Code">
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" value={form.hs_code} onChange={(e) => setForm((f) => ({ ...f, hs_code: e.target.value }))} placeholder="e.g. 8470500000" />
            </FormRow>
            <div className="grid grid-cols-3 gap-3">
              <FormRow label="Battery Life (days)">
                <input type="number" min="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" value={form.battery_life_days} onChange={(e) => setForm((f) => ({ ...f, battery_life_days: e.target.value }))} placeholder="e.g. 30" />
              </FormRow>
              <FormRow label="Warranty (days)">
                <input type="number" min="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" value={form.warranty_days} onChange={(e) => setForm((f) => ({ ...f, warranty_days: e.target.value }))} placeholder="e.g. 365" />
              </FormRow>
              <FormRow label="Max Repair (days)">
                <input type="number" min="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" value={form.repair_max_days} onChange={(e) => setForm((f) => ({ ...f, repair_max_days: e.target.value }))} placeholder="e.g. 14" />
              </FormRow>
            </div>

            {/* Product image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {imagePreview && (
                  <div style={{ position: 'relative' }}>
                    <img
                      src={imagePreview}
                      alt="preview"
                      style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: '0.5rem', border: '1px solid #e5e7eb', background: '#f8fafc' }}
                    />
                    <button
                      type="button"
                      onClick={() => { setImagePreview(null); setImageFile(null) }}
                      style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, lineHeight: '18px', textAlign: 'center' }}
                    >×</button>
                  </div>
                )}
                <label style={{ cursor: 'pointer', padding: '0.4rem 0.9rem', borderRadius: '0.5rem', border: '1px dashed #d1d5db', fontSize: '0.82rem', color: '#6b7280', background: '#fafafa' }}>
                  {imageFile ? imageFile.name : imagePreview ? 'Replace image…' : 'Upload image…'}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) {
                        setImageFile(f)
                        setImagePreview(URL.createObjectURL(f))
                      }
                    }}
                  />
                </label>
                {imagePreview && editingId && !imageFile && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm('Remove product image?')) {
                        await deleteProductImage(editingId)
                        setImagePreview(null)
                        setImageBlobUrls((prev) => { const n = { ...prev }; delete n[editingId]; return n })
                        setProducts((prev) => prev.map((p) => p.id === editingId ? { ...p, has_image: false } : p))
                      }
                    }}
                    style={{ fontSize: '0.78rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={submitting} className="text-sm px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--cadet-dark)' }}>
                {submitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function FormRow({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
