import { useState, useEffect } from 'react'
import { listClaimTypes, createClaimType, updateClaimType } from '../../api/claims.js'
import Modal from '../../components/Modal.jsx'

export default function ClaimTypesPage({ role }) {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', description: '', raised_against: 'Supplier' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const isAdmin = role === 'admin'

  async function load() {
    setLoading(true)
    try {
      const res = await listClaimTypes()
      setTypes(res.data)
    } catch {
      setError('Failed to load claim types')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function startEdit(ct) {
    setEditingId(ct.id)
    setEditForm({ name: ct.name, description: ct.description || '', raised_against: ct.raised_against, active: ct.active })
    setError(null)
  }

  async function handleSave(id) {
    setSaving(true)
    setError(null)
    try {
      await updateClaimType(id, editForm)
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createClaimType(addForm)
      setShowAdd(false)
      setAddForm({ name: '', description: '', raised_against: 'Supplier' })
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ color: 'var(--fg-muted)', padding: '2rem' }}>Loading…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', margin: 0 }}>Claim Types</h3>
        {isAdmin && (
          <button
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
            style={{ backgroundColor: 'var(--cadet-dark)' }}
            onClick={() => { setShowAdd(true); setError(null) }}
          >+ Add Type</button>
        )}
      </div>
      {error && <div style={{ color: 'var(--alert)', fontSize: 'var(--fs-body-sm)' }}>{error}</div>}

      <div className="e2o-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="e2o-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Raised Against</th>
              <th>Active</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {types.map((ct) => (
              editingId === ct.id ? (
                <tr key={ct.id}>
                  <td><input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 'var(--fs-body-sm)', width: '100%' }} /></td>
                  <td><input value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 'var(--fs-body-sm)', width: '100%' }} /></td>
                  <td>
                    <select value={editForm.raised_against} onChange={(e) => setEditForm((p) => ({ ...p, raised_against: e.target.value }))} style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 'var(--fs-body-sm)' }}>
                      <option>Supplier</option><option>Carrier</option><option>Both</option>
                    </select>
                  </td>
                  <td>
                    <select value={editForm.active} onChange={(e) => setEditForm((p) => ({ ...p, active: Number(e.target.value) }))} style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 'var(--fs-body-sm)' }}>
                      <option value={1}>Yes</option><option value={0}>No</option>
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="px-3 py-1 rounded-lg text-sm font-semibold text-white transition"
                        style={{ backgroundColor: 'var(--cadet-dark)' }}
                        onClick={() => handleSave(ct.id)}
                        disabled={saving}
                      >Save</button>
                      <button onClick={() => setEditingId(null)} style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', background: '#fff', cursor: 'pointer', fontSize: 'var(--fs-body-sm)' }}>Cancel</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={ct.id}>
                  <td style={{ fontWeight: 'var(--fw-semibold)' }}>{ct.name}</td>
                  <td style={{ color: 'var(--fg-3)' }}>{ct.description || '—'}</td>
                  <td>
                    <span className="e2o-pill" style={{ background: ct.raised_against === 'Supplier' ? '#ede9fe' : ct.raised_against === 'Carrier' ? '#fef9c3' : '#f0fdf4', color: ct.raised_against === 'Supplier' ? '#5b21b6' : ct.raised_against === 'Carrier' ? '#854d0e' : '#166534' }}>
                      {ct.raised_against}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: ct.active ? '#166534' : '#9ca3af', fontWeight: 'var(--fw-semibold)', fontSize: 'var(--fs-body-sm)' }}>
                      {ct.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <button onClick={() => startEdit(ct)} style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', background: '#fff', cursor: 'pointer', fontSize: 'var(--fs-body-sm)' }}>Edit</button>
                    </td>
                  )}
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>

      {/* Add modal */}
      {showAdd && (
        <Modal title="Add Claim Type" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">NAME *</label>
              <input value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">DESCRIPTION</label>
              <input value={addForm.description} onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">RAISED AGAINST *</label>
              <select value={addForm.raised_against} onChange={(e) => setAddForm((p) => ({ ...p, raised_against: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option>Supplier</option><option>Carrier</option><option>Both</option>
              </select>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 transition">Cancel</button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: 'var(--cadet-dark)' }}
              >{saving ? 'Saving…' : 'Add'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
