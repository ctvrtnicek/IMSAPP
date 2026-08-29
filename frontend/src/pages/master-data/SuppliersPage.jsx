import { useEffect, useState } from 'react'
import MasterDataTable from '../../components/MasterDataTable.jsx'
import Modal from '../../components/Modal.jsx'
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../../api/masterdata.js'
import { listCountries } from '../../api/network_design.js'

const EMPTY_FORM = {
  code: '',
  name: '',
  country: '',
  city: '',
  contact_email: '',
  contact_phone: '',
  country_code: '',
}

export default function SuppliersPage({ role }) {
  const isAdmin = role === 'admin'
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [countries, setCountries] = useState([])

  async function fetchSuppliers() {
    setLoading(true)
    setError(null)
    try {
      const res = await getSuppliers()
      setSuppliers(res.data)
    } catch {
      setError('Failed to load suppliers.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuppliers()
    listCountries().then(r => setCountries(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }, [])

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(row) {
    setEditingId(row.id)
    setForm({
      code: row.code,
      name: row.name,
      country: row.country,
      city: row.city || '',
      contact_email: row.contact_email || '',
      contact_phone: row.contact_phone || '',
      country_code: row.country_code || '',
    })
    setShowModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      ...form,
      city: form.city || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      country_code: form.country_code || null,
    }
    try {
      if (editingId) {
        await updateSupplier(editingId, payload)
      } else {
        await createSupplier(payload)
      }
      setShowModal(false)
      await fetchSuppliers()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Error saving supplier')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeactivate(row) {
    if (!confirm(`Deactivate supplier "${row.name}"?`)) return
    try {
      await deleteSupplier(row.id)
      await fetchSuppliers()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Error deactivating supplier')
    }
  }

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'country', label: 'Country' },
    { key: 'country_code', label: 'Country Code' },
    { key: 'city', label: 'City' },
    { key: 'contact_email', label: 'Email' },
    { key: 'active', label: 'Status' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Suppliers</h2>
        {isAdmin && (
          <button
            onClick={openAdd}
            className="text-sm px-4 py-1.5 rounded-lg text-white font-medium transition hover:opacity-90"
            style={{ backgroundColor: 'var(--cadet-dark)' }}
          >
            + Add Supplier
          </button>
        )}
      </div>
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      <MasterDataTable
        columns={columns}
        rows={suppliers}
        loading={loading}
        onEdit={isAdmin ? openEdit : undefined}
        onDeactivate={isAdmin ? handleDeactivate : undefined}
        emptyMessage="No suppliers found."
      />

      {showModal && (
        <Modal
          title={editingId ? 'Edit Supplier' : 'Add Supplier'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormRow label="Code" required>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                required
                placeholder="e.g. Castles"
              />
            </FormRow>
            <FormRow label="Name" required>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="e.g. Castles Technology"
              />
            </FormRow>
            <FormRow label="Country" required>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                required
                placeholder="e.g. Italy"
              />
            </FormRow>
            <FormRow label="Country Code (Network Design)">
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.country_code}
                onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value }))}
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
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="e.g. Milan"
              />
            </FormRow>
            <FormRow label="Contact Email">
              <input
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.contact_email}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                placeholder="e.g. contact@supplier.com"
              />
            </FormRow>
            <FormRow label="Contact Phone">
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                placeholder="e.g. +39 02 1234567"
              />
            </FormRow>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="text-sm px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: 'var(--cadet-dark)' }}
              >
                {submitting ? 'Saving…' : 'Save'}
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
