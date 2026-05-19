import { useState, useEffect } from 'react'
import Modal from '../../components/Modal.jsx'
import { getRROrders, createRROrder, updateRROrder, dispatchRROrder, receiveBackRROrder } from '../../api/repair_rework.js'
import api from '../../api/auth.js'

const TYPE_STYLES = {
  Repair: { backgroundColor: '#0369a1', color: '#fff' },
  Rework: { backgroundColor: '#7c3aed', color: '#fff' },
}

const STATUS_STYLES = {
  Draft:                       { backgroundColor: '#6b7280', color: '#fff' },
  Dispatched:                  { backgroundColor: '#ca8a04', color: '#fff' },
  'Received at Repair Centre': { backgroundColor: '#2563eb', color: '#fff' },
  'In Repair':                 { backgroundColor: '#7c3aed', color: '#fff' },
  Completed:                   { backgroundColor: '#16a34a', color: '#fff' },
  Returned:                    { backgroundColor: '#4b5563', color: '#fff' },
  Closed:                      { backgroundColor: '#374151', color: '#fff' },
}

function TypeBadge({ type }) {
  const s = TYPE_STYLES[type] || { backgroundColor: '#6b7280', color: '#fff' }
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={s}>{type}</span>
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { backgroundColor: '#6b7280', color: '#fff' }
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={s}>{status}</span>
}

const TYPE_OPTIONS = ['All', 'Repair', 'Rework']
const DIRECTION_OPTIONS = ['All', 'Outbound', 'Inbound']
const OUTBOUND_STATUSES = ['Draft', 'Dispatched', 'Received at Repair Centre', 'In Repair']
const INBOUND_STATUSES = ['Completed', 'Returned', 'Closed']
const STATUS_OPTIONS_ALL = ['All', 'Draft', 'Dispatched', 'Received at Repair Centre', 'In Repair', 'Completed', 'Returned', 'Closed']

// ---------------------------------------------------------------------------
// Detail Panel
// ---------------------------------------------------------------------------
function RRDetailPanel({ order, onBack, role, onRefresh }) {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState(null)
  const [showCompleteForm, setShowCompleteForm] = useState(false)
  const [completeForm, setCompleteForm] = useState({
    outcome: 'Repaired',
    actual_cost: '',
    actual_cost_currency: 'EUR',
    repair_notes: '',
    actual_return_date: new Date().toISOString().slice(0, 10),
  })

  async function handleAction(fn) {
    setError(null)
    setUpdating(true)
    try {
      await fn()
      onRefresh()
      onBack()
    } catch (e) {
      setError(e.response?.data?.detail || 'Action failed')
    } finally {
      setUpdating(false)
    }
  }

  async function handleComplete(e) {
    e.preventDefault()
    setError(null)
    setUpdating(true)
    try {
      await updateRROrder(order.id, {
        status: 'Completed',
        outcome: completeForm.outcome,
        actual_cost: completeForm.actual_cost ? Number(completeForm.actual_cost) : null,
        actual_cost_currency: completeForm.actual_cost_currency || null,
        repair_notes: completeForm.repair_notes || null,
        actual_return_date: completeForm.actual_return_date || null,
      })
      onRefresh()
      onBack()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to complete')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        ← Back to list
      </button>

      <div className="bg-white rounded-2xl shadow p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 font-mono">{order.order_number}</h2>
            <div className="flex gap-2 mt-2">
              <TypeBadge type={order.dispatch_type} />
              <StatusBadge status={order.status} />
            </div>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div><span className="text-gray-500">Location:</span> <span className="font-medium">{order.location_name || '—'}</span></div>
          <div><span className="text-gray-500">Environment:</span> <span className="font-medium">{order.environment}</span></div>
          <div><span className="text-gray-500">Reason:</span> <span className="font-medium">{order.reason || '—'}</span></div>
          <div><span className="text-gray-500">Est. Return:</span> <span className="font-medium">{order.estimated_return_date || '—'}</span></div>
          <div><span className="text-gray-500">Dispatched At:</span> <span className="font-medium">{order.outbound_shipped_at?.slice(0,10) || '—'}</span></div>
          <div><span className="text-gray-500">Returned At:</span> <span className="font-medium">{order.inbounded_at?.slice(0,10) || '—'}</span></div>
          {order.outcome && <div><span className="text-gray-500">Outcome:</span> <span className="font-medium">{order.outcome}</span></div>}
          {order.actual_cost != null && (
            <div><span className="text-gray-500">Actual Cost:</span> <span className="font-medium">{order.actual_cost} {order.actual_cost_currency}</span></div>
          )}
        </div>

        {order.serials?.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Serials ({order.serials.length})</p>
            <div className="flex flex-wrap gap-2">
              {order.serials.map((s) => (
                <span key={s.id} className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                  {s.serial_number || s.product_code || '—'}
                </span>
              ))}
            </div>
          </div>
        )}

        {order.repair_notes && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
            <span className="font-semibold">Notes: </span>{order.repair_notes}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {order.status === 'Draft' && (
            <button
              onClick={() => handleAction(() => dispatchRROrder(order.id))}
              disabled={updating}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg text-white"
              style={{ backgroundColor: '#0369a1' }}
            >
              Mark Dispatched
            </button>
          )}
          {['Dispatched','Received at Repair Centre','In Repair'].includes(order.status) && !showCompleteForm && (
            <button
              onClick={() => setShowCompleteForm(true)}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg text-white"
              style={{ backgroundColor: '#16a34a' }}
            >
              Complete & Return
            </button>
          )}
          {order.status === 'Completed' && (
            <button
              onClick={() => handleAction(() => receiveBackRROrder(order.id))}
              disabled={updating}
              className="px-3 py-1.5 text-sm font-semibold rounded-lg text-white"
              style={{ backgroundColor: '#4b5563' }}
            >
              Mark Returned
            </button>
          )}
        </div>

        {showCompleteForm && (
          <form onSubmit={handleComplete} className="mt-4 p-4 bg-green-50 rounded-xl space-y-3">
            <p className="text-sm font-semibold text-green-800">Complete Repair / Rework</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Outcome</label>
                <select
                  value={completeForm.outcome}
                  onChange={(e) => setCompleteForm((p) => ({ ...p, outcome: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="Repaired">Repaired</option>
                  <option value="Beyond Repair">Beyond Repair</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Actual Return Date</label>
                <input
                  type="date"
                  value={completeForm.actual_return_date}
                  onChange={(e) => setCompleteForm((p) => ({ ...p, actual_return_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Actual Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={completeForm.actual_cost}
                  onChange={(e) => setCompleteForm((p) => ({ ...p, actual_cost: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Currency</label>
                <input
                  type="text"
                  value={completeForm.actual_cost_currency}
                  onChange={(e) => setCompleteForm((p) => ({ ...p, actual_cost_currency: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Repair Notes</label>
              <textarea
                value={completeForm.repair_notes}
                onChange={(e) => setCompleteForm((p) => ({ ...p, repair_notes: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={updating}
                className="px-3 py-1.5 text-sm font-semibold rounded-lg text-white"
                style={{ backgroundColor: '#16a34a' }}>
                {updating ? 'Saving…' : 'Save & Complete'}
              </button>
              <button type="button" onClick={() => setShowCompleteForm(false)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function RepairReworkPage({ role }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeDetail, setActiveDetail] = useState(null)

  // Filters
  const [typeFilter, setTypeFilter] = useState('All')
  const [directionFilter, setDirectionFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')

  // New RR modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [locations, setLocations] = useState([])
  const [form, setForm] = useState({ dispatch_type: 'Repair', reason: '', location_id: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  const canCreate = ['admin', 'supply_planner', 'warehouse_user'].includes(role)

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    setError(null)
    try {
      const res = await getRROrders()
      setOrders(res.data)
    } catch {
      setError('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  async function openNewModal() {
    setFormError(null)
    setForm({ dispatch_type: 'Repair', reason: '', location_id: '' })
    try {
      const res = await api.get('/locations')
      setLocations(res.data.filter((l) => l.active !== 0))
    } catch { /* ignore */ }
    setShowNewModal(true)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      await createRROrder({
        dispatch_type: form.dispatch_type,
        reason: form.reason || null,
        location_id: form.location_id ? Number(form.location_id) : null,
      })
      setShowNewModal(false)
      loadOrders()
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to create order')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = orders.filter((o) => {
    if (typeFilter !== 'All' && o.dispatch_type !== typeFilter) return false
    if (directionFilter === 'Outbound' && !OUTBOUND_STATUSES.includes(o.status)) return false
    if (directionFilter === 'Inbound' && !INBOUND_STATUSES.includes(o.status)) return false
    if (statusFilter !== 'All' && o.status !== statusFilter) return false
    if (search && !o.order_number.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (activeDetail) {
    const order = orders.find((o) => o.id === activeDetail)
    if (order) {
      return (
        <RRDetailPanel
          order={order}
          onBack={() => setActiveDetail(null)}
          role={role}
          onRefresh={loadOrders}
        />
      )
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-gray-500 mt-1">Outbound dispatch to repair/rework centre + inbound return. Filter by Type or Direction.</p>
        </div>
        {canCreate && (
          <button
            onClick={openNewModal}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
            style={{ backgroundColor: 'var(--cadet-dark)' }}
          >
            + New R&amp;R Order
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {DIRECTION_OPTIONS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {STATUS_OPTIONS_ALL.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input
          type="text"
          placeholder="Search order number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48"
        />
        <button onClick={loadOrders} className="px-3 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50">
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-6 max-w-md">
          <p className="text-gray-400 text-sm">No repair &amp; rework orders found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100">
                <th className="px-4 py-3 font-semibold">Order #</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Serials</th>
                <th className="px-4 py-3 font-semibold">Dispatched</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">{o.order_number}</td>
                  <td className="px-4 py-3"><TypeBadge type={o.dispatch_type} /></td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{o.location_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">{o.reason || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{o.serials?.length ?? 0}</td>
                  <td className="px-4 py-3 text-gray-600">{o.outbound_shipped_at?.slice(0,10) || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{o.created_at?.slice(0,10) || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setActiveDetail(o.id)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold text-white"
                      style={{ backgroundColor: 'var(--cadet-dark)' }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNewModal && (
        <Modal title="New Repair & Rework Order" onClose={() => setShowNewModal(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                {formError}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Type *</label>
              <select value={form.dispatch_type} onChange={(e) => setForm((p) => ({ ...p, dispatch_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="Repair">Repair</option>
                <option value="Rework">Rework</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Originating Location</label>
              <select value={form.location_id} onChange={(e) => setForm((p) => ({ ...p, location_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Select location…</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Reason</label>
              <textarea value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowNewModal(false)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300">Cancel</button>
              <button type="submit" disabled={submitting}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: submitting ? '#9ca3af' : 'var(--cadet-dark)' }}>
                {submitting ? 'Creating…' : 'Create Order'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
