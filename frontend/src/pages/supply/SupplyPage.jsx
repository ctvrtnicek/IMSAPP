import { useState, useEffect } from 'react'
import { listTargets, createTarget, updateTarget, deleteTarget, getReplenishment, createReposition, suggestSource, createPurchaseRequisition, getPurchasePrediction } from '../../api/supply_planning.js'
import { getProducts, getLocations } from '../../api/masterdata.js'
import Modal from '../../components/Modal.jsx'

const TABS = [
  { id: 'targets',       label: 'Safety Stock Targets' },
  { id: 'replenishment', label: 'Replenishment Planner' },
  { id: 'prediction',    label: 'Purchase Prediction' },
]

const URGENCY_STYLE = {
  Urgent:  { bg: '#fee2e2', color: '#991b1b' },
  Soon:    { bg: '#fef9c3', color: '#854d0e' },
  Planned: { bg: '#dcfce7', color: '#166534' },
}

function UrgencyBadge({ urgency }) {
  const s = URGENCY_STYLE[urgency] || { bg: '#f3f4f6', color: '#374151' }
  return <span className="e2o-pill" style={{ background: s.bg, color: s.color }}>{urgency}</span>
}

function fmtPeriod(d) {
  if (!d) return '—'
  const [y, m] = d.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m, 10) - 1]} ${y}`
}

function SubTabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-1)' }}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={`e2o-tab${active === t.id ? ' active' : ''}`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

const STATUS_STYLE = {
  OK:       { bg: '#dcfce7', color: '#166534' },
  Reorder:  { bg: '#fef9c3', color: '#854d0e' },
  Critical: { bg: '#fee2e2', color: '#991b1b' },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || { bg: '#f3f4f6', color: '#374151' }
  return <span className="e2o-pill" style={{ background: s.bg, color: s.color }}>{status}</span>
}

export default function SupplyPage({ role, onNavigate }) {
  const [tab, setTab] = useState('targets')
  const [products, setProducts] = useState([])
  const [locations, setLocations] = useState([])

  // Targets state
  const [targets, setTargets] = useState([])
  const [loadingT, setLoadingT] = useState(true)
  const [errorT, setErrorT] = useState(null)
  const [filterLocT, setFilterLocT] = useState('')

  // Replenishment state
  const [replan, setReplan] = useState([])
  const [loadingR, setLoadingR] = useState(false)
  const [errorR, setErrorR] = useState(null)
  const [filterLocR, setFilterLocR] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Target modal
  const [showTargetModal, setShowTargetModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [tForm, setTForm] = useState({ product_id: '', location_id: '', min_qty: '', reorder_point: '', reorder_qty: '', notes: '' })
  const [tError, setTError] = useState(null)
  const [tSaving, setTSaving] = useState(false)

  // Reposition modal
  const [showRepoModal, setShowRepoModal] = useState(false)
  const [repoRow, setRepoRow] = useState(null)
  const [rForm, setRForm] = useState({ from_location_id: '', to_location_id: '', quantity: '' })
  const [rError, setRError] = useState(null)
  const [rSaving, setRSaving] = useState(false)
  const [rSuccess, setRSuccess] = useState(null)
  const [sourceCandidates, setSourceCandidates] = useState([])
  const [sourceLoading, setSourceLoading] = useState(false)

  // Purchase Prediction state
  const [prediction, setPrediction] = useState([])
  const [loadingPred, setLoadingPred] = useState(false)
  const [errorPred, setErrorPred] = useState(null)
  const [filterLocPred, setFilterLocPred] = useState('')

  // Purchase Requisition modal
  const [showPoModal, setShowPoModal] = useState(false)
  const [poRow, setPoRow] = useState(null)
  const [poQty, setPoQty] = useState('')
  const [poError, setPoError] = useState(null)
  const [poSaving, setPoSaving] = useState(false)
  const [poSuccess, setPoSuccess] = useState(null)   // { message, po_number, po_id }


  const canEdit = ['admin', 'supply_planner', 'demand_planner'].includes(role)

  async function loadMaster() {
    try {
      const [pr, lo] = await Promise.all([getProducts(), getLocations()])
      const prArr = Array.isArray(pr.data) ? pr.data : (pr.data?.data || [])
      const loArr = Array.isArray(lo.data) ? lo.data : (lo.data?.data || [])
      setProducts(prArr.filter((p) => p.active))
      setLocations(loArr.filter((l) => l.active))
    } catch {}
  }

  async function loadTargets() {
    setLoadingT(true); setErrorT(null)
    try {
      const params = {}
      if (filterLocT) params.location_id = filterLocT
      const res = await listTargets(params)
      setTargets(Array.isArray(res.data) ? res.data : [])
    } catch { setErrorT('Failed to load targets') }
    finally { setLoadingT(false) }
  }

  async function loadReplan() {
    setLoadingR(true); setErrorR(null)
    try {
      const params = {}
      if (filterLocR) params.location_id = filterLocR
      if (filterStatus) params.status_filter = filterStatus
      const res = await getReplenishment(params)
      setReplan(Array.isArray(res.data) ? res.data : [])
    } catch { setErrorR('Failed to load replenishment plan') }
    finally { setLoadingR(false) }
  }

  async function loadPrediction() {
    setLoadingPred(true); setErrorPred(null)
    try {
      const params = {}
      if (filterLocPred) params.location_id = filterLocPred
      const res = await getPurchasePrediction(params)
      setPrediction(Array.isArray(res.data) ? res.data : [])
    } catch { setErrorPred('Failed to load purchase prediction') }
    finally { setLoadingPred(false) }
  }

  useEffect(() => { loadMaster() }, [])
  useEffect(() => { if (tab === 'targets') loadTargets() }, [tab, filterLocT])
  useEffect(() => { if (tab === 'replenishment') loadReplan() }, [tab, filterLocR, filterStatus])
  useEffect(() => { if (tab === 'prediction') loadPrediction() }, [tab, filterLocPred])

  function openNewTarget() {
    setEditTarget(null)
    setTForm({ product_id: '', location_id: '', min_qty: '0', reorder_point: '0', reorder_qty: '0', notes: '' })
    setTError(null)
    setShowTargetModal(true)
  }

  function openEditTarget(t) {
    setEditTarget(t)
    setTForm({
      product_id: String(t.product_id),
      location_id: String(t.location_id),
      min_qty: String(t.min_qty),
      reorder_point: String(t.reorder_point),
      reorder_qty: String(t.reorder_qty),
      notes: t.notes || '',
    })
    setTError(null)
    setShowTargetModal(true)
  }

  async function handleTargetSubmit(e) {
    e.preventDefault()
    if (!tForm.product_id || !tForm.location_id) { setTError('Product and location are required'); return }
    setTSaving(true); setTError(null)
    try {
      const payload = {
        product_id: Number(tForm.product_id),
        location_id: Number(tForm.location_id),
        min_qty: Number(tForm.min_qty) || 0,
        reorder_point: Number(tForm.reorder_point) || 0,
        reorder_qty: Number(tForm.reorder_qty) || 0,
        notes: tForm.notes || null,
      }
      if (editTarget) {
        await updateTarget(editTarget.id, payload)
      } else {
        await createTarget(payload)
      }
      setShowTargetModal(false)
      await loadTargets()
    } catch (err) {
      setTError(err.response?.data?.detail || 'Save failed')
    } finally { setTSaving(false) }
  }

  async function handleDeleteTarget(id) {
    if (!window.confirm('Delete this safety stock target?')) return
    try {
      await deleteTarget(id)
      await loadTargets()
    } catch (err) { alert(err.response?.data?.detail || 'Delete failed') }
  }

  async function openRepoModal(row) {
    setRepoRow(row)
    setRForm({ from_location_id: '', to_location_id: String(row.location_id), quantity: String(row.reorder_qty || '') })
    setRError(null)
    setRSuccess(null)
    setSourceCandidates([])
    setShowRepoModal(true)

    // Fetch source suggestions
    setSourceLoading(true)
    try {
      const res = await suggestSource({
        product_id: row.product_id,
        to_location_id: row.location_id,
        quantity: row.reorder_qty || 1,
      })
      const candidates = Array.isArray(res.data) ? res.data : []
      setSourceCandidates(candidates)
      // Pre-select best candidate
      if (candidates.length > 0) {
        setRForm((prev) => ({ ...prev, from_location_id: String(candidates[0].location_id) }))
      }
    } catch {
      // non-fatal — planner can still pick manually
    } finally {
      setSourceLoading(false)
    }
  }

  async function handleReposition(e) {
    e.preventDefault()
    if (!rForm.to_location_id) { setRError('Destination location is required'); return }
    if (!rForm.quantity || Number(rForm.quantity) < 1) { setRError('Quantity must be at least 1'); return }
    setRSaving(true); setRError(null)
    try {
      const res = await createReposition({
        product_id: repoRow.product_id,
        from_location_id: Number(rForm.from_location_id),
        to_location_id: Number(rForm.to_location_id),
        quantity: Number(rForm.quantity),
      })
      setRSuccess({ message: res.data.message, order_number: res.data.order_number })
      await loadReplan()
    } catch (err) {
      setRError(err.response?.data?.detail || 'Reposition failed')
    } finally { setRSaving(false) }
  }

  function openPoModal(row) {
    setPoRow(row)
    setPoQty(String(row.reorder_qty || 1))
    setPoError(null)
    setPoSuccess(null)
    setShowPoModal(true)
  }

  async function handleCreatePO(e) {
    e.preventDefault()
    if (!poQty || Number(poQty) < 1) { setPoError('Quantity must be at least 1'); return }
    setPoSaving(true); setPoError(null)
    try {
      const res = await createPurchaseRequisition({
        product_id: poRow.product_id,
        location_id: poRow.location_id,
        quantity: Number(poQty),
      })
      setPoSuccess({ message: res.data.message, po_number: res.data.po_number, po_id: res.data.po_id })
      await loadReplan()
    } catch (err) {
      setPoError(err.response?.data?.detail || 'Failed to create Purchase Requisition')
    } finally { setPoSaving(false) }
  }

  // Summary counts for replenishment
  const critCount  = replan.filter((r) => r.status === 'Critical').length
  const reordCount = replan.filter((r) => r.status === 'Reorder').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SubTabBar tabs={TABS} active={tab} onChange={setTab} />

      {/* ---- SAFETY STOCK TARGETS ---- */}
      {tab === 'targets' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <select
              value={filterLocT}
              onChange={(e) => setFilterLocT(e.target.value)}
              style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-body-sm)', background: '#fff' }}
            >
              <option value="">All Locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
            </select>
            {canEdit && (
              <button
                onClick={openNewTarget}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: 'var(--cadet-dark)' }}
              >+ Add Target</button>
            )}
          </div>

          {errorT && <div style={{ color: 'var(--alert)', fontSize: 'var(--fs-body-sm)' }}>{errorT}</div>}

          <div className="e2o-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="e2o-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Location</th>
                  <th style={{ textAlign: 'right' }}>Min Qty</th>
                  <th style={{ textAlign: 'right' }}>Reorder Point</th>
                  <th style={{ textAlign: 'right' }}>Reorder Qty</th>
                  <th>Notes</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {loadingT ? (
                  <tr><td colSpan={canEdit ? 7 : 6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>Loading…</td></tr>
                ) : targets.length === 0 ? (
                  <tr><td colSpan={canEdit ? 7 : 6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>No targets defined yet.</td></tr>
                ) : targets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 'var(--fw-semibold)' }}>{t.product_code}</div>
                      <div style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)' }}>{t.product_name}</div>
                    </td>
                    <td style={{ color: 'var(--fg-2)' }}>{t.location_code}<span style={{ color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)' }}> — {t.location_name}</span></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{t.min_qty}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{t.reorder_point}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--cadet-dark)', fontWeight: 'var(--fw-semibold)' }}>{t.reorder_qty}</td>
                    <td style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-body-sm)' }}>{t.notes || '—'}</td>
                    {canEdit && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEditTarget(t)} style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', background: '#fff', cursor: 'pointer', fontSize: 'var(--fs-body-sm)' }}>Edit</button>
                          <button onClick={() => handleDeleteTarget(t.id)} style={{ border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', padding: '4px 10px', background: '#fff', cursor: 'pointer', fontSize: 'var(--fs-body-sm)', color: '#dc2626' }}>Delete</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ---- REPLENISHMENT PLANNER ---- */}
      {tab === 'replenishment' && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={filterLocR}
              onChange={(e) => setFilterLocR(e.target.value)}
              style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-body-sm)', background: '#fff' }}
            >
              <option value="">All Locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-body-sm)', background: '#fff' }}
            >
              <option value="">All Statuses</option>
              <option value="Critical">Critical</option>
              <option value="Reorder">Reorder</option>
              <option value="OK">OK</option>
            </select>
            <button
              onClick={loadReplan}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
              style={{ backgroundColor: 'var(--cadet-dark)' }}
            >Refresh</button>
          </div>

          {/* KPI summary */}
          {replan.length > 0 && (
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Critical',       value: critCount,              color: '#991b1b', bg: '#fee2e2' },
                { label: 'Reorder',        value: reordCount,             color: '#854d0e', bg: '#fef9c3' },
                { label: 'OK',             value: replan.length - critCount - reordCount, color: '#166534', bg: '#dcfce7' },
              ].map((c) => (
                <div key={c.label} className="e2o-card" style={{ padding: '0.875rem 1.25rem', minWidth: 120, background: c.bg, border: 'none' }}>
                  <div style={{ fontSize: 'var(--fs-label)', color: c.color, marginBottom: 2 }}>{c.label}</div>
                  <div style={{ fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-bold)', color: c.color }}>{c.value}</div>
                </div>
              ))}
            </div>
          )}

          {errorR && <div style={{ color: 'var(--alert)', fontSize: 'var(--fs-body-sm)' }}>{errorR}</div>}

          <div className="e2o-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="e2o-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Location</th>
                  <th style={{ textAlign: 'right' }}>Total Stock</th>
                  <th style={{ textAlign: 'right' }}>Available</th>
                  <th style={{ textAlign: 'right' }}>{fmtPeriod(replan[0]?.forecasts?.[0]?.period_date) || 'M+1'}</th>
                  <th style={{ textAlign: 'right' }}>{fmtPeriod(replan[0]?.forecasts?.[1]?.period_date) || 'M+2'}</th>
                  <th style={{ textAlign: 'right' }}>{fmtPeriod(replan[0]?.forecasts?.[2]?.period_date) || 'M+3'}</th>
                  <th style={{ textAlign: 'right' }}>Reorder Pt</th>
                  <th style={{ textAlign: 'right' }}>Min Qty</th>
                  <th style={{ textAlign: 'right' }}>Suggest Qty</th>
                  <th>Status</th>
                  <th>Pending Orders</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {loadingR ? (
                  <tr><td colSpan={canEdit ? 13 : 12} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>Loading…</td></tr>
                ) : replan.length === 0 ? (
                  <tr><td colSpan={canEdit ? 13 : 12} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>
                    No data — add safety stock targets first.
                  </td></tr>
                ) : replan.map((row) => (
                  <tr key={row.target_id} style={{ background: row.status === 'Critical' ? '#fff5f5' : row.status === 'Reorder' ? '#fffbeb' : 'transparent' }}>
                    <td>
                      <div style={{ fontWeight: 'var(--fw-semibold)' }}>{row.product_code}</div>
                      <div style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)' }}>{row.product_name}</div>
                    </td>
                    <td style={{ color: 'var(--fg-2)' }}>{row.location_code}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)', color: row.status === 'Critical' ? '#991b1b' : row.status === 'Reorder' ? '#854d0e' : 'var(--fg-1)' }}>
                      {row.stock_qty}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{row.available_qty ?? '—'}</td>
                    {[0, 1, 2].map((idx) => {
                      const fc = row.forecasts?.[idx]
                      const isHigh = fc?.demand_qty != null && fc.demand_qty > (row.available_qty ?? 0)
                      return (
                        <td key={idx} style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: isHigh ? '#dc6803' : 'var(--fg-3)' }}>
                          {fc?.demand_qty ?? '—'}
                        </td>
                      )
                    })}
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{row.reorder_point}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{row.min_qty}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--cadet-dark)', fontWeight: 'var(--fw-semibold)' }}>
                      {row.status !== 'OK' ? Math.max(0, row.reorder_qty) : '—'}
                    </td>
                    <td><StatusBadge status={row.status} /></td>
                    <td style={{ fontSize: 'var(--fs-body-sm)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {(row.pending_pos || []).map((po) => (
                          <button
                            key={po.id}
                            onClick={() => onNavigate?.('purchasing', { poId: po.id })}
                            style={{ color: 'var(--cadet-dark)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', textAlign: 'left' }}
                            title={`PO status: ${po.status}`}
                          >
                            {po.po_number}
                          </button>
                        ))}
                        {(row.pending_distributions || []).map((do_) => (
                          <button
                            key={do_.id}
                            onClick={() => onNavigate?.('dist-orders')}
                            style={{ color: '#2563eb', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', textAlign: 'left' }}
                            title={`Distribution Order status: ${do_.status}`}
                          >
                            {do_.order_number}
                          </button>
                        ))}
                        {!(row.pending_pos?.length) && !(row.pending_distributions?.length) && (
                          <span style={{ color: 'var(--fg-muted)' }}>—</span>
                        )}
                      </div>
                    </td>
                    {canEdit && (
                      <td>
                        {row.status !== 'OK' && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              onClick={() => openRepoModal(row)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold text-white transition"
                              style={{ backgroundColor: 'var(--cadet-dark)' }}
                            >Reposition</button>
                            <button
                              onClick={() => openPoModal(row)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold transition"
                              style={{ backgroundColor: '#fff', border: '1px solid var(--cadet-dark)', color: 'var(--cadet-dark)' }}
                            >Create PO</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ---- PURCHASE PREDICTION ---- */}
      {tab === 'prediction' && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filterLocPred} onChange={(e) => setFilterLocPred(e.target.value)}
              style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-body-sm)', background: '#fff' }}>
              <option value="">All Locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
            </select>
            <button onClick={loadPrediction} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition" style={{ backgroundColor: 'var(--cadet-dark)' }}>Refresh</button>
          </div>

          {/* KPI cards */}
          {prediction.length > 0 && (
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Urgent',  value: prediction.filter(r => r.urgency === 'Urgent').length,  ...URGENCY_STYLE.Urgent },
                { label: 'Soon',    value: prediction.filter(r => r.urgency === 'Soon').length,    ...URGENCY_STYLE.Soon },
                { label: 'Planned', value: prediction.filter(r => r.urgency === 'Planned').length, ...URGENCY_STYLE.Planned },
              ].map(c => (
                <div key={c.label} className="e2o-card" style={{ padding: '0.875rem 1.25rem', minWidth: 120, background: c.bg, border: 'none' }}>
                  <div style={{ fontSize: 'var(--fs-label)', color: c.color, marginBottom: 2 }}>{c.label}</div>
                  <div style={{ fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-bold)', color: c.color }}>{c.value}</div>
                </div>
              ))}
              <div className="e2o-card" style={{ padding: '0.875rem 1.25rem', minWidth: 120 }}>
                <div style={{ fontSize: 'var(--fs-label)', color: 'var(--fg-3)', marginBottom: 2 }}>No Supplier Linked</div>
                <div style={{ fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-2)' }}>
                  {prediction.filter(r => !r.supplier_id).length}
                </div>
              </div>
            </div>
          )}

          {errorPred && <div style={{ color: 'var(--alert)', fontSize: 'var(--fs-body-sm)' }}>{errorPred}</div>}

          {prediction.length === 0 && !loadingPred && !errorPred && (
            <div className="e2o-card" style={{ padding: '1.5rem', color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)' }}>
              No future purchase recommendations. Add demand signals in Demand Planning, and link suppliers to products in Admin → Products.
            </div>
          )}

          {(loadingPred || prediction.length > 0) && (
            <div className="e2o-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="e2o-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Location</th>
                    <th>Demand Month</th>
                    <th style={{ textAlign: 'right' }}>Shortage</th>
                    <th>Best Supplier</th>
                    <th style={{ textAlign: 'right' }}>Lead Time</th>
                    <th>Order By</th>
                    <th>Urgency</th>
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {loadingPred ? (
                    <tr><td colSpan={canEdit ? 9 : 8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>Loading…</td></tr>
                  ) : prediction.map((row) => (
                    <tr key={`${row.product_id}-${row.location_id}-${row.period_date}`}
                      style={{ background: row.urgency === 'Urgent' ? '#fff5f5' : row.urgency === 'Soon' ? '#fffbeb' : 'transparent' }}>
                      <td>
                        <div style={{ fontWeight: 'var(--fw-semibold)' }}>{row.product_code}</div>
                        <div style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)' }}>{row.product_name}</div>
                      </td>
                      <td style={{ color: 'var(--fg-2)' }}>{row.location_code}</td>
                      <td style={{ fontWeight: 'var(--fw-semibold)' }}>{fmtPeriod(row.period_date)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#991b1b', fontWeight: 'var(--fw-semibold)' }}>
                        {row.shortage_qty}
                      </td>
                      <td>
                        {row.supplier_name
                          ? <><div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-body-sm)' }}>{row.supplier_code}</div>
                              <div style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)' }}>{row.supplier_name}</div></>
                          : <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)' }}>No supplier linked</span>
                        }
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
                        {row.lead_time_days != null ? `${row.lead_time_days}d` : '—'}
                      </td>
                      <td>
                        <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-body-sm)', color: row.urgency === 'Urgent' ? '#991b1b' : row.urgency === 'Soon' ? '#854d0e' : 'var(--fg-1)' }}>
                          {row.order_by_date}
                        </div>
                        <div style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-muted)' }}>
                          {row.days_until_order > 0
                            ? `${row.days_until_order}d remaining`
                            : row.days_until_order === 0
                            ? 'Order today'
                            : `${Math.abs(row.days_until_order)}d overdue`}
                        </div>
                      </td>
                      <td><UrgencyBadge urgency={row.urgency} /></td>
                      {canEdit && (
                        <td>
                          <button
                            onClick={() => openPoModal({
                              product_id: row.product_id,
                              product_code: row.product_code,
                              product_name: row.product_name,
                              location_id: row.location_id,
                              location_code: row.location_code,
                              location_name: row.location_name,
                              reorder_qty: row.shortage_qty,
                              status: 'Critical',
                            })}
                            className="px-3 py-1 rounded-lg text-xs font-semibold transition"
                            style={{ backgroundColor: '#fff', border: '1px solid var(--cadet-dark)', color: 'var(--cadet-dark)' }}
                          >Create PO</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ---- Target Add/Edit Modal ---- */}
      {showTargetModal && (
        <Modal title={editTarget ? 'Edit Safety Stock Target' : 'Add Safety Stock Target'} onClose={() => setShowTargetModal(false)}>
          <form onSubmit={handleTargetSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Product *</label>
              <select
                value={tForm.product_id}
                onChange={(e) => setTForm((p) => ({ ...p, product_id: e.target.value }))}
                required
                disabled={!!editTarget}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Location *</label>
              <select
                value={tForm.location_id}
                onChange={(e) => setTForm((p) => ({ ...p, location_id: e.target.value }))}
                required
                disabled={!!editTarget}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select location…</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Min Qty</label>
                <input type="number" min="0" value={tForm.min_qty} onChange={(e) => setTForm((p) => ({ ...p, min_qty: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reorder Point</label>
                <input type="number" min="0" value={tForm.reorder_point} onChange={(e) => setTForm((p) => ({ ...p, reorder_point: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reorder Qty</label>
                <input type="number" min="0" value={tForm.reorder_qty} onChange={(e) => setTForm((p) => ({ ...p, reorder_qty: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <textarea value={tForm.notes} onChange={(e) => setTForm((p) => ({ ...p, notes: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-y" />
            </div>
            {tError && <p className="text-red-600 text-sm">{tError}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setShowTargetModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={tSaving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition" style={{ backgroundColor: 'var(--cadet-dark)' }}>
                {tSaving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Target'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ---- Purchase Requisition Modal ---- */}
      {showPoModal && poRow && (
        <Modal title="Create Purchase Requisition" onClose={() => setShowPoModal(false)}>
          {poSuccess ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 8, padding: '1rem', color: '#166534', fontSize: 'var(--fs-body-sm)' }}>
                {poSuccess.message}
              </div>
              <div className="flex justify-end">
                <button onClick={() => setShowPoModal(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition" style={{ backgroundColor: 'var(--cadet-dark)' }}>Done</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreatePO} className="flex flex-col gap-4">
              <div style={{ background: '#f8fafc', border: '1px solid var(--border-1)', borderRadius: 8, padding: '0.875rem 1rem', fontSize: 'var(--fs-body-sm)' }}>
                <strong>{poRow.product_code}</strong> — {poRow.product_name}<br />
                <span style={{ color: 'var(--fg-3)' }}>Shortage at <strong>{poRow.location_code}</strong> · </span>
                <span style={{ color: 'var(--fg-3)' }}>Current stock: </span>
                <strong style={{ color: poRow.status === 'Critical' ? '#991b1b' : '#854d0e' }}>{poRow.stock_qty}</strong>
                <span style={{ color: 'var(--fg-3)' }}> · reorder point: {poRow.reorder_point}</span>
              </div>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.75rem 1rem', fontSize: 'var(--fs-body-sm)', color: '#78350f' }}>
                A Draft PO will be created using the supplier with the shortest lead time linked to this product.
                Manage product–supplier associations in <strong>Admin → Products</strong>.
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={poQty}
                  onChange={(e) => setPoQty(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              {poError && <p className="text-red-600 text-sm">{poError}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setShowPoModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={poSaving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition" style={{ backgroundColor: 'var(--cadet-dark)' }}>
                  {poSaving ? 'Creating…' : 'Create Draft PO'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* ---- Reposition Modal ---- */}
      {showRepoModal && repoRow && (
        <Modal title="Create Distribution Order" onClose={() => setShowRepoModal(false)}>
          {rSuccess ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 8, padding: '1rem', color: '#166534', fontSize: 'var(--fs-body-sm)' }}>
                {rSuccess.message}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowRepoModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 transition">Close</button>
                {onNavigate && (
                  <button
                    onClick={() => { setShowRepoModal(false); onNavigate('dist-orders') }}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                    style={{ backgroundColor: 'var(--cadet-dark)' }}
                  >
                    Open {rSuccess.order_number} →
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleReposition} className="flex flex-col gap-4">
              {/* Context summary */}
              <div style={{ background: '#f8fafc', border: '1px solid var(--border-1)', borderRadius: 8, padding: '0.875rem 1rem', fontSize: 'var(--fs-body-sm)' }}>
                <strong>{repoRow.product_code}</strong> — {repoRow.product_name}<br />
                <span style={{ color: 'var(--fg-3)' }}>Stock at <strong>{repoRow.location_code}</strong>: </span>
                <strong style={{ color: repoRow.status === 'Critical' ? '#991b1b' : '#854d0e' }}>{repoRow.stock_qty}</strong>
                <span style={{ color: 'var(--fg-3)' }}> · reorder point: {repoRow.reorder_point} · reorder qty: {repoRow.reorder_qty}</span>
              </div>

              {/* Source location — driven by suggest-source */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">From Location *
                  {sourceLoading && <span style={{ fontWeight: 'normal', color: 'var(--fg-muted)', marginLeft: 6 }}>finding best source…</span>}
                  {!sourceLoading && sourceCandidates.length > 0 && String(rForm.from_location_id) === String(sourceCandidates[0].location_id) && (
                    <span style={{ fontWeight: 'normal', color: '#166534', marginLeft: 6 }}>
                      ✓ suggested
                      {sourceCandidates[0].lead_time_days != null
                        ? ` · ${sourceCandidates[0].lead_time_days}d lead time`
                        : ' · no lead time data'}
                    </span>
                  )}
                </label>
                <select
                  value={rForm.from_location_id}
                  onChange={(e) => setRForm((p) => ({ ...p, from_location_id: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">Select source location…</option>
                  {sourceCandidates.length > 0 ? (
                    <>
                      <optgroup label="Suggested (sufficient stock, sorted by lead time)">
                        {sourceCandidates.map((c) => (
                          <option key={c.location_id} value={c.location_id}>
                            {c.location_code} — {c.location_name}
                            {' '}({c.stock_qty} in stock
                            {c.lead_time_days != null ? `, ${c.lead_time_days}d` : ', no lead time'})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Other locations">
                        {locations
                          .filter((l) => String(l.id) !== String(repoRow.location_id) && !sourceCandidates.find((c) => c.location_id === l.id))
                          .map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name} (insufficient stock)</option>)
                        }
                      </optgroup>
                    </>
                  ) : (
                    locations
                      .filter((l) => String(l.id) !== String(repoRow.location_id))
                      .map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)
                  )}
                </select>
              </div>

              {/* Destination locked to the shortage location */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">To Location</label>
                <input
                  value={`${repoRow.location_code} — ${repoRow.location_name}`}
                  disabled
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={rForm.quantity}
                  onChange={(e) => setRForm((p) => ({ ...p, quantity: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              {rError && <p className="text-red-600 text-sm">{rError}</p>}
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setShowRepoModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={rSaving || sourceLoading} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition" style={{ backgroundColor: 'var(--cadet-dark)' }}>
                  {rSaving ? 'Creating…' : 'Create Distribution Order'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  )
}
