import { useState, useEffect } from 'react'
import { getByLocation, getSerials } from '../../api/inventory.js'

const inputStyle = {
  border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.35rem 0.7rem',
  fontSize: '0.85rem', outline: 'none', background: '#fff',
}

function downloadCSV(data, filename) {
  const headers = ['Location Code', 'Location Name', 'Serialised', 'Non-Serialised', 'Total', 'Total Cost (€)']
  const rows = data.map(r => [
    r.location_code,
    r.location_name,
    r.serialised_count,
    r.non_serialised_count,
    r.serialised_count + r.non_serialised_count,
    (r.total_cost || 0).toFixed(2)
  ])
  const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function ByLocationPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [filterLocation, setFilterLocation] = useState('')

  const [expandedId, setExpandedId] = useState(null)
  const [drillRows, setDrillRows] = useState([])
  const [drillLoading, setDrillLoading] = useState(false)

  useEffect(() => {
    getByLocation()
      .then((res) => { setRows(res.data); setLoading(false) })
      .catch(() => { setError('Failed to load data.'); setLoading(false) })
  }, [])

  function handleRowClick(locId) {
    if (expandedId === locId) { setExpandedId(null); setDrillRows([]); return }
    setExpandedId(locId)
    setDrillLoading(true)
    getSerials({ location_id: locId })
      .then((res) => { setDrillRows(res.data); setDrillLoading(false) })
      .catch(() => setDrillLoading(false))
  }

  const locationOptions = [...new Set(rows.map(r => r.location_code))].sort()

  const filtered = rows.filter((r) => {
    if (filterLocation && r.location_code !== filterLocation) return false
    if (!search) return true
    const q = search.toLowerCase()
    return r.location_code?.toLowerCase().includes(q) || r.location_name?.toLowerCase().includes(q)
  })

  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--cadet-dark)', marginBottom: '1rem' }}>Inventory by Location</h2>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder="Search location…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, minWidth: 200 }}
        />
        <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={inputStyle}>
          <option value="">All Locations</option>
          {locationOptions.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
        </select>
        {(search || filterLocation) && (
          <button onClick={() => { setSearch(''); setFilterLocation('') }} style={{ ...inputStyle, cursor: 'pointer', color: '#6b7280' }}>Clear</button>
        )}
        <button
          onClick={() => downloadCSV(filtered, 'inventory-by-location.csv')}
          style={{ ...inputStyle, cursor: 'pointer', background: '#f0f9ff', color: 'var(--cadet-dark)', fontWeight: 600 }}
        >
          Export CSV
        </button>
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#9ca3af' }}>{filtered.length} location{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
          No locations found.
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                {['Location Code', 'Location Name', 'Serialised', 'Non-Serialised', 'Total', 'Total Cost (€)'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#6b7280', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <>
                  <tr
                    key={r.location_id}
                    onClick={() => handleRowClick(r.location_id)}
                    style={{
                      borderBottom: expandedId === r.location_id ? 'none' : '1px solid #f3f4f6',
                      cursor: 'pointer',
                      background: expandedId === r.location_id ? '#f0f7ff' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--cadet-dark)' }}>{r.location_code}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{r.location_name}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--cadet-dark)' }}>{r.serialised_count}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{r.non_serialised_count}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--cadet-dark)' }}>{r.serialised_count + r.non_serialised_count}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.82rem', color: '#374151' }}>
                      {r.total_cost ? `€ ${r.total_cost.toFixed(2)}` : '—'}
                    </td>
                  </tr>

                  {expandedId === r.location_id && (
                    <tr key={`drill-${r.location_id}`}>
                      <td colSpan={6} style={{ padding: 0, background: '#f8fafc' }}>
                        <div style={{ padding: '1rem', borderBottom: '2px solid #e5e7eb' }}>
                          <p style={{ fontWeight: 700, fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                            SERIALS AT {r.location_code}
                          </p>
                          {drillLoading ? (
                            <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>Loading…</p>
                          ) : drillRows.length === 0 ? (
                            <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No serialised terminals at this location.</p>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  {['Serial Number', 'Product', 'State', 'Stock Type'].map((h) => (
                                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#9ca3af', fontWeight: 600 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {drillRows.map((d) => (
                                  <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 600 }}><a href={`/terminal/${d.id}`} style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: '#9ca3af' }}>{d.serial_number}</a></td>
                                    <td style={{ padding: '6px 10px' }}>{d.product_code}</td>
                                    <td style={{ padding: '6px 10px' }}>{d.current_state_name || '—'}</td>
                                    <td style={{ padding: '6px 10px' }}>{d.stock_type}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
