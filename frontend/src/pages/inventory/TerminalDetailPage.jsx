import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSerialDetail } from '../../api/inventory.js'
import AppShell from '../../components/AppShell.jsx'

const BRAND_COLOR = 'var(--cadet-dark)'

const STATE_COLOURS = {
  'Live':             { bg: '#dcfce7', color: '#166534' },
  'Out-Warehouse':    { bg: '#fef9c3', color: '#854d0e' },
  'Pre-Warehouse':    { bg: 'var(--bg-tint-cadet)', color: 'var(--cadet-dark)' },
  'Refurbished Live': { bg: '#f3e8ff', color: 'var(--violet-medium)' },
  'End State':        { bg: '#fee2e2', color: 'var(--alert)' },
}

function StateBadge({ stateName, warehouseType }) {
  const c = STATE_COLOURS[warehouseType] || { bg: 'var(--bg-3)', color: 'var(--fg-2)' }
  return (
    <span className="e2o-pill" style={{ background: c.bg, color: c.color }}>
      {stateName || '—'}
    </span>
  )
}

function InfoCard({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span className="e2o-eyebrow">{label}</span>
      <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--fg-1)', fontSize: 'var(--fs-body)' }}>
        {children}
      </span>
    </div>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  // e.g. "2024-01-15 09:30:00" → "2024-01-15 09:30 UTC"
  const s = iso.slice(0, 16).replace('T', ' ')
  return s + ' UTC'
}

function fmtCost(val, currency) {
  if (val == null) return '—'
  const sym = currency || '€'
  return `${sym} ${parseFloat(val).toFixed(2)}`
}

function getPrefix(ref) {
  const m = ref.match(/^([A-Z]+)\d/i)
  return m ? m[1].toUpperCase() : null
}

function daysSince(isoStr) {
  if (!isoStr) return null
  const then = new Date(isoStr)
  const now = new Date()
  return Math.floor((now - then) / (1000 * 60 * 60 * 24))
}

// All prefixes with standalone detail pages
const STANDALONE_ROUTES = {
  PO: (ref) => `/po/${ref}`,
  SO: (ref) => `/order/${ref}`,
  RN: (ref) => `/order/${ref}`,
  RP: (ref) => `/order/${ref}`,
  DS: (ref) => `/order/${ref}`,
  RE: (ref) => `/return/${ref}`,
  RR: (ref) => `/repair/${ref}`,
}

function OrderRefCell({ orderRef }) {
  const navigate = useNavigate()
  if (!orderRef) return <span style={{ color: 'var(--fg-muted)' }}>—</span>

  const prefix = getPrefix(orderRef)
  const routeFn = prefix && STANDALONE_ROUTES[prefix]
  const baseStyle = { fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-bold)', color: 'var(--cadet-dark)', fontSize: 'var(--fs-body)' }

  return routeFn ? (
    <button onClick={() => navigate(routeFn(orderRef))} style={{ ...baseStyle, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
      {orderRef}
    </button>
  ) : (
    <span style={baseStyle}>{orderRef}</span>
  )
}

export default function TerminalDetailPage() {
  const { serialId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    getSerialDetail(serialId)
      .then((res) => { setData(res.data); setLoading(false) })
      .catch(() => { setError('Failed to load terminal details.'); setLoading(false) })
  }, [serialId])

  const serial = data?.serial
  const history = data?.history || []

  // Battery Aging: days since first QUARANTINE or QUARANTINE_REFURBISHED state
  const batteryAgingEntry = [...history].reverse().find(
    h => h.state_code === 'QUARANTINE' || h.state_code === 'QUARANTINE_REFURBISHED'
  )
  const batteryAgingDays = daysSince(batteryAgingEntry?.datetime_utc)

  // Warranty Aging: days since first RECEIVED state on a customer order (SO/RN/RP)
  const warrantyAgingEntry = [...history].reverse().find(
    h => h.state_code === 'RECEIVED' && h.order_reference &&
         /^(SO|RN|RP)/i.test(h.order_reference)
  )
  const warrantyAgingDays = daysSince(warrantyAgingEntry?.datetime_utc)

  // Accumulated cost = sum of reporting_currency_equiv from history (or serial.accumulated_cost)
  const accumulatedCost = serial?.accumulated_cost || 0
  const accCurrency = '€'

  return (
    <AppShell title={serial ? `Terminal Detail — ${serial.serial_number}` : 'Terminal Detail'}>
      <div style={{ padding: '2rem', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>Loading…</div>
        )}
        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '0.75rem' }}>{error}</div>
        )}

        {serial && (
          <>
            {/* ── Header card ─────────────────────────────────────── */}
            <div className="e2o-card" style={{ padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap' }}>
                {/* Serial number — large */}
                <div style={{ minWidth: 200 }}>
                  <span className="e2o-eyebrow">Serial Number</span>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-bold)',
                    fontSize: '1.4rem', color: 'var(--cadet-dark)', letterSpacing: '0.04em', marginTop: 4,
                  }}>
                    {serial.serial_number}
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '1.25rem', flex: 1,
                }}>
                  <InfoCard label="Product">
                    {serial.product_code
                      ? <>{serial.product_code} <span style={{ color: '#6b7280', fontWeight: 400 }}>— {serial.product_name}</span></>
                      : '—'}
                  </InfoCard>
                  <InfoCard label="Supplier">{serial.supplier_name || '—'}</InfoCard>
                  <InfoCard label="Stock Type">{serial.stock_type || '—'}</InfoCard>
                  <InfoCard label="Current State">
                    <StateBadge stateName={serial.current_state_name} warehouseType={null} />
                  </InfoCard>
                  <InfoCard label="Current Location">
                    {serial.current_location_code
                      ? <>{serial.current_location_code} <span style={{ color: '#6b7280', fontWeight: 400 }}>— {serial.current_location_name}</span></>
                      : '—'}
                  </InfoCard>
                  <InfoCard label={`Accumulated Cost (${accCurrency})`}>
                    <span style={{ color: accumulatedCost > 0 ? '#166534' : '#374151' }}>
                      {accCurrency} {parseFloat(accumulatedCost).toFixed(2)}
                    </span>
                  </InfoCard>
                  <InfoCard label="Battery Aging">
                    {batteryAgingDays != null ? `${batteryAgingDays} days` : '—'}
                  </InfoCard>
                  <InfoCard label="Warranty Aging">
                    {warrantyAgingDays != null ? `${warrantyAgingDays} days` : '—'}
                  </InfoCard>
                </div>
              </div>
            </div>

            {/* ── State History table ──────────────────────────────── */}
            <div className="e2o-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-1)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <h2 style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-h3)', color: 'var(--fg-1)', margin: 0 }}>
                  State History
                </h2>
                <span className="e2o-pill" style={{ background: 'var(--bg-3)', color: 'var(--fg-3)' }}>
                  {history.length}
                </span>
              </div>

              {history.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 'var(--fs-body)' }}>
                  No state history recorded.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="e2o-table">
                    <thead>
                      <tr>
                        {['State', 'Location', 'Date / Time', 'Actor', 'Activity Description', 'Order Reference', 'Native Cost', 'Activity Cost (€)'].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--cadet-dark)', whiteSpace: 'nowrap' }}>
                            {h.state_name || h.state_code || '—'}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {h.location_name
                              ? <>{h.location_code && <span style={{ fontWeight: 'var(--fw-semibold)' }}>{h.location_code}</span>} <span style={{ color: 'var(--fg-3)' }}>{h.location_name}</span></>
                              : '—'}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body-sm)' }}>
                            {fmtDate(h.datetime_utc)}
                          </td>
                          <td>{h.actor_username || h.actor_type || '—'}</td>
                          <td style={{ maxWidth: 280, color: 'var(--fg-2)' }}>
                            {h.activity_description || h.notes || <span style={{ color: 'var(--fg-muted)' }}>—</span>}
                          </td>
                          <td><OrderRefCell orderRef={h.order_reference} /></td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body-sm)' }}>
                            {h.activity_cost != null && h.activity_cost_currency && h.activity_cost_currency !== accCurrency
                              ? <span>{h.activity_cost_currency} {parseFloat(h.activity_cost).toFixed(2)}</span>
                              : <span style={{ color: 'var(--border-2)' }}>—</span>}
                          </td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                            {h.reporting_currency_equiv != null
                              ? fmtCost(h.reporting_currency_equiv, accCurrency)
                              : h.activity_cost != null
                                ? fmtCost(h.activity_cost, h.activity_cost_currency)
                                : <span style={{ color: 'var(--fg-muted)' }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--border-1)', background: 'var(--bg-2)' }}>
                        <td colSpan={7} style={{ padding: '10px 14px', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', fontSize: 'var(--fs-body)' }}>
                          Accumulated Cost (reporting currency)
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 'var(--fw-bold)', color: '#166534', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {accCurrency} {parseFloat(accumulatedCost).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
