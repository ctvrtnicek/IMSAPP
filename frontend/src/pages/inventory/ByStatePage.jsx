import { useState, useEffect, useRef } from 'react'
import { getByState, getSerials } from '../../api/inventory.js'

const WAREHOUSE_TYPE_COLOURS = {
  'Live':             { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  'Out-Warehouse':    { bg: '#fef9c3', color: '#854d0e', border: '#fde68a' },
  'Pre-Warehouse':    { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  'Refurbished Live': { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' },
  'End State':        { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  'Pegged':           { bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' },
}

function StateBadge({ name, warehouseType }) {
  const c = WAREHOUSE_TYPE_COLOURS[warehouseType] || { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' }
  return (
    <span style={{ backgroundColor: c.bg, color: c.color, padding: '2px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
      {name}
    </span>
  )
}

export default function ByStatePage() {
  const [summaries, setSummaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Drill-down state
  const [selectedState, setSelectedState] = useState(null)
  const [drillRows, setDrillRows] = useState([])
  const [drillLoading, setDrillLoading] = useState(false)

  // Customize KPI visibility
  const [visibleStates, setVisibleStates] = useState(null)
  const [showCustomize, setShowCustomize] = useState(false)
  const customizeRef = useRef(null)

  useEffect(() => {
    getByState()
      .then((res) => {
        setSummaries(res.data)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load data.'); setLoading(false) })
  }, [])

  // Initialize visibleStates to top 8 by count once data is loaded
  useEffect(() => {
    if (summaries.length > 0 && visibleStates === null) {
      const top8 = [...summaries]
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
        .map((s) => s.state_code)
      setVisibleStates(top8)
    }
  }, [summaries, visibleStates])

  function resetDefaults() {
    const top8 = [...summaries]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((s) => s.state_code)
    setVisibleStates(top8)
  }

  function toggleStateVisibility(code) {
    setVisibleStates((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  function handleCardClick(summary) {
    if (selectedState === summary.state_code) {
      setSelectedState(null)
      setDrillRows([])
      return
    }
    setSelectedState(summary.state_code)
    setDrillLoading(true)
    getSerials({ state_code: summary.state_code })
      .then((res) => { setDrillRows(res.data); setDrillLoading(false) })
      .catch(() => setDrillLoading(false))
  }

  // We need warehouse_type per state_code for badges in drill-down
  const wtMap = {}
  summaries.forEach((s) => { if (s.warehouse_type) wtMap[s.state_code] = s.warehouse_type })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--cadet-dark)', margin: 0 }}>Inventory by State</h2>
        {!loading && !error && summaries.length > 0 && (
          <div style={{ position: 'relative' }} ref={customizeRef}>
            <button
              onClick={() => setShowCustomize((v) => !v)}
              style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '4px 12px', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--fg-2)', fontWeight: 600 }}
            >
              Customize
            </button>
            {showCustomize && (
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: '#fff', border: '1px solid var(--border-1)', borderRadius: '0.75rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', padding: '1rem', minWidth: 260 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--cadet-dark)' }}>Visible KPI Cards</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={resetDefaults} style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '2px 10px', background: '#f8fafc', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--fg-2)' }}>Reset</button>
                    <button onClick={() => setShowCustomize(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem', lineHeight: 1 }}>✕</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {summaries.map((s) => (
                    <label key={s.state_code} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--fg-2)' }}>
                      <input
                        type="checkbox"
                        checked={visibleStates ? visibleStates.includes(s.state_code) : false}
                        onChange={() => toggleStateVisibility(s.state_code)}
                      />
                      {s.state_name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && !error && summaries.length === 0 && (
        <p style={{ color: '#9ca3af' }}>No inventory data available.</p>
      )}

      {/* Summary cards */}
      {!loading && !error && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          {summaries.filter((s) => !visibleStates || visibleStates.includes(s.state_code)).map((s) => {
            const c = WAREHOUSE_TYPE_COLOURS[s.warehouse_type] || { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' }
            const isSelected = selectedState === s.state_code
            return (
              <div
                key={s.state_code}
                onClick={() => handleCardClick(s)}
                style={{
                  background: isSelected ? c.bg : '#fff',
                  border: `2px solid ${isSelected ? c.border || c.bg : '#e5e7eb'}`,
                  borderRadius: '1rem',
                  padding: '1.25rem 1.5rem',
                  minWidth: '180px',
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.12)' : '0 1px 4px rgba(0,0,0,0.06)',
                  transition: 'all 0.15s ease',
                }}
              >
                <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--cadet-dark)', marginBottom: '0.5rem' }}>
                  {s.state_name}
                </p>
                <p style={{ fontWeight: 800, fontSize: '2rem', color: c.color, lineHeight: 1, marginBottom: '0.5rem' }}>
                  {s.count}
                </p>
                {s.warehouse_type && (
                  <span style={{ backgroundColor: c.bg, color: c.color, padding: '2px 8px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600 }}>
                    {s.warehouse_type}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Drill-down table */}
      {selectedState && (
        <div style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #e5e7eb', fontWeight: 700, color: 'var(--cadet-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Terminals in: {summaries.find((s) => s.state_code === selectedState)?.state_name || selectedState}</span>
            <button
              onClick={() => { setSelectedState(null); setDrillRows([]) }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.1rem' }}
            >
              ✕
            </button>
          </div>
          {drillLoading ? (
            <p style={{ padding: '1rem', color: '#6b7280' }}>Loading…</p>
          ) : drillRows.length === 0 ? (
            <p style={{ padding: '1rem', color: '#9ca3af' }}>No terminals found.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                  {['Serial Number', 'Product', 'Location', 'Stock Type', 'Cost (€)',
                    ...(selectedState === '_PEGGED' ? ['Order Ref'] : [])
                  ].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#6b7280', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drillRows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--cadet-dark)' }}><a href={`/terminal/${row.id}`} style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: '#9ca3af' }}>{row.serial_number}</a></td>
                    <td style={{ padding: '10px 14px' }}>{row.product_code} {row.product_name && <span style={{ color: '#6b7280' }}>— {row.product_name}</span>}</td>
                    <td style={{ padding: '10px 14px' }}>{row.current_location_code || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>{row.stock_type}</td>
                    <td style={{ padding: '10px 14px' }}>{(row.accumulated_cost || 0).toFixed(2)}</td>
                    {selectedState === '_PEGGED' && (
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>
                        {row.pegged_to_order_number
                          ? <a href={`/order/${row.pegged_to_order_number}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>{row.pegged_to_order_number}</a>
                          : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ padding: '8px 14px', color: '#9ca3af', fontSize: '0.78rem', borderTop: '1px solid #f3f4f6' }}>
            {drillRows.length} terminal{drillRows.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
