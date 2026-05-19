import { useState, useEffect } from 'react'
import { getNonSerialised, updateNonSerialised, createNonSerialised } from '../../api/inventory.js'
import api from '../../api/auth.js'

const NS_STATES = ['Received', 'Available']

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ row, onClose, onSaved }) {
  const [quantity, setQuantity] = useState(row.quantity)
  const [state, setState] = useState(row.state)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function handleSave() {
    setSaving(true)
    setError(null)
    updateNonSerialised(row.id, { quantity: Number(quantity), state })
      .then((res) => { onSaved(res.data); onClose() })
      .catch(() => { setError('Failed to save.'); setSaving(false) })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', minWidth: '360px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--cadet-dark)' }}>Edit Accessories</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {row.product_code} — {row.product_name} @ {row.location_code}
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', fontWeight: 600, marginBottom: '4px' }}>Quantity</label>
          <input
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', fontWeight: 600, marginBottom: '4px' }}>State</label>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.875rem', background: '#fff' }}
          >
            {NS_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {error && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: '0.5rem', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background: 'var(--cadet-dark)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 1.25rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Modal ─────────────────────────────────────────────────────────────────
function AddModal({ products, locations, onClose, onCreated }) {
  const [productId, setProductId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [quantity, setQuantity] = useState(0)
  const [state, setState] = useState('Available')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function handleCreate() {
    if (!productId || !locationId) { setError('Product and location are required.'); return }
    setSaving(true)
    setError(null)
    createNonSerialised({ product_id: Number(productId), location_id: Number(locationId), quantity: Number(quantity), state })
      .then((res) => { onCreated(res.data); onClose() })
      .catch(() => { setError('Failed to create entry.'); setSaving(false) })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', minWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--cadet-dark)' }}>Add Accessories</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        {[
          { label: 'Product', el: (
            <select value={productId} onChange={(e) => setProductId(e.target.value)} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.875rem', background: '#fff' }}>
              <option value="">Select product…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          )},
          { label: 'Location', el: (
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.875rem', background: '#fff' }}>
              <option value="">Select location…</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
            </select>
          )},
          { label: 'State', el: (
            <select value={state} onChange={(e) => setState(e.target.value)} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.875rem', background: '#fff' }}>
              {NS_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )},
          { label: 'Quantity', el: (
            <input type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.875rem' }} />
          )},
        ].map(({ label, el }) => (
          <div key={label} style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', fontWeight: 600, marginBottom: 4 }}>{label}</label>
            {el}
          </div>
        ))}

        {error && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button onClick={onClose} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: '0.5rem', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
          <button onClick={handleCreate} disabled={saving} style={{ background: 'var(--cadet-dark)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.4rem 1.25rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.35rem 0.7rem',
  fontSize: '0.85rem', outline: 'none', background: '#fff',
}

// ── NonSerialisedPage ─────────────────────────────────────────────────────────
export default function NonSerialisedPage({ role }) {
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterState, setFilterState] = useState('')

  const [editRow, setEditRow] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const canEdit = role === 'admin' || role === 'warehouse_user'

  useEffect(() => {
    getNonSerialised()
      .then((res) => { setRows(res.data); setLoading(false) })
      .catch(() => { setError('Failed to load data.'); setLoading(false) })

    api.get('/locations').then((res) => setLocations(res.data)).catch(() => {})
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {})
  }, [])

  function handleSaved(updated) {
    setRows((prev) => prev.map((r) => r.id === updated.id ? updated : r))
  }

  function handleCreated(newRow) {
    setRows((prev) => [...prev, newRow])
  }

  const locationOptions = [...new Set(rows.map((r) => r.location_code).filter(Boolean))].sort()

  const filtered = rows.filter((r) => {
    if (search && !r.product_code?.toLowerCase().includes(search.toLowerCase()) &&
        !r.product_name?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterLocation && r.location_code !== filterLocation) return false
    if (filterState && r.state !== filterState) return false
    return true
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--cadet-dark)' }}>Accessories</h2>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            style={{ background: 'var(--cadet-dark)', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
          >
            + Add Entry
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder="Search product…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, minWidth: 180 }}
        />
        <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={inputStyle}>
          <option value="">All Locations</option>
          {locationOptions.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterState} onChange={(e) => setFilterState(e.target.value)} style={inputStyle}>
          <option value="">All States</option>
          {NS_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || filterLocation || filterState) && (
          <button onClick={() => { setSearch(''); setFilterLocation(''); setFilterState('') }} style={{ ...inputStyle, cursor: 'pointer', color: '#6b7280' }}>Clear</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#9ca3af' }}>{filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}</span>
      </div>

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          No accessories inventory entries found.
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                {['Product', 'Location', 'State', 'Quantity', ...(canEdit ? ['Actions'] : [])].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#6b7280', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--cadet-dark)' }}>{r.product_code}</span>
                    {r.product_name && <span style={{ color: '#6b7280', marginLeft: 4 }}>— {r.product_name}</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{r.location_code} {r.location_name && <span style={{ color: '#9ca3af' }}>— {r.location_name}</span>}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      background: r.state === 'Available' ? '#dcfce7' : '#dbeafe',
                      color: r.state === 'Available' ? '#166534' : '#1e40af',
                      padding: '2px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                    }}>
                      {r.state}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--cadet-dark)' }}>{r.quantity}</td>
                  {canEdit && (
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        onClick={() => setEditRow(r)}
                        style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '4px 12px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRow && (
        <EditModal row={editRow} onClose={() => setEditRow(null)} onSaved={handleSaved} />
      )}
      {showAdd && (
        <AddModal products={products} locations={locations} onClose={() => setShowAdd(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
