import { useEffect, useState } from 'react'
import { listSystemConfig, updateSystemConfig } from '../../api/system_config.js'

const TYPE_LABELS = { string: 'Text', integer: 'Integer', boolean: 'Boolean', decimal: 'Decimal' }

export default function SystemConfigPage() {
  const [configs, setConfigs]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [editKey, setEditKey]   = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState(null)
  const [confirmKey, setConfirmKey] = useState(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await listSystemConfig()
      setConfigs(res.data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load system configuration.')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function startEdit(cfg) {
    setEditKey(cfg.config_key)
    setEditValue(cfg.current_value === '***' ? '' : (cfg.current_value ?? ''))
    setSaveMsg(null)
  }
  function cancelEdit() { setEditKey(null); setEditValue(''); setSaveMsg(null) }
  function requestSave(cfg) { setConfirmKey(cfg.config_key) }

  async function confirmSave() {
    const key = confirmKey
    setConfirmKey(null)
    setSaving(true); setSaveMsg(null)
    try {
      await updateSystemConfig(key, editValue)
      setSaveMsg({ key, type: 'success', msg: 'Saved.' })
      setEditKey(null)
      await load()
    } catch (err) {
      setSaveMsg({ key, type: 'error', msg: err?.response?.data?.detail || 'Failed to save.' })
    } finally { setSaving(false) }
  }

  function renderInput(cfg) {
    if (cfg.data_type === 'boolean') {
      return (
        <select value={editValue} onChange={e => setEditValue(e.target.value)}
          style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 8px', fontSize: 13 }}>
          <option value="1">Enabled (1)</option>
          <option value="0">Disabled (0)</option>
        </select>
      )
    }
    const isSecret = ['ANTHROPIC_API_KEY', 'SMTP_PASSWORD'].includes(cfg.config_key)
    return (
      <input type={isSecret ? 'password' : 'text'} value={editValue}
        onChange={e => setEditValue(e.target.value)}
        placeholder={cfg.current_value === '***' ? 'Enter new value…' : cfg.default_value ?? ''}
        style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 10px', fontSize: 13, minWidth: 240 }}
        autoComplete={isSecret ? 'new-password' : 'off'} />
    )
  }

  function formatDisplayValue(cfg) {
    if (['ANTHROPIC_API_KEY', 'SMTP_PASSWORD'].includes(cfg.config_key)) {
      return <span style={{ color: '#9ca3af' }}>{cfg.current_value ? '●●●●●●●●' : '(not set)'}</span>
    }
    if (cfg.data_type === 'boolean') {
      const on = cfg.current_value === '1' || cfg.current_value === 'true'
      return <span style={{ fontWeight: 600, color: on ? '#16a34a' : '#6b7280' }}>{on ? 'Enabled' : 'Disabled'}</span>
    }
    return <span style={{ color: '#1f2937' }}>{cfg.current_value ?? <span style={{ color: '#9ca3af' }}>—</span>}</span>
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Centralised admin-managed system parameters. Changes take effect immediately.
        </p>
        <div style={{
          background: '#E8F4F6', border: '1px solid #1A6B7B', borderRadius: 8,
          padding: '10px 16px', fontSize: 13, color: '#1A6B7B',
        }}>
          Agent settings (AGENT_SHORTAGE_*, AGENT_PIPELINE_STATES, etc.) have moved to{' '}
          <strong>Admin → Agentic</strong>, where you can also run the agent, view run history, and manage allocation intents.
        </div>
      </div>

      {loading && <p style={{ color: '#9ca3af', fontSize: 13 }}>Loading configuration…</p>}
      {error   && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}

      {!loading && !error && (
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            All Configuration Keys
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                {['Key', 'Label', 'Description', 'Type', 'Current Value', 'Default', 'Last Updated', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {configs.map(cfg => {
                const isEditing = editKey === cfg.config_key
                const msg = saveMsg?.key === cfg.config_key ? saveMsg : null
                return (
                  <tr key={cfg.config_key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>{cfg.config_key}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#1f2937' }}>{cfg.label}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: 260, lineHeight: 1.4 }}>{cfg.description}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', borderRadius: 4, padding: '2px 7px', fontWeight: 500 }}>
                        {TYPE_LABELS[cfg.data_type] || cfg.data_type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {isEditing ? renderInput(cfg) : formatDisplayValue(cfg)}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#9ca3af', fontSize: 12 }}>{cfg.default_value ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#9ca3af', fontSize: 11 }}>{cfg.updated_at?.slice(0, 16) || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button onClick={() => requestSave(cfg)} disabled={saving}
                            style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, background: '#1A6B7B', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                            Save
                          </button>
                          <button onClick={cancelEdit}
                            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151' }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(cfg)}
                          style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151' }}>
                          Edit
                        </button>
                      )}
                      {msg && <p style={{ fontSize: 11, marginTop: 4, color: msg.type === 'success' ? '#16a34a' : '#dc2626' }}>{msg.msg}</p>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmKey && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} onClick={() => setConfirmKey(null)} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 14, padding: '1.5rem', maxWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Confirm Change</h3>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
              Update <strong style={{ fontFamily: 'monospace' }}>{confirmKey}</strong> to the new value? This takes effect immediately.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setConfirmKey(null)}
                style={{ fontSize: 13, padding: '7px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151' }}>Cancel</button>
              <button onClick={confirmSave}
                style={{ fontSize: 13, padding: '7px 16px', borderRadius: 8, background: '#1A6B7B', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Confirm Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
