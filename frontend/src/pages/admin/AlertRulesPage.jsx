import { useState, useEffect } from 'react'
import { getAlertRules, updateAlertRule } from '../../api/alerts.js'

const RULE_DESCRIPTIONS = {
  RETURN_RECEIVED: 'Generates an alert for every return order that is Open or Received and awaiting warehouse action.',
  REPAIR_OVERDUE:  'Flags terminals that have been in repair longer than the product\'s repair_max_days threshold.',
  TRANSIT_DELAY:   'Flags in-transit terminals that are overdue based on transit time lanes or fallback lead time.',
  LOW_STOCK:       'Alerts when stock at a location drops below the safety stock reorder point.',
  BATTERY_AGING:   'Alerts when terminal battery days since last recharge approaches or exceeds product battery_life_days.',
  WARRANTY_EXPIRY: 'Alerts when terminal warranty is approaching expiry or has already expired.',
}

export default function AlertRulesPage() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [edits, setEdits] = useState({})

  useEffect(() => {
    getAlertRules()
      .then((r) => {
        setRules(r.data)
        const init = {}
        r.data.forEach((rule) => {
          init[rule.id] = {
            enabled: rule.enabled,
            threshold_urgent_days: rule.threshold_urgent_days ?? '',
            threshold_critical_days: rule.threshold_critical_days ?? '',
          }
        })
        setEdits(init)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function handleToggle(rule) {
    const newEnabled = !edits[rule.id]?.enabled
    setEdits((prev) => ({ ...prev, [rule.id]: { ...prev[rule.id], enabled: newEnabled } }))
    setSaving((prev) => ({ ...prev, [rule.id]: true }))
    updateAlertRule(rule.id, { enabled: newEnabled ? 1 : 0 })
      .finally(() => setSaving((prev) => ({ ...prev, [rule.id]: false })))
  }

  function handleSaveThresholds(rule) {
    const edit = edits[rule.id] || {}
    setSaving((prev) => ({ ...prev, [rule.id]: true }))
    updateAlertRule(rule.id, {
      threshold_urgent_days: edit.threshold_urgent_days !== '' ? parseInt(edit.threshold_urgent_days) : null,
      threshold_critical_days: edit.threshold_critical_days !== '' ? parseInt(edit.threshold_critical_days) : null,
    }).finally(() => setSaving((prev) => ({ ...prev, [rule.id]: false })))
  }

  if (loading) return <p style={{ color: '#6b7280' }}>Loading…</p>

  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--cadet-dark)', marginBottom: '1rem' }}>Alert Rules</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {rules.map((rule) => {
          const edit = edits[rule.id] || {}
          const hasDays = rule.rule_code === 'TRANSIT_DELAY' || rule.rule_code === 'WARRANTY_EXPIRY'
          return (
            <div key={rule.id} style={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--cadet-dark)', marginBottom: 2 }}>{rule.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{RULE_DESCRIPTIONS[rule.rule_code] || rule.description}</div>
                </div>

                {hasDays && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {rule.rule_code === 'TRANSIT_DELAY' && (
                      <>
                        <label style={{ fontSize: '0.78rem', color: '#6b7280', whiteSpace: 'nowrap' }}>Urgent after (days over):</label>
                        <input
                          type="number" min={0}
                          value={edit.threshold_urgent_days ?? ''}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [rule.id]: { ...prev[rule.id], threshold_urgent_days: e.target.value } }))}
                          style={{ width: 60, border: '1px solid #d1d5db', borderRadius: '0.4rem', padding: '3px 8px', fontSize: '0.85rem' }}
                        />
                        <label style={{ fontSize: '0.78rem', color: '#6b7280', whiteSpace: 'nowrap' }}>Critical after:</label>
                        <input
                          type="number" min={0}
                          value={edit.threshold_critical_days ?? ''}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [rule.id]: { ...prev[rule.id], threshold_critical_days: e.target.value } }))}
                          style={{ width: 60, border: '1px solid #d1d5db', borderRadius: '0.4rem', padding: '3px 8px', fontSize: '0.85rem' }}
                        />
                      </>
                    )}
                    {rule.rule_code === 'WARRANTY_EXPIRY' && (
                      <>
                        <label style={{ fontSize: '0.78rem', color: '#6b7280', whiteSpace: 'nowrap' }}>Urgent (days before expiry):</label>
                        <input
                          type="number" min={0}
                          value={edit.threshold_urgent_days ?? ''}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [rule.id]: { ...prev[rule.id], threshold_urgent_days: e.target.value } }))}
                          style={{ width: 60, border: '1px solid #d1d5db', borderRadius: '0.4rem', padding: '3px 8px', fontSize: '0.85rem' }}
                        />
                      </>
                    )}
                    <button
                      onClick={() => handleSaveThresholds(rule)}
                      disabled={saving[rule.id]}
                      style={{ padding: '3px 12px', borderRadius: '0.4rem', fontSize: '0.78rem', fontWeight: 600, border: 'none', background: 'var(--cadet-dark)', color: '#fff', cursor: 'pointer' }}
                    >
                      Save
                    </button>
                  </div>
                )}

                <button
                  onClick={() => handleToggle(rule)}
                  disabled={saving[rule.id]}
                  style={{
                    padding: '5px 18px', borderRadius: '9999px', fontSize: '0.82rem', fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                    background: edit.enabled ? '#dcfce7' : '#fee2e2',
                    color: edit.enabled ? '#166534' : '#991b1b',
                  }}
                >
                  {edit.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
