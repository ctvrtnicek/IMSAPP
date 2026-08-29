import { useState, useEffect } from 'react'
import { getAllocation, reallocate } from '../../api/atp.js'
import Modal from '../../components/Modal.jsx'

const ATP_STATUS_STYLE = {
  ATP_OK:      { bg: '#dcfce7', color: '#166534' },
  ATP_PARTIAL: { bg: '#fef9c3', color: '#854d0e' },
  ATP_NONE:    { bg: '#fee2e2', color: '#991b1b' },
}

function AtpBadge({ status }) {
  const label = status || '—'
  const s = ATP_STATUS_STYLE[status] || { bg: '#f3f4f6', color: '#374151' }
  return <span className="e2o-pill" style={{ background: s.bg, color: s.color }}>{label.replace('ATP_', '')}</span>
}

const DATE_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Next 7 days', value: '7' },
  { label: 'Next 10 days', value: '10' },
  { label: 'Next 30 days', value: '30' },
]

export default function AllocationPage({ role }) {
  const [data, setData] = useState({ allocated: [], non_allocated: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [filterProduct, setFilterProduct] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterDate, setFilterDate] = useState('')

  // Reallocation modal
  const [showRealloc, setShowRealloc] = useState(false)
  const [reallocOrder, setReallocOrder] = useState(null)
  const [donors, setDonors] = useState([])
  const [selectedDonor, setSelectedDonor] = useState('')
  const [reallocSaving, setReallocSaving] = useState(false)
  const [reallocError, setReallocError] = useState(null)
  const [reallocSuccess, setReallocSuccess] = useState(null)

  const [expanded, setExpanded] = useState({})

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await getAllocation()
      setData({
        allocated: Array.isArray(res.data?.allocated) ? res.data.allocated : [],
        non_allocated: Array.isArray(res.data?.non_allocated) ? res.data.non_allocated : [],
      })
    } catch {
      setError('Failed to load allocation data')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function toggleExpand(orderId) {
    setExpanded(prev => ({ ...prev, [orderId]: !prev[orderId] }))
  }

  // Derive filter options from all orders
  const allOrders = [...data.allocated, ...data.non_allocated]
  const productOptions = [...new Set(allOrders.flatMap(o => o.lines?.map(l => l.product_code) || []).filter(Boolean))].sort()
  const typeOptions = [...new Set(allOrders.map(o => o.order_type).filter(Boolean))].sort()
  const customerOptions = [...new Set(allOrders.map(o => o.customer_name).filter(Boolean))].sort()

  function applyFilters(orders) {
    return orders.filter(o => {
      if (filterType && o.order_type !== filterType) return false
      if (filterCustomer && o.customer_name !== filterCustomer) return false
      if (filterProduct && !o.lines?.some(l => l.product_code === filterProduct)) return false
      if (filterDate) {
        const days = Number(filterDate)
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() + days)
        const edd = o.atp_delivery_date || o.lines?.[0]?.edd
        if (!edd) return true
        return new Date(edd) <= cutoff
      }
      return true
    })
  }

  const filteredAllocated = applyFilters(data.allocated)
  const filteredNonAllocated = applyFilters(data.non_allocated)

  function openReallocModal(order) {
    setReallocOrder(order)
    setReallocError(null)
    setReallocSuccess(null)
    setSelectedDonor('')
    const donorCandidates = data.allocated.filter(a =>
      a.id !== order.id &&
      !['Shipped', 'Delivered', 'Cancelled', 'Closed'].includes(a.status) &&
      (a.segment_priority ?? 999) > (order.segment_priority ?? 0)
    )
    setDonors(donorCandidates)
    setShowRealloc(true)
  }

  async function handleReallocate() {
    if (!selectedDonor) { setReallocError('Select a donor order'); return }
    setReallocSaving(true); setReallocError(null)
    try {
      const firstLine = reallocOrder.lines?.[0]
      await reallocate({
        target_order_id: reallocOrder.id,
        donor_order_id: Number(selectedDonor),
        product_id: firstLine?.product_id || 0,
        quantity: firstLine?.quantity || 1,
      })
      setReallocSuccess('Reallocation completed successfully.')
      await load()
    } catch (err) {
      setReallocError(err.response?.data?.detail || 'Reallocation failed')
    } finally { setReallocSaving(false) }
  }

  const canRealloc = ['admin', 'supply_planner'].includes(role)

  function renderOrderTable(orders, title, isAllocatedTable) {
    const showReallocBtn = !isAllocatedTable
    const colCount = isAllocatedTable ? 12 : (canRealloc ? 11 : 10)
    return (
      <div>
        <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', margin: '0 0 12px' }}>
          {title} <span style={{ color: 'var(--fg-muted)', fontWeight: 'var(--fw-normal)', fontSize: 'var(--fs-body-sm)' }}>({orders.length})</span>
        </h3>
        <div className="e2o-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="e2o-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th>Order #</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Product</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th>Segment</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Pegged</th>
                {isAllocatedTable && <th>Fulfilling Loc</th>}
                {isAllocatedTable && <th>EDD</th>}
                <th>Created</th>
                {showReallocBtn && canRealloc && <th></th>}
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={colCount} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>No orders.</td></tr>
              ) : orders.map(o => {
                const firstLine = o.lines?.[0]
                const productCodes = [...new Set(o.lines?.map(l => l.product_code).filter(Boolean) || [])].join(', ')
                const totalQty = o.lines?.reduce((sum, l) => sum + (l.quantity || 0), 0) || 0
                const fulfillLocs = [...new Set(o.lines?.map(l => l.fulfilling_location_code).filter(Boolean) || [])]
                const edd = o.atp_delivery_date || firstLine?.edd
                const isReallocated = !!o.allocation_source_order_id

                return (
                  <>
                    <tr key={o.id}>
                      <td>
                        <button onClick={() => toggleExpand(o.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--fg-3)' }}>
                          {expanded[o.id] ? '▾' : '▸'}
                        </button>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)', color: 'var(--cadet-dark)' }}>
                        {o.order_number}
                        {isReallocated && <span className="e2o-pill" style={{ background: '#e0f2fe', color: '#0369a1', marginLeft: 6, fontSize: 9 }}>Reallocated</span>}
                      </td>
                      <td>{o.order_type || '—'}</td>
                      <td style={{ color: 'var(--fg-2)' }}>{o.customer_name || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-body-sm)' }}>{productCodes || '—'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{totalQty}</td>
                      <td>
                        {o.segment_name
                          ? <span className="e2o-pill" style={{ background: '#ede9fe', color: '#5b21b6' }}>{o.segment_name}</span>
                          : <span style={{ color: 'var(--fg-muted)' }}>—</span>
                        }
                      </td>
                      <td><AtpBadge status={o.lines?.[0]?.atp_status || (o.pegged_count > 0 ? 'ATP_OK' : null)} /></td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)' }}>{o.pegged_count ?? 0}</td>
                      {isAllocatedTable && (
                        <td style={{ fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--cadet-dark)' }}>
                          {fulfillLocs.length > 0 ? fulfillLocs.join(', ') : '—'}
                        </td>
                      )}
                      {isAllocatedTable && (
                        <td style={{ fontSize: 'var(--fs-body-sm)' }}>{edd || '—'}</td>
                      )}
                      <td style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)' }}>{o.created_at?.slice(0, 10) || '—'}</td>
                      {showReallocBtn && canRealloc && (
                        <td>
                          <button
                            onClick={() => openReallocModal(o)}
                            className="px-3 py-1 rounded-lg text-xs font-semibold transition"
                            style={{ backgroundColor: '#fff', border: '1px solid var(--cadet-dark)', color: 'var(--cadet-dark)' }}
                          >Reallocate From...</button>
                        </td>
                      )}
                    </tr>
                    {expanded[o.id] && o.lines && o.lines.map((line, idx) => (
                      <tr key={`${o.id}-line-${idx}`} style={{ background: 'var(--bg-2)' }}>
                        <td></td>
                        <td colSpan={colCount - 1} style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)', paddingLeft: 24 }}>
                          Line {idx + 1}: <strong>{line.product_code}</strong> {line.product_name} — qty {line.quantity}
                          {line.fulfilling_location_code && (
                            <span style={{ marginLeft: 8, color: 'var(--cadet-dark)', fontWeight: 'var(--fw-semibold)' }}>
                              @ {line.fulfilling_location_code}
                            </span>
                          )}
                          {line.edd && (
                            <span style={{ marginLeft: 8, color: 'var(--fg-2)' }}>EDD: {line.edd}</span>
                          )}
                          {line.atp_split_details && line.atp_split_details.length > 1 && (
                            <span style={{ marginLeft: 8, color: '#6b7280' }}>
                              (Split: {line.atp_split_details.map(s => `${s.location_code} ×${s.qty}`).join(', ')})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (loading) return <div style={{ color: 'var(--fg-muted)', padding: '2rem' }}>Loading allocation data...</div>
  if (error) return <div style={{ color: 'var(--alert)', padding: '2rem' }}>{error}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Summary cards + Refresh */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="e2o-card" style={{ padding: '0.875rem 1.25rem', minWidth: 120, background: '#dcfce7', border: 'none' }}>
          <div style={{ fontSize: 'var(--fs-label)', color: '#166534', marginBottom: 2 }}>Allocated</div>
          <div style={{ fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-bold)', color: '#166534' }}>{filteredAllocated.length}</div>
        </div>
        <div className="e2o-card" style={{ padding: '0.875rem 1.25rem', minWidth: 120, background: '#fee2e2', border: 'none' }}>
          <div style={{ fontSize: 'var(--fs-label)', color: '#991b1b', marginBottom: 2 }}>Non-Allocated</div>
          <div style={{ fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-bold)', color: '#991b1b' }}>{filteredNonAllocated.length}</div>
        </div>
        <button onClick={load} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
          style={{ backgroundColor: 'var(--cadet-dark)' }}>Refresh</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--fg-3)', marginBottom: 3 }}>Product</label>
          <select className="e2o-select" style={{ minWidth: 140 }} value={filterProduct} onChange={e => setFilterProduct(e.target.value)}>
            <option value="">All Products</option>
            {productOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--fg-3)', marginBottom: 3 }}>Order Type</label>
          <select className="e2o-select" style={{ minWidth: 120 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--fg-3)', marginBottom: 3 }}>Customer</label>
          <select className="e2o-select" style={{ minWidth: 160 }} value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)}>
            <option value="">All Customers</option>
            {customerOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--fg-3)', marginBottom: 3 }}>EDD Window</label>
          <select className="e2o-select" style={{ minWidth: 130 }} value={filterDate} onChange={e => setFilterDate(e.target.value)}>
            {DATE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        {(filterProduct || filterType || filterCustomer || filterDate) && (
          <button onClick={() => { setFilterProduct(''); setFilterType(''); setFilterCustomer(''); setFilterDate('') }}
            className="e2o-btn e2o-btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }}>Clear Filters</button>
        )}
      </div>

      {renderOrderTable(filteredAllocated, 'Allocated Orders', true)}
      {renderOrderTable(filteredNonAllocated, 'Non-Allocated Orders', false)}

      {/* Reallocation Modal */}
      {showRealloc && reallocOrder && (
        <Modal title="Reallocate Inventory" onClose={() => setShowRealloc(false)}>
          {reallocSuccess ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 8, padding: '1rem', color: '#166534', fontSize: 'var(--fs-body-sm)' }}>
                {reallocSuccess}
              </div>
              <div className="flex justify-end">
                <button onClick={() => setShowRealloc(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition" style={{ backgroundColor: 'var(--cadet-dark)' }}>Done</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div style={{ background: '#f8fafc', border: '1px solid var(--border-1)', borderRadius: 8, padding: '0.875rem 1rem', fontSize: 'var(--fs-body-sm)' }}>
                Reallocating inventory <strong>to</strong> order <strong style={{ fontFamily: 'var(--font-mono)' }}>{reallocOrder.order_number}</strong>
                {reallocOrder.customer_name && <> ({reallocOrder.customer_name})</>}
                {reallocOrder.lines?.[0] && <> — {reallocOrder.lines[0].product_code} qty {reallocOrder.lines[0].quantity}</>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">DONOR ORDER *</label>
                {donors.length === 0 ? (
                  <p style={{ color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)' }}>No eligible donor orders found (must have lower segment priority and not be shipped).</p>
                ) : (
                  <select value={selectedDonor} onChange={e => setSelectedDonor(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Select donor order...</option>
                    {donors.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.order_number} — {d.customer_name || 'N/A'} ({d.segment_name || 'No segment'}, Pegged: {d.pegged_count ?? 0})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {reallocError && <p className="text-red-600 text-sm">{reallocError}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setShowRealloc(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 transition">Cancel</button>
                <button onClick={handleReallocate} disabled={reallocSaving || !selectedDonor}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                  style={{ backgroundColor: 'var(--cadet-dark)', opacity: reallocSaving || !selectedDonor ? 0.6 : 1 }}>
                  {reallocSaving ? 'Reallocating...' : 'Confirm Reallocation'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
