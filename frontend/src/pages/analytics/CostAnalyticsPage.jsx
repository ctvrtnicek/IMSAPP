import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import api from '../../api/auth.js'

const CADET = 'var(--cadet-dark)'
const AMBER = '#f59e0b'
const RED   = '#ef4444'
const SAGE  = 'var(--sage-medium)'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(val) {
  if (val == null) return '—'
  return `€ ${parseFloat(val).toFixed(2)}`
}

function exportCsv(rows, filename) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

// ── Shared UI ──────────────────────────────────────────────────────────────

function FilterRow({ children }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
      {children}
    </div>
  )
}

function ExportBtn({ onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="e2o-btn e2o-btn-secondary"
      style={{ marginLeft: 'auto', opacity: disabled ? 0.5 : 1 }}
    >
      ↓ Export CSV
    </button>
  )
}

function CostBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border-1)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill || CADET }}>
          {p.name}: <strong>{fmt(p.value)}</strong>
        </p>
      ))}
    </div>
  )
}

// ============================================================================
// Tab 1: Cost per Serial
// ============================================================================

function CostPerSerial({ locations, products }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterProduct, setFilterProduct] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [costMin, setCostMin] = useState('')
  const [costMax, setCostMax] = useState('')

  const fetch = useCallback(() => {
    setLoading(true)
    const params = {}
    if (search) params.search = search
    if (filterProduct) params.product_code = filterProduct
    if (filterLocation) params.location_id = filterLocation
    if (costMin !== '') params.cost_min = costMin
    if (costMax !== '') params.cost_max = costMax
    api.get('/analytics/cost-by-serial', { params })
      .then((r) => setRows(r.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [search, filterProduct, filterLocation, costMin, costMax])

  useEffect(() => { fetch() }, [fetch])

  const totalCost = rows.reduce((s, r) => s + (r.accumulated_cost || 0), 0)

  return (
    <div>
      <FilterRow>
        <input className="e2o-input" style={{ width: 200 }} placeholder="Search serial…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="e2o-select" style={{ width: 'auto' }} value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
          <option value="">All Products</option>
          {products.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
        </select>
        <select className="e2o-select" style={{ width: 'auto' }} value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
        </select>
        <input className="e2o-input" style={{ width: 110 }} type="number" placeholder="Min €" value={costMin} onChange={(e) => setCostMin(e.target.value)} />
        <input className="e2o-input" style={{ width: 110 }} type="number" placeholder="Max €" value={costMax} onChange={(e) => setCostMax(e.target.value)} />
        <button className="e2o-btn e2o-btn-secondary" onClick={() => { setSearch(''); setFilterProduct(''); setFilterLocation(''); setCostMin(''); setCostMax('') }}>Clear</button>
        <ExportBtn onClick={() => exportCsv(rows, 'cost-by-serial.csv')} disabled={!rows.length} />
      </FilterRow>

      {loading ? (
        <p style={{ color: 'var(--fg-muted)' }}>Loading…</p>
      ) : (
        <div className="e2o-card" style={{ overflow: 'hidden' }}>
          <table className="e2o-table">
            <thead>
              <tr>
                {['Serial Number', 'Product', 'State', 'Location', 'Stock Type', 'Accumulated Cost (€)'].map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--fg-muted)', padding: 32 }}>No results.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/terminal/${r.id}`)}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)', color: 'var(--cadet-dark)' }}>{r.serial_number}</td>
                  <td>
                    <span style={{ fontWeight: 'var(--fw-semibold)' }}>{r.product_code}</span>
                    {r.product_name && <span style={{ color: 'var(--fg-3)', marginLeft: 6, fontSize: 'var(--fs-body-sm)' }}>{r.product_name}</span>}
                  </td>
                  <td>{r.state_name || '—'}</td>
                  <td>{r.location_code ? <>{r.location_code} <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)' }}>{r.location_name}</span></> : '—'}</td>
                  <td>{r.stock_type}</td>
                  <td style={{ textAlign: 'right', fontWeight: r.accumulated_cost > 0 ? 'var(--fw-semibold)' : undefined, color: r.accumulated_cost > 0 ? '#166534' : 'var(--fg-muted)' }}>
                    {fmt(r.accumulated_cost)}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border-1)', background: 'var(--bg-2)' }}>
                  <td colSpan={5} style={{ padding: '10px 14px', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)' }}>
                    Total — {rows.length} terminal{rows.length !== 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 'var(--fw-bold)', color: '#166534', textAlign: 'right' }}>
                    {fmt(totalCost)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Tab 2: Cost by Location
// ============================================================================

function CostByLocation({ locations, states }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterState, setFilterState] = useState('')

  const fetch = useCallback(() => {
    setLoading(true)
    const params = {}
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (filterLocation) params.location_id = filterLocation
    if (filterState) params.state_code = filterState
    api.get('/analytics/cost-by-location', { params })
      .then((r) => setRows(r.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo, filterLocation, filterState])

  useEffect(() => { fetch() }, [fetch])

  const chartData = rows.slice(0, 15).map((r) => ({
    name: r.location_code,
    fullName: r.location_name,
    cost: r.total_cost,
    fill: CADET,
  }))

  const totalCost = rows.reduce((s, r) => s + r.total_cost, 0)

  return (
    <div>
      <FilterRow>
        <input className="e2o-input" type="date" style={{ width: 160 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date" />
        <input className="e2o-input" type="date" style={{ width: 160 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To date" />
        <select className="e2o-select" style={{ width: 'auto' }} value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
        </select>
        <select className="e2o-select" style={{ width: 'auto' }} value={filterState} onChange={(e) => setFilterState(e.target.value)}>
          <option value="">All States</option>
          {states.map((s) => <option key={s.code} value={s.code}>{s.display_name}</option>)}
        </select>
        <button className="e2o-btn e2o-btn-secondary" onClick={() => { setDateFrom(''); setDateTo(''); setFilterLocation(''); setFilterState('') }}>Clear</button>
        <ExportBtn onClick={() => exportCsv(rows, 'cost-by-location.csv')} disabled={!rows.length} />
      </FilterRow>

      {loading ? <p style={{ color: 'var(--fg-muted)' }}>Loading…</p> : (
        <>
          {chartData.length > 0 && (
            <div className="e2o-card" style={{ padding: '1.25rem', marginBottom: 20 }}>
              <p style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)', marginBottom: 12 }}>Cost by Location (top 15)</p>
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-1)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip content={<CostBarTooltip />} />
                  <Bar dataKey="cost" name="Total Cost (€)" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="e2o-card" style={{ overflow: 'hidden' }}>
            <table className="e2o-table">
              <thead>
                <tr>{['Location', 'Transitions', 'Total Cost (€)'].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--fg-muted)', padding: 32 }}>No cost data found.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.location_id}>
                    <td><span style={{ fontWeight: 'var(--fw-semibold)' }}>{r.location_code}</span> <span style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-body-sm)' }}>{r.location_name}</span></td>
                    <td style={{ color: 'var(--fg-3)' }}>{r.transitions}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'var(--fw-semibold)', color: '#166534' }}>{fmt(r.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border-1)', background: 'var(--bg-2)' }}>
                    <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 'var(--fw-bold)' }}>Total</td>
                    <td style={{ padding: '10px 14px', fontWeight: 'var(--fw-bold)', color: '#166534', textAlign: 'right' }}>{fmt(totalCost)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================================
// Tab 3: Cost by Product
// ============================================================================

function CostByProduct({ locations, products }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterProduct, setFilterProduct] = useState('')
  const [filterLocation, setFilterLocation] = useState('')

  const fetch = useCallback(() => {
    setLoading(true)
    const params = {}
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (filterProduct) params.product_code = filterProduct
    if (filterLocation) params.location_id = filterLocation
    api.get('/analytics/cost-by-product', { params })
      .then((r) => setRows(r.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo, filterProduct, filterLocation])

  useEffect(() => { fetch() }, [fetch])

  const chartData = rows.slice(0, 15).map((r) => ({
    name: r.product_code,
    fullName: r.product_name,
    total: r.total_cost,
    avg: r.avg_cost,
    fill: SAGE,
  }))

  const totalCost = rows.reduce((s, r) => s + r.total_cost, 0)
  const totalSerials = rows.reduce((s, r) => s + r.serial_count, 0)

  return (
    <div>
      <FilterRow>
        <input className="e2o-input" type="date" style={{ width: 160 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input className="e2o-input" type="date" style={{ width: 160 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <select className="e2o-select" style={{ width: 'auto' }} value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
          <option value="">All Products</option>
          {products.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
        </select>
        <select className="e2o-select" style={{ width: 'auto' }} value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
        </select>
        <button className="e2o-btn e2o-btn-secondary" onClick={() => { setDateFrom(''); setDateTo(''); setFilterProduct(''); setFilterLocation('') }}>Clear</button>
        <ExportBtn onClick={() => exportCsv(rows, 'cost-by-product.csv')} disabled={!rows.length} />
      </FilterRow>

      {loading ? <p style={{ color: 'var(--fg-muted)' }}>Loading…</p> : (
        <>
          {chartData.length > 0 && (
            <div className="e2o-card" style={{ padding: '1.25rem', marginBottom: 20 }}>
              <p style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)', marginBottom: 12 }}>Total Cost by Product (top 15)</p>
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-1)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip content={<CostBarTooltip />} />
                  <Bar dataKey="total" name="Total Cost (€)" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="e2o-card" style={{ overflow: 'hidden' }}>
            <table className="e2o-table">
              <thead>
                <tr>{['Product', 'Active Serials', 'Avg Cost / Serial (€)', 'Total Cost (€)'].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--fg-muted)', padding: 32 }}>No cost data found.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.product_code}>
                    <td><span style={{ fontWeight: 'var(--fw-semibold)' }}>{r.product_code}</span> <span style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-body-sm)' }}>{r.product_name}</span></td>
                    <td style={{ color: 'var(--fg-3)' }}>{r.serial_count}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(r.avg_cost)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'var(--fw-semibold)', color: '#166534' }}>{fmt(r.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border-1)', background: 'var(--bg-2)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 'var(--fw-bold)' }}>Total</td>
                    <td style={{ padding: '10px 14px', color: 'var(--fg-3)' }}>{totalSerials}</td>
                    <td></td>
                    <td style={{ padding: '10px 14px', fontWeight: 'var(--fw-bold)', color: '#166534', textAlign: 'right' }}>{fmt(totalCost)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================================
// Tab 4: Repair Cost Analysis
// ============================================================================

function RepairCostAnalysis({ locations, products }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterProduct, setFilterProduct] = useState('')

  const fetch = useCallback(() => {
    setLoading(true)
    const params = {}
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (filterLocation) params.location_id = filterLocation
    if (filterProduct) params.product_code = filterProduct
    api.get('/analytics/repair-cost-analysis', { params })
      .then((r) => setRows(r.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo, filterLocation, filterProduct])

  useEffect(() => { fetch() }, [fetch])

  return (
    <div>
      <FilterRow>
        <input className="e2o-input" type="date" style={{ width: 160 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input className="e2o-input" type="date" style={{ width: 160 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <select className="e2o-select" style={{ width: 'auto' }} value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)}>
          <option value="">All Repair Centres</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
        </select>
        <select className="e2o-select" style={{ width: 'auto' }} value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
          <option value="">All Products</option>
          {products.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
        </select>
        <button className="e2o-btn e2o-btn-secondary" onClick={() => { setDateFrom(''); setDateTo(''); setFilterLocation(''); setFilterProduct('') }}>Clear</button>
        <ExportBtn onClick={() => exportCsv(rows, 'repair-cost-analysis.csv')} disabled={!rows.length} />
      </FilterRow>

      {loading ? <p style={{ color: 'var(--fg-muted)' }}>Loading…</p> : (
        <div className="e2o-card" style={{ overflow: 'hidden' }}>
          <table className="e2o-table">
            <thead>
              <tr>{['Repair Centre', 'Product', '# Repairs', 'Avg Actual Cost (€)', 'Total Actual Cost (€)'].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--fg-muted)', padding: 32 }}>
                  No completed repairs with actual cost recorded yet.
                </td></tr>
              ) : rows.map((r, i) => (
                <tr key={i}>
                  <td><span style={{ fontWeight: 'var(--fw-semibold)' }}>{r.repair_centre_code}</span> <span style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-body-sm)' }}>{r.repair_centre_name}</span></td>
                  <td><span style={{ fontWeight: 'var(--fw-semibold)' }}>{r.product_code}</span> <span style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-body-sm)' }}>{r.product_name}</span></td>
                  <td style={{ color: 'var(--fg-3)' }}>{r.repair_count}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(r.avg_actual_cost)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'var(--fw-semibold)', color: '#166534' }}>{fmt(r.total_actual_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main export
// ============================================================================

const COST_TABS = [
  { id: 'per-serial',   label: 'Per Serial' },
  { id: 'by-location',  label: 'By Location' },
  { id: 'by-product',   label: 'By Product' },
  { id: 'repair',       label: 'Repair Analysis' },
]

export default function CostAnalyticsPage() {
  const [activeTab, setActiveTab] = useState('per-serial')
  const [locations, setLocations] = useState([])
  const [products, setProducts] = useState([])
  const [states, setStates] = useState([])

  useEffect(() => {
    api.get('/locations').then((r) => setLocations(r.data.filter((l) => l.active !== 0))).catch(() => {})
    api.get('/products').then((r) => setProducts(r.data.filter((p) => p.active !== 0))).catch(() => {})
    api.get('/terminal-states').then((r) => setStates(r.data)).catch(() => {})
  }, [])

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-1)', marginBottom: 24 }}>
        {COST_TABS.map((t) => (
          <button
            key={t.id}
            className={`e2o-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'per-serial'  && <CostPerSerial   locations={locations} products={products} />}
      {activeTab === 'by-location' && <CostByLocation  locations={locations} states={states} />}
      {activeTab === 'by-product'  && <CostByProduct   locations={locations} products={products} />}
      {activeTab === 'repair'      && <RepairCostAnalysis locations={locations} products={products} />}
    </div>
  )
}
