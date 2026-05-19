import { useState, useEffect } from 'react'
import { getInTransit } from '../../api/inventory.js'

const STATE_BADGE = {
  EXPECTING:              { bg: '#dbeafe', text: '#1e40af', label: 'Inbound (Expecting)' },
  TRANSIT_TO_COMPANY:     { bg: '#fef9c3', text: '#854d0e', label: 'To Company' },
  TRANSIT_TO_WAREHOUSE:   { bg: '#f3e8ff', text: '#6b21a8', label: 'To Warehouse' },
  TRANSIT_TO_REPAIR:      { bg: '#fce7f3', text: '#9d174d', label: 'To Repair' },
}

const TRANSIT_STATE_OPTIONS = [
  { value: '', label: 'All States' },
  { value: 'EXPECTING', label: 'Inbound (Expecting)' },
  { value: 'TRANSIT_TO_COMPANY', label: 'To Company' },
  { value: 'TRANSIT_TO_WAREHOUSE', label: 'To Warehouse' },
  { value: 'TRANSIT_TO_REPAIR', label: 'To Repair' },
]

const inputStyle = {
  border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.35rem 0.7rem',
  fontSize: '0.85rem', outline: 'none', background: '#fff',
}

export default function InTransitPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('')

  useEffect(() => {
    getInTransit()
      .then((res) => { setRows(res.data); setLoading(false) })
      .catch(() => { setError('Failed to load data.'); setLoading(false) })
  }, [])

  const suppliers = [...new Set(rows.map((r) => r.supplier_name).filter(Boolean))].sort()

  const filtered = rows.filter((r) => {
    if (search && !r.serial_number?.toLowerCase().includes(search.toLowerCase()) &&
        !r.product_code?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterState && r.current_state_code !== filterState) return false
    if (filterSupplier && r.supplier_name !== filterSupplier) return false
    return true
  })

  function handleClear() { setSearch(''); setFilterState(''); setFilterSupplier('') }

  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--cadet-dark)', marginBottom: '1rem' }}>In Transit</h2>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder="Search serial / product…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, minWidth: 200 }}
        />
        <select value={filterState} onChange={(e) => setFilterState(e.target.value)} style={inputStyle}>
          {TRANSIT_STATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} style={inputStyle}>
          <option value="">All Sources</option>
          {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || filterState || filterSupplier) && (
          <button onClick={handleClear} style={{ ...inputStyle, cursor: 'pointer', color: '#6b7280' }}>Clear</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#9ca3af' }}>
          {filtered.length} terminal{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '2.5rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          No terminals in transit matching filters.
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                {['Serial Number', 'Product', 'Transit State', 'From', 'To Location', 'Reference #', 'Latest Date'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#6b7280', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const badge = STATE_BADGE[s.current_state_code] || { bg: '#f3f4f6', text: '#374151', label: s.current_state_code }
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--cadet-dark)' }}><a href={`/terminal/${s.id}`} style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: '#9ca3af' }}>{s.serial_number}</a></td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontWeight: 600 }}>{s.product_code}</span>
                      {s.product_name && <span style={{ color: '#6b7280', marginLeft: 4 }}>— {s.product_name}</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: badge.bg, color: badge.text, padding: '2px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>
                      {s.current_state_code === 'EXPECTING' ? (s.supplier_name || '—') : (s.current_location_code || '—')}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>
                      {s.to_location_label || (s.current_state_code === 'EXPECTING' ? (s.current_location_code || '—') : '—')}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151', fontFamily: 'monospace', fontSize: '0.82rem' }}>{s.order_reference || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151', fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {s.latest_date ? s.latest_date.slice(0, 16).replace('T', ' ') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '8px 14px', color: '#9ca3af', fontSize: '0.78rem', borderTop: '1px solid #f3f4f6' }}>
            {filtered.length} terminal{filtered.length !== 1 ? 's' : ''} in transit
          </div>
        </div>
      )}
    </div>
  )
}
