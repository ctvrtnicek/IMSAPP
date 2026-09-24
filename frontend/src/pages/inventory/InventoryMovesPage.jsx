import { Fragment, useEffect, useState } from 'react'
import { getInventoryMoves, getInventoryMovesFilters } from '../../api/inventory.js'

// Inventory Moves — month-end report of terminals that changed jurisdiction or left /
// re-entered the company's books: cross-border moves between company locations, moves to
// customers / partners / repair centres, and returns. Per route and product: quantity,
// standard value (product master, EUR) and accumulated cost (EUR). The quantity opens
// the serials behind it. Logic: backend/inventory_moves.py.

const inputStyle = {
  border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.35rem 0.7rem',
  fontSize: '0.85rem', outline: 'none', background: '#fff',
}

const GROUP_LABELS = {
  ALL_CUSTOMERS: '‹all customers›', ALL_PARTNERS: '‹all partners›', ALL_REPAIRS: '‹all repair centres›',
}
const label = (v) => GROUP_LABELS[v] || v
const eur = (v) => `€ ${(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function monthLabel(p) {
  const [y, m] = p.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function downloadCSV(report) {
  const headers = ['Period', 'Category', 'From', 'To', 'Product', 'Serial', 'Move date', 'Departure', 'Arrival',
    'Order', 'Standard value (EUR)', 'Accumulated cost (EUR)']
  const lines = []
  for (const r of report.rows) {
    for (const s of r.serials) {
      lines.push([report.period, r.category_label, label(r.from), label(r.to), r.product_code, s.serial_number,
        s.date, s.departure || '', s.arrival, s.order_reference || '', s.standard_value_eur.toFixed(2),
        s.accumulated_cost_eur.toFixed(2)])
    }
  }
  const csv = [headers, ...lines].map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url; a.download = `inventory-moves-${report.period}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function InventoryMovesPage() {
  const [filters, setFilters] = useState({ periods: [], from: [], to: [] })
  const [period, setPeriod] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    getInventoryMovesFilters()
      .then((r) => {
        setFilters(r.data)
        if (r.data.periods.length) setPeriod(r.data.periods[0])
      })
      .catch(() => setError('Failed to load report filters'))
  }, [])

  useEffect(() => {
    if (!period) return
    setLoading(true); setError(null); setExpanded(null)
    getInventoryMoves({ period, ...(from ? { from } : {}), ...(to ? { to } : {}) })
      .then((r) => setReport(r.data))
      .catch((e) => setError(e.response?.data?.detail || 'Failed to load inventory moves'))
      .finally(() => setLoading(false))
  }, [period, from, to])

  const basis = report?.date_basis || {}

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} style={inputStyle} aria-label="Period">
          {filters.periods.length === 0 && <option value="">No moves recorded</option>}
          {filters.periods.map((p) => <option key={p} value={p}>{monthLabel(p)}</option>)}
        </select>
        <select value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} aria-label="From">
          <option value="">From: all</option>
          {filters.from.map((f) => <option key={f} value={f}>From: {label(f)}</option>)}
        </select>
        <select value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} aria-label="To">
          <option value="">To: all</option>
          {filters.to.map((t) => <option key={t} value={t}>To: {label(t)}</option>)}
        </select>
        {report?.rows.length > 0 && (
          <button type="button" onClick={() => downloadCSV(report)}
            style={{ ...inputStyle, cursor: 'pointer', marginLeft: 'auto' }}>
            ⬇ Export CSV (per serial)
          </button>
        )}
      </div>

      <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 12 }}>
        Move dates — sales: {basis.MOVES_DATE_BASIS_SALES || 'arrival'}, distribution: {basis.MOVES_DATE_BASIS_DISTRIBUTION || 'arrival'},
        repair: {basis.MOVES_DATE_BASIS_REPAIR || 'arrival'}, returns: arrival (set in Admin → System Config).
        Cross-border counts moves between company locations in different countries only.
      </p>

      {error && <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{error}</p>}
      {loading && <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Loading…</p>}

      {report && !loading && (
        report.rows.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No moves in {monthLabel(report.period)} for this selection.</p>
        ) : (
          <div className="e2o-card" style={{ overflowX: 'auto' }}>
            <table className="e2o-table">
              <thead>
                <tr>
                  <th>From</th><th>To</th><th>Product</th>
                  <th style={{ textAlign: 'right' }}>Quantity</th>
                  <th style={{ textAlign: 'right' }}>Standard value (EUR)</th>
                  <th style={{ textAlign: 'right' }}>Accumulated cost (EUR)</th>
                </tr>
              </thead>
              <tbody>
                {report.category_totals.map((cat) => (
                  <Fragment key={cat.category}>
                    <tr style={{ background: '#f8fafc' }}>
                      <td colSpan={3} style={{ fontWeight: 700 }}>{cat.category_label}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{cat.quantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{eur(cat.standard_value_eur)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{eur(cat.accumulated_cost_eur)}</td>
                    </tr>
                    {report.rows.filter((r) => r.category === cat.category).map((r) => {
                      const key = `${r.category}|${r.from}|${r.to}|${r.product_code}`
                      const open = expanded === key
                      return (
                        <Fragment key={key}>
                          <tr>
                            <td>{label(r.from)}</td>
                            <td>{label(r.to)}</td>
                            <td><strong>{r.product_code}</strong> <span style={{ color: '#6b7280' }}>{r.product_name}</span></td>
                            <td style={{ textAlign: 'right' }}>
                              <button type="button" onClick={() => setExpanded(open ? null : key)}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--cadet-dark)', textDecoration: 'underline', fontWeight: 600 }}>
                                {r.quantity}
                              </button>
                            </td>
                            <td style={{ textAlign: 'right' }}>{eur(r.standard_value_eur)}</td>
                            <td style={{ textAlign: 'right' }}>{eur(r.accumulated_cost_eur)}</td>
                          </tr>
                          {open && (
                            <tr>
                              <td colSpan={6} style={{ background: '#fcfcfd', padding: '0.5rem 1rem' }}>
                                <table className="e2o-table" style={{ fontSize: '0.8rem' }}>
                                  <thead>
                                    <tr><th>Serial</th><th>Move date</th><th>Departure</th><th>Arrival</th><th>Order</th>
                                      <th style={{ textAlign: 'right' }}>Standard value</th><th style={{ textAlign: 'right' }}>Accumulated cost</th></tr>
                                  </thead>
                                  <tbody>
                                    {r.serials.map((s) => (
                                      <tr key={`${s.serial_id}-${s.arrival}`}>
                                        <td><a href={`/terminal/${s.serial_id}`} style={{ fontFamily: 'var(--font-mono)', textDecoration: 'underline' }}>{s.serial_number}</a></td>
                                        <td>{s.date}</td><td>{s.departure || '—'}</td><td>{s.arrival}</td>
                                        <td>{s.order_reference || '—'}</td>
                                        <td style={{ textAlign: 'right' }}>{eur(s.standard_value_eur)}</td>
                                        <td style={{ textAlign: 'right' }}>{eur(s.accumulated_cost_eur)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
