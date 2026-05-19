import { useState, useEffect } from 'react'
import { listExchangeRates, createExchangeRate, updateExchangeRate, deleteExchangeRate } from '../../api/cost_master.js'

const EMPTY = { from_currency: '', to_currency: '', rate: '', effective_date: '' }

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
      <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', minWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--cadet-dark)' }}>{title}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function ExchangeRatesPage({ role }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const isAdmin = role === 'admin'

  function load() {
    setLoading(true)
    listExchangeRates()
      .then((r) => { setRows(r.data); setLoading(false) })
      .catch(() => { setError('Failed to load exchange rates.'); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setForm({ ...EMPTY, effective_date: new Date().toISOString().slice(0, 10) })
    setEditing(null)
    setFormError(null)
    setModal('add')
  }

  function openEdit(row) {
    setForm({ from_currency: row.from_currency, to_currency: row.to_currency, rate: String(row.rate), effective_date: row.effective_date })
    setEditing(row)
    setFormError(null)
    setModal('edit')
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
  }

  function handleSave() {
    setFormError(null)
    if (!form.from_currency || !form.to_currency || !form.rate || !form.effective_date) {
      setFormError('All fields are required.')
      return
    }
    if (isNaN(parseFloat(form.rate)) || parseFloat(form.rate) <= 0) {
      setFormError('Rate must be a positive number.')
      return
    }
    setSaving(true)
    const payload = {
      from_currency: form.from_currency.trim().toUpperCase(),
      to_currency: form.to_currency.trim().toUpperCase(),
      rate: parseFloat(form.rate),
      effective_date: form.effective_date,
    }
    const promise = modal === 'add'
      ? createExchangeRate(payload)
      : updateExchangeRate(editing.id, payload)
    promise
      .then(() => { load(); setModal(null) })
      .catch(() => { setFormError('Save failed.'); setSaving(false) })
  }

  function handleDelete(row) {
    if (!window.confirm(`Delete rate ${row.from_currency}→${row.to_currency} (${row.effective_date})?`)) return
    deleteExchangeRate(row.id)
      .then(() => load())
      .catch(() => alert('Delete failed.'))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--cadet-dark)' }}>Exchange Rates</h2>
        {isAdmin && (
          <button
            onClick={openAdd}
            style={{ background: 'var(--cadet-dark)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
          >
            + Add Rate
          </button>
        )}
      </div>

      <p style={{ color: '#6b7280', fontSize: '0.82rem', marginBottom: '1rem' }}>
        Exchange rates are used by the cost engine to convert activity costs to each location's reporting currency.
        When multiple rates exist for the same currency pair, the most recent rate on or before the transition date is used.
      </p>

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          No exchange rates configured yet.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                {['From', 'To', 'Rate', 'Effective Date', ...(isAdmin ? ['Actions'] : [])].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#6b7280', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--cadet-dark)' }}>{r.from_currency}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--cadet-dark)' }}>{r.to_currency}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#374151' }}>{r.rate}</td>
                  <td style={{ padding: '10px 14px', color: '#374151', fontFamily: 'monospace', fontSize: '0.82rem' }}>{r.effective_date}</td>
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
        <Modal title={modal === 'add' ? 'Add Exchange Rate' : 'Edit Exchange Rate'} onClose={() => setModal(null)}>
          {[
            { label: 'From Currency *', name: 'from_currency', placeholder: 'e.g. USD' },
            { label: 'To Currency *', name: 'to_currency', placeholder: 'e.g. EUR' },
            { label: 'Rate *', name: 'rate', placeholder: '1.0850', type: 'number' },
            { label: 'Effective Date *', name: 'effective_date', placeholder: '', type: 'date' },
          ].map(({ label, name, placeholder, type }) => (
            <div key={name} style={{ marginBottom: '0.875rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', fontWeight: 600, marginBottom: 4 }}>{label}</label>
              <input
                type={type || 'text'}
                name={name}
                value={form[name]}
                onChange={handleChange}
                placeholder={placeholder}
                step={type === 'number' ? 'any' : undefined}
                style={inputStyle}
              />
            </div>
          ))}
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
