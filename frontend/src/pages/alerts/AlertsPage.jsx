import { useState, useEffect } from 'react'
import { getAlerts, runAlerts, acknowledgeAlert } from '../../api/alerts.js'

const SEVERITY_BADGE = {
  Critical: { bg: '#fee2e2', text: '#991b1b' },
  Urgent:   { bg: '#fef9c3', text: '#854d0e' },
  Normal:   { bg: '#dbeafe', text: '#1e40af' },
}

const RULE_LABELS = {
  RETURN_RECEIVED: 'Return Received',
  REPAIR_OVERDUE:  'Repair Overdue',
  TRANSIT_DELAY:   'Transit Delay',
  LOW_STOCK:       'Low Stock',
  BATTERY_AGING:   'Battery Aging',
  WARRANTY_EXPIRY: 'Warranty Expiry',
}

const inputStyle = {
  border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.35rem 0.7rem',
  fontSize: '0.85rem', outline: 'none', background: '#fff',
}

export default function AlertsPage({ onNavigate }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [runResult, setRunResult] = useState(null)

  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterRule, setFilterRule] = useState('')
  const [filterStatus, setFilterStatus] = useState('New')

  function load() {
    setLoading(true)
    const params = {}
    if (filterStatus) params.status = filterStatus
    if (filterSeverity) params.severity = filterSeverity
    if (filterRule) params.rule_code = filterRule
    getAlerts(params)
      .then((r) => { setAlerts(r.data); setLoading(false) })
      .catch(() => { setError('Failed to load alerts.'); setLoading(false) })
  }

  useEffect(() => { load() }, [filterSeverity, filterRule, filterStatus])

  function handleRun() {
    setRunning(true)
    setRunResult(null)
    runAlerts()
      .then((r) => {
        setRunResult(r.data)
        load()
      })
      .catch(() => setError('Failed to run alert engine.'))
      .finally(() => setRunning(false))
  }

  function handleAcknowledge(id) {
    acknowledgeAlert(id).then(() => {
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: 'Acknowledged' } : a))
    })
  }

  function handleClear() { setFilterSeverity(''); setFilterRule(''); setFilterStatus('New') }

  const critCount = alerts.filter((a) => a.severity === 'Critical' && a.status === 'New').length
  const urgCount  = alerts.filter((a) => a.severity === 'Urgent'   && a.status === 'New').length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--cadet-dark)', margin: 0 }}>Alerts</h2>

        {critCount > 0 && (
          <span style={{ background: '#fee2e2', color: '#991b1b', borderRadius: '9999px', padding: '2px 12px', fontSize: '0.78rem', fontWeight: 700 }}>
            {critCount} Critical
          </span>
        )}
        {urgCount > 0 && (
          <span style={{ background: '#fef9c3', color: '#854d0e', borderRadius: '9999px', padding: '2px 12px', fontSize: '0.78rem', fontWeight: 700 }}>
            {urgCount} Urgent
          </span>
        )}

        <button
          onClick={handleRun}
          disabled={running}
          style={{ marginLeft: 'auto', padding: '0.4rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#fff', background: 'var(--cadet-dark)', border: 'none', cursor: running ? 'not-allowed' : 'pointer', opacity: running ? 0.7 : 1 }}
        >
          {running ? 'Running…' : '▶ Run Alert Engine'}
        </button>
      </div>

      {runResult && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.5rem', padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#166534' }}>
          Alert run complete — {runResult.alerts_generated} alert{runResult.alerts_generated !== 1 ? 's' : ''} generated.
          {' '}({Object.entries(runResult.by_rule || {}).filter(([,v])=>v>0).map(([k,v])=>`${RULE_LABELS[k]||k}: ${v}`).join(', ')})
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={inputStyle}>
          <option value="">All Statuses</option>
          <option value="New">New</option>
          <option value="Acknowledged">Acknowledged</option>
        </select>
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} style={inputStyle}>
          <option value="">All Severities</option>
          <option value="Critical">Critical</option>
          <option value="Urgent">Urgent</option>
          <option value="Normal">Normal</option>
        </select>
        <select value={filterRule} onChange={(e) => setFilterRule(e.target.value)} style={inputStyle}>
          <option value="">All Types</option>
          {Object.entries(RULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(filterSeverity || filterRule || filterStatus !== 'New') && (
          <button onClick={handleClear} style={{ ...inputStyle, cursor: 'pointer', color: '#6b7280' }}>Clear</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#9ca3af' }}>
          {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && !error && alerts.length === 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '2.5rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          No alerts matching filters. Run the alert engine to check for new alerts.
        </div>
      )}

      {!loading && !error && alerts.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                {['Severity', 'Type', 'Message', 'Serial', 'Product', 'Location', 'Overdue (d)', 'Status', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#6b7280', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => {
                const badge = SEVERITY_BADGE[a.severity] || { bg: '#f3f4f6', text: '#374151' }
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: a.status === 'Acknowledged' ? 0.55 : 1 }}>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: badge.bg, color: badge.text, padding: '2px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {a.severity}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {RULE_LABELS[a.rule_code] || a.rule_code}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151', maxWidth: 360 }}>{a.message}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.82rem', color: '#374151', whiteSpace: 'nowrap' }}>
                      {a.serial_number
                        ? <a href={`/terminal/${a.serial_id}`} style={{ color: 'var(--cadet-dark)', textDecoration: 'underline' }}>{a.serial_number}</a>
                        : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151', fontFamily: 'monospace', fontSize: '0.82rem' }}>{a.product_code || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{a.location_code || '—'}</td>
                    <td style={{ padding: '10px 14px', color: a.days_overdue ? '#dc2626' : '#9ca3af', fontWeight: a.days_overdue ? 700 : 400, textAlign: 'right' }}>
                      {a.days_overdue ?? '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ color: a.status === 'Acknowledged' ? '#9ca3af' : '#374151', fontSize: '0.78rem' }}>{a.status}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {a.status === 'New' && (
                        <button
                          onClick={() => handleAcknowledge(a.id)}
                          style={{ padding: '3px 10px', borderRadius: '0.4rem', fontSize: '0.78rem', fontWeight: 600, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap' }}
                        >
                          Acknowledge
                        </button>
                      )}
                      {a.rule_code === 'LOW_STOCK' && onNavigate && (
                        <button
                          onClick={() => onNavigate('supply')}
                          style={{ padding: '3px 10px', borderRadius: '0.4rem', fontSize: '0.78rem', fontWeight: 600, border: 'none', background: 'var(--cadet-dark)', cursor: 'pointer', color: '#fff', marginLeft: 4, whiteSpace: 'nowrap' }}
                        >
                          → Replenishment
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '8px 14px', color: '#9ca3af', fontSize: '0.78rem', borderTop: '1px solid #f3f4f6' }}>
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
