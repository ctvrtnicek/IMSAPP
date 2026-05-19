import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import api from '../../api/auth.js'
import CostAnalyticsPage from './CostAnalyticsPage.jsx'

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------
const NAVY  = 'var(--cadet-dark)'
const BLUE  = 'var(--cadet-dark)'
const TEAL  = '#00A3A1'
const GREEN = '#22c55e'
const AMBER = '#f59e0b'
const RED   = '#ef4444'
const GREY  = '#94a3b8'

const STATE_COLOURS = {
  'Available':                    GREEN,
  'Available Refurbished':        TEAL,
  'Quarantine':                   AMBER,
  'Quarantine Refurbished':       '#fb923c',
  'Staging':                      BLUE,
  'Encryption Key Loaded':        '#818cf8',
  'Expecting':                    GREY,
  'Transit to Company':           NAVY,
  'Transit to Warehouse':         '#1d4ed8',
  'Transit to Repair':            '#7c3aed',
  'In Repair':                    '#a21caf',
  'Defect':                       RED,
  'Under Investigation':          '#dc2626',
  'Scrap / Destroyed':            '#374151',
}

const STATUS_COLOURS_OB = {
  Draft:      GREY,
  Issued:     BLUE,
  Allocated:  AMBER,
  Shipped:    NAVY,
  Delivered:  GREEN,
  Cancelled:  RED,
}

const STATUS_COLOURS_PO = {
  Draft:               GREY,
  Issued:              BLUE,
  'Partially Received': AMBER,
  'Fully Received':    GREEN,
  Cancelled:           RED,
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function KpiCard({ label, value, colour, subtitle }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5 flex flex-col gap-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold" style={{ color: colour || NAVY }}>{value ?? '—'}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-base font-semibold text-gray-700 mt-2 mb-3">{children}</h2>
  )
}

function ChartCard({ title, children, minHeight = 280 }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <p className="text-sm font-semibold text-gray-600 mb-4">{title}</p>
      <div style={{ minHeight }}>{children}</div>
    </div>
  )
}

// Custom tooltip for bar charts
function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// Custom tooltip for pie charts
function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-gray-700">{payload[0].name}</p>
      <p style={{ color: payload[0].payload.fill }}>Count: <strong>{payload[0].value}</strong></p>
    </div>
  )
}

const ANALYTICS_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'cost',     label: 'Cost Analytics' },
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [activeTab, setActiveTab]     = useState('overview')
  const [summary, setSummary]         = useState(null)
  const [byState, setByState]         = useState([])
  const [byLocation, setByLocation]   = useState([])
  const [obStatus, setObStatus]       = useState([])
  const [poStatus, setPoStatus]       = useState([])
  const [stockSplit, setStockSplit]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      setError(null)
      try {
        const [sumRes, stateRes, locRes, obRes, poRes, stockRes] = await Promise.all([
          api.get('/analytics/summary'),
          api.get('/analytics/inventory-by-state'),
          api.get('/analytics/inventory-by-location'),
          api.get('/analytics/outbound-by-status'),
          api.get('/analytics/po-by-status'),
          api.get('/analytics/stock-type-split'),
        ])
        setSummary(sumRes.data)
        setByState(stateRes.data)
        setByLocation(locRes.data)
        setObStatus(obRes.data)
        setPoStatus(poRes.data)
        setStockSplit(stockRes.data)
      } catch (err) {
        setError('Failed to load analytics data.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // ── Derived chart data ────────────────────────────────────────────────────

  const stateChartData = byState.map((r) => ({
    state: r.state,
    count: r.count,
    fill: STATE_COLOURS[r.state] || BLUE,
  }))

  const locationChartData = byLocation.slice(0, 12).map((r) => ({
    name: r.location_code,
    fullName: r.location_name,
    count: r.count,
    fill: BLUE,
  }))

  const obPieData = obStatus.map((r) => ({
    name: r.status,
    value: r.count,
    fill: STATUS_COLOURS_OB[r.status] || GREY,
  }))

  const poPieData = poStatus.map((r) => ({
    name: r.status,
    value: r.count,
    fill: STATUS_COLOURS_PO[r.status] || GREY,
  }))

  const stockPieData = stockSplit.map((r, i) => ({
    name: r.stock_type,
    value: r.count,
    fill: i === 0 ? BLUE : TEAL,
  }))

  const totalObOrders = obPieData.reduce((s, r) => s + r.value, 0)
  const totalPoOrders = poPieData.reduce((s, r) => s + r.value, 0)

  return (
    <div className="space-y-6">
      {/* Page header + tab bar */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)' }}>Analytics</h1>
          <p style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-muted)' }}>Live data · refreshed on page load</p>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-1)' }}>
          {ANALYTICS_TABS.map((t) => (
            <button key={t.id} className={`e2o-tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'cost' && <CostAnalyticsPage />}

      {activeTab === 'overview' && (<>
      {loading && <p style={{ color: 'var(--fg-muted)', padding: '2rem 0' }}>Loading analytics…</p>}
      {error && <p style={{ color: 'var(--alert)', padding: '2rem 0' }}>{error}</p>}
      {!loading && !error && (<>


      {/* ── Row 1: Inventory KPIs ───────────────────────────────────────────── */}
      <SectionTitle>Inventory</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-4">
        <KpiCard label="Total Terminals"    value={summary?.total_terminals}       colour={NAVY}  />
        <KpiCard label="Available"          value={summary?.available}             colour={GREEN} />
        <KpiCard label="Avail. Refurb."     value={summary?.available_refurbished} colour={TEAL}  />
        <KpiCard label="Quarantine"         value={summary?.quarantine}            colour={AMBER} />
        <KpiCard label="Staging"            value={summary?.staging}               colour={BLUE}  />
        <KpiCard label="In Transit"         value={summary?.in_transit}            colour={NAVY}  />
        <KpiCard label="Defective"          value={summary?.defective}             colour={RED}   />
      </div>

      {/* ── Row 2: Orders KPIs ──────────────────────────────────────────────── */}
      <SectionTitle>Orders &amp; Operations</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Open Purchase Orders"  value={summary?.open_purchase_orders}  colour={BLUE}  subtitle="Draft / Issued / Partial" />
        <KpiCard label="Open Outbound Orders"  value={summary?.open_outbound_orders}  colour={NAVY}  subtitle="Draft / Issued / Allocated / Shipped" />
        <KpiCard label="Pending Returns"       value={summary?.pending_returns}       colour={AMBER} subtitle="Initiated / Received" />
        <KpiCard label="Active Repairs"        value={summary?.active_repairs}        colour={RED}   subtitle="Dispatched / At Repair Centre" />
      </div>

      {/* ── Row 3: Charts ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Inventory by State */}
        <ChartCard title="Inventory by State" minHeight={stateChartData.length * 36 + 20}>
          {stateChartData.length === 0 ? (
            <p className="text-gray-400 text-sm text-center pt-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(240, stateChartData.length * 36)}>
              <BarChart
                data={stateChartData}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="state" tick={{ fontSize: 11 }} width={170} />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="count" name="Terminals" radius={[0, 4, 4, 0]}>
                  {stateChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Inventory by Location */}
        <ChartCard title="Inventory by Location" minHeight={Math.max(240, locationChartData.length * 36)}>
          {locationChartData.length === 0 ? (
            <p className="text-gray-400 text-sm text-center pt-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(240, locationChartData.length * 36)}>
              <BarChart
                data={locationChartData}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const entry = locationChartData.find((d) => d.name === label)
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
                        <p className="font-semibold text-gray-700">{entry?.fullName || label}</p>
                        <p style={{ color: BLUE }}>Terminals: <strong>{payload[0].value}</strong></p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="count" name="Terminals" fill={BLUE} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Outbound Orders by Status */}
        <ChartCard title={`Outbound Orders by Status  (${totalObOrders} total)`} minHeight={260}>
          {obPieData.length === 0 ? (
            <p className="text-gray-400 text-sm text-center pt-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={obPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {obPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Purchase Orders by Status */}
        <ChartCard title={`Purchase Orders by Status  (${totalPoOrders} total)`} minHeight={260}>
          {poPieData.length === 0 ? (
            <p className="text-gray-400 text-sm text-center pt-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={poPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {poPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Stock Type Split */}
        {stockPieData.length > 0 && (
          <ChartCard title="Stock Type Split" minHeight={240}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={stockPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {stockPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
      </>)}
      </>)}
    </div>
  )
}
