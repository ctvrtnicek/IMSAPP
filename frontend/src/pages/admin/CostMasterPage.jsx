import { useState, useEffect } from 'react'
import { listActivityCosts, createActivityCost, updateActivityCost, deleteActivityCost } from '../../api/cost_master.js'
import api from '../../api/auth.js'

const EMPTY = { location_code: '', state_code: '', product_code: '', amount: '', currency: 'EUR' }

const inputStyle = {
  width: '100%', border: '1px solid #d1d5db', borderRadius: '0.5rem',
  padding: '0.4rem 0.75rem', fontSize: '0.875rem', outline: 'none', background: '#fff',
}

function Modal({ title, onClose, children }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', minWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--cadet-dark)' }}>{title}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function CostMasterPage({ role }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)  // null | 'add' | 'edit'
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [locations, setLocations] = useState([])
  const [states, setStates] = useState([])

  const isAdmin = role === 'admin'

  useEffect(() => {
    api.get('/locations').then((r) => setLocations(r.data)).catch(() => {})
    api.get('/terminal-states').then((r) => setStates(r.data)).catch(() => {})
  }, [])

  function load() {
    setLoading(true)
    listActivityCosts()
      .then((r) => { setRows(r.data); setLoading(false) })
      .catch(() => { setError('Failed to load cost master.'); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setForm(EMPTY)
    setEditing(null)
    setFormError(null)
    setSaving(false)
    setModal('add')
  }

  function openEdit(row) {
    setForm({
      location_code: row.location_code,
      state_code: row.state_code,
      product_code: row.product_code || '',
      amount: String(row.amount),
      currency: row.currency,
    })
    setEditing(row)
    setFormError(null)
    setSaving(false)
    setModal('edit')
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
  }

  function buildPayload() {
    return {
      location_code: form.location_code.trim(),
      state_code: form.state_code.trim(),
      product_code: form.product_code.trim() || null,
      amount: parseFloat(form.amount),
      currency: form.currency.trim() || 'EUR',
    }
  }

  function handleSave() {
    setFormError(null)
    if (!form.location_code || !form.state_code || !form.amount) {
      setFormError('Location code, state code and amount are required.')
      return
    }
    if (isNaN(parseFloat(form.amount))) {
      setFormError('Amount must be a number.')
      return
    }
    setSaving(true)
    const payload = buildPayload()
    const promise = modal === 'add'
      ? createActivityCost(payload)
      : updateActivityCost(editing.id, payload)
    promise
      .then(() => { setSaving(false); load(); setModal(null) })
      .catch(() => { setFormError('Save failed.'); setSaving(false) })
  }

  function handleDelete(row) {
    if (!window.confirm(`Delete cost rule for ${row.location_code} / ${row.state_code}?`)) return
    deleteActivityCost(row.id)
      .then(() => load())
      .catch(() => alert('Delete failed.'))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--cadet-dark)' }}>Activity Cost Master</h2>
        {isAdmin && (
          <button
            onClick={openAdd}
            style={{ background: 'var(--cadet-dark)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
          >
            + Add Rule
          </button>
        )}
      </div>

      <p style={{ color: '#6b7280', fontSize: '0.82rem', marginBottom: '1rem' }}>
        Define the cost applied to a serial when it enters a given state at a given location.
        Leave <em>Product Code</em> blank for a generic rule that applies to all products.
        Product-specific rules take priority over generic ones.
      </p>

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          No cost rules configured yet.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                {['Location Code', 'State Code', 'Product Code', 'Amount', 'Currency', ...(isAdmin ? ['Actions'] : [])].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#6b7280', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--cadet-dark)' }}>{r.location_code}</td>
                  <td style={{ padding: '10px 14px', color: '#374151', fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.state_code}</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{r.product_code || <span style={{ color: '#9ca3af' }}>— (all)</span>}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#166534' }}>{parseFloat(r.amount).toFixed(2)}</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{r.currency}</td>
                  {isAdmin && (
                    <td style={{ padding: '10px 14px', display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => openEdit(r)}
                        style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '4px 12px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                      >Edit</button>
                      <button
                        onClick={() => handleDelete(r)}
                        style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '0.375rem', padding: '4px 12px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                      >Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal === 'add' ? 'Add Cost Rule' : 'Edit Cost Rule'} onClose={() => setModal(null)}>
          {/* Location Code */}
          <div style={{ marginBottom: '0.875rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', fontWeight: 600, marginBottom: 4 }}>Location Code *</label>
            <select name="location_code" value={form.location_code} onChange={handleChange} style={inputStyle}>
              <option value="">Select location…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.code}>{l.code} — {l.name}</option>
              ))}
            </select>
          </div>

          {/* State Code */}
          <div style={{ marginBottom: '0.875rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', fontWeight: 600, marginBottom: 4 }}>State Code *</label>
            <select name="state_code" value={form.state_code} onChange={handleChange} style={inputStyle}>
              <option value="">Select state…</option>
              {states.map((s) => (
                <option key={s.id} value={s.code}>{s.code} — {s.display_name}</option>
              ))}
            </select>
          </div>

          {/* Product Code */}
          <div style={{ marginBottom: '0.875rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', fontWeight: 600, marginBottom: 4 }}>Product Code <span style={{ fontWeight: 400, color: '#9ca3af' }}>(leave blank for generic — applies to all products)</span></label>
            <input
              type="text"
              name="product_code"
              value={form.product_code}
              onChange={handleChange}
              placeholder="e.g. P400"
              style={inputStyle}
            />
          </div>

          {/* Amount + Currency side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', fontWeight: 600, marginBottom: 4 }}>Amount *</label>
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                placeholder="0.00"
                min="0"
                step="any"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', fontWeight: 600, marginBottom: 4 }}>Currency</label>
              <input
                type="text"
                name="currency"
                value={form.currency}
                onChange={handleChange}
                placeholder="EUR"
                style={inputStyle}
              />
            </div>
          </div>

          {formError && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{formError}</p>}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button onClick={() => setModal(null)} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: '0.5rem', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ background: 'var(--cadet-dark)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 1.25rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
