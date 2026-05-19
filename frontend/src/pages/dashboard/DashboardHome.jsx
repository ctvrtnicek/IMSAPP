import { useState, useEffect } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps'
import geoData from 'world-atlas/countries-110m.json'
import api from '../../api/auth.js'

// KPI card definition: { key, label, color, icon, navId }
const KPI_DEFS = [
  { key: 'total_terminals',       label: 'Total Terminals',     color: '#1e40af', bg: '#dbeafe', icon: '⬛' },
  { key: 'available',             label: 'Available',           color: '#166534', bg: '#dcfce7', icon: '✓' },
  { key: 'in_transit',            label: 'In Transit',          color: '#6b21a8', bg: '#f3e8ff', icon: '→' },
  { key: 'quarantine',            label: 'Quarantine',          color: '#854d0e', bg: '#fef9c3', icon: '!' },
  { key: 'open_purchase_orders',  label: 'Open POs',            color: '#1e40af', bg: '#eff6ff', icon: '📋' },
  { key: 'open_outbound_orders',  label: 'Open Outbound',       color: '#0f766e', bg: '#f0fdfa', icon: '↑' },
  { key: 'pending_returns',       label: 'Pending Returns',     color: '#9d174d', bg: '#fdf2f8', icon: '↩' },
  { key: 'active_repairs',        label: 'Active Repairs',      color: '#7c3aed', bg: '#f5f3ff', icon: '⚒' },
]

const PIN_COLORS = {
  'Warehouse':      '#2563eb',
  'Company':        '#16a34a',
  'Repair Centre':  '#9333ea',
  'Supplier':       '#ea580c',
  'Customer':       '#0891b2',
}

function KpiCard({ label, value, color, bg, icon, loading }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '0.75rem', padding: '1rem 1.25rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: 4,
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: color, lineHeight: 1 }}>
        {loading ? '—' : (value ?? 0).toLocaleString()}
      </div>
    </div>
  )
}

function PinTooltip({ pin, pos }) {
  if (!pin) return null
  return (
    <div style={{
      position: 'fixed', left: pos.x + 14, top: pos.y - 10, zIndex: 9999,
      background: '#1e293b', color: '#fff', borderRadius: '0.5rem',
      padding: '0.5rem 0.75rem', fontSize: '0.8rem', pointerEvents: 'none',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)', maxWidth: 220,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{pin.name}</div>
      <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: 4 }}>{pin.city ? `${pin.city}, ` : ''}{pin.country}</div>
      <div>Terminals: <strong>{pin.terminal_count.toLocaleString()}</strong></div>
      {pin.in_transit_count > 0 && (
        <div style={{ color: '#a78bfa' }}>In Transit: <strong>{pin.in_transit_count.toLocaleString()}</strong></div>
      )}
      <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: 2 }}>{pin.location_type}</div>
    </div>
  )
}

export default function DashboardHome({ username, roleLabel, onNavigate }) {
  const [kpis, setKpis] = useState(null)
  const [kpiLoading, setKpiLoading] = useState(true)
  const [pins, setPins] = useState([])
  const [pinsLoading, setPinsLoading] = useState(true)
  const [tooltip, setTooltip] = useState({ pin: null, pos: { x: 0, y: 0 } })
  const [mapError] = useState(false)

  useEffect(() => {
    api.get('/analytics/summary')
      .then((r) => { setKpis(r.data); setKpiLoading(false) })
      .catch(() => setKpiLoading(false))

    api.get('/analytics/dashboard-map')
      .then((r) => { setPins(r.data); setPinsLoading(false) })
      .catch(() => { setPinsLoading(false) })
  }, [])

  // Sort pins: larger on top rendered last (actually rendered first so smaller are on top)
  const sortedPins = [...pins].sort((a, b) => b.terminal_count - a.terminal_count)

  // Build legend
  const typesPresent = [...new Set(pins.map((p) => p.location_type))].filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Welcome */}
      <div>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', marginBottom: 4 }}>
          Welcome, {username}
        </h1>
        <span className="e2o-pill" style={{ background: 'var(--cadet-dark)', color: '#fff', display: 'inline-flex' }}>
          {roleLabel}
        </span>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
        {KPI_DEFS.map(({ key, label, color, bg }) => (
          <KpiCard key={key} label={label} value={kpis?.[key]} color={color} bg={bg} loading={kpiLoading} />
        ))}
      </div>

      {/* World map */}
      <div style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--cadet-dark)' }}>
            Global Network
            {!pinsLoading && <span style={{ fontWeight: 400, fontSize: '0.78rem', color: '#9ca3af', marginLeft: 8 }}>{pins.length} locations</span>}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {typesPresent.map((t) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#6b7280' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: PIN_COLORS[t] || '#6b7280', flexShrink: 0 }} />
                {t}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#6b7280' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #a78bfa', background: 'transparent', flexShrink: 0 }} />
              In Transit
            </div>
          </div>
        </div>

        {mapError ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
            Map unavailable (no internet connection for map tiles).
          </div>
        ) : (
          <div style={{ position: 'relative', background: '#eef2f7' }}>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 140, center: [10, 20] }}
              style={{ width: '100%', height: 420 }}
            >
              <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={6}>
                <Geographies geography={geoData}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        style={{
                          default: { fill: '#d1dce8', stroke: '#fff', strokeWidth: 0.4, outline: 'none' },
                          hover:   { fill: '#b8c9de', stroke: '#fff', strokeWidth: 0.4, outline: 'none' },
                          pressed: { fill: '#b8c9de', stroke: '#fff', strokeWidth: 0.4, outline: 'none' },
                        }}
                      />
                    ))
                  }
                </Geographies>

                {sortedPins.map((pin) => {
                  const color = PIN_COLORS[pin.location_type] || '#6b7280'
                  // Radius proportional to sqrt of terminal count
                  const r = Math.max(4, Math.min(16, 4 + Math.sqrt(pin.terminal_count) * 0.8))
                  return (
                    <Marker
                      key={pin.id}
                      coordinates={[pin.lng, pin.lat]}
                      onMouseEnter={(e) => setTooltip({ pin, pos: { x: e.clientX, y: e.clientY } })}
                      onMouseMove={(e) => setTooltip((prev) => ({ ...prev, pos: { x: e.clientX, y: e.clientY } }))}
                      onMouseLeave={() => setTooltip({ pin: null, pos: { x: 0, y: 0 } })}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Outer ring if in-transit */}
                      {pin.in_transit_count > 0 && (
                        <circle r={r + 3} fill="none" stroke="#a78bfa" strokeWidth={1.5} opacity={0.7} />
                      )}
                      <circle r={r} fill={color} fillOpacity={0.85} stroke="#fff" strokeWidth={1} />
                      {pin.terminal_count >= 50 && (
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          style={{ fontSize: r > 9 ? 7 : 0, fill: '#fff', fontWeight: 700, pointerEvents: 'none' }}
                        >
                          {pin.terminal_count >= 1000 ? `${Math.round(pin.terminal_count / 1000)}k` : pin.terminal_count}
                        </text>
                      )}
                    </Marker>
                  )
                })}
              </ZoomableGroup>
            </ComposableMap>
            {pinsLoading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(238,242,247,0.7)', fontSize: '0.85rem', color: '#6b7280' }}>
                Loading map data…
              </div>
            )}
          </div>
        )}

        {/* Location table below map */}
        {!pinsLoading && pins.length > 0 && (
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    {['Location / Supplier', 'Type', 'Country', 'Terminals', 'In Transit'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#9ca3af', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...pins]
                    .sort((a, b) => b.terminal_count - a.terminal_count)
                    .slice(0, 15)
                    .map((pin) => (
                      <tr key={pin.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                        <td style={{ padding: '5px 10px', fontWeight: 600, color: '#374151' }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: PIN_COLORS[pin.location_type] || '#6b7280', marginRight: 6 }} />
                          {pin.name}
                          {pin.city && <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 4 }}>{pin.city}</span>}
                        </td>
                        <td style={{ padding: '5px 10px', color: '#6b7280' }}>{pin.location_type}</td>
                        <td style={{ padding: '5px 10px', color: '#6b7280' }}>{pin.country}</td>
                        <td style={{ padding: '5px 10px', fontWeight: 700, color: '#1e40af', textAlign: 'right' }}>{pin.terminal_count.toLocaleString()}</td>
                        <td style={{ padding: '5px 10px', color: pin.in_transit_count > 0 ? '#7c3aed' : '#9ca3af', fontWeight: pin.in_transit_count > 0 ? 700 : 400, textAlign: 'right' }}>
                          {pin.in_transit_count > 0 ? pin.in_transit_count.toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {pins.length > 15 && (
                <div style={{ padding: '4px 10px', color: '#9ca3af', fontSize: '0.72rem' }}>
                  + {pins.length - 15} more locations
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
