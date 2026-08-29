import { useEffect, useState } from 'react'
import MasterDataTable from '../../components/MasterDataTable.jsx'
import Modal from '../../components/Modal.jsx'
import {
  getLocationTypes,
  createLocationType,
  updateLocationType,
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from '../../api/masterdata.js'
import { listTransitLanes, createTransitLane, updateTransitLane, deleteTransitLane } from '../../api/supply_planning.js'
import { listCountries } from '../../api/network_design.js'

const EMPTY_LOCATION_FORM = {
  code: '',
  name: '',
  location_type_id: '',
  country: '',
  city: '',
  reporting_currency: 'EUR',
  country_code: '',
}

export default function LocationsPage({ role }) {
  const isAdmin = role === 'admin'

  // Location Types state
  const [locationTypes, setLocationTypes] = useState([])
  const [ltLoading, setLtLoading] = useState(true)
  const [ltError, setLtError] = useState(null)
  const [showLtModal, setShowLtModal] = useState(false)
  const [ltForm, setLtForm] = useState({ name: '', gr_applicable: 1, accruals_applicable: 'NA' })
  const [editingLtId, setEditingLtId] = useState(null)
  const [ltSubmitting, setLtSubmitting] = useState(false)

  // Locations state
  const [locations, setLocations] = useState([])
  const [locLoading, setLocLoading] = useState(true)
  const [locError, setLocError] = useState(null)
  const [showLocModal, setShowLocModal] = useState(false)
  const [locForm, setLocForm] = useState(EMPTY_LOCATION_FORM)
  const [editingLocId, setEditingLocId] = useState(null)
  const [locSubmitting, setLocSubmitting] = useState(false)

  // Countries (for country_code dropdown)
  const [countries, setCountries] = useState([])

  // Transit Lanes state
  const [lanes, setLanes] = useState([])
  const [lanesLoading, setLanesLoading] = useState(true)
  const [lanesError, setLanesError] = useState(null)
  const [showLaneModal, setShowLaneModal] = useState(false)
  const [editingLane, setEditingLane] = useState(null)
  const [laneForm, setLaneForm] = useState({ from_location_id: '', to_location_id: '', transport_mode: 'Parcel', lead_time_days: '', lead_time_unit: 'days' })
  const [laneSaving, setLaneSaving] = useState(false)
  const [laneError, setLaneError] = useState(null)

  // ── Fetch data ─────────────────────────────────────────────────────────────
  async function fetchLocationTypes() {
    setLtLoading(true)
    setLtError(null)
    try {
      const res = await getLocationTypes()
      setLocationTypes(res.data)
    } catch {
      setLtError('Failed to load location types.')
    } finally {
      setLtLoading(false)
    }
  }

  async function fetchLocations() {
    setLocLoading(true)
    setLocError(null)
    try {
      const res = await getLocations()
      setLocations(res.data)
    } catch {
      setLocError('Failed to load locations.')
    } finally {
      setLocLoading(false)
    }
  }

  async function fetchLanes() {
    setLanesLoading(true); setLanesError(null)
    try {
      const res = await listTransitLanes()
      setLanes(Array.isArray(res.data) ? res.data : [])
    } catch { setLanesError('Failed to load transit lanes') }
    finally { setLanesLoading(false) }
  }

  useEffect(() => {
    fetchLocationTypes()
    fetchLocations()
    fetchLanes()
    listCountries().then(r => setCountries(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }, [])

  // ── Location Type form ─────────────────────────────────────────────────────
  async function handleLtSubmit(e) {
    e.preventDefault()
    setLtSubmitting(true)
    const payload = {
      name: ltForm.name,
      gr_applicable: Number(ltForm.gr_applicable),
      accruals_applicable: ltForm.accruals_applicable,
    }
    try {
      if (editingLtId) {
        await updateLocationType(editingLtId, payload)
      } else {
        await createLocationType(payload)
      }
      setShowLtModal(false)
      setLtForm({ name: '', gr_applicable: 1, accruals_applicable: 'NA' })
      setEditingLtId(null)
      await fetchLocationTypes()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Error saving location type')
    } finally {
      setLtSubmitting(false)
    }
  }

  function openEditLocationType(row) {
    setEditingLtId(row.id)
    setLtForm({
      name: row.name,
      gr_applicable: row.gr_applicable ?? 1,
      accruals_applicable: row.accruals_applicable || 'NA',
    })
    setShowLtModal(true)
  }

  // ── Location form ──────────────────────────────────────────────────────────
  function openAddLocation() {
    setEditingLocId(null)
    setLocForm(EMPTY_LOCATION_FORM)
    setShowLocModal(true)
  }

  function openEditLocation(row) {
    setEditingLocId(row.id)
    setLocForm({
      code: row.code,
      name: row.name,
      location_type_id: String(row.location_type_id),
      country: row.country,
      city: row.city || '',
      reporting_currency: row.reporting_currency,
      country_code: row.country_code || '',
    })
    setShowLocModal(true)
  }

  async function handleLocSubmit(e) {
    e.preventDefault()
    setLocSubmitting(true)
    const payload = {
      ...locForm,
      location_type_id: parseInt(locForm.location_type_id),
      city: locForm.city || null,
      country_code: locForm.country_code || null,
    }
    try {
      if (editingLocId) {
        await updateLocation(editingLocId, payload)
      } else {
        await createLocation(payload)
      }
      setShowLocModal(false)
      await fetchLocations()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Error saving location')
    } finally {
      setLocSubmitting(false)
    }
  }

  async function handleDeactivateLocation(row) {
    if (!confirm(`Deactivate location "${row.name}"?`)) return
    try {
      await deleteLocation(row.id)
      await fetchLocations()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Error deactivating location')
    }
  }

  // ── Transit Lane handlers ─────────────────────────────────────────────────
  function openNewLane() {
    setEditingLane(null)
    setLaneForm({ from_location_id: '', to_location_id: '', transport_mode: 'Parcel', lead_time_days: '', lead_time_unit: 'days' })
    setLaneError(null)
    setShowLaneModal(true)
  }

  function openEditLane(lane) {
    setEditingLane(lane)
    setLaneForm({
      from_location_id: String(lane.from_location_id),
      to_location_id: String(lane.to_location_id),
      transport_mode: lane.transport_mode,
      lead_time_days: String(lane.lead_time_days),
      lead_time_unit: lane.lead_time_unit || 'days',
    })
    setLaneError(null)
    setShowLaneModal(true)
  }

  async function handleLaneSubmit(e) {
    e.preventDefault()
    setLaneSaving(true); setLaneError(null)
    const payload = {
      from_location_id: Number(laneForm.from_location_id),
      to_location_id: Number(laneForm.to_location_id),
      transport_mode: laneForm.transport_mode,
      lead_time_days: Number(laneForm.lead_time_days),
    }
    try {
      if (editingLane) {
        await updateTransitLane(editingLane.id, payload)
      } else {
        await createTransitLane(payload)
      }
      setShowLaneModal(false)
      await fetchLanes()
    } catch (err) {
      setLaneError(err?.response?.data?.detail || 'Error saving lane')
    } finally { setLaneSaving(false) }
  }

  async function handleDeleteLane(lane) {
    if (!confirm(`Delete lane ${lane.from_location_code} → ${lane.to_location_code}?`)) return
    try {
      await deleteTransitLane(lane.id)
      await fetchLanes()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Error deleting lane')
    }
  }

  // ── Table columns ──────────────────────────────────────────────────────────
  const ltColumns = [
    { key: 'name', label: 'Name' },
    { key: 'gr_applicable', label: 'GR Applicable' },
    { key: 'accruals_applicable', label: 'Accruals' },
    { key: 'active', label: 'Status' },
  ]

  const locColumns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'location_type_name', label: 'Type' },
    { key: 'country', label: 'Country' },
    { key: 'country_code', label: 'Country Code' },
    { key: 'city', label: 'City' },
    { key: 'reporting_currency', label: 'Currency' },
    { key: 'active', label: 'Status' },
  ]

  return (
    <div className="space-y-8">
      {/* ── Location Types section ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-700">Location Types</h2>
          {isAdmin && (
            <button
              onClick={() => setShowLtModal(true)}
              className="text-sm px-4 py-1.5 rounded-lg text-white font-medium transition hover:opacity-90"
              style={{ backgroundColor: 'var(--cadet-dark)' }}
            >
              + Add Type
            </button>
          )}
        </div>
        {ltError && <p className="text-red-500 text-sm mb-2">{ltError}</p>}
        <MasterDataTable
          columns={ltColumns}
          rows={locationTypes}
          loading={ltLoading}
          onEdit={isAdmin ? openEditLocationType : undefined}
          emptyMessage="No location types found."
        />
      </section>

      {/* ── Locations section ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-700">Locations</h2>
          {isAdmin && (
            <button
              onClick={openAddLocation}
              className="text-sm px-4 py-1.5 rounded-lg text-white font-medium transition hover:opacity-90"
              style={{ backgroundColor: 'var(--cadet-dark)' }}
            >
              + Add Location
            </button>
          )}
        </div>
        {locError && <p className="text-red-500 text-sm mb-2">{locError}</p>}
        <MasterDataTable
          columns={locColumns}
          rows={locations}
          loading={locLoading}
          onEdit={isAdmin ? openEditLocation : undefined}
          onDeactivate={isAdmin ? handleDeactivateLocation : undefined}
          emptyMessage="No locations found."
        />
      </section>

      {/* ── Location Type modal ────────────────────────────────────────── */}
      {showLtModal && (
        <Modal title={editingLtId ? 'Edit Location Type' : 'Add Location Type'} onClose={() => { setShowLtModal(false); setEditingLtId(null) }}>
          <form onSubmit={handleLtSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={ltForm.name}
                onChange={(e) => setLtForm(f => ({ ...f, name: e.target.value }))}
                required
                placeholder="e.g. Warehouse"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GR Applicable</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={ltForm.gr_applicable}
                onChange={(e) => setLtForm(f => ({ ...f, gr_applicable: Number(e.target.value) }))}
              >
                <option value={1}>Yes</option>
                <option value={0}>No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Accruals</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={ltForm.accruals_applicable}
                onChange={(e) => setLtForm(f => ({ ...f, accruals_applicable: e.target.value }))}
              >
                <option value="NA">NA</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
                <option value="QUARTERLY">QUARTERLY</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowLtModal(false); setEditingLtId(null) }}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={ltSubmitting}
                className="text-sm px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: 'var(--cadet-dark)' }}
              >
                {ltSubmitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Location Lead Times section ───────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-700">Location Lead Times</h2>
          {isAdmin && (
            <button
              onClick={openNewLane}
              className="text-sm px-4 py-1.5 rounded-lg text-white font-medium transition hover:opacity-90"
              style={{ backgroundColor: 'var(--cadet-dark)' }}
            >
              + Add Lane
            </button>
          )}
        </div>
        {lanesError && <p className="text-red-500 text-sm mb-2">{lanesError}</p>}
        <div className="e2o-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="e2o-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Mode</th>
                <th style={{ textAlign: 'right' }}>Lead Time (days)</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {lanesLoading ? (
                <tr><td colSpan={isAdmin ? 5 : 4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>Loading…</td></tr>
              ) : lanes.length === 0 ? (
                <tr><td colSpan={isAdmin ? 5 : 4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>No transit lanes defined yet.</td></tr>
              ) : lanes.map((lane) => (
                <tr key={lane.id}>
                  <td>
                    <div style={{ fontWeight: 'var(--fw-semibold)' }}>{lane.from_location_code}</div>
                    <div style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)' }}>{lane.from_location_name}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 'var(--fw-semibold)' }}>{lane.to_location_code}</div>
                    <div style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)' }}>{lane.to_location_name}</div>
                  </td>
                  <td style={{ color: 'var(--fg-2)' }}>{lane.transport_mode}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)' }}>{lane.lead_time_days}</td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => openEditLane(lane)}
                          style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', background: '#fff', cursor: 'pointer', fontSize: 'var(--fs-body-sm)' }}
                        >Edit</button>
                        <button
                          onClick={() => handleDeleteLane(lane)}
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
      </section>

      {/* ── Location modal ─────────────────────────────────────────────── */}
      {showLocModal && (
        <Modal
          title={editingLocId ? 'Edit Location' : 'Add Location'}
          onClose={() => setShowLocModal(false)}
        >
          <form onSubmit={handleLocSubmit} className="space-y-4">
            <FormRow label="Code" required>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={locForm.code}
                onChange={(e) => setLocForm((f) => ({ ...f, code: e.target.value }))}
                required
                placeholder="e.g. Oostrum"
              />
            </FormRow>
            <FormRow label="Name" required>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={locForm.name}
                onChange={(e) => setLocForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="e.g. Oostrum Warehouse"
              />
            </FormRow>
            <FormRow label="Location Type" required>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={locForm.location_type_id}
                onChange={(e) => setLocForm((f) => ({ ...f, location_type_id: e.target.value }))}
                required
              >
                <option value="">-- Select type --</option>
                {locationTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>{lt.name}</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Country" required>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={locForm.country}
                onChange={(e) => setLocForm((f) => ({ ...f, country: e.target.value }))}
                required
                placeholder="e.g. Netherlands"
              />
            </FormRow>
            <FormRow label="Country Code (Network Design)">
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={locForm.country_code}
                onChange={(e) => {
                  const cc = e.target.value
                  setLocForm((f) => {
                    const matched = countries.find(c => c.country_code === cc)
                    return { ...f, country_code: cc, reporting_currency: matched?.currency || f.reporting_currency }
                  })
                }}
              >
                <option value="">— Not linked —</option>
                {countries.map(c => (
                  <option key={c.country_code} value={c.country_code}>{c.country_code} — {c.country_name}</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="City">
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={locForm.city}
                onChange={(e) => setLocForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="e.g. Amsterdam"
              />
            </FormRow>
            <FormRow label="Reporting Currency" required>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={locForm.reporting_currency}
                onChange={(e) => setLocForm((f) => ({ ...f, reporting_currency: e.target.value }))}
                required
                placeholder="e.g. EUR"
                maxLength={3}
              />
              {(() => {
                const matchedCountry = countries.find(c => c.country_code === locForm.country_code)
                if (matchedCountry?.currency && locForm.reporting_currency && matchedCountry.currency !== locForm.reporting_currency) {
                  return <p style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>Note: Country currency is {matchedCountry.currency}</p>
                }
                return null
              })()}
            </FormRow>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLocModal(false)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={locSubmitting}
                className="text-sm px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: 'var(--cadet-dark)' }}
              >
                {locSubmitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {/* ── Lane modal ────────────────────────────────────────────────── */}
      {showLaneModal && (
        <Modal
          title={editingLane ? 'Edit Transit Lane' : 'Add Transit Lane'}
          onClose={() => setShowLaneModal(false)}
        >
          <form onSubmit={handleLaneSubmit} className="space-y-4">
            <FormRow label="From Location" required>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={laneForm.from_location_id}
                onChange={(e) => setLaneForm((f) => ({ ...f, from_location_id: e.target.value }))}
                required
              >
                <option value="">-- Select location --</option>
                {locations.filter((l) => l.active).map((l) => (
                  <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="To Location" required>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={laneForm.to_location_id}
                onChange={(e) => setLaneForm((f) => ({ ...f, to_location_id: e.target.value }))}
                required
              >
                <option value="">-- Select location --</option>
                {locations.filter((l) => l.active).map((l) => (
                  <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Transport Mode" required>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={laneForm.transport_mode}
                onChange={(e) => setLaneForm((f) => ({ ...f, transport_mode: e.target.value }))}
                required
              >
                <option value="Parcel">Parcel</option>
                <option value="Road">Road</option>
                <option value="Air">Air</option>
                <option value="Ocean">Ocean</option>
              </select>
            </FormRow>
            <FormRow label="Lead Time" required>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{ flex: 1 }}
                  value={laneForm.lead_time_days}
                  onChange={(e) => setLaneForm((f) => ({ ...f, lead_time_days: e.target.value }))}
                  required
                  placeholder="e.g. 5"
                />
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{ width: 90 }}
                  value={laneForm.lead_time_unit}
                  onChange={(e) => setLaneForm((f) => ({ ...f, lead_time_unit: e.target.value }))}
                >
                  <option value="days">Days</option>
                  <option value="hours">Hours</option>
                </select>
              </div>
            </FormRow>
            {laneError && <p className="text-red-600 text-sm">{laneError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLaneModal(false)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={laneSaving}
                className="text-sm px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: 'var(--cadet-dark)' }}
              >
                {laneSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function FormRow({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
