import { useState, useEffect } from 'react'
import { listSegments, createSegment, updateSegment, listRules, createRule, deleteRule } from '../../api/atp.js'
import { listRegions } from '../../api/network_design.js'
import Modal from '../../components/Modal.jsx'

export default function ATPConfigPage({ role }) {
  const isAdmin = role === 'admin'

  // Segments state
  const [segments, setSegments] = useState([])
  const [loadingS, setLoadingS] = useState(true)
  const [errorS, setErrorS] = useState(null)
  const [showSegModal, setShowSegModal] = useState(false)
  const [editSeg, setEditSeg] = useState(null)
  const [segForm, setSegForm] = useState({ segment_code: '', segment_name: '', priority: '' })
  const [segSaving, setSegSaving] = useState(false)
  const [segError, setSegError] = useState(null)

  // Rules state
  const [rules, setRules] = useState([])
  const [loadingR, setLoadingR] = useState(true)
  const [errorR, setErrorR] = useState(null)
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [ruleForm, setRuleForm] = useState({ region_id: '', segment_id: '', rule_key: '', rule_value: '', description: '' })
  const [ruleSaving, setRuleSaving] = useState(false)
  const [ruleError, setRuleError] = useState(null)

  // Regions for dropdown
  const [regions, setRegions] = useState([])

  async function loadSegments() {
    setLoadingS(true); setErrorS(null)
    try {
      const res = await listSegments()
      setSegments(Array.isArray(res.data) ? res.data : [])
    } catch { setErrorS('Failed to load customer segments') }
    finally { setLoadingS(false) }
  }

  async function loadRules() {
    setLoadingR(true); setErrorR(null)
    try {
      const res = await listRules()
      setRules(Array.isArray(res.data) ? res.data : [])
    } catch { setErrorR('Failed to load ATP rules') }
    finally { setLoadingR(false) }
  }

  useEffect(() => {
    loadSegments()
    loadRules()
    listRegions().then(r => setRegions(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }, [])

  // Segment handlers
  function openAddSegment() {
    setEditSeg(null)
    setSegForm({ segment_code: '', segment_name: '', priority: '' })
    setSegError(null)
    setShowSegModal(true)
  }

  function openEditSegment(s) {
    setEditSeg(s)
    setSegForm({ segment_code: s.segment_code, segment_name: s.segment_name, priority: String(s.priority) })
    setSegError(null)
    setShowSegModal(true)
  }

  async function handleSegSubmit(e) {
    e.preventDefault()
    if (!segForm.segment_code || !segForm.segment_name) { setSegError('Code and name are required'); return }
    setSegSaving(true); setSegError(null)
    try {
      const payload = {
        segment_code: segForm.segment_code,
        segment_name: segForm.segment_name,
        priority: Number(segForm.priority) || 0,
      }
      if (editSeg) {
        await updateSegment(editSeg.id, payload)
      } else {
        await createSegment(payload)
      }
      setShowSegModal(false)
      await loadSegments()
    } catch (err) {
      setSegError(err.response?.data?.detail || 'Save failed')
    } finally { setSegSaving(false) }
  }

  // Rule handlers
  function openAddRule() {
    setRuleForm({ region_id: '', segment_id: '', rule_key: '', rule_value: '', description: '' })
    setRuleError(null)
    setShowRuleModal(true)
  }

  async function handleRuleSubmit(e) {
    e.preventDefault()
    if (!ruleForm.rule_key || !ruleForm.rule_value) { setRuleError('Rule key and value are required'); return }
    setRuleSaving(true); setRuleError(null)
    try {
      const payload = {
        region_id: ruleForm.region_id ? Number(ruleForm.region_id) : null,
        segment_id: ruleForm.segment_id ? Number(ruleForm.segment_id) : null,
        rule_key: ruleForm.rule_key,
        rule_value: ruleForm.rule_value,
        description: ruleForm.description || null,
      }
      await createRule(payload)
      setShowRuleModal(false)
      await loadRules()
    } catch (err) {
      setRuleError(err.response?.data?.detail || 'Save failed')
    } finally { setRuleSaving(false) }
  }

  async function handleDeleteRule(id) {
    if (!window.confirm('Delete this ATP rule?')) return
    try {
      await deleteRule(id)
      await loadRules()
    } catch (err) { alert(err.response?.data?.detail || 'Delete failed') }
  }

  // Helpers
  function regionName(id) {
    const r = regions.find(r => r.id === id)
    return r ? r.region_name : '—'
  }
  function segmentName(id) {
    const s = segments.find(s => s.id === id)
    return s ? s.segment_name : '—'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* ── Customer Segments ──────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', margin: 0 }}>Customer Segments</h3>
          {isAdmin && (
            <button
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
              style={{ backgroundColor: 'var(--cadet-dark)' }}
              onClick={openAddSegment}
            >+ Add Segment</button>
          )}
        </div>
        {errorS && <div style={{ color: 'var(--alert)', fontSize: 'var(--fs-body-sm)', marginBottom: 8 }}>{errorS}</div>}
        <div className="e2o-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="e2o-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th style={{ textAlign: 'right' }}>Priority</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loadingS ? (
                <tr><td colSpan={isAdmin ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>Loading...</td></tr>
              ) : segments.length === 0 ? (
                <tr><td colSpan={isAdmin ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>No segments defined yet.</td></tr>
              ) : segments.map(s => (
                <tr key={s.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)' }}>{s.segment_code}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{s.segment_name}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--cadet-dark)', fontWeight: 'var(--fw-semibold)' }}>{s.priority}</td>
                  {isAdmin && (
                    <td>
                      <button onClick={() => openEditSegment(s)} style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', background: '#fff', cursor: 'pointer', fontSize: 'var(--fs-body-sm)' }}>Edit</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ATP Rules ──────────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', margin: 0 }}>ATP Rules</h3>
          {isAdmin && (
            <button
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
              style={{ backgroundColor: 'var(--cadet-dark)' }}
              onClick={openAddRule}
            >+ Add Rule</button>
          )}
        </div>
        {errorR && <div style={{ color: 'var(--alert)', fontSize: 'var(--fs-body-sm)', marginBottom: 8 }}>{errorR}</div>}
        <div className="e2o-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="e2o-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Region</th>
                <th>Segment</th>
                <th>Rule Key</th>
                <th>Rule Value</th>
                <th>Description</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loadingR ? (
                <tr><td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>Loading...</td></tr>
              ) : rules.length === 0 ? (
                <tr><td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>No ATP rules defined yet.</td></tr>
              ) : rules.map(r => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--fg-2)' }}>{r.region_id ? regionName(r.region_id) : <span style={{ color: 'var(--fg-muted)' }}>Global</span>}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{r.segment_id ? segmentName(r.segment_id) : <span style={{ color: 'var(--fg-muted)' }}>All</span>}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)' }}>{r.rule_key}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--cadet-dark)' }}>{r.rule_value}</td>
                  <td style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-body-sm)' }}>{r.description || '—'}</td>
                  {isAdmin && (
                    <td>
                      <button onClick={() => handleDeleteRule(r.id)} style={{ border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', padding: '4px 10px', background: '#fff', cursor: 'pointer', fontSize: 'var(--fs-body-sm)', color: '#dc2626' }}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add/Edit Segment Modal ─────────────────────────────────────────── */}
      {showSegModal && (
        <Modal title={editSeg ? 'Edit Segment' : 'Add Customer Segment'} onClose={() => setShowSegModal(false)}>
          <form onSubmit={handleSegSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">CODE *</label>
              <input
                value={segForm.segment_code}
                onChange={e => setSegForm(p => ({ ...p, segment_code: e.target.value }))}
                required
                disabled={!!editSeg}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="e.g. GOLD"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">NAME *</label>
              <input
                value={segForm.segment_name}
                onChange={e => setSegForm(p => ({ ...p, segment_name: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="e.g. Gold Tier"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">PRIORITY</label>
              <input
                type="number"
                min="0"
                value={segForm.priority}
                onChange={e => setSegForm(p => ({ ...p, priority: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="Lower = higher priority"
              />
            </div>
            {segError && <p className="text-red-600 text-sm">{segError}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setShowSegModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={segSaving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition" style={{ backgroundColor: 'var(--cadet-dark)' }}>
                {segSaving ? 'Saving...' : editSeg ? 'Save Changes' : 'Add Segment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Add Rule Modal ─────────────────────────────────────────────────── */}
      {showRuleModal && (
        <Modal title="Add ATP Rule" onClose={() => setShowRuleModal(false)}>
          <form onSubmit={handleRuleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">REGION</label>
                <select
                  value={ruleForm.region_id}
                  onChange={e => setRuleForm(p => ({ ...p, region_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">-- Global --</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.region_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">SEGMENT</label>
                <select
                  value={ruleForm.segment_id}
                  onChange={e => setRuleForm(p => ({ ...p, segment_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">-- All Segments --</option>
                  {segments.map(s => <option key={s.id} value={s.id}>{s.segment_name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">RULE KEY *</label>
              <input
                value={ruleForm.rule_key}
                onChange={e => setRuleForm(p => ({ ...p, rule_key: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="e.g. max_lead_time_days"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">RULE VALUE *</label>
              <input
                value={ruleForm.rule_value}
                onChange={e => setRuleForm(p => ({ ...p, rule_value: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="e.g. 14"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">DESCRIPTION</label>
              <input
                value={ruleForm.description}
                onChange={e => setRuleForm(p => ({ ...p, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="Optional description"
              />
            </div>
            {ruleError && <p className="text-red-600 text-sm">{ruleError}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setShowRuleModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={ruleSaving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition" style={{ backgroundColor: 'var(--cadet-dark)' }}>
                {ruleSaving ? 'Saving...' : 'Add Rule'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
