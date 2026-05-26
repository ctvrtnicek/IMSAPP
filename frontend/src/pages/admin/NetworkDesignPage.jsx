import { useState, useEffect, useRef } from 'react'
import {
  listRegions, createRegion, updateRegion,
  listCountries, createCountry, updateCountry,
  listVersions, createVersion, commitBaseline, deleteVersion,
  listFlows, addFlow, deleteFlow,
  addConstraint, deleteConstraint,
} from '../../api/network_design.js'
import { getLocations } from '../../api/masterdata.js'
const listLocations = getLocations

const FLOW_TYPES = [
  { code: 'A', label: 'A — Supplier → Warehouse' },
  { code: 'B', label: 'B — Warehouse → FSL' },
  { code: 'C', label: 'C — Warehouse → Warehouse' },
  { code: 'D', label: 'D — Warehouse → Repair Centre' },
  { code: 'E', label: 'E — Repair Centre → Warehouse' },
  { code: 'F', label: 'F — Repair Centre → FSL' },
  { code: 'G', label: 'G — Warehouse → Customer' },
  { code: 'H', label: 'H — FSL → Customer' },
  { code: 'I', label: 'I — Customer → Warehouse' },
]

const FLOW_COLOURS = {
  A: '#1E5B67', B: '#517222', C: '#3D8080', D: '#8E7029',
  E: '#7239A4', F: '#C2453A', G: '#80994D', H: '#C69A3F', I: '#4D3075',
}

export default function NetworkDesignPage({ role }) {
  const [tab, setTab] = useState('regions')

  return (
    <div>
      <div style={{ borderBottom: '1px solid var(--border-1)', display: 'flex', gap: 0 }}>
        {[['regions', 'Regions & Countries'], ['network', 'Network Design']].map(([id, label]) => (
          <button key={id} className={`e2o-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ padding: '1.5rem 0' }}>
        {tab === 'regions' && <RegionsCountriesTab role={role} />}
        {tab === 'network' && <NetworkTab role={role} />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1: Regions & Countries
// ─────────────────────────────────────────────────────────────────────────────

function RegionsCountriesTab({ role }) {
  const [regions, setRegions] = useState([])
  const [countries, setCountries] = useState([])
  const [loading, setLoading] = useState(true)
  const [subtab, setSubtab] = useState('regions')

  // Region form
  const [showRegionForm, setShowRegionForm] = useState(false)
  const [regionForm, setRegionForm] = useState({ region_code: '', region_name: '' })
  const [editRegionId, setEditRegionId] = useState(null)

  // Country form
  const [showCountryForm, setShowCountryForm] = useState(false)
  const [countryForm, setCountryForm] = useState({ country_code: '', country_name: '', region_id: '' })
  const [editCountryId, setEditCountryId] = useState(null)

  const isAdmin = ['admin', 'supply_planner'].includes(role)

  async function load() {
    setLoading(true)
    try {
      const [r, c] = await Promise.all([listRegions(), listCountries()])
      setRegions(Array.isArray(r.data) ? r.data : [])
      setCountries(Array.isArray(c.data) ? c.data : [])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function saveRegion() {
    try {
      if (editRegionId) {
        await updateRegion(editRegionId, { region_name: regionForm.region_name })
      } else {
        await createRegion(regionForm)
      }
      setShowRegionForm(false); setRegionForm({ region_code: '', region_name: '' }); setEditRegionId(null)
      load()
    } catch (e) { alert(e.response?.data?.detail || 'Error saving region') }
  }

  async function saveCountry() {
    try {
      if (editCountryId) {
        await updateCountry(editCountryId, {
          country_name: countryForm.country_name,
          region_id: Number(countryForm.region_id),
        })
      } else {
        await createCountry({ ...countryForm, region_id: Number(countryForm.region_id) })
      }
      setShowCountryForm(false); setCountryForm({ country_code: '', country_name: '', region_id: '' }); setEditCountryId(null)
      load()
    } catch (e) { alert(e.response?.data?.detail || 'Error saving country') }
  }

  async function toggleServiced(country) {
    if (!isAdmin) return
    await updateCountry(country.id, { serviced: country.serviced ? 0 : 1 })
    load()
  }

  if (loading) return <p style={{ color: 'var(--fg-muted)' }}>Loading…</p>

  return (
    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {/* Regions panel */}
      <div className="e2o-card" style={{ padding: '1.25rem', minWidth: 320, flex: '1 1 320px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--fs-h3)' }}>Regions</h3>
          {isAdmin && (
            <button className="e2o-btn e2o-btn-primary" style={{ padding: '6px 14px', fontSize: 13 }}
              onClick={() => { setEditRegionId(null); setRegionForm({ region_code: '', region_name: '' }); setShowRegionForm(true) }}>
              + Add
            </button>
          )}
        </div>
        <table className="e2o-table">
          <thead><tr><th>Code</th><th>Name</th><th>Countries</th>{isAdmin && <th></th>}</tr></thead>
          <tbody>
            {regions.map(r => (
              <tr key={r.id}>
                <td><span style={{ fontWeight: 600, color: 'var(--cadet-dark)' }}>{r.region_code}</span></td>
                <td>{r.region_name}</td>
                <td style={{ color: 'var(--fg-muted)' }}>{countries.filter(c => c.region_id === r.id).length}</td>
                {isAdmin && (
                  <td>
                    <button className="e2o-btn e2o-btn-secondary" style={{ padding: '3px 10px', fontSize: 12 }}
                      onClick={() => { setEditRegionId(r.id); setRegionForm({ region_code: r.region_code, region_name: r.region_name }); setShowRegionForm(true) }}>
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {showRegionForm && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-1)' }}>
            <p style={{ margin: '0 0 .75rem', fontWeight: 600 }}>{editRegionId ? 'Edit Region' : 'Add Region'}</p>
            {!editRegionId && (
              <div style={{ marginBottom: '.5rem' }}>
                <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Code</label>
                <input className="e2o-input" value={regionForm.region_code}
                  onChange={e => setRegionForm(f => ({ ...f, region_code: e.target.value }))} />
              </div>
            )}
            <div style={{ marginBottom: '.75rem' }}>
              <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Name</label>
              <input className="e2o-input" value={regionForm.region_name}
                onChange={e => setRegionForm(f => ({ ...f, region_name: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="e2o-btn e2o-btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={saveRegion}>Save</button>
              <button className="e2o-btn e2o-btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setShowRegionForm(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Countries panel */}
      <div className="e2o-card" style={{ padding: '1.25rem', minWidth: 480, flex: '2 1 480px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--fs-h3)' }}>Countries</h3>
          {isAdmin && (
            <button className="e2o-btn e2o-btn-primary" style={{ padding: '6px 14px', fontSize: 13 }}
              onClick={() => { setEditCountryId(null); setCountryForm({ country_code: '', country_name: '', region_id: '' }); setShowCountryForm(true) }}>
              + Add
            </button>
          )}
        </div>
        <table className="e2o-table">
          <thead><tr><th>Code</th><th>Name</th><th>Region</th><th>Serviced</th>{isAdmin && <th></th>}</tr></thead>
          <tbody>
            {countries.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.country_code}</td>
                <td>{c.country_name}</td>
                <td><span className="e2o-pill" style={{ background: 'var(--bg-tint-cadet)', color: 'var(--cadet-dark)' }}>{c.region_code}</span></td>
                <td>
                  {isAdmin ? (
                    <button
                      onClick={() => toggleServiced(c)}
                      style={{
                        padding: '3px 10px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        background: c.serviced ? '#d4edda' : 'var(--bg-3)', color: c.serviced ? '#155724' : 'var(--fg-3)',
                      }}>
                      {c.serviced ? 'Active' : 'Inactive'}
                    </button>
                  ) : (
                    <span className="e2o-pill" style={{ background: c.serviced ? '#d4edda' : 'var(--bg-3)', color: c.serviced ? '#155724' : 'var(--fg-3)' }}>
                      {c.serviced ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </td>
                {isAdmin && (
                  <td>
                    <button className="e2o-btn e2o-btn-secondary" style={{ padding: '3px 10px', fontSize: 12 }}
                      onClick={() => { setEditCountryId(c.id); setCountryForm({ country_code: c.country_code, country_name: c.country_name, region_id: String(c.region_id) }); setShowCountryForm(true) }}>
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {showCountryForm && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-1)' }}>
            <p style={{ margin: '0 0 .75rem', fontWeight: 600 }}>{editCountryId ? 'Edit Country' : 'Add Country'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem .75rem', marginBottom: '.75rem' }}>
              {!editCountryId && (
                <div>
                  <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 4 }}>ISO Code</label>
                  <input className="e2o-input" maxLength={3} value={countryForm.country_code}
                    onChange={e => setCountryForm(f => ({ ...f, country_code: e.target.value.toUpperCase() }))} />
                </div>
              )}
              <div>
                <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Name</label>
                <input className="e2o-input" value={countryForm.country_name}
                  onChange={e => setCountryForm(f => ({ ...f, country_name: e.target.value }))} />
              </div>
              <div>
                <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Region</label>
                <select className="e2o-select" value={countryForm.region_id}
                  onChange={e => setCountryForm(f => ({ ...f, region_id: e.target.value }))}>
                  <option value="">Select…</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.region_code} — {r.region_name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="e2o-btn e2o-btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={saveCountry}>Save</button>
              <button className="e2o-btn e2o-btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setShowCountryForm(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2: Network Design — versions + flow canvas
// ─────────────────────────────────────────────────────────────────────────────

function NetworkTab({ role }) {
  const [versions, setVersions] = useState([])
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [flows, setFlows] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewVersion, setShowNewVersion] = useState(false)
  const [newVersionForm, setNewVersionForm] = useState({ version_name: '', version_type: 'simulation', notes: '' })
  const [showAddFlow, setShowAddFlow] = useState(false)
  const [addFlowForm, setAddFlowForm] = useState({ from_location_id: '', to_location_id: '', flow_type: '' })
  const [showCommit, setShowCommit] = useState(false)
  const [commitForm, setCommitForm] = useState({ reference_number: '', effective_date: '', notes: '' })
  const [selectedFlow, setSelectedFlow] = useState(null)
  const [showConstraintForm, setShowConstraintForm] = useState(false)
  const [constraintForm, setConstraintForm] = useState({ replenishment_type: '', valid_from: '', valid_to: '' })

  const isPlanner = ['admin', 'supply_planner'].includes(role)

  async function loadVersions() {
    setLoading(true)
    try {
      const [vr, lr] = await Promise.all([listVersions(), listLocations()])
      const vs = Array.isArray(vr.data) ? vr.data : []
      setVersions(vs)
      setLocations(Array.isArray(lr.data) ? lr.data : [])
      if (vs.length > 0 && !selectedVersionId) setSelectedVersionId(vs[0].id)
    } finally { setLoading(false) }
  }

  async function loadFlows(vId) {
    if (!vId) return
    try {
      const r = await listFlows(vId)
      setFlows(Array.isArray(r.data) ? r.data : [])
    } catch { setFlows([]) }
  }

  useEffect(() => { loadVersions() }, [])
  useEffect(() => { loadFlows(selectedVersionId) }, [selectedVersionId])

  async function handleCreateVersion() {
    try {
      const r = await createVersion(newVersionForm)
      setShowNewVersion(false); setNewVersionForm({ version_name: '', version_type: 'simulation', notes: '' })
      await loadVersions()
      setSelectedVersionId(r.data.id)
    } catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  async function handleDeleteVersion(id) {
    if (!confirm('Delete this version and all its flows?')) return
    try { await deleteVersion(id); await loadVersions() }
    catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  async function handleAddFlow() {
    try {
      await addFlow(selectedVersionId, {
        from_location_id: Number(addFlowForm.from_location_id),
        to_location_id: Number(addFlowForm.to_location_id),
        flow_type: addFlowForm.flow_type,
      })
      setShowAddFlow(false); setAddFlowForm({ from_location_id: '', to_location_id: '', flow_type: '' })
      loadFlows(selectedVersionId)
    } catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  async function handleDeleteFlow(flowId) {
    if (!confirm('Remove this flow?')) return
    try { await deleteFlow(flowId); loadFlows(selectedVersionId) }
    catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  async function handleCommit() {
    try {
      await commitBaseline(selectedVersionId, commitForm)
      setShowCommit(false); loadVersions(); loadFlows(selectedVersionId)
    } catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  async function handleAddConstraint() {
    if (!selectedFlow) return
    try {
      await addConstraint(selectedFlow.id, constraintForm)
      setShowConstraintForm(false); setConstraintForm({ replenishment_type: '', valid_from: '', valid_to: '' })
      loadFlows(selectedVersionId)
    } catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  async function handleDeleteConstraint(constraintId) {
    try { await deleteConstraint(constraintId); loadFlows(selectedVersionId) }
    catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  const selectedVersion = versions.find(v => v.id === selectedVersionId)
  const isCommitted = selectedVersion?.committed_at

  if (loading) return <p style={{ color: 'var(--fg-muted)' }}>Loading…</p>

  return (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* Version selector panel */}
      <div className="e2o-card" style={{ padding: '1.25rem', minWidth: 280, maxWidth: 320 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--fs-h3)' }}>Versions</h3>
          {isPlanner && (
            <button className="e2o-btn e2o-btn-primary" style={{ padding: '5px 12px', fontSize: 12 }}
              onClick={() => setShowNewVersion(true)}>+ New</button>
          )}
        </div>
        {versions.length === 0 && <p style={{ color: 'var(--fg-muted)', fontSize: 13 }}>No versions yet.</p>}
        {versions.map(v => (
          <div key={v.id}
            onClick={() => setSelectedVersionId(v.id)}
            style={{
              padding: '10px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', marginBottom: 6,
              background: selectedVersionId === v.id ? 'var(--bg-tint-cadet)' : 'var(--bg-2)',
              border: `1px solid ${selectedVersionId === v.id ? 'var(--cadet-dark)' : 'var(--border-1)'}`,
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{v.version_name}</span>
              <span className="e2o-pill" style={{
                fontSize: 10, padding: '2px 7px',
                background: v.committed_at ? '#d4edda' : '#e8f0fe',
                color: v.committed_at ? '#155724' : '#1a56db',
              }}>
                {v.committed_at ? 'Baseline' : 'Simulation'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>
              {v.flow_count} flows{v.effective_date ? ` · from ${v.effective_date}` : ''}
            </div>
            {isPlanner && !v.committed_at && (
              <button className="e2o-btn e2o-btn-danger" style={{ padding: '2px 8px', fontSize: 11, marginTop: 6 }}
                onClick={(e) => { e.stopPropagation(); handleDeleteVersion(v.id) }}>Delete</button>
            )}
          </div>
        ))}
        {showNewVersion && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)' }}>
            <p style={{ margin: '0 0 .5rem', fontWeight: 600, fontSize: 13 }}>New Version</p>
            <input className="e2o-input" placeholder="Version name" style={{ marginBottom: 6 }}
              value={newVersionForm.version_name} onChange={e => setNewVersionForm(f => ({ ...f, version_name: e.target.value }))} />
            <select className="e2o-select" style={{ marginBottom: 6 }}
              value={newVersionForm.version_type} onChange={e => setNewVersionForm(f => ({ ...f, version_type: e.target.value }))}>
              <option value="simulation">Simulation</option>
              <option value="baseline">Baseline (draft)</option>
            </select>
            <textarea className="e2o-input" rows={2} placeholder="Notes (optional)" style={{ marginBottom: 8 }}
              value={newVersionForm.notes} onChange={e => setNewVersionForm(f => ({ ...f, notes: e.target.value }))} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="e2o-btn e2o-btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={handleCreateVersion}>Create</button>
              <button className="e2o-btn e2o-btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setShowNewVersion(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Flow canvas + flow list */}
      {selectedVersion && (
        <div style={{ flex: '1 1 600px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>{selectedVersion.version_name}</h3>
              <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                {isCommitted ? `Committed baseline · eff. ${selectedVersion.effective_date}` : 'Simulation — editable'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isPlanner && !isCommitted && (
                <>
                  <button className="e2o-btn e2o-btn-secondary" style={{ fontSize: 13 }} onClick={() => setShowAddFlow(true)}>+ Add Flow</button>
                  <button className="e2o-btn e2o-btn-primary" style={{ fontSize: 13 }} onClick={() => setShowCommit(true)}>Commit Baseline</button>
                </>
              )}
            </div>
          </div>

          {/* Flow canvas (SVG) */}
          <FlowCanvas flows={flows} locations={locations} onSelectFlow={setSelectedFlow} selectedFlow={selectedFlow} />

          {/* Flow list */}
          <div className="e2o-card" style={{ padding: '1rem', marginTop: '1rem' }}>
            <p style={{ margin: '0 0 .75rem', fontWeight: 600, fontSize: 13 }}>
              Flows ({flows.length})
            </p>
            {flows.length === 0 && <p style={{ color: 'var(--fg-muted)', fontSize: 13 }}>No flows defined.</p>}
            <table className="e2o-table">
              <thead>
                <tr><th>From</th><th>To</th><th>Type</th><th>Constraints</th>{isPlanner && !isCommitted && <th></th>}</tr>
              </thead>
              <tbody>
                {flows.map(f => (
                  <tr key={f.id} style={{ background: selectedFlow?.id === f.id ? 'var(--bg-tint-cadet)' : '' }}
                    onClick={() => setSelectedFlow(f)}>
                    <td>{f.from_location_name || f.from_location_id}</td>
                    <td>{f.to_location_name || f.to_location_id}</td>
                    <td>
                      <span className="e2o-pill" style={{ background: FLOW_COLOURS[f.flow_type] + '22', color: FLOW_COLOURS[f.flow_type], border: `1px solid ${FLOW_COLOURS[f.flow_type]}55` }}>
                        {f.flow_type}
                      </span>
                    </td>
                    <td style={{ color: 'var(--fg-muted)', fontSize: 12 }}>
                      {f.constraints?.length > 0 ? `${f.constraints.length} constraint(s)` : 'None'}
                    </td>
                    {isPlanner && !isCommitted && (
                      <td>
                        <button className="e2o-btn e2o-btn-danger" style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={(e) => { e.stopPropagation(); handleDeleteFlow(f.id) }}>Remove</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Constraint detail panel */}
          {selectedFlow && (
            <div className="e2o-card" style={{ padding: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
                  Constraints — {selectedFlow.from_location_name} → {selectedFlow.to_location_name} ({selectedFlow.flow_type})
                </p>
                {isPlanner && !isCommitted && (
                  <button className="e2o-btn e2o-btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }}
                    onClick={() => setShowConstraintForm(true)}>+ Add Constraint</button>
                )}
              </div>
              {selectedFlow.constraints?.length === 0 && <p style={{ color: 'var(--fg-muted)', fontSize: 13 }}>No constraints — flow is unrestricted.</p>}
              {selectedFlow.constraints?.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-1)' }}>
                  <span style={{ flex: 1, fontSize: 13 }}>
                    {c.replenishment_type || 'Any type'}
                    {c.valid_from ? ` · from ${c.valid_from}` : ''}
                    {c.valid_to ? ` to ${c.valid_to}` : ''}
                  </span>
                  {isPlanner && !isCommitted && (
                    <button className="e2o-btn e2o-btn-danger" style={{ padding: '2px 8px', fontSize: 11 }}
                      onClick={() => handleDeleteConstraint(c.id)}>Remove</button>
                  )}
                </div>
              ))}
              {showConstraintForm && (
                <div style={{ marginTop: '.75rem', padding: '.75rem', background: 'var(--bg-2)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.5rem', marginBottom: '.5rem' }}>
                    <div>
                      <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 3 }}>Replenishment type</label>
                      <input className="e2o-input" placeholder="e.g. Standard" value={constraintForm.replenishment_type}
                        onChange={e => setConstraintForm(f => ({ ...f, replenishment_type: e.target.value }))} />
                    </div>
                    <div>
                      <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 3 }}>Valid from</label>
                      <input className="e2o-input" type="date" value={constraintForm.valid_from}
                        onChange={e => setConstraintForm(f => ({ ...f, valid_from: e.target.value }))} />
                    </div>
                    <div>
                      <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 3 }}>Valid to</label>
                      <input className="e2o-input" type="date" value={constraintForm.valid_to}
                        onChange={e => setConstraintForm(f => ({ ...f, valid_to: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="e2o-btn e2o-btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={handleAddConstraint}>Add</button>
                    <button className="e2o-btn e2o-btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setShowConstraintForm(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add flow modal */}
      {showAddFlow && (
        <div className="e2o-modal-overlay">
          <div className="e2o-modal">
            <h3 style={{ margin: '0 0 1.25rem' }}>Add Supply Flow</h3>
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 4 }}>From Location</label>
                <select className="e2o-select" value={addFlowForm.from_location_id}
                  onChange={e => setAddFlowForm(f => ({ ...f, from_location_id: e.target.value }))}>
                  <option value="">Select…</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                </select>
              </div>
              <div>
                <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 4 }}>To Location</label>
                <select className="e2o-select" value={addFlowForm.to_location_id}
                  onChange={e => setAddFlowForm(f => ({ ...f, to_location_id: e.target.value }))}>
                  <option value="">Select…</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                </select>
              </div>
              <div>
                <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Flow Type</label>
                <select className="e2o-select" value={addFlowForm.flow_type}
                  onChange={e => setAddFlowForm(f => ({ ...f, flow_type: e.target.value }))}>
                  <option value="">Select…</option>
                  {FLOW_TYPES.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="e2o-btn e2o-btn-secondary" onClick={() => setShowAddFlow(false)}>Cancel</button>
              <button className="e2o-btn e2o-btn-primary" onClick={handleAddFlow}>Add Flow</button>
            </div>
          </div>
        </div>
      )}

      {/* Commit baseline modal */}
      {showCommit && (
        <div className="e2o-modal-overlay">
          <div className="e2o-modal">
            <h3 style={{ margin: '0 0 .5rem' }}>Commit Baseline</h3>
            <p style={{ margin: '0 0 1.25rem', color: 'var(--fg-3)', fontSize: 13 }}>
              This will commit the simulation as an active baseline. Once committed it cannot be edited.
            </p>
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Reference Number</label>
                <input className="e2o-input" placeholder="e.g. NET-001" value={commitForm.reference_number}
                  onChange={e => setCommitForm(f => ({ ...f, reference_number: e.target.value }))} />
              </div>
              <div>
                <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Effective Date</label>
                <input className="e2o-input" type="date" value={commitForm.effective_date}
                  onChange={e => setCommitForm(f => ({ ...f, effective_date: e.target.value }))} />
              </div>
              <div>
                <label className="e2o-eyebrow" style={{ display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea className="e2o-input" rows={2} value={commitForm.notes}
                  onChange={e => setCommitForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="e2o-btn e2o-btn-secondary" onClick={() => setShowCommit(false)}>Cancel</button>
              <button className="e2o-btn e2o-btn-primary" onClick={handleCommit}>Commit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Canvas
// ─────────────────────────────────────────────────────────────────────────────

function FlowCanvas({ flows, locations, onSelectFlow, selectedFlow }) {
  if (flows.length === 0 || locations.length === 0) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-2)', borderRadius: 'var(--radius-card)', border: '1px dashed var(--border-2)', color: 'var(--fg-muted)', fontSize: 13 }}>
        No flows to display
      </div>
    )
  }

  const W = 680, H = 300
  const PADDING = 60

  // Only include locations that appear in flows
  const usedLocIds = new Set(flows.flatMap(f => [f.from_location_id, f.to_location_id]))
  const usedLocs = locations.filter(l => usedLocIds.has(l.id))

  // Layout: distribute locations in a grid
  const cols = Math.ceil(Math.sqrt(usedLocs.length))
  const rows = Math.ceil(usedLocs.length / cols)
  const cellW = (W - PADDING * 2) / Math.max(cols, 1)
  const cellH = (H - PADDING * 2) / Math.max(rows, 1)

  const posMap = {}
  usedLocs.forEach((loc, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    posMap[loc.id] = {
      x: PADDING + col * cellW + cellW / 2,
      y: PADDING + row * cellH + cellH / 2,
      name: loc.name,
      code: loc.code,
    }
  })

  return (
    <div className="e2o-card" style={{ padding: 0, overflow: 'hidden' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', background: 'var(--bg-2)' }}>
        <defs>
          {Object.entries(FLOW_COLOURS).map(([type, color]) => (
            <marker key={type} id={`arrow-${type}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={color} />
            </marker>
          ))}
        </defs>

        {/* Draw flows */}
        {flows.map(f => {
          const from = posMap[f.from_location_id]
          const to = posMap[f.to_location_id]
          if (!from || !to) return null
          const color = FLOW_COLOURS[f.flow_type] || '#888'
          const isSelected = selectedFlow?.id === f.id

          // Slightly offset if bidirectional to avoid overlap
          const dx = to.x - from.x, dy = to.y - from.y
          const len = Math.sqrt(dx * dx + dy * dy)
          const offset = len > 0 ? 5 : 0
          const ox = (-dy / len) * offset, oy = (dx / len) * offset

          return (
            <g key={f.id} style={{ cursor: 'pointer' }} onClick={() => onSelectFlow(f)}>
              <line
                x1={from.x + ox} y1={from.y + oy} x2={to.x + ox} y2={to.y + oy}
                stroke={color} strokeWidth={isSelected ? 3 : 1.5} opacity={isSelected ? 1 : 0.75}
                markerEnd={`url(#arrow-${f.flow_type})`}
                strokeDasharray={f.constraints?.length ? '5,3' : undefined}
              />
              {/* Flow type label at midpoint */}
              <text
                x={(from.x + to.x) / 2 + ox} y={(from.y + to.y) / 2 + oy - 6}
                fontSize="9" fill={color} textAnchor="middle" fontWeight="700">{f.flow_type}</text>
            </g>
          )
        })}

        {/* Draw location nodes */}
        {Object.values(posMap).map(({ x, y, name, code }) => (
          <g key={code}>
            <circle cx={x} cy={y} r={18} fill="var(--bg-1)" stroke="var(--cadet-dark)" strokeWidth={1.5} />
            <text x={x} y={y + 4} fontSize="9" fill="var(--cadet-dark)" textAnchor="middle" fontWeight="700">{code.slice(0, 4)}</text>
            <text x={x} y={y + 30} fontSize="8" fill="var(--fg-3)" textAnchor="middle">
              {name.length > 14 ? name.slice(0, 13) + '…' : name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
