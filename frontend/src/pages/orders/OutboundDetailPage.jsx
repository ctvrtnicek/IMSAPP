import { useState, useEffect } from 'react'
import Modal from '../../components/Modal.jsx'
import {
  getOutboundOrder,
  issueOrder,
  allocateOrder,
  shipOrder,
  deliverOrder,
  cancelOrder,
  getAvailableSerials,
} from '../../api/outbound_orders.js'
import { getLocations, getProducts } from '../../api/masterdata.js'
import { listWorkOrders } from '../../api/work_orders.js'
import { listClaims, createClaim, listClaimTypes, uploadClaimAttachment } from '../../api/claims.js'

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

export default function OutboundDetailPage({ orderId, onBack, role }) {
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Allocation modal
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const [allocLocations, setAllocLocations] = useState([])
  const [allocProducts, setAllocProducts] = useState([])
  const [allocProductId, setAllocProductId] = useState('')
  const [allocLocationId, setAllocLocationId] = useState('')
  const [availableSerials, setAvailableSerials] = useState([])
  const [selectedSerials, setSelectedSerials] = useState({}) // { serial_id: order_line_id }
  const [allocLineId, setAllocLineId] = useState('')
  const [allocFetchError, setAllocFetchError] = useState(null)
  const [allocSubmitting, setAllocSubmitting] = useState(false)

  // Ship modal
  const [showShipModal, setShowShipModal] = useState(false)
  const [shipForm, setShipForm] = useState({
    carrier: '',
    tracking_number: '',
    shipped_date: new Date().toISOString().slice(0, 10),
    estimated_arrival_date: '',
    shipping_cost: '',
    shipping_cost_currency: 'EUR',
  })
  const [shipSubmitting, setShipSubmitting] = useState(false)
  const [shipError, setShipError] = useState(null)

  // Work Order awareness
  const [activeWo, setActiveWo] = useState(null)
  const [completedWo, setCompletedWo] = useState(null)

  // Claims
  const [orderClaims, setOrderClaims] = useState([])
  const [claimTypes, setClaimTypes] = useState([])
  const [showRaiseClaim, setShowRaiseClaim] = useState(false)
  const [claimForm, setClaimForm] = useState({ claim_type_id: '', raised_against: 'Carrier', urgency: 'Normal', description: '' })
  const [claimFile, setClaimFile] = useState(null)
  const [claimError, setClaimError] = useState(null)
  const [claimSaving, setClaimSaving] = useState(false)

  useEffect(() => {
    loadOrder()
  }, [orderId])

  async function loadOrder() {
    setLoading(true)
    setError(null)
    try {
      const res = await getOutboundOrder(orderId)
      setOrder(res.data)
      // Load open WO and claims for this order
      const [woRes, claimsRes, ctRes] = await Promise.all([
        listWorkOrders({ outbound_order_id: orderId }),
        listClaims({ outbound_order_id: orderId }),
        listClaimTypes(),
      ])
      const open = woRes.data.find((w) => ['Open', 'Acknowledged', 'In Progress'].includes(w.status))
      setActiveWo(open || null)
      const done = woRes.data.find((w) => w.status === 'Complete')
      setCompletedWo(done || null)
      setOrderClaims(claimsRes.data)
      setClaimTypes(ctRes.data)
    } catch {
      setError('Failed to load order')
    } finally {
      setLoading(false)
    }
  }

  // ── Action: Issue ──────────────────────────────────────────────────────────
  async function handleIssue() {
    setActionError(null)
    setActionLoading(true)
    try {
      const res = await issueOrder(orderId)
      setOrder(res.data)
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to issue order')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Action: Mark Delivered ─────────────────────────────────────────────────
  async function handleDeliver() {
    setActionError(null)
    setActionLoading(true)
    try {
      const res = await deliverOrder(orderId)
      setOrder(res.data)
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to mark as delivered')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Action: Cancel ─────────────────────────────────────────────────────────
  async function handleCancel() {
    if (!window.confirm('Are you sure you want to cancel this order?')) return
    setActionError(null)
    setActionLoading(true)
    try {
      const res = await cancelOrder(orderId)
      setOrder(res.data)
    } catch (err) {
      setActionError(err.response?.data?.detail || 'Failed to cancel order')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRaiseClaim(e) {
    e.preventDefault()
    setClaimError(null)
    if (!claimForm.claim_type_id) { setClaimError('Claim type is required'); return }
    setClaimSaving(true)
    try {
      const res = await createClaim({
        outbound_order_id: orderId,
        claim_type_id: Number(claimForm.claim_type_id),
        raised_against: claimForm.raised_against,
        urgency: claimForm.urgency || 'Normal',
        description: claimForm.description || null,
      })
      if (claimFile) {
        const fd = new FormData()
        fd.append('file', claimFile)
        await uploadClaimAttachment(res.data.id, fd)
      }
      setShowRaiseClaim(false)
      setClaimForm({ claim_type_id: '', raised_against: 'Carrier', urgency: 'Normal', description: '' })
      setClaimFile(null)
      await loadOrder()
    } catch (err) {
      setClaimError(err.response?.data?.detail || 'Failed to raise claim')
    } finally {
      setClaimSaving(false)
    }
  }

  // ── Allocation Modal ───────────────────────────────────────────────────────
  async function openAllocateModal() {
    setAllocFetchError(null)
    setSelectedSerials({})
    setAllocProductId('')
    setAllocLocationId('')
    setAllocLineId(order?.lines?.[0]?.id ? String(order.lines[0].id) : '')
    setAvailableSerials([])
    try {
      const [locRes, prodRes] = await Promise.all([getLocations(), getProducts()])
      setAllocLocations(locRes.data.filter((l) => l.active !== 0))
      setAllocProducts(prodRes.data.filter((p) => p.active !== 0 && p.serialised))
    } catch {
      // ignore
    }
    // Pre-set fulfilling location if set on order
    if (order?.fulfilling_location_id) {
      setAllocLocationId(String(order.fulfilling_location_id))
    }
    setShowAllocateModal(true)
  }

  async function fetchAvailableSerials() {
    if (!allocProductId || !allocLocationId) return
    setAllocFetchError(null)
    try {
      const res = await getAvailableSerials({
        product_id: Number(allocProductId),
        location_id: Number(allocLocationId),
      })
      setAvailableSerials(res.data)
    } catch {
      setAllocFetchError('Failed to load available serials')
      setAvailableSerials([])
    }
  }

  function toggleSerial(serialId) {
    setSelectedSerials((prev) => {
      const next = { ...prev }
      if (next[serialId] !== undefined) {
        delete next[serialId]
      } else {
        next[serialId] = allocLineId ? Number(allocLineId) : null
      }
      return next
    })
  }

  async function handleAllocateSubmit() {
    const allocations = Object.entries(selectedSerials)
      .filter(([, lineId]) => lineId !== null)
      .map(([serialId, lineId]) => ({
        serial_id: Number(serialId),
        order_line_id: Number(lineId),
      }))

    if (!allocations.length) {
      setAllocFetchError('Select at least one serial and assign a line')
      return
    }

    setAllocSubmitting(true)
    setAllocFetchError(null)
    try {
      await allocateOrder(orderId, { allocations })
      setShowAllocateModal(false)
      await loadOrder()  // Reload to pick up newly created WO
    } catch (err) {
      setAllocFetchError(err.response?.data?.detail || 'Allocation failed')
    } finally {
      setAllocSubmitting(false)
    }
  }

  // ── Ship Modal ─────────────────────────────────────────────────────────────
  function openShipModal() {
    setShipError(null)
    setShipForm({
      carrier: order?.carrier || '',
      tracking_number: order?.tracking_number || '',
      shipped_date: new Date().toISOString().slice(0, 10),
      estimated_arrival_date: order?.estimated_arrival_date || '',
      shipping_cost: order?.shipping_cost ? String(order.shipping_cost) : '',
      shipping_cost_currency: order?.shipping_cost_currency || 'EUR',
    })
    setShowShipModal(true)
  }

  async function handleShipSubmit(e) {
    e.preventDefault()
    setShipError(null)
    setShipSubmitting(true)
    const payload = {
      carrier: shipForm.carrier || null,
      tracking_number: shipForm.tracking_number || null,
      shipped_date: shipForm.shipped_date || null,
      estimated_arrival_date: shipForm.estimated_arrival_date || null,
      shipping_cost: shipForm.shipping_cost ? Number(shipForm.shipping_cost) : null,
      shipping_cost_currency: shipForm.shipping_cost_currency || null,
    }
    try {
      const res = await shipOrder(orderId, payload)
      setOrder(res.data)
      setShowShipModal(false)
    } catch (err) {
      setShipError(err.response?.data?.detail || 'Failed to ship order')
    } finally {
      setShipSubmitting(false)
    }
  }

  // ── Role + status checks ───────────────────────────────────────────────────
  const isAdmin = role === 'admin'
  const isPlanner = role === 'supply_planner'
  const isWarehouse = role === 'warehouse_user'

  const canIssue = (isAdmin || isPlanner) && order?.status === 'Draft'
  const canAllocate = (isAdmin || isPlanner) && ['Issued', 'Allocated'].includes(order?.status)
  const canShip = (isAdmin || isPlanner || isWarehouse) && order?.status === 'Allocated' && !activeWo
  const canDeliver = (isAdmin || isPlanner || isWarehouse) && order?.status === 'Shipped'
  const canCancel = (isAdmin || isPlanner) && ['Draft', 'Issued', 'Allocated'].includes(order?.status)

  // ── Count allocated serials per line ──────────────────────────────────────
  function allocatedCountForLine(lineId) {
    if (!order?.allocated_serials) return 0
    return order.allocated_serials.filter((s) => s.order_line_id === lineId).length
  }

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
        ← Back to Distribution Orders
      </button>

      {/* Header section */}
      <div className="bg-white rounded-2xl shadow p-6 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-800 font-mono">{order.order_number}</h1>
              <TypeBadge type={order.order_type} />
              <StatusBadge status={order.status} />
            </div>
            <div className="flex flex-col gap-1 text-sm text-gray-600">
              {order.customer_name && (
                <span><span className="font-semibold">Customer:</span> {order.customer_name}</span>
              )}
              {order.destination_location_code && (
                <span><span className="font-semibold">Destination:</span> {order.destination_location_code}</span>
              )}
              {order.fulfilling_location_code && (
                <span><span className="font-semibold">Fulfilling Location:</span> {order.fulfilling_location_code}</span>
              )}
              {order.created_at && (
                <span><span className="font-semibold">Created:</span> {order.created_at.slice(0, 10)}</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {canIssue && (
              <button
                onClick={handleIssue}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: '#2563eb' }}
              >
                Issue
              </button>
            )}
            {canAllocate && (
              <button
                onClick={openAllocateModal}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: '#4f46e5' }}
              >
                Allocate Serials
              </button>
            )}
            {canShip && (
              <button
                onClick={openShipModal}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: '#ca8a04' }}
              >
                Ship
              </button>
            )}
            {canDeliver && (
              <button
                onClick={handleDeliver}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: '#16a34a' }}
              >
                Mark Delivered
              </button>
            )}
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white border border-red-300 transition"
                style={{ backgroundColor: '#fff', color: '#dc2626' }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {/* Active Work Order banner */}
        {activeWo && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800 flex items-center gap-3">
            <span>
              Pick Work Order <strong style={{ fontFamily: 'var(--font-mono)' }}>{activeWo.order_number}</strong> is <strong>{activeWo.status}</strong> — complete it before shipping.
            </span>
            <a href={`/work-order/${activeWo.order_number}`}
              className="underline font-semibold text-blue-700 hover:text-blue-900 ml-auto">
              View WO →
            </a>
          </div>
        )}

        {/* Completed Work Order info */}
        {completedWo && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800 flex items-center gap-3">
            <span>
              Warehouse confirmed picking via <strong style={{ fontFamily: 'var(--font-mono)' }}>{completedWo.order_number}</strong> —{' '}
              <strong>{order.allocated_serials?.length ?? 0}</strong> serial{(order.allocated_serials?.length ?? 0) !== 1 ? 's' : ''} picked.
            </span>
            <a href={`/work-order/${completedWo.order_number}`}
              className="underline font-semibold text-green-700 hover:text-green-900 ml-auto">
              View WO →
            </a>
          </div>
        )}

        {/* ATP section */}
        {order.atp_ship_date && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">ATP Planning</p>
            <div className="flex flex-wrap gap-6 text-sm text-gray-600">
              <span><span className="font-semibold">Ship Date:</span> {order.atp_ship_date}</span>
              {order.atp_delivery_date && (
                <span><span className="font-semibold">Delivery Date:</span> {order.atp_delivery_date}</span>
              )}
              <span>
                <span className="font-semibold">Feasible:</span>{' '}
                {order.atp_feasible
                  ? <span className="text-green-600 font-semibold">Yes</span>
                  : <span className="text-red-500 font-semibold">No</span>
                }
              </span>
            </div>
          </div>
        )}

        {/* Rental info */}
        {order.order_type === 'Rental' && order.rental_period_months && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Rental Details</p>
            <div className="flex flex-wrap gap-6 text-sm text-gray-600">
              <span><span className="font-semibold">Period:</span> {order.rental_period_months} months</span>
              {order.rental_fee && (
                <span>
                  <span className="font-semibold">Fee:</span> {order.rental_fee} {order.rental_fee_currency}
                </span>
              )}
              {order.rental_expected_return_date && (
                <span>
                  <span className="font-semibold">Expected Return:</span> {order.rental_expected_return_date}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Shipment info */}
        {order.status === 'Shipped' || order.status === 'Delivered' ? (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Shipment Details</p>
            <div className="flex flex-wrap gap-6 text-sm text-gray-600">
              {order.carrier && <span><span className="font-semibold">Carrier:</span> {order.carrier}</span>}
              {order.tracking_number && (
                <span><span className="font-semibold">Tracking:</span> {order.tracking_number}</span>
              )}
              {order.shipped_date && (
                <span><span className="font-semibold">Shipped:</span> {order.shipped_date}</span>
              )}
              {order.estimated_arrival_date && (
                <span>
                  <span className="font-semibold">Est. Arrival:</span> {order.estimated_arrival_date}
                </span>
              )}
              {order.shipping_cost && (
                <span>
                  <span className="font-semibold">Shipping Cost:</span>{' '}
                  {order.shipping_cost} {order.shipping_cost_currency}
                </span>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Lines table */}
      <div className="bg-white rounded-2xl shadow p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">Order Lines</h2>
        {order.lines && order.lines.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100">
                <th className="px-3 py-2 font-semibold">Line #</th>
                <th className="px-3 py-2 font-semibold">Product</th>
                <th className="px-3 py-2 font-semibold">Quantity</th>
                <th className="px-3 py-2 font-semibold">Allocated</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => {
                const allocCount = allocatedCountForLine(line.id)
                return (
                  <tr key={line.id} className="border-b border-gray-50">
                    <td className="px-3 py-2 text-gray-600">{line.line_number}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">
                      {line.product_code} – {line.product_name}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{line.quantity}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`font-semibold ${allocCount >= line.quantity ? 'text-green-600' : 'text-gray-500'}`}
                      >
                        {allocCount} / {line.quantity}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-400 text-sm">No lines.</p>
        )}
      </div>

      {/* Allocated Serials */}
      {order.allocated_serials && order.allocated_serials.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">
            Allocated Serials ({order.allocated_serials.length})
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100">
                <th className="px-3 py-2 font-semibold">Serial Number</th>
                <th className="px-3 py-2 font-semibold">Product</th>
                <th className="px-3 py-2 font-semibold">State</th>
                <th className="px-3 py-2 font-semibold">Location</th>
              </tr>
            </thead>
            <tbody>
              {order.allocated_serials.map((s) => (
                <tr key={s.id} className="border-b border-gray-50">
                  <td className="px-3 py-2 font-mono text-gray-800"><a href={`/terminal/${s.serial_id}`} className="underline decoration-gray-300 text-gray-800 hover:text-blue-700">{s.serial_number}</a></td>
                  <td className="px-3 py-2 text-gray-600">{s.product_code || '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{s.current_state_code || '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{s.current_location_code || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Claims section */}
      <div className="bg-white rounded-2xl shadow p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase">
            Claims {orderClaims.length > 0 && `(${orderClaims.length})`}
          </h2>
          {['admin', 'supply_planner', 'warehouse_user'].includes(role) && (
            <button
              onClick={() => { setShowRaiseClaim(true); setClaimError(null) }}
              className="px-3 py-1 rounded-lg text-xs font-semibold text-white transition"
              style={{ backgroundColor: 'var(--cadet-dark)' }}
            >
              Raise Claim
            </button>
          )}
        </div>
        {orderClaims.length === 0 ? (
          <p className="text-gray-400 text-sm">No claims raised.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100">
                <th className="px-3 py-2 font-semibold">Claim #</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Raised Against</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {orderClaims.map((c) => (
                <tr key={c.id} className="border-b border-gray-50">
                  <td className="px-3 py-2 font-mono font-semibold text-gray-800">{c.claim_number}</td>
                  <td className="px-3 py-2 text-gray-700">{c.claim_type_name}</td>
                  <td className="px-3 py-2 text-gray-600">{c.raised_against}</td>
                  <td className="px-3 py-2">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: c.status === 'Resolved' ? '#16a34a' : c.status === 'Rejected' ? '#dc2626' : '#6b7280', color: '#fff' }}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{c.created_at?.slice(0, 10) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Raise Claim Modal */}
      {showRaiseClaim && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="bg-white rounded-2xl shadow-xl p-8" style={{ width: 460, maxWidth: '95vw' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-800">Raise Claim</h2>
              <button onClick={() => setShowRaiseClaim(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
            </div>
            <form onSubmit={handleRaiseClaim} className="flex flex-col gap-4">
              {claimError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{claimError}</div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Claim Type *</label>
                <select value={claimForm.claim_type_id}
                  onChange={(e) => setClaimForm(p => ({ ...p, claim_type_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" required>
                  <option value="">Select type...</option>
                  {claimTypes.map((ct) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Raised Against *</label>
                <select value={claimForm.raised_against}
                  onChange={(e) => setClaimForm(p => ({ ...p, raised_against: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="Carrier">Carrier</option>
                  <option value="Supplier">Supplier</option>
                  <option value="Customer">Customer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Urgency</label>
                <select value={claimForm.urgency || 'Normal'}
                  onChange={(e) => setClaimForm(p => ({ ...p, urgency: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="Normal">Normal</option>
                  <option value="Important">Important</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea value={claimForm.description}
                  onChange={(e) => setClaimForm(p => ({ ...p, description: e.target.value }))}
                  rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  placeholder="Describe the issue..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Attachment</label>
                <input type="file" onChange={(e) => setClaimFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-600" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowRaiseClaim(false)}
                  className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={claimSaving}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                  style={{ backgroundColor: claimSaving ? '#93c5fd' : 'var(--cadet-dark)' }}>
                  {claimSaving ? 'Saving...' : 'Raise Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Allocation Modal ─────────────────────────────────────────────────── */}
      {showAllocateModal && (
        <Modal title="Allocate Serials" onClose={() => setShowAllocateModal(false)}>
          <div className="flex flex-col gap-4">
            {allocFetchError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {allocFetchError}
              </div>
            )}

            {/* Summary: lines needing allocation */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Lines</p>
              {order.lines.map((line) => {
                const allocated = allocatedCountForLine(line.id)
                const remaining = line.quantity - allocated
                return (
                  <div key={line.id} className="flex justify-between text-sm py-1">
                    <span className="text-gray-700">{line.product_code} – {line.product_name}</span>
                    <span className={remaining > 0 ? 'text-orange-500 font-semibold' : 'text-green-600 font-semibold'}>
                      {allocated}/{line.quantity} allocated
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Line selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Assign to Line *</label>
              <select
                value={allocLineId}
                onChange={(e) => setAllocLineId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select line...</option>
                {order.lines.map((line) => (
                  <option key={line.id} value={line.id}>
                    Line {line.line_number}: {line.product_code} (qty {line.quantity})
                  </option>
                ))}
              </select>
            </div>

            {/* Product + Location filter */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Product</label>
                <select
                  value={allocProductId}
                  onChange={(e) => setAllocProductId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">Select product...</option>
                  {allocProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
                <select
                  value={allocLocationId}
                  onChange={(e) => setAllocLocationId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">Select location...</option>
                  {allocLocations.map((l) => (
                    <option key={l.id} value={l.id}>{l.code} – {l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchAvailableSerials}
              disabled={!allocProductId || !allocLocationId}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition self-start"
              style={{
                backgroundColor: (!allocProductId || !allocLocationId) ? '#93c5fd' : 'var(--cadet-dark)',
              }}
            >
              Find Available Serials
            </button>

            {/* Available serials list */}
            {availableSerials.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Available Serials ({availableSerials.length})
                </p>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                  {availableSerials.map((s) => {
                    const isSelected = selectedSerials[s.id] !== undefined
                    return (
                      <label
                        key={s.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSerial(s.id)}
                          className="rounded"
                        />
                        <span className="font-mono text-sm text-gray-800">{s.serial_number}</span>
                        <span className="text-xs text-gray-500">{s.current_state_code}</span>
                        <span className="text-xs text-gray-400 ml-auto">{s.current_location_code}</span>
                      </label>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {Object.keys(selectedSerials).length} selected
                </p>
              </div>
            )}

            {availableSerials.length === 0 && allocProductId && allocLocationId && (
              <p className="text-sm text-gray-400">
                No available serials found. Use "Find Available Serials" to search.
              </p>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAllocateModal(false)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleAllocateSubmit}
                disabled={allocSubmitting || Object.keys(selectedSerials).length === 0}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{
                  backgroundColor:
                    allocSubmitting || Object.keys(selectedSerials).length === 0
                      ? '#93c5fd'
                      : '#4f46e5',
                }}
              >
                {allocSubmitting ? 'Allocating...' : 'Confirm Allocation'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Ship Modal ───────────────────────────────────────────────────────── */}
      {showShipModal && (
        <Modal title="Ship Order" onClose={() => setShowShipModal(false)}>
          <form onSubmit={handleShipSubmit} className="flex flex-col gap-4">
            {shipError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {shipError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Carrier</label>
                <input
                  type="text"
                  value={shipForm.carrier}
                  onChange={(e) => setShipForm((p) => ({ ...p, carrier: e.target.value }))}
                  placeholder="e.g. DHL"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tracking Number</label>
                <input
                  type="text"
                  value={shipForm.tracking_number}
                  onChange={(e) => setShipForm((p) => ({ ...p, tracking_number: e.target.value }))}
                  placeholder="Tracking #"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Shipped Date</label>
                <input
                  type="date"
                  value={shipForm.shipped_date}
                  onChange={(e) => setShipForm((p) => ({ ...p, shipped_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Est. Arrival Date</label>
                <input
                  type="date"
                  value={shipForm.estimated_arrival_date}
                  onChange={(e) => setShipForm((p) => ({ ...p, estimated_arrival_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Shipping Cost</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shipForm.shipping_cost}
                  onChange={(e) => setShipForm((p) => ({ ...p, shipping_cost: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Currency</label>
                <input
                  type="text"
                  value={shipForm.shipping_cost_currency}
                  onChange={(e) => setShipForm((p) => ({ ...p, shipping_cost_currency: e.target.value }))}
                  placeholder="EUR"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowShipModal(false)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={shipSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: shipSubmitting ? '#93c5fd' : '#ca8a04' }}
              >
                {shipSubmitting ? 'Shipping...' : 'Confirm Ship'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
