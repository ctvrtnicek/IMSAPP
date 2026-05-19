import { useState, useEffect, useCallback } from 'react'
import api from '../../api/auth.js'

const BRAND = 'var(--cadet-dark)'

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const COMMON_TZ = [
  'UTC',
  'Europe/London', 'Europe/Amsterdam', 'Europe/Berlin', 'Europe/Paris',
  'Europe/Warsaw', 'Europe/Prague', 'Europe/Budapest', 'Europe/Rome',
  'Europe/Madrid', 'Europe/Helsinki', 'Europe/Bucharest', 'Europe/Athens',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'America/Toronto',
  'Asia/Dubai', 'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Asia/Seoul',
  'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Bangkok',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
  'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
]

const EMPTY_FORM = {
  entity_type: 'location',
  location_id: '',
  supplier_id: '',
  timezone: 'UTC',
  working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  work_hours_start: '08:00',
  work_hours_end: '17:00',
  holidays: [],
}

function daysFromString(str) {
  return (str || '').split(',').map((d) => d.trim()).filter(Boolean)
}

function daysToString(arr) {
  return arr.join(',')
}

export default function BusinessCalendarPage({ role }) {
  const [cals, setCals] = useState([])
  const [locations, setLocations] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [modal, setModal] = useState(null) // null | 'create' | 'edit'
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  // New holiday input
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayDesc, setNewHolidayDesc] = useState('')

  const isAdmin = role === 'admin'

  const fetchCals = useCallback(() => {
    setLoading(true)
    api.get('/business-calendars')
      .then((r) => { setCals(r.data); setLoading(false) })
      .catch(() => { setError('Failed to load calendars.'); setLoading(false) })
  }, [])

  useEffect(() => { fetchCals() }, [fetchCals])

  useEffect(() => {
    api.get('/locations').then((r) => setLocations(r.data)).catch(() => {})
    api.get('/suppliers').then((r) => setSuppliers(r.data)).catch(() => {})
  }, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditing(null)
    setFormError(null)
    setNewHolidayDate('')
    setNewHolidayDesc('')
    setModal('create')
  }

  function openEdit(cal) {
    setForm({
      entity_type: cal.entity_type,
      location_id: cal.location_id ? String(cal.location_id) : '',
      supplier_id: cal.supplier_id ? String(cal.supplier_id) : '',
      timezone: cal.timezone || 'UTC',
      working_days: daysFromString(cal.working_days),
      work_hours_start: cal.work_hours_start || '08:00',
      work_hours_end: cal.work_hours_end || '17:00',
      holidays: (cal.holidays || []).map((h) => ({ ...h })),
    })
    setEditing(cal)
    setFormError(null)
    setNewHolidayDate('')
    setNewHolidayDesc('')
    setModal('edit')
  }

  function closeModal() { setModal(null); setEditing(null) }

  function toggleDay(day) {
    setForm((f) => {
      const days = f.working_days.includes(day)
        ? f.working_days.filter((d) => d !== day)
        : [...f.working_days, day]
      // preserve Mon-Sun order
      return { ...f, working_days: ALL_DAYS.filter((d) => days.includes(d)) }
    })
  }

  function addHoliday() {
    if (!newHolidayDate) return
    setForm((f) => ({
      ...f,
      holidays: [
        ...f.holidays,
        { holiday_date: newHolidayDate, description: newHolidayDesc.trim() || null },
      ].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)),
    }))
    setNewHolidayDate('')
    setNewHolidayDesc('')
  }

  function removeHoliday(idx) {
    setForm((f) => ({ ...f, holidays: f.holidays.filter((_, i) => i !== idx) }))
  }

  async function handleSave() {
    const entityId = form.entity_type === 'location' ? form.location_id : form.supplier_id
    if (!entityId) {
      setFormError(`Select a ${form.entity_type}.`)
      return
    }
    if (form.working_days.length === 0) {
      setFormError('Select at least one working day.')
      return
    }
    setSaving(true)
    setFormError(null)
    const payload = {
      entity_type: form.entity_type,
      location_id: form.entity_type === 'location' ? parseInt(form.location_id) : null,
      supplier_id: form.entity_type === 'supplier' ? parseInt(form.supplier_id) : null,
      timezone: form.timezone,
      working_days: daysToString(form.working_days),
      work_hours_start: form.work_hours_start,
      work_hours_end: form.work_hours_end,
      holidays: form.holidays,
    }
    try {
      if (modal === 'create') {
        await api.post('/business-calendars', payload)
      } else {
        await api.put(`/business-calendars/${editing.id}`, payload)
      }
      fetchCals()
      closeModal()
    } catch (e) {
      setFormError(e?.response?.data?.detail || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(cal) {
    if (!confirm(`Delete calendar for ${cal.location_label || cal.supplier_label || 'this entity'}?`)) return
    try {
      await api.delete(`/business-calendars/${cal.id}`)
      fetchCals()
    } catch {
      alert('Delete failed.')
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem' }}>
        {isAdmin && (
          <button
            onClick={openCreate}
            style={{ background: BRAND, color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.45rem 1.1rem', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600 }}
          >
            + Add Calendar
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#9ca3af' }}>{cals.length} calendar{cals.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && !error && cals.length === 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '2.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          No business calendars configured.
        </div>
      )}

      {!loading && !error && cals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {cals.map((cal) => (
            <CalCard key={cal.id} cal={cal} isAdmin={isAdmin} onEdit={() => openEdit(cal)} onDelete={() => handleDelete(cal)} />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', width: 600, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--cadet-dark)', margin: 0 }}>
                {modal === 'create' ? 'Add Business Calendar' : 'Edit Business Calendar'}
              </h2>
              <button onClick={closeModal} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>

            {formError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>{formError}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {/* Entity type + entity */}
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.75rem', alignItems: 'end' }}>
                <Field label="Entity Type">
                  <select value={form.entity_type} onChange={(e) => setForm((f) => ({ ...f, entity_type: e.target.value, location_id: '', supplier_id: '' }))} style={inputStyle}>
                    <option value="location">Location</option>
                    <option value="supplier">Supplier</option>
                  </select>
                </Field>
                <Field label={form.entity_type === 'location' ? 'Location *' : 'Supplier *'}>
                  {form.entity_type === 'location' ? (
                    <select value={form.location_id} onChange={(e) => setForm((f) => ({ ...f, location_id: e.target.value }))} style={inputStyle}>
                      <option value="">— Select —</option>
                      {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
                    </select>
                  ) : (
                    <select value={form.supplier_id} onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))} style={inputStyle}>
                      <option value="">— Select —</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                    </select>
                  )}
                </Field>
              </div>

              {/* Timezone */}
              <Field label="Timezone (IANA)">
                <select value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} style={inputStyle}>
                  {COMMON_TZ.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </Field>

              {/* Working days */}
              <div>
                <label style={labelStyle}>Working Days *</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: 6 }}>
                  {ALL_DAYS.map((day) => {
                    const on = form.working_days.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        style={{
                          border: `2px solid ${on ? BRAND : '#d1d5db'}`,
                          background: on ? BRAND : '#fff',
                          color: on ? '#fff' : '#374151',
                          borderRadius: '0.375rem',
                          padding: '4px 10px', fontSize: '0.8rem',
                          cursor: 'pointer', fontWeight: on ? 700 : 400, minWidth: 42,
                        }}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Work hours */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Work Hours Start">
                  <input type="time" value={form.work_hours_start} onChange={(e) => setForm((f) => ({ ...f, work_hours_start: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Work Hours End">
                  <input type="time" value={form.work_hours_end} onChange={(e) => setForm((f) => ({ ...f, work_hours_end: e.target.value }))} style={inputStyle} />
                </Field>
              </div>

              {/* Public Holidays */}
              <div>
                <label style={labelStyle}>Public Holidays</label>
                {form.holidays.length > 0 && (
                  <div style={{ marginBottom: '0.5rem', maxHeight: 200, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={thStyle}>Date</th>
                          <th style={thStyle}>Description</th>
                          <th style={{ ...thStyle, width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.holidays.map((h, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={tdStyle}>{h.holiday_date}</td>
                            <td style={{ ...tdStyle, color: '#6b7280' }}>{h.description || '—'}</td>
                            <td style={tdStyle}>
                              <button onClick={() => removeHoliday(i)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* Add holiday row */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: 6 }}>
                  <input type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)}
                    style={{ ...inputStyle, flex: '0 0 150px' }} />
                  <input type="text" placeholder="Description (optional)" value={newHolidayDesc} onChange={(e) => setNewHolidayDesc(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={addHoliday} disabled={!newHolidayDate}
                    style={{ background: BRAND, color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap', opacity: newHolidayDate ? 1 : 0.5 }}>
                    + Add
                  </button>
                </div>
              </div>
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

function CalCard({ cal, isAdmin, onEdit, onDelete }) {
  const days = daysFromString(cal.working_days)

  return (
    <div style={{ background: '#fff', borderRadius: '0.875rem', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '1.25rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Entity */}
        <div>
          <span style={{
            display: 'inline-block', background: cal.entity_type === 'location' ? '#dbeafe' : '#f3e8ff',
            color: cal.entity_type === 'location' ? '#1e40af' : '#6b21a8',
            borderRadius: '9999px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700, marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {cal.entity_type}
          </span>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--cadet-dark)' }}>
            {cal.location_label || cal.supplier_label || `ID ${cal.location_id || cal.supplier_id}`}
          </div>
        </div>

        {/* Actions */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={onEdit} style={{ background: 'transparent', color: BRAND, border: `1px solid ${BRAND}`, borderRadius: '0.375rem', padding: '3px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
            <button onClick={onDelete} style={{ background: 'transparent', color: '#dc2626', border: '1px solid #dc2626', borderRadius: '0.375rem', padding: '3px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
          </div>
        )}
      </div>

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
        <Detail label="Timezone">{cal.timezone}</Detail>
        <Detail label="Working Days">
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {ALL_DAYS.map((d) => (
              <span key={d} style={{
                padding: '1px 6px', borderRadius: '0.25rem', fontSize: '0.72rem', fontWeight: 600,
                background: days.includes(d) ? BRAND : '#f3f4f6',
                color: days.includes(d) ? '#fff' : '#9ca3af',
              }}>{d}</span>
            ))}
          </div>
        </Detail>
        <Detail label="Work Hours">{cal.work_hours_start} – {cal.work_hours_end}</Detail>
        <Detail label="Holidays">{cal.holidays?.length || 0}</Detail>
      </div>

      {/* Holiday list */}
      {cal.holidays?.length > 0 && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {cal.holidays.map((h) => (
            <span key={h.id || h.holiday_date} style={{ background: '#fef9c3', color: '#854d0e', borderRadius: '9999px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 600 }}>
              {h.holiday_date}{h.description ? ` — ${h.description}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Detail({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: '0.68rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: '0.82rem', color: '#374151' }}>{children}</div>
    </div>
  )
}

const inputStyle = {
  border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.4rem 0.75rem',
  fontSize: '0.875rem', outline: 'none', width: '100%', boxSizing: 'border-box',
}
const labelStyle = { display: 'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: 4 }
const thStyle = { textAlign: 'left', padding: '6px 10px', color: '#9ca3af', fontWeight: 600, fontSize: '0.72rem' }
const tdStyle = { padding: '6px 10px' }

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}


