import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSerials, getTerminalStates } from '../../api/inventory.js'
import api from '../../api/auth.js'

const WAREHOUSE_TYPE_COLOURS = {
  'Live':             { bg: '#dcfce7', color: '#166534' },
  'Out-Warehouse':    { bg: '#fef9c3', color: '#854d0e' },
  'Pre-Warehouse':    { bg: 'var(--bg-tint-cadet)', color: 'var(--cadet-dark)' },
  'Refurbished Live': { bg: '#f3e8ff', color: 'var(--violet-medium)' },
  'End State':        { bg: '#fee2e2', color: 'var(--alert)' },
}

function StateBadge({ stateName, warehouseType }) {
  const c = WAREHOUSE_TYPE_COLOURS[warehouseType] || { bg: 'var(--bg-3)', color: 'var(--fg-2)' }
  return (
    <span className="e2o-pill" style={{ background: c.bg, color: c.color }}>
      {stateName || '—'}
    </span>
  )
}

// ── AllTerminalsPage ──────────────────────────────────────────────────────────
export default function AllTerminalsPage() {
  const navigate = useNavigate()
  const [serials, setSerials] = useState([])
  const [states, setStates] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filter state
  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterProduct, setFilterProduct] = useState('')

  // Paging state
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(0)

  // Load states and locations once
  useEffect(() => {
    getTerminalStates()
      .then((res) => setStates(res.data))
      .catch(() => {})

    api.get('/locations')
      .then((res) => setLocations(res.data))
      .catch(() => {})
  }, [])

  const fetchSerials = useCallback(() => {
    setLoading(true)
    setError(null)
    const params = {}
    if (search) params.search = search
    if (filterState) params.state_code = filterState
    if (filterLocation) params.location_id = filterLocation

    getSerials(params)
      .then((res) => {
        setSerials(res.data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load terminals.')
        setLoading(false)
      })
  }, [search, filterState, filterLocation])

  const productOptions = useMemo(() => {
    const seen = new Map()
    serials.forEach((s) => {
      if (s.product_id && !seen.has(s.product_id))
        seen.set(s.product_id, { id: s.product_id, code: s.product_code, name: s.product_name })
    })
    return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code))
  }, [serials])

  const filteredSerials = useMemo(() => {
    if (!filterProduct) return serials
    return serials.filter((s) => String(s.product_id) === String(filterProduct))
  }, [serials, filterProduct])

  useEffect(() => {
    fetchSerials()
  }, [fetchSerials])

  // Reset page when filters change
  useEffect(() => { setCurrentPage(0) }, [search, filterState, filterLocation, filterProduct])

  function handleClear() {
    setSearch('')
    setFilterState('')
    setFilterLocation('')
    setFilterProduct('')
  }

  // Paging
  const totalPages = Math.ceil(filteredSerials.length / pageSize)
  const paged = filteredSerials.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  // Build a warehouse_type lookup from states
  const stateWtMap = {}
  states.forEach((s) => { stateWtMap[s.code] = s.warehouse_type })

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginBottom: 'var(--sp-5)', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search serial number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="e2o-input"
          style={{ width: 'auto', minWidth: 200 }}
        />
        <select className="e2o-select" style={{ width: 'auto' }} value={filterState} onChange={(e) => setFilterState(e.target.value)}>
          <option value="">All States</option>
          {states.map((s) => <option key={s.id} value={s.code}>{s.display_name}</option>)}
        </select>
        <select className="e2o-select" style={{ width: 'auto' }} value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
        </select>
        <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-body-sm)', background: '#fff' }}>
          <option value="">All Products</option>
          {productOptions.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
        <button className="e2o-btn e2o-btn-secondary" onClick={handleClear}>Clear</button>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: 'var(--fg-muted)' }}>Loading…</p>
      ) : error ? (
        <p style={{ color: 'var(--alert)' }}>{error}</p>
      ) : filteredSerials.length === 0 ? (
        <div className="e2o-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--fg-muted)' }}>
          No terminals found.
        </div>
      ) : (
        <div className="e2o-card" style={{ overflow: 'hidden' }}>
          <table className="e2o-table">
            <thead>
              <tr>
                {['Serial Number', 'Product', 'State', 'Latest Location', 'Stock Type', 'Latest Date', 'Cost (€)', 'Actions'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)', color: 'var(--cadet-dark)' }}><a href={`/terminal/${s.id}`} style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: 'var(--fg-muted)' }}>{s.serial_number}</a></td>
                  <td>
                    <span style={{ fontWeight: 'var(--fw-semibold)' }}>{s.product_code}</span>
                    {s.product_name && <span style={{ color: 'var(--fg-3)', marginLeft: 4 }}>{s.product_name}</span>}
                  </td>
                  <td><StateBadge stateName={s.current_state_name} warehouseType={stateWtMap[s.current_state_code]} /></td>
                  <td>
                    {s.latest_location_code
                      ? <><span style={{ fontWeight: 'var(--fw-semibold)' }}>{s.latest_location_code}</span> <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)' }}>{s.latest_location_name}</span></>
                      : '—'}
                  </td>
                  <td>{s.stock_type}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body-sm)', whiteSpace: 'nowrap' }}>
                    {s.latest_date ? s.latest_date.slice(0, 16).replace('T', ' ') : '—'}
                  </td>
                  <td>{(s.accumulated_cost || 0).toFixed(2)}</td>
                  <td>
                    <button
                      className="e2o-btn e2o-btn-primary"
                      onClick={() => navigate(`/terminal/${s.id}`)}
                      style={{ padding: '4px 14px', fontSize: 'var(--fs-body-sm)' }}
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredSerials.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: '1px solid #f3f4f6', fontSize: '0.82rem', color: '#6b7280', flexWrap: 'wrap' }}>
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(0) }}
                style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '2px 6px', fontSize: '0.82rem' }}
              >
                {[50, 100, 150].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span style={{ marginLeft: 'auto' }}>
                {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filteredSerials.length)} of {filteredSerials.length}
              </span>
              <button disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}
                style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: currentPage === 0 ? '#f9fafb' : '#fff', cursor: currentPage === 0 ? 'default' : 'pointer' }}>
                ‹ Prev
              </button>
              <button disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}
                style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: currentPage >= totalPages - 1 ? '#f9fafb' : '#fff', cursor: currentPage >= totalPages - 1 ? 'default' : 'pointer' }}>
                Next ›
              </button>
            </div>
          )}
          <div style={{ padding: '8px 14px', color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)', borderTop: '1px solid var(--border-1)' }}>
            {filteredSerials.length} terminal{filteredSerials.length !== 1 ? 's' : ''} shown
          </div>
        </div>
      )}
    </div>
  )
}
