import { useState, useEffect } from 'react'
import Modal from '../../components/Modal.jsx'
import {
  getPO,
  issuePO,
  receiveAll,
  receiveDialog,
  reverseReceive,
  importSerials,
  getPOSerials,
} from '../../api/purchase_orders.js'
import { listClaims, createClaim, listClaimTypes, uploadClaimAttachment } from '../../api/claims.js'

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLOURS_CLAIM = {
  'Open':         { background: '#dbeafe', color: '#1d4ed8' },
  'Under Review': { background: '#fef9c3', color: '#854d0e' },
  'Resolved':     { background: '#dcfce7', color: '#166534' },
  'Rejected':     { background: '#fee2e2', color: '#991b1b' },
}

const STATUS_STYLES = {
  Draft:               { backgroundColor: '#6b7280', color: '#fff' },
  Issued:              { backgroundColor: '#2563eb', color: '#fff' },
  Expected:            { backgroundColor: '#7c3aed', color: '#fff' },
  'Partially Received':{ backgroundColor: '#ea580c', color: '#fff' },
  'Fully Received':    { backgroundColor: '#16a34a', color: '#fff' },
  Closed:              { backgroundColor: '#374151', color: '#fff' },
  Cancelled:           { backgroundColor: '#dc2626', color: '#fff' },
  'Quality Hold':      { backgroundColor: '#dc2626', color: '#fff' },
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || { backgroundColor: '#6b7280', color: '#fff' }
  return (
    <span
      className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
      style={style}
    >
      {status}
    </span>
  )
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ received, ordered }) {
  const pct = ordered > 0 ? Math.min(100, Math.round((received / ordered) * 100)) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: pct >= 100 ? '#16a34a' : pct > 0 ? '#ea580c' : '#e5e7eb',
          }}
        />
      </div>
      <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
    </div>
  )
}

// ── Import Serials Modal ──────────────────────────────────────────────────────

function ImportSerialsModal({ poId, onClose, onSuccess }) {
  const [form, setForm] = useState({
    shipment_reference: '',
    carrier: '',
    carrier_tracking_ref: '',
    estimated_arrival_date: '',
    serials_text: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setResult(null)

    const lines = form.serials_text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    if (!lines.length) {
      setError('Enter at least one serial number row')
      return
    }

    const serials = []
    const parseErrors = []
    lines.forEach((line, idx) => {
      const parts = line.split(',')
      if (parts.length < 2) {
        parseErrors.push(`Line ${idx + 1}: missing product_code — "${line}"`)
        return
      }
      serials.push({
        serial_number: parts[0].trim(),
        product_code: parts[1].trim(),
      })
    })

    if (parseErrors.length) {
      setError(parseErrors.join('\n'))
      return
    }

    const payload = {
      po_id: poId,
      shipment_reference: form.shipment_reference || null,
      carrier: form.carrier || null,
      carrier_tracking_ref: form.carrier_tracking_ref || null,
      estimated_arrival_date: form.estimated_arrival_date || null,
      serials,
    }

    setSubmitting(true)
    try {
      const res = await importSerials(poId, payload)
      setResult(res.data)
      if (res.data.created > 0) {
        onSuccess()
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Import failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Import Serial Numbers" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 whitespace-pre-wrap">
            {error}
          </div>
        )}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
            <p className="font-semibold">Import complete</p>
            <p>{result.created} created, {result.duplicates} duplicates skipped, {result.errors?.length || 0} errors</p>
            {result.errors?.length > 0 && (
              <ul className="mt-1 list-disc list-inside text-red-600 text-xs">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Shipment Reference</label>
            <input
              type="text"
              value={form.shipment_reference}
              onChange={(e) => setForm((p) => ({ ...p, shipment_reference: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Carrier</label>
            <input
              type="text"
              value={form.carrier}
              onChange={(e) => setForm((p) => ({ ...p, carrier: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Carrier Tracking Ref</label>
            <input
              type="text"
              value={form.carrier_tracking_ref}
              onChange={(e) => setForm((p) => ({ ...p, carrier_tracking_ref: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Estimated Arrival Date</label>
            <input
              type="date"
              value={form.estimated_arrival_date}
              onChange={(e) => setForm((p) => ({ ...p, estimated_arrival_date: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Serial Numbers *
          </label>
          <p className="text-xs text-gray-400 mb-2">
            One row per line, format: <code className="bg-gray-100 px-1 rounded">SERIAL_NUMBER,PRODUCT_CODE</code>
          </p>
          <textarea
            value={form.serials_text}
            onChange={(e) => setForm((p) => ({ ...p, serials_text: e.target.value }))}
            rows={8}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none resize-y"
            placeholder={"T12345678,P400\nT12345679,P400\nT12345680,V400C"}
            required
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 transition"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
              style={{ backgroundColor: submitting ? '#93c5fd' : 'var(--cadet-dark)' }}
            >
              {submitting ? 'Importing...' : 'Import'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}

// ── Main PODetailPage ─────────────────────────────────────────────────────────

export default function PODetailPage({ poId, role, onBack }) {
  const [po, setPo] = useState(null)
  const [serials, setSerials] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [poClaims, setPoClaims] = useState([])
  const [claimTypes, setClaimTypes] = useState([])
  const [showRaiseClaim, setShowRaiseClaim] = useState(false)
  const [claimForm, setClaimForm] = useState({ claim_type_id: '', raised_against: 'Supplier', urgency: 'Normal', description: '' })
  const [claimFile, setClaimFile] = useState(null)
  const [claimError, setClaimError] = useState(null)
  const [claimSaving, setClaimSaving] = useState(false)
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)
  const [receiveItems, setReceiveItems] = useState([])

  useEffect(() => {
    loadPO()
  }, [poId])

  async function loadPO() {
    setLoading(true)
    setError(null)
    try {
      const [poRes, serialRes, claimsRes, ctRes] = await Promise.all([
        getPO(poId),
        getPOSerials(poId),
        listClaims({ po_id: poId }),
        listClaimTypes(),
      ])
      setPo(poRes.data)
      setSerials(serialRes.data)
      setPoClaims(claimsRes.data)
      setClaimTypes(ctRes.data)
    } catch (e) {
      setError('Failed to load purchase order')
    } finally {
      setLoading(false)
    }
  }

  async function handleIssue() {
    setActionError(null)
    setActionLoading(true)
    try {
      await issuePO(poId)
      loadPO()
    } catch (e) {
      setActionError(e.response?.data?.detail || 'Failed to issue PO')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReceiveAll() {
    setActionError(null)
    setActionLoading(true)
    try {
      await receiveAll(poId)
      loadPO()
    } catch (e) {
      setActionError(e.response?.data?.detail || 'Failed to receive all')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReverseReceive() {
    if (!confirm('Reverse Goods Receipt? This will move all received serials back to EXPECTING state.')) return
    setActionError(null)
    setActionLoading(true)
    try {
      await reverseReceive(poId)
      loadPO()
    } catch (e) {
      setActionError(e.response?.data?.detail || 'Failed to reverse goods receipt')
    } finally {
      setActionLoading(false)
    }
  }

  function onImportSuccess() {
    loadPO()
  }

  async function handleRaiseClaim(e) {
    e.preventDefault()
    setClaimError(null)
    if (!claimForm.claim_type_id) { setClaimError('Claim type is required'); return }
    setClaimSaving(true)
    try {
      const res = await createClaim({
        po_id: poId,
        claim_type_id: Number(claimForm.claim_type_id),
        raised_against: claimForm.raised_against,
        urgency: claimForm.urgency || 'Normal',
        description: claimForm.description || null,
        serial_id: null,
      })
      if (claimFile) {
        const fd = new FormData()
        fd.append('file', claimFile)
        await uploadClaimAttachment(res.data.id, fd)
      }
      setShowRaiseClaim(false)
      setClaimForm({ claim_type_id: '', raised_against: 'Supplier', urgency: 'Normal', description: '' })
      setClaimFile(null)
      await loadPO()
    } catch (err) {
      setClaimError(err.response?.data?.detail || 'Failed to raise claim')
    } finally {
      setClaimSaving(false)
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-sm mt-8">Loading...</p>
  }

  if (error || !po) {
    return (
      <div>
        <button onClick={onBack} className="text-blue-600 text-sm mb-4 hover:underline">
          ← Back to POs
        </button>
        <p className="text-red-500 text-sm">{error || 'PO not found'}</p>
      </div>
    )
  }

  const canIssue =
    po.status === 'Draft' && (role === 'admin' || role === 'supply_planner')
  const canReceiveAll =
    (po.status === 'Expected' || po.status === 'Partially Received') &&
    (role === 'admin' || role === 'warehouse_user')
  const canReverseGR =
    (po.status === 'Fully Received' || po.status === 'Partially Received') &&
    role === 'admin'
  const canImport =
    (po.status === 'Issued' || po.status === 'Expected') &&
    (role === 'admin' || role === 'supply_planner' || role === 'warehouse_user' || role === 'supplier')

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="text-blue-600 text-sm mb-5 hover:underline flex items-center gap-1"
      >
        ← Back to POs
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow p-6 mb-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900 font-mono">{po.po_number}</h1>
                <StatusBadge status={po.status} />
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              {canIssue && (
                <button
                  onClick={handleIssue}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                  style={{ backgroundColor: actionLoading ? '#93c5fd' : '#2563eb' }}
                >
                  Issue PO
                </button>
              )}
              {canImport && (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                  style={{ backgroundColor: '#7c3aed' }}
                >
                  Import Serials
                </button>
              )}
              {canReceiveAll && (
                <button
                  onClick={() => {
                    const expecting = serials.filter(s => s.current_state_code === 'EXPECTING')
                    setReceiveItems(expecting.map(s => ({
                      serial_id: s.id,
                      serial_number: s.serial_number,
                      product_code: s.product_code,
                      state_code: 'QUARANTINE',
                    })))
                    setShowReceiveDialog(true)
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                  style={{ backgroundColor: actionLoading ? '#86efac' : '#16a34a' }}
                >
                  Goods Receipt
                </button>
              )}
              {canReverseGR && (
                <button
                  onClick={handleReverseReceive}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                  style={{ backgroundColor: actionLoading ? '#fca5a5' : '#dc2626' }}
                >
                  Reverse GR
                </button>
              )}
            </div>
          </div>

          {actionError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {actionError}
            </div>
          )}

          {/* PO details grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mt-2">
            <div>
              <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Supplier</span>
              <p className="text-gray-800">{po.supplier_name || '—'}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Destination</span>
              <p className="text-gray-800">
                {po.destination_location_code
                  ? `${po.destination_location_code} – ${po.destination_location_name || ''}`
                  : '—'}
              </p>
            </div>
            <div>
              <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Order Date</span>
              <p className="text-gray-800">{po.order_date || '—'}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Expected Arrival</span>
              <p className="text-gray-800">{po.expected_arrival_date || '—'}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Received Date</span>
              <p className="text-gray-800">{po.received_date || '—'}</p>
            </div>
            {po.notes && (
              <div className="col-span-2">
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Notes</span>
                <p className="text-gray-800">{po.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lines table */}
      <div className="bg-white rounded-2xl shadow mb-5">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Order Lines</h2>
        </div>
        {po.lines && po.lines.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100">
                <th className="px-4 py-3 font-semibold">Line #</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold text-right">Qty Ordered</th>
                <th className="px-4 py-3 font-semibold text-right">Qty Expected</th>
                <th className="px-4 py-3 font-semibold text-right">Qty Received</th>
                <th className="px-4 py-3 font-semibold">Received Date</th>
                <th className="px-4 py-3 font-semibold text-right">Unit Price</th>
                <th className="px-4 py-3 font-semibold">Currency</th>
                <th className="px-4 py-3 font-semibold" style={{ minWidth: 140 }}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line) => (
                <tr
                  key={line.id}
                  className="border-b border-gray-50 last:border-b-0"
                >
                  <td className="px-4 py-3 text-gray-600">{line.line_number}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-2">
                      {line.product_code}
                    </span>
                    <span className="text-gray-700">{line.product_name}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{line.qty_ordered}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{line.qty_expected}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{line.qty_received}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{line.received_date || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {line.price_per_product != null ? line.price_per_product.toFixed(2) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{line.price_currency || '—'}</td>
                  <td className="px-4 py-3">
                    <ProgressBar received={line.qty_received} ordered={line.qty_ordered} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-6 py-4 text-sm text-gray-400">No lines found.</p>
        )}
      </div>

      {/* Serials section */}
      <div className="bg-white rounded-2xl shadow">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            Serial Numbers
            {serials.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">({serials.length})</span>
            )}
          </h2>
        </div>
        {serials.length === 0 ? (
          <p className="px-6 py-4 text-sm text-gray-400">
            No serial numbers imported yet. Use "Import Serials" to add serials to this PO.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100">
                  <th className="px-4 py-3 font-semibold">Serial Number</th>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">State</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Stock Type</th>
                  <th className="px-4 py-3 font-semibold">Shipment Ref</th>
                  <th className="px-4 py-3 font-semibold">Carrier</th>
                </tr>
              </thead>
              <tbody>
                {serials.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-800"><a href={`/terminal/${s.id}`} className="underline decoration-gray-300 text-gray-800 hover:text-blue-700">{s.serial_number}</a></td>
                    <td className="px-4 py-2.5 text-gray-700">
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded mr-1">
                        {s.product_code}
                      </span>
                      {s.product_name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={s.current_state_code === 'QUALITY_HOLD'
                          ? { backgroundColor: '#fee2e2', color: '#dc2626' }
                          : { backgroundColor: '#f3e8ff', color: '#7c3aed' }}
                      >
                        {s.current_state_code || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">
                      {s.current_location_code
                        ? `${s.current_location_code} – ${s.current_location_name || ''}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{s.stock_type}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs font-mono">{s.shipment_reference || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{s.carrier || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Claims section */}
      {poClaims.length > 0 && (
        <div className="bg-white rounded-2xl shadow mt-5">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Claims ({poClaims.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100">
                <th className="px-4 py-3 font-semibold">Claim #</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Raised Against</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {poClaims.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-b-0">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold" style={{ color: 'var(--cadet-dark)' }}>
                    <button
                      onClick={() => {
                        sessionStorage.setItem('dash_nav', 'sales-orders')
                        sessionStorage.setItem('dash_orders_tab', 'claims')
                        window.history.back()
                      }}
                      style={{ color: 'var(--cadet-dark)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-mono)', fontSize: 'inherit', fontWeight: 'inherit' }}
                    >
                      {c.claim_number}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{c.claim_type_name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.raised_against}</td>
                  <td className="px-4 py-2.5">
                    <span className="e2o-pill" style={STATUS_COLOURS_CLAIM[c.status] || { background: '#f3f4f6', color: '#374151' }}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Discrepancy banner + raise claim */}
      {po && po.lines && (() => {
        const totalOrdered = po.lines.reduce((s, l) => s + (l.qty_ordered || 0), 0)
        const totalReceived = po.lines.reduce((s, l) => s + (l.qty_received || 0), 0)
        const showBanner = totalReceived < totalOrdered && po.status !== 'Draft' && po.status !== 'Issued'
        if (!showBanner) return null
        return (
          <div className="mt-4 rounded-lg px-4 py-3 flex items-center justify-between" style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}>
            <div>
              <span className="font-semibold" style={{ color: '#92400e' }}>Quantity discrepancy: </span>
              <span style={{ color: '#b45309' }}>Ordered {totalOrdered}, received {totalReceived}. {totalOrdered - totalReceived} unit(s) unaccounted for.</span>
            </div>
            {['admin', 'supply_planner', 'warehouse_user'].includes(role) && (
              <button
                onClick={() => { setShowRaiseClaim(true); setClaimError(null) }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ marginLeft: 12, flexShrink: 0, backgroundColor: 'var(--cadet-dark)' }}
              >
                Raise Claim
              </button>
            )}
          </div>
        )
      })()}

      {/* Import Serials Modal */}
      {showImportModal && (
        <ImportSerialsModal
          poId={poId}
          onClose={() => setShowImportModal(false)}
          onSuccess={onImportSuccess}
        />
      )}

      {/* Receive Dialog Modal */}
      {showReceiveDialog && (
        <Modal title={`Goods Receipt — ${po.po_number}`} onClose={() => setShowReceiveDialog(false)}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Set All:</span>
              <button
                onClick={() => setReceiveItems(items => items.map(i => ({ ...i, state_code: 'QUARANTINE' })))}
                className="px-3 py-1 rounded-lg text-xs font-semibold"
                style={{ background: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer' }}
              >All &rarr; Quarantine</button>
              <button
                onClick={() => setReceiveItems(items => items.map(i => ({ ...i, state_code: 'QUALITY_HOLD' })))}
                className="px-3 py-1 rounded-lg text-xs font-semibold"
                style={{ background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer' }}
              >All &rarr; Quality Hold</button>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100">
                    <th className="px-3 py-2 font-semibold">Serial Number</th>
                    <th className="px-3 py-2 font-semibold">Product</th>
                    <th className="px-3 py-2 font-semibold">Target State</th>
                  </tr>
                </thead>
                <tbody>
                  {receiveItems.map((item, idx) => (
                    <tr key={item.serial_id} className="border-b border-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{item.serial_number}</td>
                      <td className="px-3 py-2 text-xs">{item.product_code}</td>
                      <td className="px-3 py-2">
                        <select
                          value={item.state_code}
                          onChange={e => setReceiveItems(items => items.map((it, i) => i === idx ? { ...it, state_code: e.target.value } : it))}
                          className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                          style={{ color: item.state_code === 'QUALITY_HOLD' ? '#dc2626' : '#374151', fontWeight: 600 }}
                        >
                          <option value="QUARANTINE">Quarantine</option>
                          <option value="QUALITY_HOLD" style={{ color: '#dc2626' }}>Quality Hold</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {receiveItems.length} serial(s) — {receiveItems.filter(i => i.state_code === 'QUALITY_HOLD').length} Quality Hold
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowReceiveDialog(false)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50"
              >Cancel</button>
              <button
                onClick={async () => {
                  setActionLoading(true); setActionError(null)
                  try {
                    await receiveDialog(poId, { items: receiveItems.map(i => ({ serial_id: i.serial_id, state_code: i.state_code })) })
                    setShowReceiveDialog(false)
                    loadPO()
                  } catch (e) {
                    setActionError(e.response?.data?.detail || 'Receiving failed')
                  } finally { setActionLoading(false) }
                }}
                disabled={actionLoading || receiveItems.length === 0}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: actionLoading ? '#86efac' : '#16a34a' }}
              >{actionLoading ? 'Processing...' : 'Confirm Receipt'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Raise Claim Modal */}
      {showRaiseClaim && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="bg-white rounded-2xl shadow-xl p-8" style={{ width: 460, maxWidth: '95vw' }}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Raise Claim</h3>
              <button onClick={() => setShowRaiseClaim(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleRaiseClaim} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CLAIM TYPE *</label>
                <select
                  value={claimForm.claim_type_id}
                  onChange={(e) => setClaimForm((p) => ({ ...p, claim_type_id: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">Select claim type…</option>
                  {claimTypes.filter((ct) => ct.active).map((ct) => (
                    <option key={ct.id} value={ct.id}>{ct.name} ({ct.raised_against})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">RAISED AGAINST *</label>
                <select
                  value={claimForm.raised_against}
                  onChange={(e) => setClaimForm((p) => ({ ...p, raised_against: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="Supplier">Supplier</option>
                  <option value="Carrier">Carrier</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">URGENCY</label>
                <select
                  value={claimForm.urgency || 'Normal'}
                  onChange={(e) => setClaimForm((p) => ({ ...p, urgency: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="Normal">Normal</option>
                  <option value="Important">Important</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">DESCRIPTION</label>
                <textarea
                  value={claimForm.description}
                  onChange={(e) => setClaimForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  placeholder="Describe the issue…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-y"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">ATTACHMENT</label>
                <input
                  type="file"
                  onChange={(e) => setClaimFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-600"
                />
              </div>
              {claimError && <p className="text-red-600 text-sm">{claimError}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowRaiseClaim(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={claimSaving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition" style={{ backgroundColor: claimSaving ? '#93c5fd' : 'var(--cadet-dark)' }}>
                  {claimSaving ? 'Creating…' : 'Create Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
