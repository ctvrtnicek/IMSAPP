import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlertSummary } from '../api/alerts.js'
import LocationsPage from './master-data/LocationsPage.jsx'
import SuppliersPage from './master-data/SuppliersPage.jsx'
import ProductsPage from './master-data/ProductsPage.jsx'
import CustomersPage from './master-data/CustomersPage.jsx'
import AllTerminalsPage from './inventory/AllTerminalsPage.jsx'
import ByStatePage from './inventory/ByStatePage.jsx'
import ByLocationPage from './inventory/ByLocationPage.jsx'
import ByProductPage from './inventory/ByProductPage.jsx'
import InTransitPage from './inventory/InTransitPage.jsx'
import NonSerialisedPage from './inventory/NonSerialisedPage.jsx'
import SalesOrdersPage from './orders/SalesOrdersPage.jsx'
import DistributionOrdersPage from './orders/DistributionOrdersPage.jsx'
import StateUpdatePage from './warehouse/StateUpdatePage.jsx'
import WorkOrdersPage from './warehouse/WorkOrdersPage.jsx'
import ReturnOrdersPage from './returns/ReturnOrdersPage.jsx'
import RepairOrdersPage from './returns/RepairOrdersPage.jsx'
import UsersPage from './admin/UsersPage.jsx'
import StatesPage from './admin/StatesPage.jsx'
import BusinessCalendarPage from './admin/BusinessCalendarPage.jsx'
import CostMasterPage from './admin/CostMasterPage.jsx'
import ExchangeRatesPage from './admin/ExchangeRatesPage.jsx'
import AnalyticsPage from './analytics/AnalyticsPage.jsx'
import ExcelUploadPage from './upload/ExcelUploadPage.jsx'
import ClaimTypesPage from './admin/ClaimTypesPage.jsx'
import DemandPage from './demand/DemandPage.jsx'
import SupplyPage from './supply/SupplyPage.jsx'
import DashboardHome from './dashboard/DashboardHome.jsx'
import AlertsPage from './alerts/AlertsPage.jsx'
import AlertRulesPage from './admin/AlertRulesPage.jsx'

const BRAND_COLOR = 'var(--cadet-dark)'

const NAV_ITEMS = [
  { id: 'dashboard',        label: 'Dashboard',        icon: '⊞' },
  { id: 'inventory',        label: 'Inventory',        icon: '▦' },
  // Step 3: Orders split into 3 separate nav items
  { id: 'sales-orders',     label: 'Orders',           icon: '↑' },
  { id: 'dist-orders',      label: 'Distribution',     icon: '⇆' },
  { id: 'repair-rework',    label: 'Returns & Repairs', icon: '⚒' },
  { id: 'demand',           label: 'Demand',           icon: '◈' },
  { id: 'supply',           label: 'Supply',           icon: '⟳' },
  { id: 'analytics',        label: 'Analytics',        icon: '⌁' },
  // P-03: Warehouse + Upload merged into Warehouse Tasks
  { id: 'warehouse-tasks',  label: 'Warehouse Tasks',  icon: '⬡' },
  // P-04: Master Data + Admin merged into Admin
  { id: 'alerts',           label: 'Alerts',           icon: '🔔' },
  { id: 'admin',            label: 'Admin',            icon: '⚙' },
]

const ADMIN_TABS = [
  { id: 'locations',       label: 'Locations' },
  { id: 'suppliers',       label: 'Suppliers' },
  { id: 'products',        label: 'Products' },
  { id: 'customers',       label: 'Customers' },
  { id: 'users',           label: 'Users & Roles' },
  { id: 'states',          label: 'Terminal States' },
  { id: 'calendars',       label: 'Calendars' },
  { id: 'cost-master',     label: 'Cost Master' },
  { id: 'exchange-rates',  label: 'FX Rates' },
  { id: 'claim-types',     label: 'Claim Types' },
  { id: 'alert-rules',     label: 'Alert Rules' },
  { id: 'upload',          label: 'Upload' },
]

// P-03: Warehouse Tasks tab bar
const WAREHOUSE_TABS = [
  { id: 'state-update',  label: 'Warehouse Tasks' },
  { id: 'work-orders',   label: 'Work Orders' },
]


const RETURNS_TABS = [
  { id: 'return-orders', label: 'Return Orders' },
  { id: 'repair-orders', label: 'Repair Orders' },
]

const INVENTORY_TABS = [
  { id: 'all',          label: 'All Terminals' },
  { id: 'by-state',     label: 'By State' },
  { id: 'by-location',  label: 'By Location' },
  { id: 'by-product',   label: 'By Product' },
  // P-05: "Expecting" renamed to "In Transit"
  { id: 'in-transit',   label: 'In Transit' },
  // P-06: "Non-Serialised" renamed to "Accessories"
  { id: 'accessories',  label: 'Accessories' },
]

const ROLE_LABELS = {
  admin:           'Admin',
  supply_planner:  'Supply Planner',
  warehouse_user:  'Warehouse User',
  repair_centre:   'Repair Centre',
  supplier:        'Supplier',
  demand_planner:  'Demand Planner',
}


function SubTabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--border-1)' }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`e2o-tab${active === tab.id ? ' active' : ''}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default function DashboardPage({ auth, setAuth }) {
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState(() => sessionStorage.getItem('dash_nav') || 'dashboard')
  const [activeAdminTab, setActiveAdminTab] = useState(() => sessionStorage.getItem('dash_admin_tab') || 'locations')
  const [activeInvTab, setActiveInvTab] = useState(() => sessionStorage.getItem('dash_inv_tab') || 'all')
  const [activeReturnsTab, setActiveReturnsTab] = useState(() => sessionStorage.getItem('dash_returns_tab') || 'return-orders')
  const [activeReturnDetail, setActiveReturnDetail] = useState(null)
  const [activeRepairDetail, setActiveRepairDetail] = useState(null)
  const [activeWarehouseTab, setActiveWarehouseTab] = useState(() => sessionStorage.getItem('dash_warehouse_tab') || 'state-update')
  const [alertSummary, setAlertSummary] = useState({ total: 0, critical: 0, urgent: 0, normal: 0 })
  const username  = auth?.username || localStorage.getItem('username') || 'User'
  const role      = auth?.role     || localStorage.getItem('role')     || ''
  const roleLabel = ROLE_LABELS[role] || role

  useEffect(() => {
    function fetchSummary() {
      getAlertSummary().then((r) => setAlertSummary(r.data)).catch(() => {})
    }
    fetchSummary()
    const timer = setInterval(fetchSummary, 60000)
    return () => clearInterval(timer)
  }, [])

  function handleSignOut() {
    setAuth(null)
    navigate('/login', { replace: true })
  }

  function handleNavigate(navId) {
    setActiveNav(navId)
    sessionStorage.setItem('dash_nav', navId)
  }

  function handleNavChange(id) {
    setActiveNav(id)
    sessionStorage.setItem('dash_nav', id)
    if (id !== 'repair-rework') {
      setActiveReturnDetail(null)
      setActiveRepairDetail(null)
    }
  }

  function handleInvTabChange(id) {
    setActiveInvTab(id)
    sessionStorage.setItem('dash_inv_tab', id)
  }

  function handleAdminTabChange(id) {
    setActiveAdminTab(id)
    sessionStorage.setItem('dash_admin_tab', id)
  }

  function renderContent() {
    if (activeNav === 'dashboard') {
      return <DashboardHome username={username} roleLabel={roleLabel} onNavigate={handleNavigate} />
    }

    // P-04: Merged Admin (was Master Data + Admin)
    if (activeNav === 'admin') {
      return (
        <div className="flex flex-col h-full">
          <div className="mb-5">
            <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', marginBottom: 16 }}>Admin</h1>
            <SubTabBar tabs={ADMIN_TABS} active={activeAdminTab} onChange={handleAdminTabChange} />
          </div>
          <div className="flex-1">
            {activeAdminTab === 'locations' && <LocationsPage role={role} />}
            {activeAdminTab === 'suppliers' && <SuppliersPage role={role} />}
            {activeAdminTab === 'products'  && <ProductsPage  role={role} />}
            {activeAdminTab === 'customers' && <CustomersPage role={role} />}
            {activeAdminTab === 'users'     && <UsersPage role={role} currentUsername={username} />}
            {activeAdminTab === 'states'        && <StatesPage role={role} />}
            {activeAdminTab === 'calendars'     && <BusinessCalendarPage role={role} />}
            {activeAdminTab === 'cost-master'   && <CostMasterPage role={role} />}
            {activeAdminTab === 'exchange-rates'&& <ExchangeRatesPage role={role} />}
            {activeAdminTab === 'claim-types'   && <ClaimTypesPage role={role} />}
            {activeAdminTab === 'alert-rules'   && <AlertRulesPage />}
            {activeAdminTab === 'upload'        && <ExcelUploadPage />}
          </div>
        </div>
      )
    }

    if (activeNav === 'sales-orders') {
      return (
        <div className="flex flex-col h-full">
          <div className="mb-5">
            <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', marginBottom: 16 }}>Orders</h1>
          </div>
          <div className="flex-1">
            <SalesOrdersPage role={role} />
          </div>
        </div>
      )
    }

    if (activeNav === 'dist-orders') {
      return (
        <div className="flex flex-col h-full">
          <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', marginBottom: 20 }}>Distribution Orders</h1>
          <DistributionOrdersPage role={role} />
        </div>
      )
    }

    if (activeNav === 'repair-rework') {
      return (
        <div className="flex flex-col h-full">
          <div className="mb-5">
            <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', marginBottom: 16 }}>Returns &amp; Repairs</h1>
            <SubTabBar
              tabs={RETURNS_TABS}
              active={activeReturnsTab}
              onChange={(id) => {
                setActiveReturnsTab(id)
                setActiveReturnDetail(null)
                setActiveRepairDetail(null)
              }}
            />
          </div>
          <div className="flex-1">
            {activeReturnsTab === 'return-orders' && (
              <ReturnOrdersPage
                role={role}
                onView={(id) => setActiveReturnDetail(id)}
                onCreateRepair={(repairId) => {
                  setActiveReturnsTab('repair-orders')
                  setActiveRepairDetail(repairId)
                }}
              />
            )}
            {activeReturnsTab === 'repair-orders' && (
              <RepairOrdersPage
                role={role}
                onView={(id) => setActiveRepairDetail(id)}
                activeRepairId={activeRepairDetail}
                onBack={() => setActiveRepairDetail(null)}
              />
            )}
          </div>
        </div>
      )
    }

    if (activeNav === 'inventory') {
      return (
        <div className="flex flex-col h-full">
          <div className="mb-5">
            <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', marginBottom: 16 }}>Inventory</h1>
            <SubTabBar tabs={INVENTORY_TABS} active={activeInvTab} onChange={handleInvTabChange} />
          </div>
          <div className="flex-1">
            {activeInvTab === 'all'         && <AllTerminalsPage role={role} />}
            {activeInvTab === 'by-state'    && <ByStatePage      role={role} />}
            {activeInvTab === 'by-location' && <ByLocationPage   role={role} />}
            {activeInvTab === 'by-product'  && <ByProductPage    role={role} />}
            {/* P-05: In Transit tab (was Expecting) — shows all 3 transit states */}
            {activeInvTab === 'in-transit'  && <InTransitPage    role={role} />}
            {/* P-06: Accessories tab (was Non-Serialised) */}
            {activeInvTab === 'accessories' && <NonSerialisedPage role={role} />}
          </div>
        </div>
      )
    }

    // P-03: Warehouse Tasks (Warehouse + Upload merged)
    if (activeNav === 'warehouse-tasks') {
      return (
        <div className="flex flex-col h-full">
          <div className="mb-5">
            <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', marginBottom: 16 }}>Warehouse Tasks</h1>
            <SubTabBar tabs={WAREHOUSE_TABS} active={activeWarehouseTab} onChange={(id) => { setActiveWarehouseTab(id); sessionStorage.setItem('dash_warehouse_tab', id) }} />
          </div>
          <div className="flex-1">
            {activeWarehouseTab === 'state-update' && <StateUpdatePage role={role} />}
            {activeWarehouseTab === 'work-orders'  && <WorkOrdersPage role={role} />}
          </div>
        </div>
      )
    }

    if (activeNav === 'demand') {
      return (
        <div className="flex flex-col h-full">
          <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', marginBottom: 20 }}>Demand Planning</h1>
          <DemandPage role={role} />
        </div>
      )
    }

    if (activeNav === 'supply') {
      return (
        <div className="flex flex-col h-full">
          <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', marginBottom: 20 }}>Supply Planning</h1>
          <SupplyPage role={role} onNavigate={handleNavigate} />
        </div>
      )
    }

    if (activeNav === 'analytics') {
      return <AnalyticsPage />
    }

    if (activeNav === 'alerts') {
      return (
        <div className="flex flex-col h-full">
          <AlertsPage onNavigate={handleNavigate} />
        </div>
      )
    }

    return (
      <div>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', marginBottom: 24, textTransform: 'capitalize' }}>
          {NAV_ITEMS.find((n) => n.id === activeNav)?.label || activeNav}
        </h1>
        <div className="e2o-card" style={{ padding: '1.5rem', maxWidth: 400 }}>
          <p style={{ color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)' }}>Module coming soon.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-2)' }}>
      {/* Top bar */}
      <header className="e2o-topbar" style={{ flexShrink: 0, justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-body-lg)', letterSpacing: '0.02em' }}>
          Inventory Management System
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
          {/* Alert bell */}
          <button
            onClick={() => handleNavChange('alerts')}
            title={alertSummary.total > 0 ? `${alertSummary.total} active alert${alertSummary.total !== 1 ? 's' : ''}` : 'No active alerts'}
            style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px', color: '#fff', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center' }}
          >
            🔔
            {alertSummary.total > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: alertSummary.critical > 0 ? '#dc2626' : '#f59e0b',
                color: '#fff', borderRadius: '9999px',
                fontSize: 9, fontWeight: 700,
                minWidth: 16, height: 16, lineHeight: '16px',
                textAlign: 'center', padding: '0 3px',
              }}>
                {alertSummary.total > 99 ? '99+' : alertSummary.total}
              </span>
            )}
          </button>
          <span style={{ fontSize: 'var(--fs-body-sm)', opacity: 0.85 }}>
            {username}{' '}
            <span style={{ opacity: 0.65, fontSize: 'var(--fs-label)' }}>({roleLabel})</span>
          </span>
          <button
            onClick={handleSignOut}
            style={{
              fontSize: 'var(--fs-body-sm)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.4)',
              padding: '4px 14px', borderRadius: 'var(--radius-sm)',
              background: 'transparent', cursor: 'pointer',
              transition: 'var(--transition)',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Sign Out
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <nav className="e2o-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 64, padding: '16px 8px', flexShrink: 0 }}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              title={item.label}
              onClick={() => handleNavChange(item.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, padding: '10px 4px', borderRadius: 'var(--radius-sm)',
                border: 'none', cursor: 'pointer', transition: 'var(--transition)',
                fontSize: 9, fontWeight: 'var(--fw-medium)', lineHeight: 1.3, textAlign: 'center',
                color: activeNav === item.id ? '#fff' : 'rgba(255,255,255,0.6)',
                background: activeNav === item.id ? 'var(--cadet-dark)' : 'transparent',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Main Content */}
        <main style={{ flex: 1, overflow: 'auto', padding: 32 }}>
          {renderContent()}
        </main>
      </div>
    </div>
  )
}
