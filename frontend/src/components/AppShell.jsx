import { useNavigate } from 'react-router-dom'

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
  { id: 'admin',           label: 'Admin',             icon: '⚙' },
]

const ROLE_LABELS = {
  admin:          'Admin',
  supply_planner: 'Supply Planner',
  warehouse_user: 'Warehouse User',
  repair_centre:  'Repair Centre',
  supplier:       'Supplier',
  demand_planner: 'Demand Planner',
}

/**
 * AppShell — topbar + sidebar wrapper for standalone pages.
 * Reads auth from localStorage so it doesn't need auth props.
 * Props:
 *   title    — subtitle shown in topbar
 *   onBack   — if provided, renders a ← Back button in topbar
 *   backLabel — label for back button (default "← Back")
 */
export default function AppShell({ children, title, onBack, backLabel = '← Back' }) {
  const navigate = useNavigate()
  const username  = localStorage.getItem('username') || 'User'
  const role      = localStorage.getItem('role') || ''
  const roleLabel = ROLE_LABELS[role] || role

  function handleNav(id) {
    sessionStorage.setItem('dash_nav', id)
    navigate('/dashboard')
  }

  function handleSignOut() {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('username')
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-2)' }}>
      {/* Top bar */}
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
            Inventory Management System
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
              onClick={() => handleNav(item.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, padding: '10px 4px', borderRadius: 'var(--radius-sm)',
                border: 'none', cursor: 'pointer', transition: 'var(--transition)',
                fontSize: 9, fontWeight: 'var(--fw-medium)', lineHeight: 1.3, textAlign: 'center',
                color: 'rgba(255,255,255,0.6)',
                background: 'transparent',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--cadet-dark)'; e.currentTarget.style.color = '#fff' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Content */}
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
