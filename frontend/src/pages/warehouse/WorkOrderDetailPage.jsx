import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getWorkOrder, getWorkOrderByNumber,
  acknowledgeWorkOrder, startWorkOrder,
  completeWorkOrder, cancelWorkOrder,
  reverseWorkOrder,
  getSerialsAtLocation,
  completeRechargeWO,
} from '../../api/work_orders.js'
import AppShell from '../../components/AppShell.jsx'

const STATUS_COLOURS = {
  Open:          { bg: '#dbeafe', color: '#1d4ed8' },
  Acknowledged:  { bg: '#fef9c3', color: '#854d0e' },
  'In Progress': { bg: '#fde68a', color: '#92400e' },
  Complete:      { bg: '#dcfce7', color: '#166534' },
  Cancelled:     { bg: '#f3f4f6', color: '#6b7280' },
}

function StatusBadge({ status }) {
  const c = STATUS_COLOURS[status] || { bg: '#f3f4f6', color: '#374151' }
  return <span className="e2o-pill" style={{ background: c.bg, color: c.color }}>{status}</span>
}

function fmtDate(iso) {
  if (!iso) return '—'
  return iso.slice(0, 16).replace('T', ' ') + ' UTC'
}

// ---------------------------------------------------------------------------
// Serial picker component — typeahead from location
// ---------------------------------------------------------------------------
function SerialPicker({ value, onChange, locationId, placeholder }) {
  const [search, setSearch] = useState(value || '')
  const [options, setOptions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchOptions = useCallback((q) => {
    if (!locationId) return
    setLoading(true)
    getSerialsAtLocation(locationId, q || undefined)
      .then((r) => { setOptions(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [locationId])

  useEffect(() => {
    if (open) fetchOptions(search)
  }, [search, open, fetchOptions])

  const handleSelect = (sn) => {
    setSearch(sn.serial_number)
    onChange(sn.id, sn.serial_number)
    setOpen(false)
  }

  const handleClear = () => {
    setSearch('')
    onChange(null, '')
  }

  return (
    <div style={{ position: 'relative', minWidth: 220 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          className="e2o-input"
          style={{ flex: 1, fontSize: 'var(--fs-body-sm)', padding: '4px 8px' }}
          placeholder={placeholder || 'Search serial…'}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {search && (
          <button
            type="button"
            onClick={handleClear}
            className="e2o-btn e2o-btn-secondary"
            style={{ fontSize: 11, padding: '2px 8px' }}
          >✕</button>
        )}
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#fff', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto',
        }}>
          {loading && <div style={{ padding: '8px 12px', color: 'var(--fg-muted)', fontSize: 12 }}>Searching…</div>}
          {!loading && options.length === 0 && (
            <div style={{ padding: '8px 12px', color: 'var(--fg-muted)', fontSize: 12 }}>No serials found</div>
          )}
          {options.map((sn) => (
            <div
              key={sn.id}
              onMouseDown={() => handleSelect(sn)}
              style={{
                padding: '6px 12px', cursor: 'pointer', fontSize: 'var(--fs-body-sm)',
                fontFamily: 'var(--font-mono)',
                background: 'transparent',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tint-cadet)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {sn.serial_number}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function WorkOrderDetailPage() {
  const { orderNumber } = useParams()
  const navigate = useNavigate()
  const [wo, setWo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Confirmation state: map of wol.id → { confirmed_serial_id, confirmed_serial_number, short_pick }
  const [confirmations, setConfirmations] = useState({})
  // Over-picks: list of { outbound_order_line_id, serial_id, serial_number }
  const [overPicks, setOverPicks] = useState([])

  const loadWo = useCallback(() => {
    setLoading(true)
    setError(null)
    getWorkOrderByNumber(orderNumber)
      .then((r) => getWorkOrder(r.data.id))
      .then((r) => {
        setWo(r.data)
        // Initialise confirmations — pre-fill confirmed with allocated if not yet confirmed
        const init = {}
        for (const line of r.data.lines || []) {
          init[line.id] = {
            confirmed_serial_id:     line.confirmed_serial?.id             ?? line.allocated_serial?.id             ?? null,
            confirmed_serial_number: line.confirmed_serial?.serial_number  ?? line.allocated_serial?.serial_number  ?? '',
            short_pick: line.is_short_pick,
          }
        }
        setConfirmations(init)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load work order.'); setLoading(false) })
  }, [orderNumber])

  useEffect(() => { loadWo() }, [loadWo])

  const action = async (fn) => {
    setBusy(true)
    setActionError(null)
    try {
      await fn()
      await loadWo()
    } catch (err) {
      setActionError(err?.response?.data?.detail || 'Action failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleConfirm = (wolId, serialId, serialNumber) => {
    setConfirmations((prev) => ({
      ...prev,
      [wolId]: { confirmed_serial_id: serialId, confirmed_serial_number: serialNumber, short_pick: false },
    }))
  }

  const handleShortPick = (wolId, checked) => {
    setConfirmations((prev) => ({
      ...prev,
      [wolId]: { ...prev[wolId], short_pick: checked, confirmed_serial_id: checked ? null : prev[wolId]?.confirmed_serial_id },
    }))
  }

  const addOverPick = () => {
    if (!wo) return
    const firstLineId = wo.lines[0]?.outbound_order_line_id || null
    setOverPicks((prev) => [...prev, { outbound_order_line_id: firstLineId, serial_id: null, serial_number: '' }])
  }

  const removeOverPick = (idx) => {
    setOverPicks((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleComplete = () => {
    // Recharge WO: complete with all allocated serial IDs
    if (wo.wo_type === 'Recharge') {
      const serial_ids = (wo.lines || []).map((l) => l.allocated_serial?.id).filter(Boolean)
      action(() => completeRechargeWO(wo.id, { serial_ids }))
      return
    }
    const lines = Object.entries(confirmations).map(([wolId, c]) => ({
      work_order_line_id: parseInt(wolId),
      confirmed_serial_id: c.short_pick ? null : c.confirmed_serial_id,
    }))
    const over_picks = overPicks
      .filter((op) => op.serial_id && op.outbound_order_line_id)
      .map((op) => ({ outbound_order_line_id: op.outbound_order_line_id, serial_id: op.serial_id }))
    action(() => completeWorkOrder(wo.id, { lines, over_picks }))
  }

  const isEditable = wo && ['Open', 'Acknowledged', 'In Progress'].includes(wo.status)

  function goBack() {
    sessionStorage.setItem('dash_nav', 'warehouse-tasks')
    sessionStorage.setItem('dash_warehouse_tab', 'work-orders')
    navigate('/dashboard')
  }

  if (loading) return (
    <AppShell title="Work Order" onBack={goBack} backLabel="← WO List">
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--fg-muted)' }}>Loading…</div>
    </AppShell>
  )

  if (error || !wo) return (
    <AppShell title="Work Order" onBack={goBack} backLabel="← WO List">
      <div style={{ padding: '2rem', color: 'var(--alert)' }}>{error || 'Not found'}</div>
    </AppShell>
  )

  return (
    <AppShell title={`Work Order — ${wo.order_number}`} onBack={goBack} backLabel="← WO List">
      <main style={{ padding: '2rem', maxWidth: 1400, width: '100%', margin: '0 auto' }}>

        {/* Header card */}
        <div className="e2o-card" style={{ padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 200 }}>
              <span className="e2o-eyebrow">Work Order</span>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-bold)', fontSize: '1.4rem', color: 'var(--cadet-dark)', letterSpacing: '0.04em', marginTop: 4 }}>
                {wo.order_number}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '1.25rem', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span className="e2o-eyebrow">Outbound Order</span>
                {wo.outbound_order_number ? (
                  <a href={`/order/${wo.outbound_order_number}`}
                    style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--cadet-dark)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body)', textDecoration: 'underline' }}>
                    {wo.outbound_order_number}
                  </a>
                ) : <span style={{ color: 'var(--fg-muted)' }}>—</span>}
              </div>
              {[
                ['Order Type', wo.outbound_order_type],
                ['WO Type', wo.wo_type],
                ['Location', wo.location_code ? `${wo.location_code} — ${wo.location_name}` : '—'],
                ['Created', fmtDate(wo.created_at)],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span className="e2o-eyebrow">{label}</span>
                  <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--fg-1)', fontSize: 'var(--fs-body)' }}>{val || '—'}</span>
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span className="e2o-eyebrow">Status</span>
                <StatusBadge status={wo.status} />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ marginTop: '1.25rem', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {wo.status === 'Open' && (
              <button className="e2o-btn e2o-btn-secondary" onClick={() => action(() => acknowledgeWorkOrder(wo.id))} disabled={busy}>
                Acknowledge
              </button>
            )}
            {wo.status === 'Acknowledged' && (
              <button className="e2o-btn e2o-btn-secondary" onClick={() => action(() => startWorkOrder(wo.id))} disabled={busy}>
                Start Picking
              </button>
            )}
            {isEditable && (
              <button className="e2o-btn e2o-btn-primary" onClick={handleComplete} disabled={busy}>
                Complete Work Order
              </button>
            )}
            {isEditable && (
              <button
                className="e2o-btn e2o-btn-danger"
                onClick={() => { if (window.confirm('Cancel this work order?')) action(() => cancelWorkOrder(wo.id)) }}
                disabled={busy}
              >
                Cancel
              </button>
            )}
            {wo.status === 'Complete' && (
              <button
                className="e2o-btn e2o-btn-secondary"
                onClick={() => { if (window.confirm('Reverse this work order back to In Progress? This will undo confirmed picks.')) action(() => reverseWorkOrder(wo.id)) }}
                disabled={busy}
              >
                Reverse
              </button>
            )}
          </div>
          {actionError && (
            <p style={{ marginTop: 10, color: 'var(--alert)', fontSize: 'var(--fs-body-sm)' }}>{actionError}</p>
          )}
        </div>

        {/* Recharge WO — simple terminals list */}
        {wo.wo_type === 'Recharge' && (
          <div className="e2o-card" style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-1)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <h2 style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-h3)', color: 'var(--fg-1)', margin: 0 }}>
                Terminals to Recharge
              </h2>
              <span className="e2o-pill" style={{ background: 'var(--bg-3)', color: 'var(--fg-3)' }}>{wo.lines?.length ?? 0}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="e2o-table">
                <thead><tr><th>#</th><th>Serial Number</th><th>Status after completion</th></tr></thead>
                <tbody>
                  {(wo.lines || []).map((line, idx) => (
                    <tr key={line.id}>
                      <td style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{idx + 1}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--cadet-dark)', fontWeight: 'var(--fw-semibold)' }}>
                        {line.allocated_serial
                          ? <a href={`/terminal/${line.allocated_serial.id}`} style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: '#9ca3af' }}>{line.allocated_serial.serial_number}</a>
                          : '—'}
                      </td>
                      <td style={{ color: '#166534', fontSize: '0.82rem' }}>→ Recharged</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pick lines table (non-Recharge WOs) */}
        {wo.wo_type !== 'Recharge' && (
        <div className="e2o-card" style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-1)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <h2 style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-h3)', color: 'var(--fg-1)', margin: 0 }}>
              Pick Lines
            </h2>
            <span className="e2o-pill" style={{ background: 'var(--bg-3)', color: 'var(--fg-3)' }}>
              {wo.lines?.length ?? 0}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="e2o-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Allocated Serial</th>
                  <th>Confirmed Serial</th>
                  {isEditable && <th>Short Pick</th>}
                </tr>
              </thead>
              <tbody>
                {(wo.lines || []).map((line, idx) => {
                  const conf = confirmations[line.id] || {}
                  return (
                    <tr key={line.id} style={conf.short_pick ? { opacity: 0.5 } : {}}>
                      <td style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{line.line_number ?? idx + 1}</td>
                      <td>
                        {line.product_code
                          ? <><strong>{line.product_code}</strong> <span style={{ color: 'var(--fg-3)' }}>{line.product_name}</span></>
                          : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--cadet-dark)', fontWeight: 'var(--fw-semibold)' }}>
                        {line.allocated_serial
                          ? <a href={`/terminal/${line.allocated_serial.id}`} style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: '#9ca3af' }}>{line.allocated_serial.serial_number}</a>
                          : <span style={{ color: 'var(--fg-muted)' }}>—</span>}
                      </td>
                      <td>
                        {isEditable && !conf.short_pick ? (
                          <SerialPicker
                            value={conf.confirmed_serial_number || ''}
                            locationId={wo.location_id}
                            onChange={(id, sn) => handleConfirm(line.id, id, sn)}
                          />
                        ) : (
                          <span style={{ fontFamily: 'var(--font-mono)', color: conf.short_pick ? '#9ca3af' : 'var(--cadet-dark)', fontWeight: conf.confirmed_serial_number ? 'var(--fw-semibold)' : 'normal' }}>
                            {conf.short_pick ? 'Short pick' : conf.confirmed_serial_id
                              ? <a href={`/terminal/${conf.confirmed_serial_id}`} style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: '#9ca3af' }}>{conf.confirmed_serial_number || line.confirmed_serial?.serial_number || '—'}</a>
                              : (conf.confirmed_serial_number || line.confirmed_serial?.serial_number || '—')}
                          </span>
                        )}
                      </td>
                      {isEditable && (
                        <td>
                          <input
                            type="checkbox"
                            checked={!!conf.short_pick}
                            onChange={(e) => handleShortPick(line.id, e.target.checked)}
                            style={{ accentColor: 'var(--cadet-dark)', width: 16, height: 16 }}
                          />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Over-picks section (non-Recharge WOs only) */}
        {wo.wo_type !== 'Recharge' && isEditable && (
          <div className="e2o-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-h3)', color: 'var(--fg-1)', margin: 0 }}>
                Over-Picks (Additional Serials)
              </h2>
              <button className="e2o-btn e2o-btn-secondary" onClick={addOverPick} style={{ fontSize: 'var(--fs-body-sm)' }}>
                + Add
              </button>
            </div>

            {overPicks.length === 0 ? (
              <div style={{ padding: '1.5rem', color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)' }}>
                No over-picks. Use "Add" to allocate additional serials beyond the original allocation.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="e2o-table">
                  <thead>
                    <tr>
                      <th>Order Line</th>
                      <th>Serial to Pick</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {overPicks.map((op, idx) => (
                      <tr key={idx}>
                        <td>
                          <select
                            className="e2o-select"
                            value={op.outbound_order_line_id || ''}
                            onChange={(e) => {
                              const v = parseInt(e.target.value) || null
                              setOverPicks((prev) => prev.map((p, i) => i === idx ? { ...p, outbound_order_line_id: v } : p))
                            }}
                            style={{ fontSize: 'var(--fs-body-sm)' }}
                          >
                            <option value="">Select line…</option>
                            {(wo.lines || []).map((l) => (
                              <option key={l.outbound_order_line_id} value={l.outbound_order_line_id}>
                                Line {l.line_number} — {l.product_code}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <SerialPicker
                            value={op.serial_number || ''}
                            locationId={wo.location_id}
                            onChange={(id, sn) => setOverPicks((prev) => prev.map((p, i) => i === idx ? { ...p, serial_id: id, serial_number: sn } : p))}
                          />
                        </td>
                        <td>
                          <button className="e2o-btn e2o-btn-danger" onClick={() => removeOverPick(idx)} style={{ fontSize: 'var(--fs-body-sm)', padding: '3px 10px' }}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </AppShell>
  )
}
