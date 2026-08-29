import { useEffect, useState, useCallback } from 'react'
import {
  runAgentNow, getAgentRuns, getRunLogs, getAgentIntents,
  cancelIntent, listSystemConfig, updateSystemConfig,
} from '../../api/agents'

const AGENT_KEYS = [
  'AGENT_SHORTAGE_ENABLED',
  'AGENT_SHORTAGE_RUN_TIME_1',
  'AGENT_SHORTAGE_RUN_TIME_2',
  'AGENT_SHORTAGE_HITL_QTY',
  'AGENT_SHORTAGE_HITL_VALUE',
  'AGENT_SHORTAGE_MIN_SHORTAGE',
  'AGENT_SHORTAGE_EMAIL_TO',
  'AGENT_PIPELINE_STATES',
  'AGENT_INTENT_HORIZON_DAYS',
]

const STEP_COLORS = {
  THINK:          { bg: '#1E4E8C', text: '#fff' },
  ACT:            { bg: '#D46A00', text: '#fff' },
  OBSERVE:        { bg: '#2E7D32', text: '#fff' },
  SUMMARY:        { bg: '#5C3A8E', text: '#fff' },
  INTENT_CHECK:   { bg: '#006691', text: '#fff' },
  INTENT_EXECUTE: { bg: '#00695C', text: '#fff' },
  LLM_REASONING:  { bg: '#880E4F', text: '#fff' },
}

function StepBadge({ type }) {
  const c = STEP_COLORS[type] || { bg: '#888', text: '#fff' }
  return (
    <span style={{
      background: c.bg, color: c.text,
      padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      fontFamily: 'monospace', minWidth: 120, display: 'inline-block', textAlign: 'center',
    }}>{type}</span>
  )
}

function ThinkingPanel({ runId, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRunLogs(runId)
      .then(r => setLogs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [runId])

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 700,
      background: '#fff', boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
      zIndex: 1000, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        background: '#1E4E8C', color: '#fff', padding: '16px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Agent Thinking Log</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Run: {runId?.slice(0, 8)}...</div>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
          borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 14,
        }}>Close</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <p style={{ color: '#666' }}>Loading...</p>}
        {!loading && logs.length === 0 && <p style={{ color: '#666' }}>No log entries found.</p>}
        {logs.map(log => (
          <div key={log.id} style={{
            display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start',
          }}>
            <StepBadge type={log.step_type} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 13, color: '#222', fontFamily: 'monospace',
                whiteSpace: 'pre-wrap', lineHeight: 1.5,
                background: '#f8f8f8', borderRadius: 4, padding: '6px 10px',
              }}>{log.message}</div>
              {log.order_ref && (
                <div style={{ fontSize: 11, color: '#1E4E8C', marginTop: 2 }}>
                  Order: {log.order_ref}
                </div>
              )}
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{log.created_at}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AgenticPage() {
  const [config, setConfig]         = useState({})
  const [editingKey, setEditingKey] = useState(null)
  const [editVal, setEditVal]       = useState('')
  const [running, setRunning]       = useState(false)
  const [runResult, setRunResult]   = useState(null)
  const [runs, setRuns]             = useState([])
  const [intents, setIntents]       = useState([])
  const [thinkingRunId, setThinkingRunId] = useState(null)
  const [loadingRuns, setLoadingRuns]   = useState(true)
  const [loadingIntents, setLoadingIntents] = useState(true)

  const loadAll = useCallback(() => {
    listSystemConfig().then(r => {
      const map = {}
      r.data.forEach(c => { map[c.config_key] = c.current_value })
      setConfig(map)
    }).catch(() => {})

    setLoadingRuns(true)
    getAgentRuns(50).then(r => setRuns(r.data)).catch(() => {}).finally(() => setLoadingRuns(false))

    setLoadingIntents(true)
    getAgentIntents().then(r => setIntents(r.data)).catch(() => {}).finally(() => setLoadingIntents(false))
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleRunNow = async () => {
    setRunning(true)
    setRunResult(null)
    try {
      const r = await runAgentNow('shortage')
      setRunResult(r.data)
      loadAll()
    } catch (e) {
      setRunResult({ status: 'error', error: e?.response?.data?.detail || String(e) })
    } finally {
      setRunning(false)
    }
  }

  const handleSaveConfig = async (key) => {
    try {
      await updateSystemConfig(key, editVal)
      setConfig(prev => ({ ...prev, [key]: editVal }))
      setEditingKey(null)
    } catch (e) {
      alert('Save failed: ' + (e?.response?.data?.detail || String(e)))
    }
  }

  const handleCancelIntent = async (id) => {
    if (!window.confirm('Cancel this allocation intent? The pipeline reservation will be removed.')) return
    try {
      await cancelIntent(id)
      setIntents(prev => prev.map(i => i.id === id ? { ...i, status: 'Cancelled' } : i))
    } catch (e) {
      alert('Cancel failed: ' + (e?.response?.data?.detail || String(e)))
    }
  }

  const isEnabled = config['AGENT_SHORTAGE_ENABLED'] === '1' || config['AGENT_SHORTAGE_ENABLED'] === 'true'

  const pendingIntents = intents.filter(i => ['Pending', 'PartiallyExecuted'].includes(i.status))

  function statusBadge(status) {
    const colors = {
      completed: '#2E7D32', running: '#D46A00', error: '#c62828',
      skipped: '#888', Executed: '#2E7D32', Pending: '#006691',
      PartiallyExecuted: '#E65100', Cancelled: '#888', Expired: '#c62828',
    }
    return (
      <span style={{
        background: colors[status] || '#888', color: '#fff',
        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
      }}>{status}</span>
    )
  }

  function fmt(sec) {
    if (sec == null) return '-'
    if (sec < 60) return `${sec}s`
    return `${Math.floor(sec / 60)}m ${sec % 60}s`
  }

  const tdStyle = { padding: '8px 12px', borderBottom: '1px solid #eee', fontSize: 13 }
  const thStyle = { ...tdStyle, fontWeight: 700, background: '#1E4E8C', color: '#fff', textAlign: 'left' }

  return (
    <div style={{ padding: 28, fontFamily: 'Arial, sans-serif', maxWidth: 1200 }}>
      <h1 style={{ color: '#1E4E8C', marginBottom: 4 }}>Agentic</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        AI-powered inventory agents — configuration, run history, and allocation intents.
      </p>

      {/* ── Panel 1: Agent Control ─────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, marginBottom: 24 }}>
        <div style={{
          background: '#1E4E8C', color: '#fff', padding: '12px 20px',
          borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>IMS_InventoryShortage Agent</span>
          <span style={{
            background: isEnabled ? '#2E7D32' : '#c62828', color: '#fff',
            padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
          }}>{isEnabled ? 'ENABLED' : 'DISABLED'}</span>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <button
              onClick={handleRunNow}
              disabled={running}
              style={{
                background: running ? '#aaa' : '#1E4E8C', color: '#fff',
                border: 'none', borderRadius: 6, padding: '10px 24px',
                fontWeight: 700, fontSize: 14, cursor: running ? 'not-allowed' : 'pointer',
              }}
            >
              {running ? 'Running...' : '▶ Run Now'}
            </button>
            <span style={{ color: '#666', fontSize: 13 }}>
              Scheduled: {config['AGENT_SHORTAGE_RUN_TIME_1'] || '-'} &amp; {config['AGENT_SHORTAGE_RUN_TIME_2'] || '-'} CET
            </span>
          </div>

          {runResult && (
            <div style={{
              background: runResult.status === 'error' ? '#fff3f3' : '#f0faf0',
              border: `1px solid ${runResult.status === 'error' ? '#ffcdd2' : '#c8e6c9'}`,
              borderRadius: 6, padding: '12px 16px', marginBottom: 16,
            }}>
              <div style={{ fontWeight: 700, color: runResult.status === 'error' ? '#c62828' : '#2E7D32' }}>
                Run {runResult.status === 'error' ? 'Failed' : 'Complete'}
                {runResult.fallback_mode && <span style={{ color: '#D46A00', marginLeft: 8 }}>[FALLBACK MODE]</span>}
              </div>
              {runResult.status !== 'error' ? (
                <div style={{ marginTop: 6, fontSize: 13, color: '#444', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <span>Run ID: <b>{runResult.run_id?.slice(0, 8)}...</b></span>
                  <span>Shortages: <b>{runResult.shortages_found ?? 0}</b></span>
                  <span>DOs Created: <b>{runResult.actions_taken ?? 0}</b></span>
                  <span>HITL Items: <b>{runResult.hitl_items ?? 0}</b></span>
                  <span>Intents Recorded: <b>{runResult.intents_recorded ?? 0}</b></span>
                  <span>Intents Executed: <b>{runResult.intents_executed ?? 0}</b></span>
                </div>
              ) : (
                <div style={{ color: '#c62828', fontSize: 13, marginTop: 4 }}>{runResult.error}</div>
              )}
            </div>
          )}

          {/* Agent config table */}
          <h3 style={{ color: '#1E4E8C', fontSize: 14, marginBottom: 8 }}>Agent Settings</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr>
                {['Config Key', 'Current Value', ''].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {AGENT_KEYS.map(key => (
                <tr key={key} style={{ background: '#fafafa' }}>
                  <td style={tdStyle}><code style={{ fontSize: 12 }}>{key}</code></td>
                  <td style={tdStyle}>
                    {editingKey === key ? (
                      <input
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        style={{ border: '1px solid #1E4E8C', borderRadius: 4, padding: '4px 8px', width: 250, fontSize: 13 }}
                        autoFocus
                      />
                    ) : (
                      <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{config[key] ?? '—'}</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, width: 140 }}>
                    {editingKey === key ? (
                      <span style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleSaveConfig(key)} style={{ background: '#1E4E8C', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>Save</button>
                        <button onClick={() => setEditingKey(null)} style={{ background: '#eee', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => { setEditingKey(key); setEditVal(config[key] ?? '') }}
                        style={{ background: 'none', border: '1px solid #1E4E8C', color: '#1E4E8C', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}>
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Panel 2: Run History ───────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, marginBottom: 24 }}>
        <div style={{ background: '#1E4E8C', color: '#fff', padding: '12px 20px', borderRadius: '8px 8px 0 0', fontWeight: 700, fontSize: 15 }}>
          Run History
        </div>
        <div style={{ padding: 20 }}>
          {loadingRuns ? <p style={{ color: '#666' }}>Loading...</p> : runs.length === 0 ? (
            <p style={{ color: '#666' }}>No runs yet. Click Run Now to start.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Run ID', 'Triggered By', 'Started At', 'Duration', 'Shortages', 'DOs', 'HITL', 'Intents', 'Status', ''].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run, idx) => (
                    <tr key={run.run_id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={tdStyle}><code style={{ fontSize: 11 }}>{run.run_id?.slice(0, 8)}...</code></td>
                      <td style={tdStyle}>{run.triggered_by || '-'}</td>
                      <td style={tdStyle}>{run.started_at ? run.started_at.slice(0, 16).replace('T', ' ') : '-'}</td>
                      <td style={tdStyle}>{fmt(run.duration_s)}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{run.shortages_found ?? '-'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{run.actions_taken ?? '-'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{run.hitl_items ?? '-'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {(run.intents_recorded ?? 0) + (run.intents_executed ?? 0) > 0
                          ? `+${run.intents_recorded ?? 0} / exec ${run.intents_executed ?? 0}`
                          : '0'}
                      </td>
                      <td style={tdStyle}>{statusBadge(run.status)}</td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => setThinkingRunId(run.run_id)}
                          style={{ background: 'none', border: '1px solid #1E4E8C', color: '#1E4E8C', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
                        >
                          View Thinking
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Panel 3: Active Allocation Intents ─────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, marginBottom: 24 }}>
        <div style={{
          background: '#1E4E8C', color: '#fff', padding: '12px 20px',
          borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Active Allocation Intents</span>
          <span style={{ fontSize: 12, opacity: 0.85 }}>
            {pendingIntents.length} pending
          </span>
        </div>
        <div style={{ padding: 20 }}>
          {loadingIntents ? <p style={{ color: '#666' }}>Loading...</p> : intents.length === 0 ? (
            <p style={{ color: '#666' }}>No allocation intents recorded yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['#', 'Product', 'From', 'To', 'Reserved', 'Remaining', 'Created by Run', 'Created At', 'Status', 'DOs Executed', ''].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {intents.map((intent, idx) => (
                    <tr key={intent.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={tdStyle}>{intent.id}</td>
                      <td style={tdStyle}><b>{intent.product_code}</b><br /><span style={{ color: '#666', fontSize: 11 }}>{intent.product_name}</span></td>
                      <td style={tdStyle}>{intent.from_location_code || '-'}</td>
                      <td style={tdStyle}>{intent.to_location_code || '-'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{intent.reserved_qty}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{intent.remaining_qty}</td>
                      <td style={tdStyle}><code style={{ fontSize: 11 }}>{intent.run_id?.slice(0, 8)}...</code></td>
                      <td style={tdStyle}>{intent.created_at ? intent.created_at.slice(0, 10) : '-'}</td>
                      <td style={tdStyle}>{statusBadge(intent.status)}</td>
                      <td style={tdStyle}>{intent.execution_do_refs || '-'}</td>
                      <td style={tdStyle}>
                        {['Pending', 'PartiallyExecuted'].includes(intent.status) && (
                          <button
                            onClick={() => handleCancelIntent(intent.id)}
                            style={{ background: 'none', border: '1px solid #c62828', color: '#c62828', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {intents.some(i => i.reasoning) && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', color: '#1E4E8C', fontSize: 13 }}>Show Claude's reasoning for intents</summary>
              {intents.filter(i => i.reasoning).map(i => (
                <div key={i.id} style={{ marginTop: 8, background: '#f8f8f8', borderLeft: '3px solid #1E4E8C', padding: '8px 12px', fontSize: 12, fontStyle: 'italic', color: '#444' }}>
                  <b>Intent #{i.id} ({i.product_code} {i.from_location_code} → {i.to_location_code}):</b> {i.reasoning}
                </div>
              ))}
            </details>
          )}
        </div>
      </div>

      {/* Thinking side panel */}
      {thinkingRunId && (
        <>
          <div
            onClick={() => setThinkingRunId(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 999 }}
          />
          <ThinkingPanel runId={thinkingRunId} onClose={() => setThinkingRunId(null)} />
        </>
      )}
    </div>
  )
}
