import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Nav structure — kept in sync with DashboardPage
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { id: 'dashboard',       label: 'Dashboard',         icon: '⊞' },
  { id: 'inventory',       label: 'Inventory',         icon: '▦' },
  { id: 'sales-orders',    label: 'Orders',            icon: '↑' },
  { id: 'dist-orders',     label: 'Distribution',      icon: '⇆' },
  { id: 'repair-rework',   label: 'Returns & Repairs', icon: '⚒' },
  { id: 'demand',          label: 'Demand',            icon: '◈' },
  { id: 'supply',          label: 'Supply',            icon: '⟳' },
  { id: 'analytics',       label: 'Analytics',         icon: '⌁' },
  { id: 'warehouse-tasks', label: 'Warehouse Tasks',   icon: '⬡' },
  { id: 'alerts',          label: 'Alerts',            icon: '🔔' },
  { id: 'admin',           label: 'Admin',             icon: '⚙' },
]

const ROLE_LABELS = {
  admin:               'Admin',
  supply_planner:      'Supply Planner',
  warehouse_user:      'Warehouse User',
  repair_centre:       'Repair Centre',
  supplier:            'Supplier',
  demand_planner:      'Demand Planner',
  inbound_specialist:  'Inbound Specialist',
  outbound_specialist: 'Outbound Specialist',
  rma_manager:         'RMA Manager',
  senior_management:   'Senior Management',
}

const SIDEBAR_EXPANDED = 220
const SIDEBAR_COLLAPSED = 56

// ---------------------------------------------------------------------------
// Role-based visibility — kept in sync with DashboardPage
// ---------------------------------------------------------------------------

function hasAnyRole(roles, ...codes) {
  return codes.some(c => roles.includes(c))
}

function isNavVisible(navId, roles) {
  const isAdmin     = roles.includes('admin')
  const isSupplier  = roles.includes('supplier')
  const isWarehouse = hasAnyRole(roles, 'admin', 'supply_planner', 'warehouse_user',
                        'inbound_specialist', 'outbound_specialist')

  switch (navId) {
    case 'dashboard':       return true
    case 'inventory':       return true
    case 'sales-orders':    return hasAnyRole(roles, 'admin', 'supply_planner', 'demand_planner',
                              'warehouse_user', 'inbound_specialist', 'outbound_specialist',
                              'rma_manager', 'senior_management')
    case 'dist-orders':     return hasAnyRole(roles, 'admin', 'supply_planner', 'demand_planner',
                              'warehouse_user', 'inbound_specialist', 'outbound_specialist')
    case 'repair-rework':   return !isSupplier
    case 'demand':          return hasAnyRole(roles, 'admin', 'supply_planner', 'demand_planner',
                              'outbound_specialist', 'senior_management')
    case 'supply':          return hasAnyRole(roles, 'admin', 'supply_planner', 'demand_planner',
                              'senior_management')
    case 'analytics':       return hasAnyRole(roles, 'admin', 'supply_planner', 'demand_planner',
                              'warehouse_user', 'senior_management')
    case 'warehouse-tasks': return isWarehouse
    case 'alerts':          return true
    case 'admin':           return isAdmin
    default:                return isAdmin
  }
}

// ---------------------------------------------------------------------------
// AppShell
// Props:
//   title     — subtitle shown in topbar
//   onBack    — if provided, renders a ← Back button in topbar
//   backLabel — label for back button (default "← Back")
// ---------------------------------------------------------------------------

export default function AppShell({ children, title, onBack, backLabel = '← Back' }) {
  const navigate   = useNavigate()
  const inputRef   = useRef(null)

  const username  = localStorage.getItem('username') || 'User'
  const role      = localStorage.getItem('role') || ''
  const rolesRaw  = (() => { try { return JSON.parse(localStorage.getItem('roles') || '[]') } catch { return [] } })()
  const roles     = rolesRaw.length > 0 ? rolesRaw : (role ? [role] : [])
  const roleLabel = roles.map(r => ROLE_LABELS[r] || r).join(', ') || role

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true')
  const [searchQuery, setSearchQuery] = useState('')

  const visibleItems = NAV_ITEMS.filter(item => isNavVisible(item.id, roles))

  function handleToggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar_collapsed', String(next))
  }

  function handleNav(id) {
    sessionStorage.setItem('dash_nav', id)
    navigate('/dashboard')
  }

  function handleSearchSubmit() {
    const q = searchQuery.trim()
    if (!q) return
    sessionStorage.setItem('dash_nav', 'search')
    navigate(`/dashboard?q=${encodeURIComponent(q)}`)
  }

  function handleSearchKey(e) {
    if (e.key === 'Enter') handleSearchSubmit()
  }

  function handleSignOut() {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('roles')
    localStorage.removeItem('username')
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-2)' }}>

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <header className="e2o-topbar" style={{ flexShrink: 0, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)',
                color: '#fff', borderRadius: 'var(--radius-sm)', padding: '4px 14px',
                fontSize: 'var(--fs-body-sm)', cursor: 'pointer', fontWeight: 'var(--fw-semibold)',
              }}
            >
              {backLabel}
            </button>
          )}
          <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-body-lg)', letterSpacing: '0.02em' }}>
            Terminal Stock App
          </span>
        </div>
        {title && (
          <span style={{ fontSize: 'var(--fs-body-sm)', opacity: 0.8 }}>{title}</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
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
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            Sign Out
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar ───────────────────────────────────────────────── */}
        <nav
          className="e2o-sidebar"
          style={{
            width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED,
            minWidth: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED,
            transition: 'width 0.2s ease, min-width 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            padding: '8px 0',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {/* Toggle */}
          <button
            onClick={handleToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              display: 'flex', alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-end',
              padding: '6px 10px', border: 'none', background: 'transparent',
              cursor: 'pointer', color: 'rgba(0,0,0,0.4)',
              fontSize: 16, lineHeight: 1, flexShrink: 0,
              transition: 'color 0.15s', marginBottom: 4,
            }}
            onMouseOver={e => e.currentTarget.style.color = 'rgba(0,0,0,0.8)'}
            onMouseOut={e => e.currentTarget.style.color = 'rgba(0,0,0,0.4)'}
          >
            {collapsed ? '›' : '‹'}
          </button>

          {/* Search — expanded */}
          {!collapsed && (
            <div style={{ padding: '0 10px', marginBottom: 8, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.07)', borderRadius: 6, overflow: 'hidden' }}>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKey}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: '#1a1a1a', fontSize: 12, padding: '6px 8px',
                  }}
                />
                <button
                  onClick={handleSearchSubmit}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'rgba(0,0,0,0.4)', padding: '6px 8px', fontSize: 13, lineHeight: 1,
                  }}
                >
                  ⌕
                </button>
              </div>
            </div>
          )}

          {/* Search icon — collapsed */}
          {collapsed && (
            <button
              onClick={() => { handleToggleCollapse(); setTimeout(() => inputRef.current?.focus(), 250) }}
              title="Search"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 6px 8px', padding: '8px', borderRadius: 6,
                border: 'none', background: 'transparent', cursor: 'pointer',
                color: 'rgba(0,0,0,0.4)', fontSize: 16,
              }}
            >
              ⌕
            </button>
          )}

          {/* Nav items */}
          <div style={{
            flex: 1, overflowY: 'auto', overflowX: 'hidden',
            display: 'flex', flexDirection: 'column', gap: 2, padding: '0 6px',
          }}>
            {visibleItems.map((item) => (
              <button
                key={item.id}
                title={collapsed ? item.label : undefined}
                onClick={() => handleNav(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: collapsed ? '10px 0' : '9px 10px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                  background: 'transparent',
                  borderLeft: '3px solid transparent',
                  color: 'rgba(0,0,0,0.65)',
                  fontWeight: 400,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 17, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && (
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Main content ─────────────────────────────────────────── */}
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
