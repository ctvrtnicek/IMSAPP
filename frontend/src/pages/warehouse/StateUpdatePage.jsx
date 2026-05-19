/**
 * StateUpdatePage.jsx — Warehouse State Update module.
 *
 * Two modes:
 *   - Bulk Update:       filter serials by state/location, select subset, move to new state.
 *   - Individual Update: search for a serial by number, view its card + history, move to a new state.
 */

import { useState, useEffect, useCallback } from 'react'
import { getSerialsByState, bulkStateUpdate, singleStateUpdate } from '../../api/warehouse.js'
import { getSerials } from '../../api/inventory.js'
import { getLocations } from '../../api/masterdata.js'
import api from '../../api/auth.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WAREHOUSE_FLOW = {
  QUARANTINE:           ['ENCRYPTION_KEY_LOADED', 'STAGING', 'AVAILABLE'],
  ENCRYPTION_KEY_LOADED: ['STAGING', 'AVAILABLE'],
  STAGING:              ['AVAILABLE'],
}

const STATE_COLOURS = {
  Live:              { bg: '#dcfce7', color: '#166534' },
  'Out-Warehouse':   { bg: '#fef9c3', color: '#854d0e' },
  'Pre-Warehouse':   { bg: '#dbeafe', color: '#1e40af' },
  'Refurbished Live':{ bg: '#f3e8ff', color: '#6b21a8' },
  'End State':       { bg: '#fee2e2', color: '#991b1b' },
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StateBadge({ stateName, warehouseType }) {
  const colours = STATE_COLOURS[warehouseType] || { bg: '#f3f4f6', color: '#374151' }
  return (
    <span
      style={{
        backgroundColor: colours.bg,
        color: colours.color,
        padding: '2px 10px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {stateName || '—'}
    </span>
  )
}

function ResultBanner({ result, onDismiss }) {
  if (!result) return null
  const isError = result.type === 'error'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        marginBottom: '1rem',
        backgroundColor: isError ? '#fee2e2' : '#dcfce7',
        color: isError ? '#991b1b' : '#166534',
        fontWeight: 500,
        fontSize: '0.875rem',
      }}
    >
      <span>{result.message}</span>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}
      >
        ✕
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BULK UPDATE mode
// ---------------------------------------------------------------------------

function BulkUpdatePanel({ states, locations }) {
  const [fromStateCode, setFromStateCode] = useState('QUARANTINE')
  const [filterLocationId, setFilterLocationId] = useState('')
  const [serials, setSerials] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [toStateCode, setToStateCode] = useState('')
  const [newLocationId, setNewLocationId] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  // Compute suggested target states
  const suggestedTargets = WAREHOUSE_FLOW[fromStateCode] || states.map((s) => s.code)
  const targetStates = states.filter((s) => suggestedTargets.includes(s.code))

  function loadSerials() {
    setLoading(true)
    setSelected(new Set())
    setResult(null)
    const params = { state_code: fromStateCode }
    if (filterLocationId) params.location_id = filterLocationId
    getSerialsByState(params)
      .then((res) => {
        setSerials(res.data)
        setLoading(false)
      })
      .catch(() => {
        setResult({ type: 'error', message: 'Failed to load serials.' })
        setLoading(false)
      })
  }

  function toggleAll() {
    if (selected.size === serials.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(serials.map((s) => s.id)))
    }
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function applyUpdate() {
    if (!toStateCode) {
      setResult({ type: 'error', message: 'Please select a target state.' })
      return
    }
    if (selected.size === 0) {
      setResult({ type: 'error', message: 'No serials selected.' })
      return
    }
    setSubmitting(true)
    setResult(null)
    const payload = {
      serial_ids: Array.from(selected),
      to_state_code: toStateCode,
      location_id: newLocationId ? parseInt(newLocationId) : null,
      notes: notes || null,
    }
    bulkStateUpdate(payload)
      .then((res) => {
        const { updated, errors } = res.data
        if (errors && errors.length > 0) {
          setResult({
            type: 'error',
            message: `Updated ${updated} serial(s), but ${errors.length} error(s): ${errors.join('; ')}`,
          })
        } else {
          setResult({
            type: 'success',
            message: `${updated} serial(s) updated to ${toStateCode}.`,
          })
        }
        setSubmitting(false)
        // Reload to reflect new states
        loadSerials()
        setToStateCode('')
        setNotes('')
        setNewLocationId('')
      })
      .catch(() => {
        setResult({ type: 'error', message: 'State update failed. Check your permissions.' })
        setSubmitting(false)
      })
  }

  return (
    <div>
      {/* Step 1 — Filter */}
      <div
        style={{
          background: '#fff',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          padding: '1.25rem 1.5rem',
          marginBottom: '1rem',
        }}
      >
        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '0.75rem' }}>
          Step 1 — Filter Serials
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
              From State
            </label>
            <select
              value={fromStateCode}
              onChange={(e) => { setFromStateCode(e.target.value); setSerials([]); setSelected(new Set()) }}
              style={{
                border: '1px solid #d1d5db', borderRadius: '0.375rem',
                padding: '0.375rem 0.625rem', fontSize: '0.875rem', minWidth: '180px',
              }}
            >
              {states.map((s) => (
                <option key={s.code} value={s.code}>{s.display_name || s.code}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
              Location
            </label>
            <select
              value={filterLocationId}
              onChange={(e) => setFilterLocationId(e.target.value)}
              style={{
                border: '1px solid #d1d5db', borderRadius: '0.375rem',
                padding: '0.375rem 0.625rem', fontSize: '0.875rem', minWidth: '180px',
              }}
            >
              <option value="">All Locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </select>
          </div>

          <button
            onClick={loadSerials}
            disabled={loading}
            style={{
              backgroundColor: 'var(--cadet-dark)', color: '#fff',
              border: 'none', borderRadius: '0.375rem',
              padding: '0.5rem 1.25rem', fontSize: '0.875rem',
              fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Loading…' : 'Load Serials'}
          </button>
        </div>
      </div>

      {/* Result banner */}
      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      {/* Step 2 — Select serials table */}
      {serials.length === 0 && !loading && (
        <div
          style={{
            background: '#fff', borderRadius: '0.75rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            padding: '2rem', textAlign: 'center', color: '#9ca3af',
            marginBottom: '1rem',
          }}
        >
          No serials loaded. Choose a state and click "Load Serials".
        </div>
      )}

      {serials.length > 0 && (
        <div
          style={{
            background: '#fff', borderRadius: '0.75rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            padding: '1.25rem 1.5rem', marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
              Step 2 — Select Serials
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {selected.size} of {serials.length} selected
              </span>
              <button
                onClick={toggleAll}
                style={{
                  fontSize: '0.75rem', color: 'var(--cadet-dark)',
                  background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600,
                }}
              >
                {selected.size === serials.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#6b7280', fontWeight: 600, width: '2rem' }}>
                    <input
                      type="checkbox"
                      checked={serials.length > 0 && selected.size === serials.length}
                      onChange={toggleAll}
                      title={selected.size === serials.length ? 'Deselect all' : 'Select all'}
                      style={{ accentColor: 'var(--cadet-dark)', cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Serial Number</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Product</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Current State</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Location</th>
                </tr>
              </thead>
              <tbody>
                {serials.map((s) => {
                  const isChecked = selected.has(s.id)
                  return (
                    <tr
                      key={s.id}
                      onClick={() => toggleOne(s.id)}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        cursor: 'pointer',
                        backgroundColor: isChecked ? '#eff6ff' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(s.id)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ accentColor: 'var(--cadet-dark)' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', color: 'var(--cadet-dark)', fontWeight: 600 }}>
                        {s.serial_number}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#374151' }}>
                        {s.product_code ? `${s.product_code} — ${s.product_name}` : s.product_name || '—'}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <StateBadge stateName={s.current_state_name} warehouseType={s.stock_type} />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#6b7280' }}>
                        {s.current_location_name || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 3 — Target state */}
      {serials.length > 0 && (
        <div
          style={{
            background: '#fff', borderRadius: '0.75rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            padding: '1.25rem 1.5rem',
          }}
        >
          <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '0.75rem' }}>
            Step 3 — Target State
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                To State
              </label>
              <select
                value={toStateCode}
                onChange={(e) => setToStateCode(e.target.value)}
                style={{
                  border: '1px solid #d1d5db', borderRadius: '0.375rem',
                  padding: '0.375rem 0.625rem', fontSize: '0.875rem', minWidth: '200px',
                }}
              >
                <option value="">Select target state…</option>
                {targetStates.map((s) => (
                  <option key={s.code} value={s.code}>{s.display_name || s.code}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                New Location (optional)
              </label>
              <select
                value={newLocationId}
                onChange={(e) => setNewLocationId(e.target.value)}
                style={{
                  border: '1px solid #d1d5db', borderRadius: '0.375rem',
                  padding: '0.375rem 0.625rem', fontSize: '0.875rem', minWidth: '180px',
                }}
              >
                <option value="">Keep current</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                ))}
              </select>
            </div>

            <div style={{ flexGrow: 1 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                Notes (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Batch received 2024-05-07"
                style={{
                  border: '1px solid #d1d5db', borderRadius: '0.375rem',
                  padding: '0.375rem 0.625rem', fontSize: '0.875rem', width: '100%',
                }}
              />
            </div>

            <button
              onClick={applyUpdate}
              disabled={submitting || selected.size === 0}
              style={{
                backgroundColor: 'var(--cadet-dark)', color: '#fff',
                border: 'none', borderRadius: '0.375rem',
                padding: '0.5rem 1.25rem', fontSize: '0.875rem',
                fontWeight: 600, cursor: (submitting || selected.size === 0) ? 'not-allowed' : 'pointer',
                opacity: (submitting || selected.size === 0) ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {submitting ? 'Applying…' : `Apply to ${selected.size} Selected`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// INDIVIDUAL UPDATE mode
// ---------------------------------------------------------------------------

function IndividualUpdatePanel({ states, locations }) {
  const [searchText, setSearchText] = useState('')
  const [searching, setSearching] = useState(false)
  const [foundSerials, setFoundSerials] = useState([])
  const [selectedSerial, setSelectedSerial] = useState(null)
  const [history, setHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toStateCode, setToStateCode] = useState('')
  const [newLocationId, setNewLocationId] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  function doSearch() {
    if (!searchText.trim()) return
    setSearching(true)
    setResult(null)
    setSelectedSerial(null)
    setHistory([])
    getSerials({ search: searchText.trim(), limit: 20 })
      .then((res) => {
        setFoundSerials(res.data)
        setSearching(false)
      })
      .catch(() => {
        setResult({ type: 'error', message: 'Search failed.' })
        setSearching(false)
      })
  }

  function selectSerial(s) {
    setSelectedSerial(s)
    setFoundSerials([])
    setSearchText(s.serial_number)
    setToStateCode('')
    setNotes('')
    setNewLocationId('')
    setResult(null)
    // Fetch history via inventory detail endpoint
    api.get(`/inventory/serials/${s.id}`)
      .then((res) => setHistory(res.data.history || []))
      .catch(() => setHistory([]))
  }

  function doUpdate() {
    if (!toStateCode || !selectedSerial) return
    setSubmitting(true)
    setResult(null)
    const payload = {
      serial_id: selectedSerial.id,
      to_state_code: toStateCode,
      location_id: newLocationId ? parseInt(newLocationId) : null,
      notes: notes || null,
    }
    singleStateUpdate(payload)
      .then((res) => {
        const updated = res.data.serial
        setSelectedSerial({ ...selectedSerial, ...updated })
        setResult({ type: 'success', message: `Serial moved to ${toStateCode}.` })
        setToStateCode('')
        setNotes('')
        setNewLocationId('')
        setSubmitting(false)
        // Refresh history
        api.get(`/inventory/serials/${selectedSerial.id}`)
          .then((r) => setHistory(r.data.history || []))
          .catch(() => {})
      })
      .catch(() => {
        setResult({ type: 'error', message: 'Update failed. Check your permissions.' })
        setSubmitting(false)
      })
  }

  return (
    <div>
      {/* Search box */}
      <div
        style={{
          background: '#fff', borderRadius: '0.75rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          padding: '1.25rem 1.5rem', marginBottom: '1rem',
        }}
      >
        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '0.75rem' }}>
          Search Serial Number
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="Type serial number and press Enter…"
            style={{
              flex: 1, border: '1px solid #d1d5db', borderRadius: '0.375rem',
              padding: '0.5rem 0.75rem', fontSize: '0.875rem',
            }}
          />
          <button
            onClick={doSearch}
            disabled={searching}
            style={{
              backgroundColor: 'var(--cadet-dark)', color: '#fff',
              border: 'none', borderRadius: '0.375rem',
              padding: '0.5rem 1rem', fontSize: '0.875rem',
              fontWeight: 600, cursor: searching ? 'not-allowed' : 'pointer',
              opacity: searching ? 0.7 : 1,
            }}
          >
            {searching ? 'Searching…' : 'Find'}
          </button>
        </div>

        {/* Dropdown results */}
        {foundSerials.length > 0 && (
          <div
            style={{
              marginTop: '0.5rem', border: '1px solid #e5e7eb',
              borderRadius: '0.375rem', overflow: 'hidden',
            }}
          >
            {foundSerials.map((s) => (
              <div
                key={s.id}
                onClick={() => selectSerial(s)}
                style={{
                  padding: '0.625rem 0.75rem', cursor: 'pointer',
                  borderBottom: '1px solid #f3f4f6',
                  fontSize: '0.875rem',
                  display: 'flex', gap: '1rem', alignItems: 'center',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
              >
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--cadet-dark)' }}>{s.serial_number}</span>
                <span style={{ color: '#6b7280' }}>{s.product_name || '—'}</span>
                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{s.current_state_name || '—'}</span>
              </div>
            ))}
          </div>
        )}

        {foundSerials.length === 0 && !searching && searchText && !selectedSerial && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: '#9ca3af' }}>
            No results — try a different serial number.
          </p>
        )}
      </div>

      {/* Result banner */}
      <ResultBanner result={result} onDismiss={() => setResult(null)} />

      {/* Serial card */}
      {selectedSerial && (
        <div
          style={{
            background: '#fff', borderRadius: '0.75rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            padding: '1.25rem 1.5rem', marginBottom: '1rem',
          }}
        >
          {/* Card header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <p style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.125rem', color: 'var(--cadet-dark)' }}>
                {selectedSerial.serial_number}
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.125rem' }}>
                {selectedSerial.product_code ? `${selectedSerial.product_code} — ` : ''}
                {selectedSerial.product_name || 'Unknown product'}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
              <StateBadge
                stateName={selectedSerial.current_state_name}
                warehouseType={selectedSerial.stock_type}
              />
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                {selectedSerial.current_location_name || 'No location'}
              </span>
            </div>
          </div>

          {/* State History expandable */}
          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem' }}>
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--cadet-dark)', fontSize: '0.8125rem', fontWeight: 600, padding: 0,
              }}
            >
              {historyOpen ? '▲' : '▼'} State History ({history.length} entries)
            </button>

            {historyOpen && (
              <div style={{ marginTop: '0.5rem' }}>
                {history.length === 0 ? (
                  <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>No history recorded.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '0.375rem 0.5rem', textAlign: 'left', color: '#6b7280' }}>Date/Time</th>
                        <th style={{ padding: '0.375rem 0.5rem', textAlign: 'left', color: '#6b7280' }}>State</th>
                        <th style={{ padding: '0.375rem 0.5rem', textAlign: 'left', color: '#6b7280' }}>Location</th>
                        <th style={{ padding: '0.375rem 0.5rem', textAlign: 'left', color: '#6b7280' }}>Actor</th>
                        <th style={{ padding: '0.375rem 0.5rem', textAlign: 'left', color: '#6b7280' }}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.slice(0, 5).map((h) => (
                        <tr key={h.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                          <td style={{ padding: '0.375rem 0.5rem', color: '#374151' }}>
                            {h.datetime_utc ? h.datetime_utc.replace('T', ' ').substring(0, 16) : '—'}
                          </td>
                          <td style={{ padding: '0.375rem 0.5rem', color: 'var(--cadet-dark)', fontWeight: 600 }}>
                            {h.state_name || h.state_code || '—'}
                          </td>
                          <td style={{ padding: '0.375rem 0.5rem', color: '#6b7280' }}>
                            {h.location_name || '—'}
                          </td>
                          <td style={{ padding: '0.375rem 0.5rem', color: '#6b7280' }}>
                            {h.actor_username || h.actor_type || '—'}
                          </td>
                          <td style={{ padding: '0.375rem 0.5rem', color: '#9ca3af' }}>
                            {h.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Move controls */}
          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1rem', marginTop: '0.75rem' }}>
            <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#374151', marginBottom: '0.625rem' }}>
              Move to State
            </p>
            <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  Target State
                </label>
                <select
                  value={toStateCode}
                  onChange={(e) => setToStateCode(e.target.value)}
                  style={{
                    border: '1px solid #d1d5db', borderRadius: '0.375rem',
                    padding: '0.375rem 0.625rem', fontSize: '0.875rem', minWidth: '200px',
                  }}
                >
                  <option value="">Select state…</option>
                  {states
                    .filter((s) => s.code !== selectedSerial.current_state_code)
                    .map((s) => (
                      <option key={s.code} value={s.code}>{s.display_name || s.code}</option>
                    ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  New Location (optional)
                </label>
                <select
                  value={newLocationId}
                  onChange={(e) => setNewLocationId(e.target.value)}
                  style={{
                    border: '1px solid #d1d5db', borderRadius: '0.375rem',
                    padding: '0.375rem 0.625rem', fontSize: '0.875rem', minWidth: '160px',
                  }}
                >
                  <option value="">Keep current</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ flexGrow: 1 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes…"
                  style={{
                    border: '1px solid #d1d5db', borderRadius: '0.375rem',
                    padding: '0.375rem 0.625rem', fontSize: '0.875rem', width: '100%',
                  }}
                />
              </div>

              <button
                onClick={doUpdate}
                disabled={submitting || !toStateCode}
                style={{
                  backgroundColor: 'var(--cadet-dark)', color: '#fff',
                  border: 'none', borderRadius: '0.375rem',
                  padding: '0.5rem 1.25rem', fontSize: '0.875rem',
                  fontWeight: 600, cursor: (submitting || !toStateCode) ? 'not-allowed' : 'pointer',
                  opacity: (submitting || !toStateCode) ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {submitting ? 'Updating…' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function StateUpdatePage({ role }) {
  const [mode, setMode] = useState('bulk') // 'bulk' | 'individual'
  const [states, setStates] = useState([])
  const [locations, setLocations] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/inventory/states'),
      getLocations(),
    ])
      .then(([statesRes, locRes]) => {
        setStates(statesRes.data)
        setLocations(locRes.data)
        setDataLoading(false)
      })
      .catch(() => setDataLoading(false))
  }, [])

  if (dataLoading) {
    return (
      <div style={{ padding: '2rem', color: '#6b7280', textAlign: 'center' }}>
        Loading warehouse data…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Mode toggle */}
      <div
        style={{
          display: 'inline-flex', borderRadius: '0.5rem',
          overflow: 'hidden', border: '1px solid #e5e7eb',
          marginBottom: '1.25rem',
        }}
      >
        {[
          { id: 'bulk', label: 'Bulk Update' },
          { id: 'individual', label: 'Individual Update' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: mode === id ? 700 : 400,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mode === id ? 'var(--cadet-dark)' : '#fff',
              color: mode === id ? '#fff' : '#374151',
              transition: 'background-color 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'bulk' && (
        <BulkUpdatePanel states={states} locations={locations} />
      )}
      {mode === 'individual' && (
        <IndividualUpdatePanel states={states} locations={locations} />
      )}
    </div>
  )
}
