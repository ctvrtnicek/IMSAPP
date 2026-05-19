import { useState, useEffect, useRef } from 'react'
import { listSignals, createSignal, updateSignal, deleteSignal, getForecast, uploadSignalsCSV } from '../../api/demand_planning.js'
import { getProducts } from '../../api/masterdata.js'
import { getLocations } from '../../api/masterdata.js'
import Modal from '../../components/Modal.jsx'

const TABS = [
  { id: 'signals',    label: 'Demand Signals' },
  { id: 'signals-lt', label: 'Demand Forecast LongTerm' },
  { id: 'forecast',   label: 'Forecast Inventory View' },
]

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

function fmtPeriod(d) {
  if (!d) return '—'
  const [y, m] = d.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m, 10) - 1]} ${y}`
}

function GapBadge({ gap }) {
  if (gap > 0)  return <span className="e2o-pill" style={{ background: '#dcfce7', color: '#166534' }}>+{gap} surplus</span>
  if (gap === 0) return <span className="e2o-pill" style={{ background: '#f3f4f6', color: '#374151' }}>Met</span>
  return <span className="e2o-pill" style={{ background: '#fee2e2', color: '#991b1b' }}>{gap} short</span>
}

// Return first day of a given month offset from today
function monthOffset(n) {
  const d = new Date()
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const CSV_BTN_STYLE = {
  backgroundColor: '#fff',
  border: '1px solid var(--cadet-dark)',
  color: 'var(--cadet-dark)',
}

function downloadCSV(data, filename) {
  if (!data || data.length === 0) return
  const headers = Object.keys(data[0])
  const rows = data.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function DemandPage({ role }) {
  const [tab, setTab] = useState('signals')
  const [products, setProducts] = useState([])
  const [locations, setLocations] = useState([])

  // Signals state (next 3 months)
  const [signals, setSignals] = useState([])
  const [loadingS, setLoadingS] = useState(true)
  const [errorS, setErrorS] = useState(null)
  const [filterProd, setFilterProd] = useState('')
  const [filterLoc, setFilterLoc] = useState('')

  // Long-term signals state (beyond 3 months)
  const [signalsLT, setSignalsLT] = useState([])
  const [loadingLT, setLoadingLT] = useState(false)
  const [errorLT, setErrorLT] = useState(null)
  const [filterProdLT, setFilterProdLT] = useState('')
  const [filterLocLT, setFilterLocLT] = useState('')

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadResult, setUploadResult] = useState(null)
  const uploadRef = useRef(null)
  const uploadRefLT = useRef(null)

  // New/edit signal modal
  const [showModal, setShowModal] = useState(false)
  const [editSignal, setEditSignal] = useState(null)   // null = new
  const [form, setForm] = useState({ product_id: '', location_id: '', period_date: monthOffset(1), quantity: '', notes: '' })
  const [formError, setFormError] = useState(null)
  const [formSaving, setFormSaving] = useState(false)

  // Forecast state
  const [forecast, setForecast] = useState([])
  const [loadingF, setLoadingF] = useState(false)
  const [errorF, setErrorF] = useState(null)
  const [fcPeriod, setFcPeriod] = useState(monthOffset(1))

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

  async function loadSignals() {
    setLoadingS(true)
    setErrorS(null)
    try {
      const params = { period_to: monthOffset(3) }
      if (filterProd) params.product_id = filterProd
      if (filterLoc)  params.location_id = filterLoc
      const res = await listSignals(params)
      setSignals(Array.isArray(res.data) ? res.data : [])
    } catch {
      setErrorS('Failed to load signals')
    } finally {
      setLoadingS(false)
    }
  }

  async function loadSignalsLT() {
    setLoadingLT(true)
    setErrorLT(null)
    try {
      const params = { period_from: monthOffset(3) }
      if (filterProdLT) params.product_id = filterProdLT
      if (filterLocLT)  params.location_id = filterLocLT
      const res = await listSignals(params)
      setSignalsLT(Array.isArray(res.data) ? res.data : [])
    } catch {
      setErrorLT('Failed to load long-term signals')
    } finally {
      setLoadingLT(false)
    }
  }

  async function loadForecast() {
    setLoadingF(true)
    setErrorF(null)
    try {
      const params = {}
      if (fcPeriod) params.period_date = fcPeriod
      const res = await getForecast(params)
      setForecast(Array.isArray(res.data) ? res.data : [])
    } catch {
      setErrorF('Failed to load forecast')
    } finally {
      setLoadingF(false)
    }
  }

  useEffect(() => { loadMaster() }, [])
  useEffect(() => { if (tab === 'signals')    loadSignals()   }, [tab, filterProd, filterLoc])
  useEffect(() => { if (tab === 'signals-lt') loadSignalsLT() }, [tab, filterProdLT, filterLocLT])
  useEffect(() => { if (tab === 'forecast')   loadForecast()  }, [tab, fcPeriod])

  async function handleUploadCSV(e, reloadFn) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadError(null); setUploadResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadSignalsCSV(fd)
      setUploadResult(res.data)
      await reloadFn()
    } catch (err) {
      setUploadError(err?.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function openNew() {
    setEditSignal(null)
    setForm({ product_id: '', location_id: '', period_date: monthOffset(1), quantity: '', notes: '' })
    setFormError(null)
    setShowModal(true)
  }

  function openEdit(s) {
    setEditSignal(s)
    setForm({
      product_id: String(s.product_id),
      location_id: s.location_id ? String(s.location_id) : '',
      period_date: s.period_date,
      quantity: String(s.quantity),
      notes: s.notes || '',
    })
    setFormError(null)
    setShowModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.product_id) { setFormError('Product is required'); return }
    if (!form.period_date) { setFormError('Period is required'); return }
    if (!form.quantity || isNaN(Number(form.quantity))) { setFormError('Quantity must be a number'); return }
    setFormSaving(true)
    setFormError(null)
    try {
      const payload = {
        product_id: Number(form.product_id),
        location_id: form.location_id ? Number(form.location_id) : null,
        period_date: form.period_date,
        quantity: Number(form.quantity),
        notes: form.notes || null,
      }
      if (editSignal) {
        await updateSignal(editSignal.id, payload)
      } else {
        await createSignal(payload)
      }
      setShowModal(false)
      if (tab === 'signals-lt') await loadSignalsLT()
      else await loadSignals()
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Save failed')
    } finally {
      setFormSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this demand signal?')) return
    try {
      await deleteSignal(id)
      if (tab === 'signals-lt') await loadSignalsLT()
      else await loadSignals()
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed')
    }
  }

  function renderSignalsTable(data, loading, error, filterProdVal, setFP, filterLocVal, setFL, reloadFn, uploadRefEl) {
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <select
              value={filterProdVal}
              onChange={(e) => setFP(e.target.value)}
              style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-body-sm)', background: '#fff' }}
            >
              <option value="">All Products</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
            <select
              value={filterLocVal}
              onChange={(e) => setFL(e.target.value)}
              style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-body-sm)', background: '#fff' }}
            >
              <option value="">All Locations</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {canEdit && (
              <>
                <button
                  onClick={() => downloadCSV(data, 'demand_signals.csv')}
                  className="px-3 py-2 rounded-lg text-xs font-semibold transition"
                  style={CSV_BTN_STYLE}
                >Download CSV</button>
                <button
                  onClick={() => uploadRefEl.current?.click()}
                  disabled={uploading}
                  className="px-3 py-2 rounded-lg text-xs font-semibold transition"
                  style={CSV_BTN_STYLE}
                >{uploading ? 'Uploading…' : 'Upload CSV'}</button>
                <input
                  ref={uploadRefEl}
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => handleUploadCSV(e, reloadFn)}
                />
                <button
                  onClick={openNew}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                  style={{ backgroundColor: 'var(--cadet-dark)' }}
                >+ New Signal</button>
              </>
            )}
          </div>
        </div>

        {uploadError && <div style={{ color: 'var(--alert)', fontSize: 'var(--fs-body-sm)' }}>{uploadError}</div>}
        {uploadResult && (
          <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.75rem 1rem', fontSize: 'var(--fs-body-sm)', color: '#166534' }}>
            Uploaded {uploadResult.created_or_updated} records.
            {uploadResult.errors?.length > 0 && (
              <ul style={{ marginTop: 4, paddingLeft: 16, color: '#991b1b' }}>
                {uploadResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}

        {error && <div style={{ color: 'var(--alert)', fontSize: 'var(--fs-body-sm)' }}>{error}</div>}

        <div className="e2o-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="e2o-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Location</th>
                <th>Period</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th>Notes</th>
                <th>Created By</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canEdit ? 7 : 6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>Loading…</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={canEdit ? 7 : 6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>No demand signals found.</td></tr>
              ) : data.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--fg-1)' }}>{s.product_code}</div>
                    <div style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)' }}>{s.product_name}</div>
                  </td>
                  <td style={{ color: 'var(--fg-2)' }}>{s.location_code || <span style={{ color: 'var(--fg-muted)' }}>All</span>}</td>
                  <td style={{ fontWeight: 'var(--fw-semibold)' }}>{fmtPeriod(s.period_date)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)', color: 'var(--cadet-dark)' }}>{s.quantity.toLocaleString()}</td>
                  <td style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-body-sm)' }}>{s.notes || '—'}</td>
                  <td style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-body-sm)' }}>{s.created_by_username || '—'}</td>
                  {canEdit && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => openEdit(s)}
                          style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', background: '#fff', cursor: 'pointer', fontSize: 'var(--fs-body-sm)' }}
                        >Edit</button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          style={{ border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', padding: '4px 10px', background: '#fff', cursor: 'pointer', fontSize: 'var(--fs-body-sm)', color: '#dc2626' }}
                        >Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SubTabBar tabs={TABS} active={tab} onChange={(t) => { setTab(t); setUploadResult(null); setUploadError(null) }} />

      {/* ---- DEMAND SIGNALS TAB ---- */}
      {tab === 'signals' && renderSignalsTable(
        signals, loadingS, errorS,
        filterProd, setFilterProd,
        filterLoc, setFilterLoc,
        loadSignals, uploadRef
      )}

      {/* ---- DEMAND FORECAST LONG TERM TAB ---- */}
      {tab === 'signals-lt' && renderSignalsTable(
        signalsLT, loadingLT, errorLT,
        filterProdLT, setFilterProdLT,
        filterLocLT, setFilterLocLT,
        loadSignalsLT, uploadRefLT
      )}

      {/* ---- FORECAST VIEW TAB ---- */}
      {tab === 'forecast' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-2)', fontWeight: 'var(--fw-semibold)' }}>Period:</label>
            <input
              type="month"
              value={fcPeriod ? fcPeriod.slice(0, 7) : ''}
              onChange={(e) => setFcPeriod(e.target.value ? `${e.target.value}-01` : '')}
              style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-body-sm)', background: '#fff' }}
            />
            <button
              onClick={loadForecast}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
              style={{ backgroundColor: 'var(--cadet-dark)' }}
            >Refresh</button>
          </div>

          {errorF && <div style={{ color: 'var(--alert)', fontSize: 'var(--fs-body-sm)' }}>{errorF}</div>}

          <div className="e2o-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="e2o-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Location</th>
                  <th>Period</th>
                  <th style={{ textAlign: 'right' }}>Demand</th>
                  <th style={{ textAlign: 'right' }}>Stock</th>
                  <th>Coverage</th>
                </tr>
              </thead>
              <tbody>
                {loadingF ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>Loading…</td></tr>
                ) : forecast.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>
                    No demand signals for this period. Add signals in the Demand Signals tab.
                  </td></tr>
                ) : forecast.map((row) => (
                  <tr key={row.signal_id}>
                    <td>
                      <div style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--fg-1)' }}>{row.product_code}</div>
                      <div style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)' }}>{row.product_name}</div>
                    </td>
                    <td style={{ color: 'var(--fg-2)' }}>{row.location_code}</td>
                    <td style={{ fontWeight: 'var(--fw-semibold)' }}>{fmtPeriod(row.period_date)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{row.demand_qty.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{row.stock_qty.toLocaleString()}</td>
                    <td><GapBadge gap={row.gap} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary cards */}
          {forecast.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Total Demand',   value: forecast.reduce((s, r) => s + r.demand_qty, 0).toLocaleString(), color: 'var(--cadet-dark)' },
                { label: 'Total Stock',    value: forecast.reduce((s, r) => s + r.stock_qty, 0).toLocaleString(),  color: '#166534' },
                { label: 'Lines at Risk',  value: forecast.filter((r) => r.gap < 0).length, color: '#991b1b' },
              ].map((c) => (
                <div key={c.label} className="e2o-card" style={{ padding: '1rem 1.5rem', minWidth: 160 }}>
                  <div style={{ fontSize: 'var(--fs-label)', color: 'var(--fg-3)', marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-bold)', color: c.color }}>{c.value}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* New / Edit Signal Modal */}
      {showModal && (
        <Modal
          title={editSignal ? 'Edit Demand Signal' : 'New Demand Signal'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Product *</label>
              <select
                value={form.product_id}
                onChange={(e) => setForm((p) => ({ ...p, product_id: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
              <select
                value={form.location_id}
                onChange={(e) => setForm((p) => ({ ...p, location_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">All Locations (global)</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Period (Month) *</label>
              <input
                type="month"
                value={form.period_date ? form.period_date.slice(0, 7) : ''}
                onChange={(e) => setForm((p) => ({ ...p, period_date: e.target.value ? `${e.target.value}-01` : '' }))}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity *</label>
              <input
                type="number"
                min="0"
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                required
                placeholder="e.g. 500"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Optional context…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-y"
              />
            </div>
            {formError && <p className="text-red-600 text-sm">{formError}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 transition">Cancel</button>
              <button
                type="submit"
                disabled={formSaving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: 'var(--cadet-dark)' }}
              >
                {formSaving ? 'Saving…' : editSignal ? 'Save Changes' : 'Create Signal'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
