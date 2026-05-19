import { useState, useEffect, useCallback } from 'react'
import api from '../../api/auth.js'

const BRAND = 'var(--cadet-dark)'

const WAREHOUSE_TYPES = ['Live', 'Pre-Warehouse', 'Out-Warehouse', 'Refurbished Live', 'End State']
const DURATION_UNITS = ['Hours', 'Days']

const WT_COLOURS = {
  'Live':             { bg: '#dcfce7', color: '#166534' },
  'Out-Warehouse':    { bg: '#fef9c3', color: '#854d0e' },
  'Pre-Warehouse':    { bg: '#dbeafe', color: '#1e40af' },
  'Refurbished Live': { bg: '#f3e8ff', color: '#6b21a8' },
  'End State':        { bg: '#fee2e2', color: '#991b1b' },
}

function WtBadge({ wt }) {
  const c = WT_COLOURS[wt] || { bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{ backgroundColor: c.bg, color: c.color, padding: '2px 10px', borderRadius: '9999px', fontSize: '0.73rem', fontWeight: 600 }}>
      {wt || '—'}
    </span>
  )
}

const EMPTY_FORM = {
  code: '',
  display_name: '',
  warehouse_type: '',
  description: '',
  sequence_number: '',
  expected_duration_value: '',
  expected_duration_unit: 'Days',
  valid_location_type_ids: [],
}

export default function StatesPage({ role }) {
  const [states, setStates] = useState([])
  const [locationTypes, setLocationTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showInactive, setShowInactive] = useState(false)

  const [modal, setModal] = useState(null) // null | 'create' | 'edit'
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const isAdmin = role === 'admin'

  const fetchStates = useCallback(() => {
    setLoading(true)
    api.get('/terminal-states', { params: { include_inactive: showInactive } })
      .then((r) => { setStates(r.data); setLoading(false) })
      .catch(() => { setError('Failed to load states.'); setLoading(false) })
  }, [showInactive])

  useEffect(() => {
    fetchStates()
  }, [fetchStates])

  useEffect(() => {
    api.get('/terminal-states/location-types')
      .then((r) => setLocationTypes(r.data))
      .catch(() => {})
  }, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditing(null)
    setFormError(null)
    setModal('create')
  }

  function openEdit(s) {
    setForm({
      code: s.code,
      display_name: s.display_name,
      warehouse_type: s.warehouse_type || '',
      description: s.description || '',
      sequence_number: s.sequence_number != null ? String(s.sequence_number) : '',
      expected_duration_value: s.expected_duration_value != null ? String(s.expected_duration_value) : '',
      expected_duration_unit: s.expected_duration_unit || 'Days',
      valid_location_type_ids: s.valid_location_type_ids || [],
    })
    setEditing(s)
    setFormError(null)
    setModal('edit')
  }

  function closeModal() { setModal(null); setEditing(null) }

  function toggleLocType(id) {
    setForm((f) => {
      const ids = f.valid_location_type_ids.includes(id)
        ? f.valid_location_type_ids.filter((x) => x !== id)
        : [...f.valid_location_type_ids, id]
      return { ...f, valid_location_type_ids: ids }
    })
  }

  async function handleSave() {
    if (!form.code.trim() || !form.display_name.trim()) {
      setFormError('Code and Display Name are required.')
      return
    }
    setSaving(true)
    setFormError(null)
    const payload = {
      code: form.code.trim().toUpperCase(),
      display_name: form.display_name.trim(),
      warehouse_type: form.warehouse_type || null,
      description: form.description.trim() || null,
      sequence_number: form.sequence_number !== '' ? parseInt(form.sequence_number) : null,
      expected_duration_value: form.expected_duration_value !== '' ? parseFloat(form.expected_duration_value) : null,
      expected_duration_unit: form.expected_duration_value !== '' ? (form.expected_duration_unit || 'Days') : null,
      valid_location_type_ids: form.valid_location_type_ids,
    }
    try {
      if (modal === 'create') {
        await api.post('/terminal-states', payload)
      } else {
        await api.put(`/terminal-states/${editing.id}`, payload)
      }
      fetchStates()
      closeModal()
    } catch (e) {
      setFormError(e?.response?.data?.detail || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const locTypeMap = Object.fromEntries(locationTypes.map((lt) => [lt.id, lt.name]))

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {isAdmin && (
          <button
            onClick={openCreate}
            style={{ background: BRAND, color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.45rem 1.1rem', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600 }}
          >
            + Add State
          </button>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#6b7280', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#9ca3af' }}>{states.length} state{states.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && !error && (
        <div style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                {['Seq', 'Code', 'Display Name', 'Type', 'Activity Description', 'Expected Duration', 'Valid Location Types', 'Actions'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#6b7280', fontWeight: 600, fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {states.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: s.active ? 1 : 0.5 }}>
                  <td style={{ padding: '9px 14px', color: '#9ca3af', fontFamily: 'monospace', width: 50 }}>
                    {s.sequence_number != null ? s.sequence_number : '—'}
                  </td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--cadet-dark)', whiteSpace: 'nowrap' }}>
                    {s.code}
                  </td>
                  <td style={{ padding: '9px 14px', fontWeight: 500 }}>{s.display_name}</td>
                  <td style={{ padding: '9px 14px' }}><WtBadge wt={s.warehouse_type} /></td>
                  <td style={{ padding: '9px 14px', color: '#4b5563', maxWidth: 320, fontSize: '0.8rem' }}>
                    {s.activity_description
                      ? s.activity_description
                      : <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                  <td style={{ padding: '9px 14px', whiteSpace: 'nowrap', color: '#374151' }}>
                    {s.expected_duration_value != null
                      ? `${s.expected_duration_value} ${s.expected_duration_unit || ''}`
                      : <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    {(s.valid_location_type_ids || []).length === 0
                      ? <span style={{ color: '#9ca3af' }}>Any</span>
                      : (s.valid_location_type_ids || []).map((id) => (
                          <span key={id} style={{ display: 'inline-block', background: '#f0f9ff', color: '#0369a1', borderRadius: '9999px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600, marginRight: 4, marginBottom: 2 }}>
                            {locTypeMap[id] || id}
                          </span>
                        ))}
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    {isAdmin && (
                      <button
                        onClick={() => openEdit(s)}
                        style={{ background: 'transparent', color: BRAND, border: `1px solid ${BRAND}`, borderRadius: '0.375rem', padding: '3px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {states.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>No states found.</div>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', width: 560, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--cadet-dark)', margin: 0 }}>
                {modal === 'create' ? 'Add State' : 'Edit State'}
              </h2>
              <button onClick={closeModal} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>

            {formError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>{formError}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Code + Seq on same row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                <Field label="Code *">
                  <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    style={inputStyle} placeholder="e.g. AVAILABLE" disabled={modal === 'edit'} />
                </Field>
                <Field label="Sequence #">
                  <input type="number" value={form.sequence_number} onChange={(e) => setForm((f) => ({ ...f, sequence_number: e.target.value }))}
                    style={{ ...inputStyle, width: 90 }} placeholder="e.g. 10" />
                </Field>
              </div>

              <Field label="Display Name *">
                <input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  style={inputStyle} placeholder="e.g. Available" />
              </Field>

              <Field label="Warehouse Type">
                <select value={form.warehouse_type} onChange={(e) => setForm((f) => ({ ...f, warehouse_type: e.target.value }))} style={inputStyle}>
                  <option value="">— None —</option>
                  {WAREHOUSE_TYPES.map((wt) => <option key={wt} value={wt}>{wt}</option>)}
                </select>
              </Field>

              {/* Expected Duration */}
              <div>
                <label style={labelStyle}>Expected Duration</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="number" min="0" step="0.5"
                    value={form.expected_duration_value}
                    onChange={(e) => setForm((f) => ({ ...f, expected_duration_value: e.target.value }))}
                    style={{ ...inputStyle, width: 100 }} placeholder="Value"
                  />
                  <select value={form.expected_duration_unit} onChange={(e) => setForm((f) => ({ ...f, expected_duration_unit: e.target.value }))} style={{ ...inputStyle, width: 100 }}>
                    {DURATION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {form.expected_duration_value && (
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      = {form.expected_duration_value} {form.expected_duration_unit}
                    </span>
                  )}
                </div>
              </div>

              {/* Valid Location Types */}
              <div>
                <label style={labelStyle}>Valid Location Types</label>
                <p style={{ fontSize: '0.73rem', color: '#9ca3af', margin: '2px 0 8px' }}>
                  Leave empty to allow all location types.
                </p>
                {locationTypes.length === 0
                  ? <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>No location types configured.</p>
                  : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {locationTypes.map((lt) => {
                        const selected = form.valid_location_type_ids.includes(lt.id)
                        return (
                          <button
                            key={lt.id}
                            type="button"
                            onClick={() => toggleLocType(lt.id)}
                            style={{
                              border: `2px solid ${selected ? BRAND : '#d1d5db'}`,
                              background: selected ? BRAND : '#fff',
                              color: selected ? '#fff' : '#374151',
                              borderRadius: '0.375rem', padding: '4px 12px',
                              fontSize: '0.8rem', cursor: 'pointer', fontWeight: selected ? 600 : 400,
                              transition: 'all 0.1s',
                            }}
                          >
                            {lt.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
              </div>

              <Field label="Description">
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  style={{ ...inputStyle, height: 72, resize: 'vertical' }} placeholder="Optional description" />
              </Field>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={closeModal} style={{ border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', borderRadius: '0.5rem', padding: '0.45rem 1.1rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} style={{ background: BRAND, color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.45rem 1.25rem', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.4rem 0.75rem',
  fontSize: '0.875rem', outline: 'none', width: '100%', boxSizing: 'border-box',
}
const labelStyle = { display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: 4 }

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}
