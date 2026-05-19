import { useEffect, useState } from 'react'
import { getUsers, createUser, updateUser, resetPassword, deactivateUser } from '../../api/users.js'
import api from '../../api/auth.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLES = [
  { value: 'admin',           label: 'Admin' },
  { value: 'supply_planner',  label: 'Supply Planner' },
  { value: 'demand_planner',  label: 'Demand Planner' },
  { value: 'warehouse_user',  label: 'Warehouse User' },
  { value: 'repair_centre',   label: 'Repair Centre' },
  { value: 'supplier',        label: 'Supplier' },
]

const ROLE_BADGE = {
  admin:           { bg: '#fee2e2', text: '#991b1b' },
  supply_planner:  { bg: '#dbeafe', text: '#1e40af' },
  demand_planner:  { bg: '#e0e7ff', text: '#3730a3' },
  warehouse_user:  { bg: '#dcfce7', text: '#166534' },
  repair_centre:   { bg: '#f3e8ff', text: '#6b21a8' },
  supplier:        { bg: '#ffedd5', text: '#9a3412' },
}

const EMPTY_CREATE_FORM = {
  username: '',
  password: '',
  email: '',
  role: 'warehouse_user',
  default_location_id: '',
}

const EMPTY_EDIT_FORM = {
  email: '',
  role: 'warehouse_user',
  default_location_id: '',
  active: 1,
}

const EMPTY_RESET_FORM = {
  new_password: '',
  confirm_password: '',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black bg-opacity-40"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormRow({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const INPUT_CLS =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

function RoleBadge({ role }) {
  const style = ROLE_BADGE[role] || { bg: '#f3f4f6', text: '#374151' }
  const label = ROLES.find((r) => r.value === role)?.label || role
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {label}
    </span>
  )
}

function StatusBadge({ active }) {
  return active ? (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      Active
    </span>
  ) : (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
      Inactive
    </span>
  )
}

function InlineMessage({ success, error }) {
  if (error)
    return <p className="text-red-600 text-sm mt-2 p-2 bg-red-50 rounded-lg">{error}</p>
  if (success)
    return <p className="text-green-700 text-sm mt-2 p-2 bg-green-50 rounded-lg">{success}</p>
  return null
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function UsersPage({ role, currentUsername }) {
  // Access guard
  if (role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-white rounded-2xl shadow p-8 text-center max-w-sm">
          <p className="text-gray-500 text-sm">Access restricted to administrators.</p>
        </div>
      </div>
    )
  }

  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [showInactive, setShowInactive] = useState(false)

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)

  // Form state
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM)
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM)
  const [resetForm, setResetForm] = useState(EMPTY_RESET_FORM)
  const [selectedUserId, setSelectedUserId] = useState(null)

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [modalSuccess, setModalSuccess] = useState(null)
  const [modalError, setModalError] = useState(null)

  // ── Data fetching ──────────────────────────────────────────────────────────

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

  async function fetchLocations() {
    try {
      const res = await api.get('/locations')
      setLocations(res.data)
    } catch {
      // Locations are optional — fail silently, dropdowns will just be empty
    }
  }

  useEffect(() => {
    fetchLocations()
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [showInactive])

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function clearModalState() {
    setModalSuccess(null)
    setModalError(null)
  }

  function openCreateModal() {
    setCreateForm(EMPTY_CREATE_FORM)
    clearModalState()
    setShowCreateModal(true)
  }

  function openEditModal(user) {
    setSelectedUserId(user.id)
    setEditForm({
      email: user.email || '',
      role: user.role,
      default_location_id: user.default_location_id ? String(user.default_location_id) : '',
      active: user.active,
    })
    clearModalState()
    setShowEditModal(true)
  }

  function openResetModal(user) {
    setSelectedUserId(user.id)
    setResetForm(EMPTY_RESET_FORM)
    clearModalState()
    setShowResetModal(true)
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleCreate(e) {
    e.preventDefault()
    setSubmitting(true)
    setModalError(null)
    setModalSuccess(null)
    try {
      const payload = {
        username: createForm.username,
        password: createForm.password,
        email: createForm.email || null,
        role: createForm.role,
        default_location_id: createForm.default_location_id
          ? parseInt(createForm.default_location_id)
          : null,
      }
      await createUser(payload)
      setModalSuccess('User created successfully.')
      await fetchUsers()
      setTimeout(() => {
        setShowCreateModal(false)
        setModalSuccess(null)
      }, 1200)
    } catch (err) {
      setModalError(err?.response?.data?.detail || 'Failed to create user.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEdit(e) {
    e.preventDefault()
    setSubmitting(true)
    setModalError(null)
    setModalSuccess(null)
    try {
      const payload = {
        email: editForm.email || null,
        role: editForm.role,
        default_location_id: editForm.default_location_id
          ? parseInt(editForm.default_location_id)
          : null,
        active: editForm.active,
      }
      await updateUser(selectedUserId, payload)
      setModalSuccess('User updated successfully.')
      await fetchUsers()
      setTimeout(() => {
        setShowEditModal(false)
        setModalSuccess(null)
      }, 1200)
    } catch (err) {
      setModalError(err?.response?.data?.detail || 'Failed to update user.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    if (resetForm.new_password !== resetForm.confirm_password) {
      setModalError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    setModalError(null)
    setModalSuccess(null)
    try {
      await resetPassword(selectedUserId, { new_password: resetForm.new_password })
      setModalSuccess('Password reset successfully.')
      setTimeout(() => {
        setShowResetModal(false)
        setModalSuccess(null)
      }, 1200)
    } catch (err) {
      setModalError(err?.response?.data?.detail || 'Failed to reset password.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeactivate(user) {
    if (!confirm(`Deactivate user "${user.username}"? They will no longer be able to log in.`)) return
    try {
      await deactivateUser(user.id)
      await fetchUsers()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to deactivate user.')
    }
  }

  // ── Location dropdown helper ───────────────────────────────────────────────

  function locationLabel(loc) {
    return `${loc.code} – ${loc.name}`
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Users &amp; Roles</h1>
        <button
          onClick={openCreateModal}
          className="text-sm px-4 py-2 rounded-lg text-white font-medium transition hover:opacity-90"
          style={{ backgroundColor: 'var(--cadet-dark)' }}
        >
          + New User
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
          />
          Show inactive users
        </label>
      </div>

      {/* Error */}
      {fetchError && (
        <p className="text-red-500 text-sm">{fetchError}</p>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading users…</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">Username</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Role</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Default Location</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Created</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const defaultLoc = locations.find(
                    (l) => l.id === user.default_location_id,
                  )
                  const isSelf = user.username === currentUsername
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {user.username}
                        {isSelf && (
                          <span className="ml-2 text-xs text-gray-400">(you)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{user.email || '—'}</td>
                      <td className="px-4 py-3">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {defaultLoc ? locationLabel(defaultLoc) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge active={user.active} />
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {user.created_at
                          ? user.created_at.slice(0, 10)
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => openEditModal(user)}
                            className="text-xs px-2.5 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => openResetModal(user)}
                            className="text-xs px-2.5 py-1 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50 transition"
                          >
                            Reset Password
                          </button>
                          {user.active === 1 && !isSelf && (
                            <button
                              onClick={() => handleDeactivate(user)}
                              className="text-xs px-2.5 py-1 rounded-md border border-red-300 text-red-600 hover:bg-red-50 transition"
                            >
                              Deactivate
                            </button>
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

      {/* ── Create User Modal ──────────────────────────────────────────────── */}
      {showCreateModal && (
        <Modal title="New User" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <FormRow label="Username" required>
              <input
                className={INPUT_CLS}
                value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                required
                placeholder="e.g. jsmith"
                autoComplete="off"
              />
            </FormRow>
            <FormRow label="Password" required>
              <input
                type="password"
                className={INPUT_CLS}
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                required
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </FormRow>
            <FormRow label="Email">
              <input
                type="email"
                className={INPUT_CLS}
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="e.g. jsmith@example.com"
              />
            </FormRow>
            <FormRow label="Role" required>
              <select
                className={INPUT_CLS}
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                required
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Default Location">
              <select
                className={INPUT_CLS}
                value={createForm.default_location_id}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, default_location_id: e.target.value }))
                }
              >
                <option value="">— None —</option>
                {locations.filter((l) => l.active).map((l) => (
                  <option key={l.id} value={l.id}>
                    {locationLabel(l)}
                  </option>
                ))}
              </select>
            </FormRow>

            <InlineMessage success={modalSuccess} error={modalError} />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="text-sm px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 transition hover:opacity-90"
                style={{ backgroundColor: 'var(--cadet-dark)' }}
              >
                {submitting ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit User Modal ────────────────────────────────────────────────── */}
      {showEditModal && (
        <Modal title="Edit User" onClose={() => setShowEditModal(false)}>
          <form onSubmit={handleEdit} className="space-y-4">
            <FormRow label="Email">
              <input
                type="email"
                className={INPUT_CLS}
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="e.g. jsmith@example.com"
              />
            </FormRow>
            <FormRow label="Role" required>
              <select
                className={INPUT_CLS}
                value={editForm.role}
                onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                required
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Default Location">
              <select
                className={INPUT_CLS}
                value={editForm.default_location_id}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, default_location_id: e.target.value }))
                }
              >
                <option value="">— None —</option>
                {locations.filter((l) => l.active).map((l) => (
                  <option key={l.id} value={l.id}>
                    {locationLabel(l)}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Active">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.active === 1}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, active: e.target.checked ? 1 : 0 }))
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                />
                User is active
              </label>
            </FormRow>

            <InlineMessage success={modalSuccess} error={modalError} />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="text-sm px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 transition hover:opacity-90"
                style={{ backgroundColor: 'var(--cadet-dark)' }}
              >
                {submitting ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Reset Password Modal ───────────────────────────────────────────── */}
      {showResetModal && (
        <Modal title="Reset Password" onClose={() => setShowResetModal(false)}>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <FormRow label="New Password" required>
              <input
                type="password"
                className={INPUT_CLS}
                value={resetForm.new_password}
                onChange={(e) => setResetForm((f) => ({ ...f, new_password: e.target.value }))}
                required
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </FormRow>
            <FormRow label="Confirm Password" required>
              <input
                type="password"
                className={INPUT_CLS}
                value={resetForm.confirm_password}
                onChange={(e) =>
                  setResetForm((f) => ({ ...f, confirm_password: e.target.value }))
                }
                required
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </FormRow>

            <InlineMessage success={modalSuccess} error={modalError} />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="text-sm px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 transition hover:opacity-90"
                style={{ backgroundColor: 'var(--cadet-dark)' }}
              >
                {submitting ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
