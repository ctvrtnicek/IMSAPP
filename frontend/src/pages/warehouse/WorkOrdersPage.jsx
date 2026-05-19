import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listWorkOrders } from '../../api/work_orders.js'
import api from '../../api/auth.js'
import { getLocations } from '../../api/masterdata.js'

const STATUS_COLOURS = {
  Open:          { bg: '#dbeafe', color: '#1d4ed8' },
  Acknowledged:  { bg: '#fef9c3', color: '#854d0e' },
  'In Progress': { bg: '#fde68a', color: '#92400e' },
  Complete:      { bg: '#dcfce7', color: '#166534' },
  Cancelled:     { bg: '#f3f4f6', color: '#6b7280' },
}

function StatusBadge({ status }) {
  const c = STATUS_COLOURS[status] || { bg: '#f3f4f6', color: '#374151' }
  return (
    <span className="e2o-pill" style={{ background: c.bg, color: c.color }}>{status}</span>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  return iso.slice(0, 16).replace('T', ' ') + ' UTC'
}

const STATUSES = ['Open', 'Acknowledged', 'In Progress', 'Complete', 'Cancelled']

export default function WorkOrdersPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterOrderType, setFilterOrderType] = useState('')

  // Paging state
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(0)
  const [showRechargeModal, setShowRechargeModal] = useState(false)
  const [locations, setLocations] = useState([])
  const [rechargeLocationId, setRechargeLocationId] = useState('')
  const [rechargeSaving, setRechargeSaving] = useState(false)
  const [rechargeError, setRechargeError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    const params = {}
    if (statusFilter) params.status = statusFilter
    listWorkOrders(params)
      .then((r) => { setRows(r.data); setLoading(false) })
      .catch(() => { setError('Failed to load work orders.'); setLoading(false) })
  }, [statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { getLocations().then((r) => setLocations(r.data)).catch(() => {}) }, [])

  // Reset page when filters change
  useEffect(() => { setCurrentPage(0) }, [statusFilter, filterType, filterOrderType])

  const woTypes = [...new Set(rows.map(r => r.wo_type).filter(Boolean))].sort()
  const orderTypes = [...new Set(rows.map(r => r.outbound_order_type).filter(Boolean))].sort()

  const filtered = rows.filter(r => {
    if (filterType && r.wo_type !== filterType) return false
    if (filterOrderType && r.outbound_order_type !== filterOrderType) return false
    return true
  })
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)' }}>
          Work Orders
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => { setShowRechargeModal(true); setRechargeError(null) }}
            style={{ padding: '0.4rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#fff', background: 'var(--cadet-dark)', border: 'none', cursor: 'pointer' }}
          >
            + Recharge WO
          </button>
          <button className="e2o-btn e2o-btn-secondary" onClick={load} style={{ fontSize: 'var(--fs-body-sm)' }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Recharge WO modal */}
      {showRechargeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.5rem', width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--cadet-dark)', marginBottom: '1rem' }}>Create Recharge Work Order</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Location</label>
              <select
                value={rechargeLocationId}
                onChange={(e) => setRechargeLocationId(e.target.value)}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.4rem 0.7rem', fontSize: '0.85rem' }}
              >
                <option value="">Select location…</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
              </select>
            </div>
            {rechargeError && <p style={{ color: '#dc2626', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{rechargeError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setShowRechargeModal(false)} style={{ padding: '0.35rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#6b7280' }}>Cancel</button>
              <button
                disabled={!rechargeLocationId || rechargeSaving}
                onClick={() => {
                  setRechargeSaving(true); setRechargeError(null)
                  api.post('/work-orders/recharge', { location_id: parseInt(rechargeLocationId) })
                    .then((r) => { setShowRechargeModal(false); setRechargeLocationId(''); load() })
                    .catch((e) => setRechargeError(e.response?.data?.detail || 'Failed to create recharge WO.'))
                    .finally(() => setRechargeSaving(false))
                }}
                style={{ padding: '0.35rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#fff', background: 'var(--cadet-dark)', border: 'none', cursor: (!rechargeLocationId || rechargeSaving) ? 'not-allowed' : 'pointer', opacity: (!rechargeLocationId || rechargeSaving) ? 0.6 : 1 }}
              >
                {rechargeSaving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.35rem 0.7rem', fontSize: '0.85rem', outline: 'none', background: '#fff' }}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.35rem 0.7rem', fontSize: '0.85rem', outline: 'none', background: '#fff' }}
        >
          <option value="">All Types</option>
          {woTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filterOrderType}
          onChange={(e) => setFilterOrderType(e.target.value)}
          style={{ border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.35rem 0.7rem', fontSize: '0.85rem', outline: 'none', background: '#fff' }}
        >
          <option value="">All Order Types</option>
          {orderTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading && <p style={{ color: 'var(--fg-muted)', padding: '1rem 0' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--alert)', padding: '1rem 0' }}>{error}</p>}

      {!loading && !error && (
        <div className="e2o-card" style={{ overflow: 'hidden' }}>
          {rows.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--fg-muted)' }}>
              No work orders found.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="e2o-table">
                <thead>
                  <tr>
                    {['WO Number', 'Outbound Order', 'Type', 'Status', 'Location', 'Lines', 'Created'].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((wo) => (
                    <tr
                      key={wo.id}
                      onClick={() => navigate(`/work-order/${wo.order_number}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-bold)', color: 'var(--cadet-dark)' }}>
                        {wo.order_number}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--cadet-dark)' }}>
                        {wo.outbound_order_number}
                      </td>
                      <td>{wo.wo_type}</td>
                      <td><StatusBadge status={wo.status} /></td>
                      <td>
                        {wo.location_code
                          ? <><strong>{wo.location_code}</strong> <span style={{ color: 'var(--fg-3)' }}>{wo.location_name}</span></>
                          : <span style={{ color: 'var(--fg-muted)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>{wo.lines?.length ?? '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)' }}>
                        {fmtDate(wo.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 0 && (
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
                    {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filtered.length)} of {filtered.length}
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}
