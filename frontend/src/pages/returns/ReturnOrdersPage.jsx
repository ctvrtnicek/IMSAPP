import { useState, useEffect } from 'react'
import Modal from '../../components/Modal.jsx'
import {
  getReturnOrders,
  getReturnOrder,
  createReturnOrder,
  updateReturnOrder,
  receiveReturnOrder,
  createRepairOrder,
} from '../../api/returns.js'
import { getCustomers, getLocations } from '../../api/masterdata.js'
import { getOutboundOrders, getOutboundOrder } from '../../api/outbound_orders.js'

// ── Status badge colours ──────────────────────────────────────────────────────
const RETURN_STATUS_STYLES = {
  Initiated:  { backgroundColor: '#2563eb', color: '#fff' },
  'In Transit': { backgroundColor: '#ca8a04', color: '#fff' },
  Received:   { backgroundColor: '#16a34a', color: '#fff' },
  Inspected:  { backgroundColor: '#7c3aed', color: '#fff' },
  Closed:     { backgroundColor: '#6b7280', color: '#fff' },
}

const OUTCOME_STYLES = {
  Defective: { backgroundColor: '#ea580c', color: '#fff' },
  Scrap:     { backgroundColor: '#dc2626', color: '#fff' },
}

const STATUS_OPTIONS = ['All', 'Initiated', 'In Transit', 'Received', 'Inspected', 'Closed']
const REASON_OPTIONS = ['Defective', 'End of Rental', 'End of Lifecycle', 'Wrong Item', 'Other']

function StatusBadge({ status }) {
  const style = RETURN_STATUS_STYLES[status] || { backgroundColor: '#6b7280', color: '#fff' }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={style}>
      {status}
    </span>
  )
}

function OutcomeBadge({ outcome }) {
  if (!outcome) return <span className="text-gray-400 text-xs">—</span>
  const style = OUTCOME_STYLES[outcome] || { backgroundColor: '#6b7280', color: '#fff' }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={style}>
      {outcome}
    </span>
  )
}

// ===========================================================================
// ReturnDetailPanel — inline detail view
// ===========================================================================
export function ReturnDetailPanel({ returnId, onBack, role, onCreateRepair }) {
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Inspection outcome state
  const [showOutcomePanel, setShowOutcomePanel] = useState(false)
  const [selectedOutcome, setSelectedOutcome] = useState('Defective')
  const [outcomeSubmitting, setOutcomeSubmitting] = useState(false)

  // Create Repair Order modal
  const [showRepairModal, setShowRepairModal] = useState(false)
  const [locations, setLocations] = useState([])
  const [repairForm, setRepairForm] = useState({
    repair_centre_location_id: '',
    dispatch_date: new Date().toISOString().slice(0, 10),
    estimated_return_date: '',
    return_location_id: '',
  })
  const [repairSubmitting, setRepairSubmitting] = useState(false)
  const [repairError, setRepairError] = useState(null)

  useEffect(() => {
    loadOrder()
  }, [returnId])

  async function loadOrder() {
    setLoading(true)
    setError(null)
    try {
      const res = await getReturnOrder(returnId)
      setOrder(res.data)
    } catch {
      setError('Failed to load return order')
    } finally {
      setLoading(false)
    }
  }

  // ── Mark Received ──────────────────────────────────────────────────────────
  async function handleReceive() {
    setActionError(null)
    setActionLoading(true)
    try {
      const res = await receiveReturnOrder(returnId)
      setOrder(res.data)
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to mark as received')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Set Inspection Outcome ─────────────────────────────────────────────────
  async function handleSetOutcome() {
    setOutcomeSubmitting(true)
    setActionError(null)
    try {
      const res = await updateReturnOrder(returnId, { inspection_outcome: selectedOutcome })
      setOrder(res.data)
      setShowOutcomePanel(false)
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to set inspection outcome')
    } finally {
      setOutcomeSubmitting(false)
    }
  }

  // ── Create Repair Order ────────────────────────────────────────────────────
  async function openRepairModal() {
    setRepairError(null)
    setRepairForm({
      repair_centre_location_id: '',
      dispatch_date: new Date().toISOString().slice(0, 10),
      estimated_return_date: '',
      return_location_id: '',
    })
    try {
      const res = await getLocations()
      setLocations(res.data.filter((l) => l.active !== 0))
    } catch {
      setLocations([])
    }
    setShowRepairModal(true)
  }

  async function handleCreateRepair(e) {
    e.preventDefault()
    if (!repairForm.repair_centre_location_id) {
      setRepairError('Repair centre is required')
      return
    }
    setRepairSubmitting(true)
    setRepairError(null)
    try {
      const serial_ids = (order?.serials || []).map((s) => s.id)
      const payload = {
        return_order_id: returnId,
        repair_centre_location_id: Number(repairForm.repair_centre_location_id),
        serial_ids,
        dispatch_date: repairForm.dispatch_date || null,
        estimated_return_date: repairForm.estimated_return_date || null,
        return_location_id: repairForm.return_location_id ? Number(repairForm.return_location_id) : null,
      }
      const res = await createRepairOrder(payload)
      setShowRepairModal(false)
      if (onCreateRepair) onCreateRepair(res.data.id)
    } catch (err) {
      setRepairError(err.response?.data?.detail || 'Failed to create repair order')
    } finally {
      setRepairSubmitting(false)
    }
  }

  // ── Role + status checks ───────────────────────────────────────────────────
  const isAdmin = role === 'admin'
  const isPlanner = role === 'supply_planner'
  const isWarehouse = role === 'warehouse_user'

  const canReceive =
    (isAdmin || isWarehouse) &&
    order &&
    ['Initiated', 'In Transit'].includes(order.status)

  const canSetOutcome =
    (isAdmin || isPlanner || isWarehouse) &&
    order?.status === 'Received'

  const canCreateRepair =
    (isAdmin || isPlanner) &&
    order?.status === 'Inspected' &&
    order?.inspection_outcome === 'Defective'

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>
  if (error) return <p className="text-red-500 text-sm">{error}</p>
  if (!order) return null

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition"
      >
        ← Back to Return Orders
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl shadow p-6 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-800 font-mono">{order.order_number}</h1>
              <StatusBadge status={order.status} />
              {order.inspection_outcome && <OutcomeBadge outcome={order.inspection_outcome} />}
            </div>
            <div className="flex flex-col gap-1 text-sm text-gray-600">
              {order.customer_name && (
                <span><span className="font-semibold">Customer:</span> {order.customer_name}</span>
              )}
              {order.original_order_number && (
                <span><span className="font-semibold">Original Order:</span> {order.original_order_number}</span>
              )}
              <span><span className="font-semibold">Reason:</span> {order.reason}</span>
              {order.created_at && (
                <span><span className="font-semibold">Created:</span> {order.created_at.slice(0, 10)}</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {canReceive && (
              <button
                onClick={handleReceive}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: '#16a34a' }}
              >
                Mark Received
              </button>
            )}
            {canSetOutcome && (
              <button
                onClick={() => setShowOutcomePanel((v) => !v)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: '#7c3aed' }}
              >
                Set Inspection Outcome
              </button>
            )}
            {canCreateRepair && (
              <button
                onClick={openRepairModal}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: 'var(--cadet-dark)' }}
              >
                Create Repair Order
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {/* Inspection outcome inline panel */}
        {showOutcomePanel && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Set Inspection Outcome</p>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedOutcome}
                onChange={(e) => setSelectedOutcome(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="Defective">Defective</option>
                <option value="Scrap">Scrap</option>
              </select>
              <button
                onClick={handleSetOutcome}
                disabled={outcomeSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: outcomeSubmitting ? '#93c5fd' : '#7c3aed' }}
              >
                {outcomeSubmitting ? 'Saving...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowOutcomePanel(false)}
                className="px-3 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Serials table */}
      <div className="bg-white rounded-2xl shadow p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">
          Serials ({order.serials?.length || 0})
        </h2>
        {order.serials && order.serials.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100">
                <th className="px-3 py-2 font-semibold">Serial Number</th>
                <th className="px-3 py-2 font-semibold">Product</th>
                <th className="px-3 py-2 font-semibold">Current State</th>
              </tr>
            </thead>
            <tbody>
              {order.serials.map((s) => (
                <tr key={s.id} className="border-b border-gray-50">
                  <td className="px-3 py-2 font-mono text-gray-800"><a href={`/terminal/${s.id}`} className="underline decoration-gray-300 text-gray-800 hover:text-blue-700">{s.serial_number}</a></td>
                  <td className="px-3 py-2 text-gray-600">{s.product_code || '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{s.current_state_code || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-400 text-sm">No serials.</p>
        )}
      </div>

      {/* Create Repair Order Modal */}
      {showRepairModal && (
        <Modal title="Create Repair Order" onClose={() => setShowRepairModal(false)}>
          <form onSubmit={handleCreateRepair} className="flex flex-col gap-4">
            {repairError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {repairError}
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              <span className="font-semibold">Serials to repair:</span>{' '}
              {order.serials?.length || 0} serial(s) from {order.order_number}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Repair Centre *</label>
              <select
                value={repairForm.repair_centre_location_id}
                onChange={(e) => setRepairForm((p) => ({ ...p, repair_centre_location_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                required
              >
                <option value="">Select repair centre...</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.code} – {l.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Dispatch Date</label>
                <input
                  type="date"
                  value={repairForm.dispatch_date}
                  onChange={(e) => setRepairForm((p) => ({ ...p, dispatch_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Estimated Return Date</label>
                <input
                  type="date"
                  value={repairForm.estimated_return_date}
                  onChange={(e) => setRepairForm((p) => ({ ...p, estimated_return_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Return Location (after repair)</label>
              <select
                value={repairForm.return_location_id}
                onChange={(e) => setRepairForm((p) => ({ ...p, return_location_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select location...</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.code} – {l.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRepairModal(false)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={repairSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: repairSubmitting ? '#93c5fd' : 'var(--cadet-dark)' }}
              >
                {repairSubmitting ? 'Creating...' : 'Create Repair Order'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ===========================================================================
// ReturnOrdersPage — list view
// ===========================================================================
export default function ReturnOrdersPage({ role, onView, onCreateRepair }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Detail panel
  const [activeReturnId, setActiveReturnId] = useState(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')

  // Paging state
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(0)

  // New Return modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [customers, setCustomers] = useState([])
  const [outboundOrders, setOutboundOrders] = useState([])
  const [serialsInput, setSerialsInput] = useState([{ id: '' }])
  const [obSerials, setObSerials] = useState([])        // serials from selected outbound order
  const [selectedObSerials, setSelectedObSerials] = useState({}) // serial_number → checked
  const [form, setForm] = useState({
    customer_id: '',
    original_order_id: '',
    reason: 'Defective',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  const canCreate = ['admin', 'supply_planner', 'warehouse_user'].includes(role)

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    setLoading(true)
    setError(null)
    try {
      const res = await getReturnOrders()
      setOrders(res.data)
    } catch {
      setError('Failed to load return orders')
    } finally {
      setLoading(false)
    }
  }

  async function openNewModal() {
    setFormError(null)
    setForm({ customer_id: '', original_order_id: '', reason: 'Defective' })
    setSerialsInput([{ id: '' }])
    setObSerials([])
    setSelectedObSerials({})
    try {
      const [custRes, obRes] = await Promise.all([
        getCustomers(),
        getOutboundOrders({ status: 'Delivered' }),
      ])
      setCustomers(custRes.data.filter((c) => c.active !== 0))
      setOutboundOrders(obRes.data)
    } catch {
      // ignore
    }
    setShowNewModal(true)
  }

  async function handleObOrderChange(orderId) {
    setForm((p) => ({ ...p, original_order_id: orderId }))
    setObSerials([])
    setSelectedObSerials({})
    setSerialsInput([{ id: '' }])
    if (!orderId) return
    try {
      const res = await getOutboundOrder(Number(orderId))
      const serials = res.data?.allocated_serials || []
      setObSerials(serials)
      // Pre-select all
      const checked = {}
      serials.forEach((s) => { checked[s.serial_number] = true })
      setSelectedObSerials(checked)
    } catch {
      // ignore — fallback to manual input
    }
  }

  function setSerialId(idx, value) {
    setSerialsInput((prev) => {
      const next = [...prev]
      next[idx] = { id: value }
      return next
    })
  }

  function addSerialRow() {
    setSerialsInput((prev) => [...prev, { id: '' }])
  }

  function removeSerialRow(idx) {
    setSerialsInput((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      return next.length ? next : [{ id: '' }]
    })
  }

  async function handleCreate(e) {
    e.preventDefault()
    setFormError(null)

    const serial_numbers = obSerials.length > 0
      ? Object.entries(selectedObSerials).filter(([, checked]) => checked).map(([sn]) => sn)
      : serialsInput.map((s) => s.id.trim()).filter((v) => v !== '')

    if (!serial_numbers.length) {
      setFormError('At least one serial number is required')
      return
    }

    const payload = {
      reason: form.reason,
      serial_numbers,
      customer_id: form.customer_id ? Number(form.customer_id) : null,
      original_order_id: form.original_order_id ? Number(form.original_order_id) : null,
    }

    setSubmitting(true)
    try {
      const res = await createReturnOrder(payload)
      setShowNewModal(false)
      loadOrders()
      // Open the new return order detail
      setActiveReturnId(res.data.id)
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to create return order')
    } finally {
      setSubmitting(false)
    }
  }

  // Reset page when filters change
  useEffect(() => { setCurrentPage(0) }, [statusFilter, search])

  // Client-side filtering
  const filtered = orders.filter((o) => {
    if (statusFilter !== 'All' && o.status !== statusFilter) return false
    if (search && !o.order_number.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  // ── Detail panel mode ──────────────────────────────────────────────────────
  if (activeReturnId !== null) {
    return (
      <ReturnDetailPanel
        returnId={activeReturnId}
        onBack={() => setActiveReturnId(null)}
        role={role}
        onCreateRepair={(repairId) => {
          setActiveReturnId(null)
          if (onCreateRepair) onCreateRepair(repairId)
        }}
      />
    )
  }

  // ── List mode ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-bold text-gray-800">Return Orders</h2>
        {canCreate && (
          <button
            onClick={openNewModal}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
            style={{ backgroundColor: 'var(--cadet-dark)' }}
          >
            + New Return
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          type="text"
          placeholder="Search order number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none w-52"
        />
        <button
          onClick={loadOrders}
          className="px-3 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 transition"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-6 max-w-md">
          <p className="text-gray-400 text-sm">No return orders found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100">
                <th className="px-4 py-3 font-semibold">Order #</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Original Order</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Inspection Outcome</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((o) => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">{o.order_number}</td>
                  <td className="px-4 py-3 text-gray-600">{o.customer_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono">{o.original_order_number || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{o.reason}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3">
                    <OutcomeBadge outcome={o.inspection_outcome} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {o.created_at ? o.created_at.slice(0, 10) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setActiveReturnId(o.id)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold text-white transition"
                      style={{ backgroundColor: 'var(--cadet-dark)' }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-100 text-xs text-gray-500 flex-wrap">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(0) }}
                className="border border-gray-200 rounded-lg px-3 py-1 text-sm"
              >
                {[50, 100, 150].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="ml-auto">
                {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filtered.length)} of {filtered.length}
              </span>
              <button disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}
                className="border border-gray-200 rounded-lg px-3 py-1 text-sm"
                style={{ background: currentPage === 0 ? '#f9fafb' : '#fff', cursor: currentPage === 0 ? 'default' : 'pointer' }}>
                ‹ Prev
              </button>
              <button disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}
                className="border border-gray-200 rounded-lg px-3 py-1 text-sm"
                style={{ background: currentPage >= totalPages - 1 ? '#f9fafb' : '#fff', cursor: currentPage >= totalPages - 1 ? 'default' : 'pointer' }}>
                Next ›
              </button>
            </div>
          )}
        </div>
      )}

      {/* New Return Order Modal */}
      {showNewModal && (
        <Modal title="New Return Order" onClose={() => setShowNewModal(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Reason *</label>
              <select
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                required
              >
                {REASON_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Customer</label>
              <select
                value={form.customer_id}
                onChange={(e) => setForm((p) => ({ ...p, customer_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select customer (optional)...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Original Outbound Order</label>
              <select
                value={form.original_order_id}
                onChange={(e) => handleObOrderChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select outbound order (optional)...</option>
                {outboundOrders.map((o) => (
                  <option key={o.id} value={o.id}>{o.order_number} — {o.customer_name || o.status}</option>
                ))}
              </select>
            </div>

            {/* Serial Numbers — checkboxes if OB order selected, else manual input */}
            {obSerials.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600">Select Serials to Return *</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { const a = {}; obSerials.forEach((s) => { a[s.serial_number] = true }); setSelectedObSerials(a) }}
                      className="text-xs text-blue-600 hover:underline">All</button>
                    <button type="button" onClick={() => setSelectedObSerials({})}
                      className="text-xs text-gray-500 hover:underline">None</button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 flex flex-col gap-1">
                  {obSerials.map((s) => (
                    <label key={s.serial_number} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                      <input
                        type="checkbox"
                        checked={!!selectedObSerials[s.serial_number]}
                        onChange={(e) => setSelectedObSerials((prev) => ({ ...prev, [s.serial_number]: e.target.checked }))}
                        style={{ accentColor: 'var(--cadet-dark)' }}
                      />
                      <span className="font-mono text-gray-800">{s.serial_number}</span>
                      {s.product_code && <span className="text-gray-400 text-xs">{s.product_code}</span>}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">{Object.values(selectedObSerials).filter(Boolean).length} of {obSerials.length} selected</p>
              </div>
            ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600">Serial Numbers *</label>
                <button
                  type="button"
                  onClick={addSerialRow}
                  className="text-xs font-semibold px-2 py-1 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 transition"
                >
                  + Add Serial
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {serialsInput.map((s, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={s.id}
                      onChange={(e) => setSerialId(idx, e.target.value)}
                      placeholder="e.g. T123"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                    />
                    {serialsInput.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSerialRow(idx)}
                        className="text-red-400 hover:text-red-600 text-lg leading-none px-1"
                        title="Remove"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Enter the serial number(s) exactly as they appear in the system.</p>
            </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: submitting ? '#93c5fd' : 'var(--cadet-dark)' }}
              >
                {submitting ? 'Creating...' : 'Create Return'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
