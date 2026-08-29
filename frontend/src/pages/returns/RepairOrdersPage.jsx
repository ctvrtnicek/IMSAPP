import { useState, useEffect } from 'react'
import Modal from '../../components/Modal.jsx'
import {
  getRepairOrders,
  getRepairOrder,
  updateRepairOrder,
} from '../../api/returns.js'
import {
  uploadRepairDocument,
  listRepairDocuments,
} from '../../api/repair_documents.js'

// ── Status badge colours ──────────────────────────────────────────────────────
const REPAIR_STATUS_STYLES = {
  Dispatched:                  { backgroundColor: '#ca8a04', color: '#fff' },
  'Received at Repair Centre': { backgroundColor: '#2563eb', color: '#fff' },
  'In Repair':                 { backgroundColor: '#7c3aed', color: '#fff' },
  Completed:                   { backgroundColor: '#16a34a', color: '#fff' },
  Returned:                    { backgroundColor: '#6b7280', color: '#fff' },
}

const STATUS_OPTIONS = [
  'All',
  'Dispatched',
  'Received at Repair Centre',
  'In Repair',
  'Completed',
  'Returned',
]

function StatusBadge({ status }) {
  const style = REPAIR_STATUS_STYLES[status] || { backgroundColor: '#6b7280', color: '#fff' }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={style}>
      {status}
    </span>
  )
}

// ===========================================================================
// RepairDocumentsSection — upload & list repair documents
// ===========================================================================
function RepairDocumentsSection({ repairId }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { loadDocs() }, [repairId])

  async function loadDocs() {
    setLoading(true)
    try {
      const res = await listRepairDocuments(repairId)
      setDocs(res.data || [])
    } catch {
      // endpoint may not exist yet — silently ignore
      setDocs([])
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    // Max 2 MB
    if (file.size > 2 * 1024 * 1024) {
      setError('File must be under 2 MB.')
      return
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png']
    if (!allowed.includes(file.type)) {
      setError('Only PDF, JPG, and PNG files are accepted.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      await uploadRepairDocument(repairId, file)
      loadDocs()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload document.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 mb-4">
      <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">Documents</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-3">
          {error}
        </div>
      )}

      <div className="mb-3">
        <label
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition inline-block"
          style={{ backgroundColor: 'var(--cadet-dark)', cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.65 : 1 }}
        >
          {uploading ? 'Uploading...' : 'Upload Document'}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
        <span className="text-xs text-gray-400 ml-2">PDF, JPG, PNG — max 2 MB</span>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading documents...</p>
      ) : docs.length === 0 ? (
        <p className="text-gray-400 text-sm">No documents uploaded.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100">
              <th className="px-3 py-2 font-semibold">Filename</th>
              <th className="px-3 py-2 font-semibold">Date</th>
              <th className="px-3 py-2 font-semibold">Uploaded By</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="px-3 py-2 text-gray-800">{d.file_name}</td>
                <td className="px-3 py-2 text-gray-600">{d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : '--'}</td>
                <td className="px-3 py-2 text-gray-600">{d.uploaded_by || '--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ===========================================================================
// RepairDetailPanel — inline detail view
// ===========================================================================
export function RepairDetailPanel({ repairId, onBack, role }) {
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Complete Repair form
  const [showCompleteForm, setShowCompleteForm] = useState(false)
  const [completeForm, setCompleteForm] = useState({
    outcome: 'Repaired',
    actual_cost: '',
    actual_cost_currency: 'EUR',
    repair_notes: '',
    actual_return_date: '',
  })
  const [completeSubmitting, setCompleteSubmitting] = useState(false)
  const [completeError, setCompleteError] = useState(null)

  useEffect(() => {
    loadOrder()
  }, [repairId])

  async function loadOrder() {
    setLoading(true)
    setError(null)
    try {
      const res = await getRepairOrder(repairId)
      setOrder(res.data)
    } catch {
      setError('Failed to load repair order')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(newStatus) {
    setActionError(null)
    setActionLoading(true)
    try {
      const res = await updateRepairOrder(repairId, { status: newStatus })
      setOrder(res.data)
    } catch (err) {
      setActionError(err.response?.data?.detail || `Failed to update status to ${newStatus}`)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCompleteSubmit(e) {
    e.preventDefault()
    setCompleteError(null)
    setCompleteSubmitting(true)
    try {
      const payload = {
        status: 'Completed',
        outcome: completeForm.outcome,
        actual_cost: completeForm.actual_cost ? Number(completeForm.actual_cost) : null,
        actual_cost_currency: completeForm.actual_cost_currency || null,
        repair_notes: completeForm.repair_notes || null,
        actual_return_date: completeForm.actual_return_date || null,
      }
      const res = await updateRepairOrder(repairId, payload)
      setOrder(res.data)
      setShowCompleteForm(false)
    } catch (err) {
      setCompleteError(err.response?.data?.detail || 'Failed to complete repair')
    } finally {
      setCompleteSubmitting(false)
    }
  }

  // ── Role + status checks ───────────────────────────────────────────────────
  const isAdmin = role === 'admin'
  const isRepairCentre = role === 'repair_centre'

  const canMarkReceived =
    (isAdmin || isRepairCentre) && order?.status === 'Dispatched'

  const canMarkInRepair =
    (isAdmin || isRepairCentre) && order?.status === 'Received at Repair Centre'

  const canComplete =
    (isAdmin || isRepairCentre) && order?.status === 'In Repair'

  const canMarkReturned =
    (isAdmin || isRepairCentre) && order?.status === 'Completed'

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
        ← Back to Repair Orders
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl shadow p-6 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-800 font-mono">{order.order_number}</h1>
              <StatusBadge status={order.status} />
              {order.outcome && (
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: order.outcome === 'Repaired' ? '#16a34a' : '#dc2626',
                    color: '#fff',
                  }}
                >
                  {order.outcome}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 text-sm text-gray-600">
              <span>
                <span className="font-semibold">Repair Centre:</span>{' '}
                {order.repair_centre_name || '—'}
              </span>
              {order.dispatch_date && (
                <span><span className="font-semibold">Dispatched:</span> {order.dispatch_date}</span>
              )}
              {order.estimated_return_date && (
                <span>
                  <span className="font-semibold">Est. Return:</span> {order.estimated_return_date}
                </span>
              )}
              {order.actual_return_date && (
                <span>
                  <span className="font-semibold">Actual Return:</span> {order.actual_return_date}
                </span>
              )}
              {order.return_location_name && (
                <span>
                  <span className="font-semibold">Return Location:</span> {order.return_location_name}
                </span>
              )}
              {order.actual_cost != null && (
                <span>
                  <span className="font-semibold">Actual Cost:</span>{' '}
                  {order.actual_cost} {order.actual_cost_currency}
                </span>
              )}
              {order.repair_notes && (
                <span><span className="font-semibold">Notes:</span> {order.repair_notes}</span>
              )}
              {order.created_at && (
                <span><span className="font-semibold">Created:</span> {order.created_at.slice(0, 10)}</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {canMarkReceived && (
              <button
                onClick={() => handleStatusChange('Received at Repair Centre')}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: '#2563eb' }}
              >
                Mark Received at Repair Centre
              </button>
            )}
            {canMarkInRepair && (
              <button
                onClick={() => handleStatusChange('In Repair')}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: '#7c3aed' }}
              >
                Mark In Repair
              </button>
            )}
            {canComplete && (
              <button
                onClick={() => setShowCompleteForm((v) => !v)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: '#16a34a' }}
              >
                Complete Repair
              </button>
            )}
            {canMarkReturned && (
              <button
                onClick={() => handleStatusChange('Returned')}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: '#6b7280' }}
              >
                Mark Returned to Warehouse
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {/* Complete Repair inline form */}
        {showCompleteForm && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Complete Repair</p>
            <form onSubmit={handleCompleteSubmit} className="flex flex-col gap-3">
              {completeError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                  {completeError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Outcome *</label>
                  <select
                    value={completeForm.outcome}
                    onChange={(e) => setCompleteForm((p) => ({ ...p, outcome: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    required
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Actual Cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={completeForm.actual_cost}
                    onChange={(e) => setCompleteForm((p) => ({ ...p, actual_cost: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Currency</label>
                  <input
                    type="text"
                    value={completeForm.actual_cost_currency}
                    onChange={(e) => setCompleteForm((p) => ({ ...p, actual_cost_currency: e.target.value }))}
                    placeholder="EUR"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Repair Notes</label>
                <textarea
                  value={completeForm.repair_notes}
                  onChange={(e) => setCompleteForm((p) => ({ ...p, repair_notes: e.target.value }))}
                  rows={3}
                  placeholder="Notes about the repair..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCompleteForm(false)}
                  className="px-3 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completeSubmitting}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                  style={{ backgroundColor: completeSubmitting ? '#93c5fd' : '#16a34a' }}
                >
                  {completeSubmitting ? 'Saving...' : 'Confirm Complete'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Documents section */}
      <RepairDocumentsSection repairId={repairId} />

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
    </div>
  )
}

// ===========================================================================
// RepairOrdersPage — list view
// ===========================================================================
export default function RepairOrdersPage({ role, onView, activeRepairId, onBack }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Local detail panel state (used when not driven from parent via activeRepairId)
  const [localActiveId, setLocalActiveId] = useState(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')

  // Paging state
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => {
    loadOrders()
  }, [])

  // If parent passes a new activeRepairId, open it
  useEffect(() => {
    if (activeRepairId != null) {
      setLocalActiveId(activeRepairId)
    }
  }, [activeRepairId])

  async function loadOrders() {
    setLoading(true)
    setError(null)
    try {
      const res = await getRepairOrders()
      setOrders(res.data)
    } catch {
      setError('Failed to load repair orders')
    } finally {
      setLoading(false)
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
  const detailId = localActiveId ?? activeRepairId
  if (detailId !== null && detailId !== undefined) {
    return (
      <RepairDetailPanel
        repairId={detailId}
        onBack={() => {
          setLocalActiveId(null)
          if (onBack) onBack()
        }}
        role={role}
      />
    )
  }

  // ── List mode ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-bold text-gray-800">Repair Orders</h2>
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
          <p className="text-gray-400 text-sm">No repair orders found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100">
                <th className="px-4 py-3 font-semibold">Order #</th>
                <th className="px-4 py-3 font-semibold">Repair Centre</th>
                <th className="px-4 py-3 font-semibold">Serials</th>
                <th className="px-4 py-3 font-semibold">Dispatch Date</th>
                <th className="px-4 py-3 font-semibold">Est. Return</th>
                <th className="px-4 py-3 font-semibold">Actual Cost</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((o) => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">{o.order_number}</td>
                  <td className="px-4 py-3 text-gray-600">{o.repair_centre_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{o.serials?.length ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{o.dispatch_date || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{o.estimated_return_date || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {o.actual_cost != null
                      ? `${o.actual_cost} ${o.actual_cost_currency || ''}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setLocalActiveId(o.id)}
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
    </div>
  )
}
