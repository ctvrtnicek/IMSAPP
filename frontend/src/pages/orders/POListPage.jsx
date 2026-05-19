import { useState, useEffect } from 'react'
import Modal from '../../components/Modal.jsx'
import { getPOs, createPO } from '../../api/purchase_orders.js'
import { getSuppliers, getLocations, getProducts } from '../../api/masterdata.js'

// Status badge colour map
const STATUS_STYLES = {
  Draft:               { backgroundColor: '#6b7280', color: '#fff' },
  Issued:              { backgroundColor: '#2563eb', color: '#fff' },
  Expected:            { backgroundColor: '#7c3aed', color: '#fff' },
  'Partially Received':{ backgroundColor: '#ea580c', color: '#fff' },
  'Fully Received':    { backgroundColor: '#16a34a', color: '#fff' },
  Closed:              { backgroundColor: '#374151', color: '#fff' },
  Cancelled:           { backgroundColor: '#dc2626', color: '#fff' },
}

const STATUS_OPTIONS = [
  'All',
  'Draft',
  'Issued',
  'Expected',
  'Partially Received',
  'Fully Received',
  'Closed',
  'Cancelled',
]

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || { backgroundColor: '#6b7280', color: '#fff' }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
      style={style}
    >
      {status}
    </span>
  )
}

const EMPTY_LINE = { product_id: '', qty_ordered: '' }

export default function POListPage({ role, onViewPO, initialPoId }) {
  const [pos, setPos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filter state
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')

  // Paging state
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(0)

  // New PO modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [locations, setLocations] = useState([])
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({
    supplier_id: '',
    destination_location_id: '',
    order_date: new Date().toISOString().slice(0, 10),
    expected_arrival_date: '',
    notes: '',
    lines: [{ ...EMPTY_LINE }],
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  const canCreate = role === 'admin' || role === 'supply_planner'

  useEffect(() => {
    loadPOs()
  }, [])

  // Auto-open a specific PO if initialPoId provided
  useEffect(() => {
    if (initialPoId && onViewPO) onViewPO(initialPoId)
  }, [initialPoId])

  async function loadPOs() {
    setLoading(true)
    setError(null)
    try {
      const res = await getPOs()
      setPos(res.data)
    } catch (e) {
      setError('Failed to load purchase orders')
    } finally {
      setLoading(false)
    }
  }

  async function openNewModal() {
    setFormError(null)
    setForm({
      supplier_id: '',
      destination_location_id: '',
      order_date: new Date().toISOString().slice(0, 10),
      expected_arrival_date: '',
      notes: '',
      lines: [{ ...EMPTY_LINE }],
    })
    // Load dropdowns
    try {
      const [suppRes, locRes, prodRes] = await Promise.all([
        getSuppliers(),
        getLocations(),
        getProducts(),
      ])
      setSuppliers(suppRes.data.filter((s) => s.active !== 0))
      setLocations(locRes.data.filter((l) => l.active !== 0))
      setProducts(prodRes.data.filter((p) => p.active !== 0))
    } catch {
      // ignore — dropdowns may be empty
    }
    setShowNewModal(true)
  }

  function setLineField(idx, field, value) {
    setForm((prev) => {
      const lines = [...prev.lines]
      lines[idx] = { ...lines[idx], [field]: value }
      return { ...prev, lines }
    })
  }

  function addLine() {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, { ...EMPTY_LINE }] }))
  }

  function removeLine(idx) {
    setForm((prev) => {
      const lines = prev.lines.filter((_, i) => i !== idx)
      return { ...prev, lines: lines.length ? lines : [{ ...EMPTY_LINE }] }
    })
  }

  async function handleCreate(e) {
    e.preventDefault()
    setFormError(null)

    if (!form.supplier_id) { setFormError('Supplier is required'); return }
    if (!form.destination_location_id) { setFormError('Destination location is required'); return }
    if (!form.order_date) { setFormError('Order date is required'); return }

    const validLines = form.lines.filter((l) => l.product_id && l.qty_ordered)
    if (!validLines.length) {
      setFormError('At least one complete line (product + quantity) is required')
      return
    }

    const payload = {
      supplier_id: Number(form.supplier_id),
      destination_location_id: Number(form.destination_location_id),
      order_date: form.order_date,
      expected_arrival_date: form.expected_arrival_date || null,
      notes: form.notes || null,
      lines: validLines.map((l) => ({
        product_id: Number(l.product_id),
        qty_ordered: Number(l.qty_ordered),
      })),
    }

    setSubmitting(true)
    try {
      await createPO(payload)
      setShowNewModal(false)
      loadPOs()
    } catch (e) {
      setFormError(e.response?.data?.detail || 'Failed to create purchase order')
    } finally {
      setSubmitting(false)
    }
  }

  // Reset page when filters change
  useEffect(() => { setCurrentPage(0) }, [statusFilter, search])

  // Apply client-side filters
  const filtered = pos.filter((po) => {
    if (statusFilter !== 'All' && po.status !== statusFilter) return false
    if (search && !po.po_number.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Purchase Orders</h1>
        {canCreate && (
          <button
            onClick={openNewModal}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
            style={{ backgroundColor: 'var(--cadet-dark)' }}
          >
            + New PO
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
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search PO number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none w-52"
        />
        <button
          onClick={loadPOs}
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
          <p className="text-gray-400 text-sm">No purchase orders found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100">
                <th className="px-4 py-3 font-semibold">PO Number</th>
                <th className="px-4 py-3 font-semibold">Supplier</th>
                <th className="px-4 py-3 font-semibold">Destination</th>
                <th className="px-4 py-3 font-semibold">Order Date</th>
                <th className="px-4 py-3 font-semibold">Expected Arrival</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((po) => (
                <tr
                  key={po.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-gray-800">
                    {po.po_number}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{po.supplier_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {po.destination_location_code
                      ? `${po.destination_location_code} – ${po.destination_location_name || ''}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{po.order_date || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{po.expected_arrival_date || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={po.status} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onViewPO(po.id)}
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

      {/* New PO Modal */}
      {showNewModal && (
        <Modal title="New Purchase Order" onClose={() => setShowNewModal(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            {/* Supplier */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Supplier *</label>
              <select
                value={form.supplier_id}
                onChange={(e) => setForm((p) => ({ ...p, supplier_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                required
              >
                <option value="">Select supplier...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Destination Location */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Destination Location *</label>
              <select
                value={form.destination_location_id}
                onChange={(e) => setForm((p) => ({ ...p, destination_location_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                required
              >
                <option value="">Select location...</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.code} – {l.name}</option>
                ))}
              </select>
            </div>

            {/* Order Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Order Date *</label>
              <input
                type="date"
                value={form.order_date}
                onChange={(e) => setForm((p) => ({ ...p, order_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                required
              />
            </div>

            {/* Expected Arrival Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Expected Arrival Date</label>
              <input
                type="date"
                value={form.expected_arrival_date}
                onChange={(e) => setForm((p) => ({ ...p, expected_arrival_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                placeholder="Optional notes..."
              />
            </div>

            {/* Lines */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600">Order Lines *</label>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-xs font-semibold px-2 py-1 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 transition"
                >
                  + Add Line
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {form.lines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={line.product_id}
                      onChange={(e) => setLineField(idx, 'product_id', e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                    >
                      <option value="">Product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={line.qty_ordered}
                      onChange={(e) => setLineField(idx, 'qty_ordered', e.target.value)}
                      placeholder="Qty"
                      className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                    />
                    {form.lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-red-400 hover:text-red-600 text-lg leading-none px-1"
                        title="Remove line"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
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
                {submitting ? 'Creating...' : 'Create PO'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
