import { useEffect, useState } from 'react'
import { getUsers, createUser, updateUser, resetPassword, deactivateUser } from '../../api/users.js'
import api from '../../api/auth.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_ROLES = [
  { value: 'admin',               label: 'Admin',               type: 'internal' },
  { value: 'supply_planner',      label: 'Supply Planner',      type: 'internal' },
  { value: 'demand_planner',      label: 'Demand Planner',      type: 'internal' },
  { value: 'warehouse_user',      label: 'Warehouse User',      type: 'internal' },
  { value: 'inbound_specialist',  label: 'Inbound Specialist',  type: 'internal' },
  { value: 'outbound_specialist', label: 'Outbound Specialist', type: 'internal' },
  { value: 'rma_manager',         label: 'RMA Manager',         type: 'internal' },
  { value: 'senior_management',   label: 'Senior Management',   type: 'internal' },
  { value: 'repair_centre',       label: 'Repair Centre',       type: 'external' },
  { value: 'supplier',            label: 'Supplier User',       type: 'external' },
]

const ROLE_BADGE_COLORS = {
  admin:               { bg: '#fee2e2', text: '#991b1b' },
  supply_planner:      { bg: '#dbeafe', text: '#1e40af' },
  demand_planner:      { bg: '#e0e7ff', text: '#3730a3' },
  warehouse_user:      { bg: '#dcfce7', text: '#166534' },
  repair_centre:       { bg: '#f3e8ff', text: '#6b21a8' },
  supplier:            { bg: '#ffedd5', text: '#9a3412' },
  inbound_specialist:  { bg: '#d1fae5', text: '#065f46' },
  outbound_specialist: { bg: '#fef3c7', text: '#92400e' },
  rma_manager:         { bg: '#fce7f3', text: '#9d174d' },
  senior_management:   { bg: '#e0f2fe', text: '#075985' },
}

// PRD Appendix A — Roles & Rights Matrix
const RIGHTS_MATRIX = [
  { feature: 'Admin — Master Data + System Config',      admin:'R/W', supply_planner:'R',   demand_planner:'—',   warehouse_user:'—', supplier:'—', repair_centre:'—', inbound_specialist:'—', outbound_specialist:'—', rma_manager:'—', senior_management:'—' },
  { feature: 'Admin — Master Data Supply Chain',         admin:'R/W', supply_planner:'R/W', demand_planner:'—',   warehouse_user:'—', supplier:'—', repair_centre:'—', inbound_specialist:'—', outbound_specialist:'—', rma_manager:'—', senior_management:'—' },
  { feature: 'Admin — Upload',                           admin:'R/W', supply_planner:'R/W', demand_planner:'—',   warehouse_user:'—', supplier:'—', repair_centre:'—', inbound_specialist:'—', outbound_specialist:'—', rma_manager:'—', senior_management:'—' },
  { feature: 'Network Design (R3)',                      admin:'R/W', supply_planner:'R/W', demand_planner:'R',   warehouse_user:'—', supplier:'—', repair_centre:'—', inbound_specialist:'—', outbound_specialist:'—', rma_manager:'—', senior_management:'—' },
  { feature: 'Inventory — Terminal Serial Numbers',      admin:'R/W', supply_planner:'R/W', demand_planner:'R/W', warehouse_user:'R', supplier:'R', repair_centre:'R', inbound_specialist:'R', outbound_specialist:'R', rma_manager:'R', senior_management:'R' },
  { feature: 'Purchase Orders — Create, Issue & Cancel', admin:'R/W', supply_planner:'R/W', demand_planner:'R',   warehouse_user:'R', supplier:'R', repair_centre:'R', inbound_specialist:'R/W', outbound_specialist:'R', rma_manager:'R', senior_management:'R' },
  { feature: 'Purchase Orders — Import Serials',         admin:'R/W', supply_planner:'R/W', demand_planner:'R',   warehouse_user:'R/W', supplier:'R/W', repair_centre:'R/W', inbound_specialist:'R/W', outbound_specialist:'R', rma_manager:'R', senior_management:'R' },
  { feature: 'Purchase Orders — Receive',                admin:'R/W', supply_planner:'R/W', demand_planner:'R',   warehouse_user:'R/W', supplier:'R/W', repair_centre:'R/W', inbound_specialist:'R/W', outbound_specialist:'R', rma_manager:'R/W', senior_management:'R' },
  { feature: 'Outbound Orders — Create, Issue & Cancel', admin:'R/W', supply_planner:'R/W', demand_planner:'R',   warehouse_user:'R', supplier:'—', repair_centre:'—', inbound_specialist:'—', outbound_specialist:'R/W', rma_manager:'—', senior_management:'—' },
  { feature: 'Outbound Orders — Allocate Serials',       admin:'R/W', supply_planner:'R/W', demand_planner:'R',   warehouse_user:'R/W', supplier:'—', repair_centre:'—', inbound_specialist:'—', outbound_specialist:'R/W', rma_manager:'—', senior_management:'—' },
  { feature: 'Outbound Orders — Ship & Receive',         admin:'R/W', supply_planner:'R/W', demand_planner:'R',   warehouse_user:'R/W', supplier:'—', repair_centre:'—', inbound_specialist:'—', outbound_specialist:'R/W', rma_manager:'—', senior_management:'—' },
  { feature: 'Distribution Orders — Create, Issue',      admin:'R/W', supply_planner:'R/W', demand_planner:'R',   warehouse_user:'R', supplier:'—', repair_centre:'—', inbound_specialist:'R/W', outbound_specialist:'R/W', rma_manager:'—', senior_management:'—' },
  { feature: 'Distribution Orders — Allocate & Ship',    admin:'R/W', supply_planner:'R/W', demand_planner:'R',   warehouse_user:'R/W', supplier:'—', repair_centre:'—', inbound_specialist:'R/W', outbound_specialist:'R/W', rma_manager:'—', senior_management:'—' },
  { feature: 'Warehouse Tasks & Work Orders',            admin:'R/W', supply_planner:'R',   demand_planner:'R',   warehouse_user:'R/W', supplier:'—', repair_centre:'—', inbound_specialist:'—', outbound_specialist:'—', rma_manager:'—', senior_management:'—' },
  { feature: 'Returns',                                  admin:'R/W', supply_planner:'R',   demand_planner:'R',   warehouse_user:'R/W', supplier:'—', repair_centre:'—', inbound_specialist:'R/W', outbound_specialist:'R/W', rma_manager:'R/W', senior_management:'R' },
  { feature: 'Repairs — General',                        admin:'R/W', supply_planner:'R',   demand_planner:'R',   warehouse_user:'R/W', supplier:'R/W', repair_centre:'R/W', inbound_specialist:'R/W', outbound_specialist:'R/W', rma_manager:'R/W', senior_management:'R' },
  { feature: 'Demand Signals & Forecast',                admin:'R/W', supply_planner:'R/W', demand_planner:'R/W', warehouse_user:'—', supplier:'—', repair_centre:'—', inbound_specialist:'—', outbound_specialist:'R', rma_manager:'—', senior_management:'R' },
  { feature: 'Supply — Stock Targets & Replenishment',   admin:'R/W', supply_planner:'R/W', demand_planner:'R',   warehouse_user:'—', supplier:'—', repair_centre:'—', inbound_specialist:'—', outbound_specialist:'—', rma_manager:'—', senior_management:'R' },
  { feature: 'Analytics',                                admin:'R/W', supply_planner:'R/W', demand_planner:'R',   warehouse_user:'R', supplier:'—', repair_centre:'—', inbound_specialist:'—', outbound_specialist:'—', rma_manager:'—', senior_management:'R' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function RoleBadge({ roleCode }) {
  const meta  = ALL_ROLES.find(r => r.value === roleCode)
  const color = ROLE_BADGE_COLORS[roleCode] || { bg: '#f3f4f6', text: '#374151' }
  return (
    <span style={{ background: color.bg, color: color.text, borderRadius: 9999, padding: '2px 7px', fontSize: 11, fontWeight: 600, display: 'inline-block', margin: '1px 2px' }}>
      {meta?.label || roleCode}
    </span>
  )
}

function StatusBadge({ active }) {
  return active ? (
    <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Active</span>
  ) : (
    <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 9999, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Inactive</span>
  )
}

function RightCell({ value }) {
  const color = value === 'R/W' ? '#166534' : value === 'R' ? '#1e40af' : '#9ca3af'
  const bg    = value === 'R/W' ? '#dcfce7' : value === 'R' ? '#dbeafe' : 'transparent'
  return (
    <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: 11, fontWeight: value !== '—' ? 600 : 400, color, background: bg }}>
      {value}
    </td>
  )
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: wide ? 660 : 480, margin: '0 1rem', padding: '1.5rem', zIndex: 10, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1f2937' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const INPUT = { width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '7px 11px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const BTN_PRIMARY = { background: '#1E4E8C', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const BTN_SECONDARY = { background: 'transparent', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }

function FormRow({ label, required, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#f87171', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function MultiCheckbox({ label, options, selected, onChange }) {
  function toggle(val) {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val])
  }
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(opt => (
          <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', background: selected.includes(opt.value) ? '#e0f2fe' : '#f9fafb', border: `1px solid ${selected.includes(opt.value) ? '#0284c7' : '#e5e7eb'}`, borderRadius: 6, padding: '4px 9px', userSelect: 'none' }}>
            <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} style={{ margin: 0 }} />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  )
}

function MultiSelect({ label, options, selected, onChange }) {
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(v => v !== id) : [...selected, id])
  }
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>{label}</p>
      <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 6 }}>
        {options.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af' }}>None available</p>}
        {options.map(opt => (
          <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', padding: '3px 4px', borderRadius: 4, background: selected.includes(opt.id) ? '#f0fdf4' : 'transparent' }}>
            <input type="checkbox" checked={selected.includes(opt.id)} onChange={() => toggle(opt.id)} style={{ margin: 0 }} />
            {opt.code} — {opt.name}
          </label>
        ))}
      </div>
    </div>
  )
}

function InlineMsg({ success, error }) {
  if (error)   return <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8, padding: '8px 12px', background: '#fef2f2', borderRadius: 6 }}>{error}</p>
  if (success) return <p style={{ color: '#16a34a', fontSize: 13, marginTop: 8, padding: '8px 12px', background: '#f0fdf4', borderRadius: 6 }}>{success}</p>
  return null
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const PAGE_TABS = [
  { id: 'users', label: 'Users' },
  { id: 'roles', label: 'Roles & Rights' },
]

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function UsersPage({ role, currentUsername }) {
  if (role !== 'admin') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Access restricted to administrators.</p>
      </div>
    )
  }

  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [regions, setRegions] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [showInactive, setShowInactive] = useState(false)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [modalSuccess, setModalSuccess] = useState(null)
  const [modalError, setModalError] = useState(null)

  // Form state
  const [createForm, setCreateForm] = useState({ username: '', password: '', email: '', roles: ['warehouse_user'], location_ids: [], region_ids: [], supplier_id: '' })
  const [editForm, setEditForm] = useState({ email: '', roles: [], location_ids: [], region_ids: [], active: 1, supplier_id: '' })
  const [resetForm, setResetForm] = useState({ new_password: '', confirm_password: '' })

  async function fetchUsers() {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await getUsers({ include_inactive: showInactive })
      setUsers(res.data)
    } catch (err) {
      setFetchError(err?.response?.data?.detail || 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.all([
      api.get('/locations').then(r => setLocations(r.data)).catch(() => {}),
      api.get('/users/meta/regions').then(r => setRegions(r.data)).catch(() => {}),
      api.get('/suppliers').then(r => setSuppliers(r.data)).catch(() => {}),
    ])
  }, [])

  useEffect(() => { fetchUsers() }, [showInactive])

  function clearModal() { setModalSuccess(null); setModalError(null) }

  function openCreate() {
    setCreateForm({ username: '', password: '', email: '', roles: ['warehouse_user'], location_ids: [], region_ids: [], supplier_id: '' })
    clearModal(); setShowCreateModal(true)
  }

  function openEdit(user) {
    setSelectedUser(user)
    setEditForm({
      email: user.email || '',
      roles: user.roles || [user.role],
      location_ids: user.location_ids || [],
      region_ids: user.region_ids || [],
      active: user.active,
      supplier_id: user.supplier_id || '',
    })
    clearModal(); setShowEditModal(true)
  }

  function openReset(user) {
    setSelectedUser(user)
    setResetForm({ new_password: '', confirm_password: '' })
    clearModal(); setShowResetModal(true)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (createForm.roles.length === 0) { setModalError('Please select at least one role.'); return }
    if (/\s/.test(createForm.username)) { setModalError('Username must be a single word with no spaces.'); return }
    setSubmitting(true); setModalError(null); setModalSuccess(null)
    try {
      await createUser({
        username: createForm.username,
        password: createForm.password,
        email: createForm.email || null,
        role: createForm.roles[0],
        roles: createForm.roles,
        location_ids: createForm.location_ids,
        region_ids: createForm.region_ids,
        supplier_id: createForm.supplier_id ? Number(createForm.supplier_id) : null,
      })
      setModalSuccess('User created successfully.')
      await fetchUsers()
      setTimeout(() => { setShowCreateModal(false); setModalSuccess(null) }, 1200)
    } catch (err) {
      setModalError(err?.response?.data?.detail || 'Failed to create user.')
    } finally { setSubmitting(false) }
  }

  async function handleEdit(e) {
    e.preventDefault()
    if (editForm.roles.length === 0) { setModalError('Please select at least one role.'); return }
    setSubmitting(true); setModalError(null); setModalSuccess(null)
    try {
      await updateUser(selectedUser.id, {
        email: editForm.email || null,
        role: editForm.roles[0],
        roles: editForm.roles,
        location_ids: editForm.location_ids,
        region_ids: editForm.region_ids,
        active: editForm.active,
        supplier_id: editForm.supplier_id ? Number(editForm.supplier_id) : null,
      })
      setModalSuccess('User updated successfully.')
      await fetchUsers()
      setTimeout(() => { setShowEditModal(false); setModalSuccess(null) }, 1200)
    } catch (err) {
      setModalError(err?.response?.data?.detail || 'Failed to update user.')
    } finally { setSubmitting(false) }
  }

  async function handleReset(e) {
    e.preventDefault()
    if (resetForm.new_password !== resetForm.confirm_password) { setModalError('Passwords do not match.'); return }
    setSubmitting(true); setModalError(null); setModalSuccess(null)
    try {
      await resetPassword(selectedUser.id, { new_password: resetForm.new_password })
      setModalSuccess('Password reset successfully.')
      setTimeout(() => { setShowResetModal(false); setModalSuccess(null) }, 1200)
    } catch (err) {
      setModalError(err?.response?.data?.detail || 'Failed to reset password.')
    } finally { setSubmitting(false) }
  }

  async function handleDeactivate(user) {
    if (!confirm(`Deactivate "${user.username}"? They will no longer be able to log in.`)) return
    try { await deactivateUser(user.id); await fetchUsers() }
    catch (err) { alert(err?.response?.data?.detail || 'Failed to deactivate user.') }
  }

  // ---------------------------------------------------------------------------
  // Roles & Rights matrix tab
  // ---------------------------------------------------------------------------

  const roleColumns = ALL_ROLES.map(r => r.value)

  function renderRolesTab() {
    return (
      <div>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Access rights per role across all IMS functional areas. R/W = Read/Write, R = Read only, — = No access.
        </p>
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', minWidth: 200 }}>Feature / Area</th>
                {ALL_ROLES.map(r => (
                  <th key={r.value} style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: r.type === 'external' ? '#9a3412' : '#1e40af', minWidth: 80, fontSize: 11 }}>
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RIGHTS_MATRIX.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '6px 12px', color: '#374151', fontWeight: 500, fontSize: 12 }}>{row.feature}</td>
                  {roleColumns.map(rc => (
                    <RightCell key={rc} value={row[rc] || '—'} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af', display: 'flex', gap: 16 }}>
          <span><strong style={{ color: '#166534' }}>R/W</strong> = Read &amp; Write</span>
          <span><strong style={{ color: '#1e40af' }}>R</strong> = Read only</span>
          <span><strong style={{ color: '#9ca3af' }}>—</strong> = No access</span>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Users tab
  // ---------------------------------------------------------------------------

  const activeLocations = locations.filter(l => l.active !== 0)

  // Filter locations by selected roles (enforced per role type)
  function getFilteredLocations(roles) {
    if (roles.includes('supplier')) return activeLocations.filter(l => l.location_type_name === 'Supplier')
    if (roles.includes('repair_centre') && !roles.some(r => ['admin','supply_planner','warehouse_user','inbound_specialist','outbound_specialist'].includes(r)))
      return activeLocations.filter(l => l.location_type_name === 'Repair Centre')
    if (roles.includes('warehouse_user') && !roles.some(r => ['admin','supply_planner'].includes(r)))
      return activeLocations.filter(l => ['Warehouse','FSL'].includes(l.location_type_name))
    return activeLocations
  }

  function renderUsersTab() {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Show inactive users
          </label>
          <button onClick={openCreate} style={{ ...BTN_PRIMARY, padding: '7px 16px' }}>+ New User</button>
        </div>

        {fetchError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{fetchError}</p>}

        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading users…</div>
          ) : users.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No users found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#f8fafc' }}>
                    {['Username','Email','Roles','Supplier','Locations','Regions','Status','Created','Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const isSelf = user.username === currentUsername
                    return (
                      <tr key={user.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1f2937' }}>
                          {user.username}{isSelf && <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 4 }}>(you)</span>}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6b7280' }}>{user.email || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                            {(user.roles || [user.role]).map(r => <RoleBadge key={r} roleCode={r} />)}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12 }}>{user.supplier_name || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12 }}>
                          {(user.locations || []).length > 0
                            ? user.locations.map(l => l.code).join(', ')
                            : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12 }}>
                          {(user.regions || []).length > 0
                            ? user.regions.map(r => r.code).join(', ')
                            : '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}><StatusBadge active={user.active} /></td>
                        <td style={{ padding: '10px 12px', color: '#9ca3af', fontSize: 11 }}>{user.created_at?.slice(0,10) || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button onClick={() => openEdit(user)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151' }}>Edit</button>
                            <button onClick={() => openReset(user)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #fcd34d', background: '#fff', cursor: 'pointer', color: '#92400e' }}>Reset PW</button>
                            {user.active === 1 && !isSelf && (
                              <button onClick={() => handleDeactivate(user)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', cursor: 'pointer', color: '#b91c1c' }}>Deactivate</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1f2937' }}>Users &amp; Roles</h1>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: 20, gap: 2 }}>
        {PAGE_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            border: 'none', background: 'transparent',
            color: activeTab === t.id ? '#1E4E8C' : '#6b7280',
            borderBottom: activeTab === t.id ? '2px solid #1E4E8C' : '2px solid transparent',
            marginBottom: -2,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' ? renderUsersTab() : renderRolesTab()}

      {/* Create Modal */}
      {showCreateModal && (
        <Modal title="New User" onClose={() => setShowCreateModal(false)} wide>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FormRow label="Username" required>
                <input style={INPUT} value={createForm.username} onChange={e => setCreateForm(f => ({...f, username: e.target.value}))} required placeholder="e.g. jsmith" autoComplete="off" />
              </FormRow>
              <FormRow label="Password" required>
                <input type="password" style={INPUT} value={createForm.password} onChange={e => setCreateForm(f => ({...f, password: e.target.value}))} required placeholder="••••••••" autoComplete="new-password" />
              </FormRow>
              <FormRow label="Email">
                <input type="email" style={INPUT} value={createForm.email} onChange={e => setCreateForm(f => ({...f, email: e.target.value}))} placeholder="jsmith@example.com" />
              </FormRow>
            </div>
            <div style={{ marginTop: 14 }}>
              <MultiCheckbox
                label="Roles (select one or more)"
                options={ALL_ROLES.map(r => ({ value: r.value, label: r.label }))}
                selected={createForm.roles}
                onChange={v => setCreateForm(f => ({...f, roles: v, location_ids: []}))}
              />
            </div>
            {createForm.roles.includes('supplier') && (
              <div style={{ marginTop: 14 }}>
                <FormRow label="Supplier Company" required>
                  <select style={INPUT} value={createForm.supplier_id} onChange={e => setCreateForm(f => ({...f, supplier_id: e.target.value}))} required>
                    <option value="">— Select supplier —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </FormRow>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <MultiSelect
                label={`Assigned Locations${createForm.roles.includes('supplier') ? ' (Supplier locations)' : createForm.roles.includes('repair_centre') ? ' (Repair Centre locations)' : createForm.roles.includes('warehouse_user') ? ' (Warehouse/FSL locations)' : ''}`}
                options={getFilteredLocations(createForm.roles).map(l => ({ id: l.id, code: l.code, name: l.name }))}
                selected={createForm.location_ids}
                onChange={v => setCreateForm(f => ({...f, location_ids: v}))}
              />
              <MultiSelect label="Assigned Regions" options={regions.map(r => ({ id: r.id, code: r.code, name: r.name }))} selected={createForm.region_ids} onChange={v => setCreateForm(f => ({...f, region_ids: v}))} />
            </div>
            <InlineMsg success={modalSuccess} error={modalError} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowCreateModal(false)} style={BTN_SECONDARY}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ ...BTN_PRIMARY, opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Creating…' : 'Create User'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedUser && (
        <Modal title={`Edit User: ${selectedUser.username}`} onClose={() => setShowEditModal(false)} wide>
          <form onSubmit={handleEdit}>
            <FormRow label="Email">
              <input type="email" style={INPUT} value={editForm.email} onChange={e => setEditForm(f => ({...f, email: e.target.value}))} placeholder="jsmith@example.com" />
            </FormRow>
            <div style={{ marginTop: 14 }}>
              <MultiCheckbox
                label="Roles (select one or more)"
                options={ALL_ROLES.map(r => ({ value: r.value, label: r.label }))}
                selected={editForm.roles}
                onChange={v => setEditForm(f => ({...f, roles: v, location_ids: []}))}
              />
            </div>
            {editForm.roles.includes('supplier') && (
              <div style={{ marginTop: 14 }}>
                <FormRow label="Supplier Company">
                  <select style={INPUT} value={editForm.supplier_id} onChange={e => setEditForm(f => ({...f, supplier_id: e.target.value}))}>
                    <option value="">— Select supplier —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </FormRow>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <MultiSelect
                label={`Assigned Locations${editForm.roles.includes('supplier') ? ' (Supplier locations)' : editForm.roles.includes('repair_centre') ? ' (Repair Centre locations)' : editForm.roles.includes('warehouse_user') ? ' (Warehouse/FSL locations)' : ''}`}
                options={getFilteredLocations(editForm.roles).map(l => ({ id: l.id, code: l.code, name: l.name }))}
                selected={editForm.location_ids}
                onChange={v => setEditForm(f => ({...f, location_ids: v}))}
              />
              <MultiSelect label="Assigned Regions" options={regions.map(r => ({ id: r.id, code: r.code, name: r.name }))} selected={editForm.region_ids} onChange={v => setEditForm(f => ({...f, region_ids: v}))} />
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={editForm.active === 1} onChange={e => setEditForm(f => ({...f, active: e.target.checked ? 1 : 0}))} />
                User is active
              </label>
            </div>
            <InlineMsg success={modalSuccess} error={modalError} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowEditModal(false)} style={BTN_SECONDARY}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ ...BTN_PRIMARY, opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {showResetModal && selectedUser && (
        <Modal title={`Reset Password: ${selectedUser.username}`} onClose={() => setShowResetModal(false)}>
          <form onSubmit={handleReset}>
            <FormRow label="New Password" required>
              <input type="password" style={INPUT} value={resetForm.new_password} onChange={e => setResetForm(f => ({...f, new_password: e.target.value}))} required placeholder="••••••••" autoComplete="new-password" />
            </FormRow>
            <FormRow label="Confirm Password" required>
              <input type="password" style={INPUT} value={resetForm.confirm_password} onChange={e => setResetForm(f => ({...f, confirm_password: e.target.value}))} required placeholder="••••••••" autoComplete="new-password" />
            </FormRow>
            <InlineMsg success={modalSuccess} error={modalError} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowResetModal(false)} style={BTN_SECONDARY}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ ...BTN_PRIMARY, opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Resetting…' : 'Reset Password'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
