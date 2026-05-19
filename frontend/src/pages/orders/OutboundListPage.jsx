import { useState, useEffect } from 'react'
import Modal from '../../components/Modal.jsx'
import { getOutboundOrders, createOutboundOrder } from '../../api/outbound_orders.js'
import { getCustomers, getLocations, getProducts } from '../../api/masterdata.js'

// ── Type badge colours ───────────────────────────────────────────────────────
const TYPE_STYLES = {
  Sales:        { backgroundColor: '#2563eb', color: '#fff' },
  Rental:       { backgroundColor: '#7c3aed', color: '#fff' },
  Replacement:  { backgroundColor: '#ea580c', color: '#fff' },
  Distribution: { backgroundColor: '#0d9488', color: '#fff' },
}

// ── Status badge colours ──────────────────────────────────────────────────────
const STATUS_STYLES = {
  Draft:       { backgroundColor: '#6b7280', color: '#fff' },
  Issued:      { backgroundColor: '#2563eb', color: '#fff' },
  Allocated:   { backgroundColor: '#4f46e5', color: '#fff' },
  'In Picking':{ backgroundColor: '#0369a1', color: '#fff' },
  Shipped:     { backgroundColor: '#ca8a04', color: '#fff' },
  Delivered:   { backgroundColor: '#16a34a', color: '#fff' },
  Cancelled:   { backgroundColor: '#dc2626', color: '#fff' },
  Closed:      { backgroundColor: '#374151', color: '#fff' },
}

const TYPE_OPTIONS = ['All', 'Sales', 'Rental', 'Replacement', 'Distribution']
const STATUS_OPTIONS = [
  'All', 'Draft', 'Issued', 'Allocated', 'In Picking', 'Shipped', 'Delivered', 'Closed', 'Cancelled',
]

function TypeBadge({ type }) {
  const style = TYPE_STYLES[type] || { backgroundColor: '#6b7280', color: '#fff' }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={style}>
      {type}
    </span>
  )
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || { backgroundColor: '#6b7280', color: '#fff' }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={style}>
      {status}
    </span>
  )
}

const EMPTY_LINE = { product_id: '', quantity: '' }

// allowedTypes: if provided, only show/create orders of these types
export default function OutboundListPage({ role, onViewOrder, allowedTypes }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const typeOptions = allowedTypes
    ? ['All', ...allowedTypes]
    : TYPE_OPTIONS

  // Filters
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')

  // Paging state
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(0)

  // New Order modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [customers, setCustomers] = useState([])
  const [locations, setLocations] = useState([])
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({
    order_type: 'Sales',
    customer_id: '',
    destination_location_id: '',
    fulfilling_location_id: '',
    rental_period_months: 12,
    rental_fee: '',
    rental_fee_currency: 'EUR',
    lines: [{ ...EMPTY_LINE }],
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  const canCreate = role === 'admin' || role === 'supply_planner'

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    setLoading(true)
    setError(null)
    try {
      const res = await getOutboundOrders()
      setOrders(res.data)
    } catch {
      setError('Failed to load outbound orders')
    } finally {
      setLoading(false)
    }
  }

  async function openNewModal() {
    setFormError(null)
    setForm({
      order_type: allowedTypes?.[0] || 'Sales',
      customer_id: '',
      destination_location_id: '',
      fulfilling_location_id: '',
      rental_period_months: 12,
      rental_fee: '',
      rental_fee_currency: 'EUR',
      lines: [{ ...EMPTY_LINE }],
    })
    try {
      const [custRes, locRes, prodRes] = await Promise.all([
        getCustomers(),
        getLocations(),
        getProducts(),
      ])
      setCustomers(custRes.data.filter((c) => c.active !== 0))
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

    if (!form.order_type) { setFormError('Order type is required'); return }
    const needsCustomer = ['Sales', 'Rental', 'Replacement'].includes(form.order_type)
    const needsDestination = form.order_type === 'Distribution'

    if (needsCustomer && !form.customer_id) {
      setFormError('Customer is required for this order type')
      return
    }
    if (needsDestination && !form.destination_location_id) {
      setFormError('Destination location is required for Distribution orders')
      return
    }

    const validLines = form.lines.filter((l) => l.product_id && l.quantity)
    if (!validLines.length) {
      setFormError('At least one complete line (product + quantity) is required')
      return
    }

    const payload = {
      order_type: form.order_type,
      customer_id: needsCustomer && form.customer_id ? Number(form.customer_id) : null,
      destination_location_id: needsDestination && form.destination_location_id
        ? Number(form.destination_location_id)
        : null,
      fulfilling_location_id: form.fulfilling_location_id ? Number(form.fulfilling_location_id) : null,
      lines: validLines.map((l) => ({
        product_id: Number(l.product_id),
        quantity: Number(l.quantity),
      })),
    }

    if (form.order_type === 'Rental') {
      payload.rental_period_months = Number(form.rental_period_months) || 12
      payload.rental_fee = form.rental_fee ? Number(form.rental_fee) : null
      payload.rental_fee_currency = form.rental_fee_currency || null
    }

    setSubmitting(true)
    try {
      await createOutboundOrder(payload)
      setShowNewModal(false)
      loadOrders()
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to create outbound order')
    } finally {
      setSubmitting(false)
    }
  }

  // Reset page when filters change
  useEffect(() => { setCurrentPage(0) }, [typeFilter, statusFilter, search])

  // Client-side filtering
  const filtered = orders.filter((o) => {
    if (allowedTypes && !allowedTypes.includes(o.order_type)) return false
    if (typeFilter !== 'All' && o.order_type !== typeFilter) return false
    if (statusFilter !== 'All' && o.status !== statusFilter) return false
    if (search && !o.order_number.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  const needsCustomer = ['Sales', 'Rental', 'Replacement'].includes(form.order_type)
  const needsDestination = form.order_type === 'Distribution'
  const isRental = form.order_type === 'Rental'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-bold text-gray-800">Distribution Orders</h2>
        {canCreate && (
          <button
            onClick={openNewModal}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
            style={{ backgroundColor: 'var(--cadet-dark)' }}
          >
            + New Order
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {typeOptions.length > 2 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
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
          <p className="text-gray-400 text-sm">No outbound orders found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100">
                <th className="px-4 py-3 font-semibold">Order #</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Customer / Destination</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">ATP Ship Date</th>
                <th className="px-4 py-3 font-semibold">ATP Delivery</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((o) => {
                const customerDest = o.customer_name || o.destination_location_code || '—'
                const createdDate = o.created_at ? o.created_at.slice(0, 10) : '—'
                return (
                  <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-mono font-semibold text-gray-800">{o.order_number}</td>
                    <td className="px-4 py-3">
                      <TypeBadge type={o.order_type} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{customerDest}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{o.atp_ship_date || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{o.atp_delivery_date || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{createdDate}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onViewOrder(o.id)}
                        className="px-3 py-1 rounded-lg text-xs font-semibold text-white transition"
                        style={{ backgroundColor: 'var(--cadet-dark)' }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
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

      {/* New Order Modal */}
      {showNewModal && (
        <Modal title="New Outbound Order" onClose={() => setShowNewModal(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            {/* Order Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Order Type *</label>
              <select
                value={form.order_type}
                onChange={(e) => setForm((p) => ({ ...p, order_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                required
              >
                {(allowedTypes || ['Sales','Rental','Replacement','Distribution']).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Customer — for Sales, Rental, Replacement */}
            {needsCustomer && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Customer *</label>
                <select
                  value={form.customer_id}
                  onChange={(e) => setForm((p) => ({ ...p, customer_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  required
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Destination Location — for Distribution */}
            {needsDestination && (
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
            )}

            {/* Fulfilling / Origin Location */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                {form.order_type === 'Distribution' ? 'Origin Location (ships from)' : 'Fulfilling Location'}
              </label>
              <select
                value={form.fulfilling_location_id}
                onChange={(e) => setForm((p) => ({ ...p, fulfilling_location_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select location...</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.code} – {l.name}</option>
                ))}
              </select>
            </div>

            {/* Rental-specific fields */}
            {isRental && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Rental Period (months)</label>
                    <input
                      type="number"
                      min="1"
                      value={form.rental_period_months}
                      onChange={(e) => setForm((p) => ({ ...p, rental_period_months: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Rental Fee Currency</label>
                    <input
                      type="text"
                      value={form.rental_fee_currency}
                      onChange={(e) => setForm((p) => ({ ...p, rental_fee_currency: e.target.value }))}
                      placeholder="EUR"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Rental Fee</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.rental_fee}
                    onChange={(e) => setForm((p) => ({ ...p, rental_fee: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </>
            )}

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
                      value={line.quantity}
                      onChange={(e) => setLineField(idx, 'quantity', e.target.value)}
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
                {submitting ? 'Creating...' : 'Create Order'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
