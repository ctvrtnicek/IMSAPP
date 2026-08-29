import { useState } from 'react'
import { getTraceability, initiateRMA } from '../../api/traceability.js'

// ---------------------------------------------------------------------------
// Timeline dot + line styles
// ---------------------------------------------------------------------------
const DOT_SIZE = 12
const LINE_WIDTH = 2

const STATE_COLORS = {
  EXPECTING:    '#ca8a04',
  IN_STOCK:     '#16a34a',
  ALLOCATED:    '#2563eb',
  SHIPPED:      '#7c3aed',
  DELIVERED:    '#0d9488',
  RMA:          '#dc2626',
  IN_REPAIR:    '#e11d48',
  DECOMMISSION: '#6b7280',
}

function stateColor(state) {
  return STATE_COLORS[state] || 'var(--cadet-dark)'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({ label, value, mono }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 'var(--fs-body-sm)', lineHeight: 1.6 }}>
      <span style={{ color: 'var(--fg-muted)', minWidth: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--fg-1)', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>{value}</span>
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div className="e2o-card" style={{ padding: '1.25rem 1.5rem', marginBottom: 16 }}>
      <p className="e2o-eyebrow" style={{ marginBottom: 10 }}>{title}</p>
      {children}
    </div>
  )
}

function OrderLink({ orderRef, type }) {
  if (!orderRef) return <span style={{ color: 'var(--fg-muted)' }}>--</span>
  const prefix = type === 'po' ? '/po/' : type === 'return' ? '/return/' : type === 'repair' ? '/repair/' : '/order/'
  return (
    <a
      href={`${prefix}${encodeURIComponent(orderRef)}`}
      target="_blank"
      rel="noreferrer"
      style={{ color: 'var(--cadet-dark)', textDecoration: 'underline', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body-sm)' }}
    >
      {orderRef}
    </a>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TraceabilityPage({ role }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  // RMA dialog
  const [showRMA, setShowRMA] = useState(false)
  const [rmaReason, setRmaReason] = useState('')
  const [rmaLoading, setRmaLoading] = useState(false)
  const [rmaError, setRmaError] = useState(null)
  const [rmaSuccess, setRmaSuccess] = useState(null)

  const canInitiateRMA = ['admin', 'supply_planner', 'rma_manager'].includes(role)

  async function handleSearch(e) {
    e.preventDefault()
    const serial = query.trim()
    if (!serial) return
    setLoading(true)
    setError(null)
    setData(null)
    setRmaSuccess(null)
    try {
      const res = await getTraceability(serial)
      setData(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Serial not found or failed to load traceability data.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRMASubmit(e) {
    e.preventDefault()
    if (!rmaReason.trim()) return
    setRmaLoading(true)
    setRmaError(null)
    try {
      await initiateRMA({ serial_id: data.serial.id, reason: rmaReason.trim() })
      setRmaSuccess('RMA initiated successfully.')
      setShowRMA(false)
      setRmaReason('')
      const res = await getTraceability(data.serial.serial_number)
      setData(res.data)
    } catch (err) {
      const detail = err.response?.data?.detail
      setRmaError(typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : `HTTP ${err.response?.status || 'error'}: Failed to initiate RMA.`)
    } finally {
      setRmaLoading(false)
    }
  }

  // Sort history chronological (oldest first)
  const history = data?.history ? [...data.history].sort((a, b) => new Date(a.datetime_utc) - new Date(b.datetime_utc)) : []

  return (
    <div>
      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 24, maxWidth: 520 }}>
        <input
          type="text"
          className="e2o-input"
          placeholder="Enter serial number..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" className="e2o-btn e2o-btn-primary" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="e2o-card" style={{ padding: '1rem 1.25rem', marginBottom: 16, borderLeft: '3px solid var(--alert)', background: '#fdf2f2' }}>
          <span style={{ color: 'var(--alert)', fontSize: 'var(--fs-body-sm)' }}>{error}</span>
        </div>
      )}

      {rmaSuccess && (
        <div className="e2o-card" style={{ padding: '1rem 1.25rem', marginBottom: 16, borderLeft: '3px solid #16a34a', background: '#f0fdf4' }}>
          <span style={{ color: '#16a34a', fontSize: 'var(--fs-body-sm)' }}>{rmaSuccess}</span>
        </div>
      )}

      {data && (
        <>
          {/* Serial header card */}
          <SectionCard title="Serial Information">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <InfoRow label="Serial Number" value={data.serial?.serial_number} mono />
                <InfoRow label="Product" value={data.serial?.product_code ? `${data.serial.product_code} — ${data.serial.product_name || ''}` : null} />
                <InfoRow label="Supplier" value={data.serial?.supplier_name} />
                <InfoRow label="Current State" value={data.serial?.current_state} />
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <InfoRow label="Location" value={data.serial?.current_location_code ? `${data.serial.current_location_code} — ${data.serial.current_location_name || ''}` : null} />
                <InfoRow label="Firmware" value={data.serial?.firmware_name ? `${data.serial.firmware_name} v${data.serial.firmware_version || ''}` : null} />
                <InfoRow label="Accumulated Cost" value={data.serial?.accumulated_cost != null ? `€ ${data.serial.accumulated_cost.toFixed(2)}` : null} />
                <InfoRow label="Stock Type" value={data.serial?.stock_type} />
              </div>
            </div>

            {canInitiateRMA && data.serial?.current_state_code !== 'DECOMMISSIONED' && (
              <div style={{ marginTop: 16 }}>
                <button className="e2o-btn" onClick={() => setShowRMA(true)} style={{ background: '#dc2626', color: '#fff', border: 'none' }}>
                  Initiate RMA
                </button>
              </div>
            )}
          </SectionCard>

          {/* RMA Dialog */}
          {showRMA && (
            <SectionCard title="Initiate RMA">
              <form onSubmit={handleRMASubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
                {rmaError && (
                  <div style={{ background: '#fdf2f2', border: '1px solid #e9a8a4', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 'var(--fs-body-sm)', color: 'var(--alert)' }}>
                    {rmaError}
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--fg-2)', marginBottom: 4 }}>
                    RMA Reason *
                  </label>
                  <textarea
                    className="e2o-input"
                    rows={3}
                    required
                    value={rmaReason}
                    onChange={(e) => setRmaReason(e.target.value)}
                    placeholder="Describe the reason for initiating RMA..."
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="e2o-btn e2o-btn-primary" disabled={rmaLoading}>
                    {rmaLoading ? 'Submitting...' : 'Confirm RMA'}
                  </button>
                  <button type="button" className="e2o-btn" onClick={() => { setShowRMA(false); setRmaError(null) }}>
                    Cancel
                  </button>
                </div>
              </form>
            </SectionCard>
          )}

          {/* Original PO */}
          {data.original_po && (
            <SectionCard title="Purchase Order">
              <InfoRow label="PO Number" value={<OrderLink orderRef={data.original_po.po_number} type="po" />} />
              <InfoRow label="Supplier" value={data.original_po.supplier_name} />
              <InfoRow label="Order Date" value={data.original_po.order_date?.slice(0, 10)} />
              <InfoRow label="Received Date" value={data.original_po.received_date?.slice(0, 10)} />
            </SectionCard>
          )}

          {/* RMA references */}
          {data.rma_references && data.rma_references.length > 0 && (
            <SectionCard title="RMA References">
              {data.rma_references.map((rma, i) => (
                <div key={i} style={{ marginBottom: i < data.rma_references.length - 1 ? 12 : 0, paddingBottom: i < data.rma_references.length - 1 ? 12 : 0, borderBottom: i < data.rma_references.length - 1 ? '1px solid var(--border-1)' : 'none' }}>
                  <InfoRow label="RMA Reference" value={rma.rma_reference} mono />
                  <InfoRow label="Return Order" value={<OrderLink orderRef={rma.return_order} type="return" />} />
                </div>
              ))}
            </SectionCard>
          )}

          {/* Order references */}
          {data.order_references && data.order_references.length > 0 && (
            <SectionCard title="Order References">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {data.order_references.map((ref, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span className="e2o-pill" style={{ background: '#f3f4f6', color: '#374151', fontSize: 10 }}>{ref.type}</span>
                    <OrderLink orderRef={ref.reference} type={ref.type?.toLowerCase().includes('purchase') ? 'po' : ref.type?.toLowerCase().includes('return') ? 'return' : ref.type?.toLowerCase().includes('repair') ? 'repair' : 'order'} />
                  </span>
                ))}
              </div>
            </SectionCard>
          )}

          {/* State History Timeline */}
          {history.length > 0 && (
            <SectionCard title="State History">
              <div style={{ position: 'relative', paddingLeft: 28 }}>
                {/* Vertical line */}
                <div style={{
                  position: 'absolute', left: DOT_SIZE / 2 - LINE_WIDTH / 2, top: DOT_SIZE / 2,
                  bottom: DOT_SIZE / 2, width: LINE_WIDTH, background: 'var(--border-1)',
                }} />

                {history.map((entry, i) => (
                  <div key={i} style={{ position: 'relative', paddingBottom: i < history.length - 1 ? 20 : 0, minHeight: 36 }}>
                    {/* Dot */}
                    <div style={{
                      position: 'absolute', left: -28, top: 2,
                      width: DOT_SIZE, height: DOT_SIZE, borderRadius: '50%',
                      background: stateColor(entry.state_code), border: '2px solid #fff',
                      boxShadow: '0 0 0 2px ' + stateColor(entry.state_code) + '40',
                    }} />

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="e2o-pill" style={{ background: stateColor(entry.state_code) + '18', color: stateColor(entry.state_code), fontWeight: 600, fontSize: 11 }}>
                          {entry.state_name || entry.state_code}
                        </span>
                        {entry.location_code && (
                          <span style={{ fontSize: 'var(--fs-label)', color: 'var(--fg-muted)' }}>{entry.location_code} — {entry.location_name || ''}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 'var(--fs-label)', color: 'var(--fg-3)', marginTop: 2 }}>
                        {entry.datetime_utc ? new Date(entry.datetime_utc).toLocaleString() : '—'}
                        {entry.actor_user && <span> — {entry.actor_user}</span>}
                        {entry.activity_description && <span style={{ color: 'var(--fg-muted)' }}> — {entry.activity_description}</span>}
                        {entry.order_reference && (
                          <span> — <OrderLink orderRef={entry.order_reference} type="order" /></span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  )
}
