import { useState, useEffect, useRef } from 'react'
import { listFirmware, createFirmware, updateFirmware, deleteFirmware, uploadFirmwareFile } from '../../api/firmware.js'
import { getProducts } from '../../api/masterdata.js'

const EMPTY_FORM = {
  firmware_name: '', version: '', release_number: '',
  release_date: '', release_hour: '', key_used: '',
  product_id: '', active: 1,
}

export default function FirmwarePage({ role }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadId, setUploadId] = useState(null)
  const [products, setProducts] = useState([])
  const fileRef = useRef(null)
  const isAdmin = role === 'admin'

  useEffect(() => { getProducts().then(r => setProducts(r.data || [])).catch(() => {}) }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await listFirmware()
      setRows(Array.isArray(r.data) ? r.data : [])
    } catch { setRows([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditingId(null); setForm(EMPTY_FORM); setShowModal(true)
  }

  function openEdit(fw) {
    setEditingId(fw.id)
    setForm({
      firmware_name: fw.firmware_name || '',
      version: fw.version || '',
      release_number: fw.release_number || '',
      release_date: fw.release_date || '',
      release_hour: fw.release_hour || '',
      key_used: fw.key_used || '',
      product_id: fw.product_id ? String(fw.product_id) : '',
      active: fw.active != null ? fw.active : 1,
    })
    setShowModal(true)
  }

  async function handleSave() {
    setSubmitting(true)
    const payload = { ...form, product_id: form.product_id ? Number(form.product_id) : null, active: Number(form.active) }
    try {
      if (editingId) {
        await updateFirmware(editingId, payload)
      } else {
        await createFirmware(payload)
      }
      setShowModal(false); load()
    } catch (e) { alert(e.response?.data?.detail || 'Error saving') }
    finally { setSubmitting(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this firmware record?')) return
    try { await deleteFirmware(id); load() }
    catch (e) { alert(e.response?.data?.detail || 'Error deleting') }
  }

  async function handleFileUpload(e, firmwareId) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadFirmwareFile(firmwareId, file)
      load()
    } catch (e) { alert(e.response?.data?.detail || 'Upload failed') }
    e.target.value = ''
  }

  if (loading) return <p style={{ color: 'var(--fg-muted)' }}>Loading…</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-h3)' }}>Firmware</h2>
        {isAdmin && (
          <button className="e2o-btn e2o-btn-primary" onClick={openCreate}>+ Add Firmware</button>
        )}
      </div>

      <div className="e2o-card" style={{ overflow: 'hidden' }}>
        <table className="e2o-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Product</th>
              <th>Version</th>
              <th>Release #</th>
              <th>Release Date</th>
              <th>Key Used</th>
              <th>Active</th>
              <th>File</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={isAdmin ? 9 : 8} style={{ color: 'var(--fg-muted)', textAlign: 'center', padding: '2rem' }}>No firmware records.</td></tr>
            )}
            {rows.map(fw => (
              <tr key={fw.id}>
                <td style={{ fontWeight: 600 }}>{fw.firmware_name}</td>
                <td><span className="e2o-pill" style={{ background: '#e0f2fe', color: '#075985' }}>{fw.product_code || '—'}</span></td>
                <td><span className="e2o-pill" style={{ background: 'var(--bg-tint-cadet)', color: 'var(--cadet-dark)' }}>{fw.version}</span></td>
                <td style={{ color: 'var(--fg-3)' }}>{fw.release_number || '—'}</td>
                <td>{fw.release_date || '—'}</td>
                <td style={{ color: 'var(--fg-3)' }}>{fw.key_used || '—'}</td>
                <td>
                  <span className="e2o-pill" style={{ background: fw.active ? '#d4edda' : '#f3f4f6', color: fw.active ? '#155724' : '#6b7280' }}>
                    {fw.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  {fw.has_file ? (
                    <span className="e2o-pill" style={{ background: '#d4edda', color: '#155724', fontSize: 10 }}>Uploaded</span>
                  ) : (
                    isAdmin ? (
                      <label style={{ cursor: 'pointer' }}>
                        <span className="e2o-pill" style={{ background: 'var(--bg-3)', color: 'var(--fg-3)', fontSize: 10, cursor: 'pointer' }}>Upload</span>
                        <input type="file" style={{ display: 'none' }} onChange={e => handleFileUpload(e, fw.id)} />
                      </label>
                    ) : <span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>—</span>
                  )}
                </td>
                {isAdmin && (
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="e2o-btn e2o-btn-secondary" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => openEdit(fw)}>Edit</button>
                      <button className="e2o-btn e2o-btn-danger" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => handleDelete(fw.id)}>Delete</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="e2o-modal-overlay">
          <div className="e2o-modal">
            <h3 style={{ margin: '0 0 1.25rem' }}>{editingId ? 'Edit Firmware' : 'Add Firmware'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem .75rem', marginBottom: '1.25rem' }}>
              {[
                ['firmware_name', 'Name', 'text', true],
                ['version', 'Version', 'text', true],
                ['release_number', 'Release #', 'text', false],
                ['release_date', 'Release Date', 'date', false],
                ['key_used', 'Key Used', 'text', false],
              ].map(([field, label, type, required]) => (
                <div key={field}>
                  <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 4 }}>
                    {label}{required && ' *'}
                  </label>
                  <input className="e2o-input" type={type} value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Product *</label>
                <select className="e2o-select" value={form.product_id}
                  onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}>
                  <option value="">Select product…</option>
                  {products.filter(p => p.active).map(p => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.active === 1}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked ? 1 : 0 }))} />
                  Active
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="e2o-btn e2o-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="e2o-btn e2o-btn-primary" onClick={handleSave} disabled={submitting}>
                {submitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
