import { useEffect, useState } from 'react'
import MasterDataTable from '../../components/MasterDataTable.jsx'
import Modal from '../../components/Modal.jsx'
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../../api/masterdata.js'
import { listSegments } from '../../api/atp.js'
import { listCountries } from '../../api/network_design.js'

const CUSTOMER_TYPES = ['Shop', 'Merchant', 'Distributor', 'Partner']

const EMPTY_FORM = {
  customer_ref: '',
  duns_number: '',
  name: '',
  customer_type: '',
  country: '',
  state_region: '',
  credit_rating: '',
  delivery_address: '',
  contact_email: '',
  contact_phone: '',
  segment_id: '',
}

export default function CustomersPage({ role }) {
  const isAdmin = role === 'admin'
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [segments, setSegments] = useState([])
  const [countries, setCountries] = useState([])

  async function fetchCustomers() {
    setLoading(true)
    setError(null)
    try {
      const res = await getCustomers()
      setCustomers(res.data)
    } catch {
      setError('Failed to load customers.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
    listSegments().then(r => setSegments(Array.isArray(r.data) ? r.data : [])).catch(() => {})
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
      customer_ref: row.customer_ref,
      duns_number: row.duns_number || '',
      name: row.name,
      customer_type: row.customer_type,
      country: row.country,
      state_region: row.state_region || '',
      credit_rating: row.credit_rating || '',
      delivery_address: row.delivery_address || '',
      contact_email: row.contact_email || '',
      contact_phone: row.contact_phone || '',
      segment_id: row.segment_id ? String(row.segment_id) : '',
    })
    setShowModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      customer_ref: form.customer_ref,
      duns_number: form.duns_number || null,
      name: form.name,
      customer_type: form.customer_type,
      country: form.country,
      state_region: form.state_region || null,
      credit_rating: form.credit_rating || null,
      delivery_address: form.delivery_address || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      segment_id: form.segment_id ? Number(form.segment_id) : null,
    }
    try {
      if (editingId) {
        await updateCustomer(editingId, payload)
      } else {
        await createCustomer(payload)
      }
      setShowModal(false)
      await fetchCustomers()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Error saving customer')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeactivate(row) {
    if (!confirm(`Deactivate customer "${row.name}"?`)) return
    try {
      await deleteCustomer(row.id)
      await fetchCustomers()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Error deactivating customer')
    }
  }

  const columns = [
    { key: 'customer_ref', label: 'Ref' },
    { key: 'name', label: 'Name' },
    { key: 'customer_type', label: 'Type' },
    { key: 'country', label: 'Country' },
    { key: 'credit_rating', label: 'Credit Rating' },
    { key: 'segment_name', label: 'Segment' },
    { key: 'active', label: 'Status' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Customers</h2>
        {isAdmin && (
          <button
            onClick={openAdd}
            className="text-sm px-4 py-1.5 rounded-lg text-white font-medium transition hover:opacity-90"
            style={{ backgroundColor: 'var(--cadet-dark)' }}
          >
            + Add Customer
          </button>
        )}
      </div>
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      <MasterDataTable
        columns={columns}
        rows={customers}
        loading={loading}
        onEdit={isAdmin ? openEdit : undefined}
        onDeactivate={isAdmin ? handleDeactivate : undefined}
        emptyMessage="No customers found."
      />

      {showModal && (
        <Modal
          title={editingId ? 'Edit Customer' : 'Add Customer'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Customer Ref" required>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.customer_ref}
                  onChange={(e) => setForm((f) => ({ ...f, customer_ref: e.target.value }))}
                  required
                  placeholder="e.g. CUST-001"
                />
              </FormRow>
              <FormRow label="DUNS Number">
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.duns_number}
                  onChange={(e) => setForm((f) => ({ ...f, duns_number: e.target.value }))}
                  placeholder="e.g. 123456789"
                />
              </FormRow>
            </div>
            <FormRow label="Name" required>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="e.g. Starbucks"
              />
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Customer Type" required>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.customer_type}
                  onChange={(e) => setForm((f) => ({ ...f, customer_type: e.target.value }))}
                  required
                >
                  <option value="">-- Select --</option>
                  {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormRow>
              <FormRow label="Segment">
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.segment_id}
                  onChange={(e) => setForm((f) => ({ ...f, segment_id: e.target.value }))}
                >
                  <option value="">-- No segment --</option>
                  {segments.map((s) => <option key={s.id} value={s.id}>{s.segment_name} (Priority: {s.priority})</option>)}
                </select>
              </FormRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Country" required>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  required
                >
                  <option value="">-- Select country --</option>
                  {countries.map((c) => <option key={c.country_code} value={c.country_code}>{c.country_code} — {c.country_name}</option>)}
                </select>
              </FormRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="State / Region">
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.state_region}
                  onChange={(e) => setForm((f) => ({ ...f, state_region: e.target.value }))}
                  placeholder="e.g. Noord-Holland"
                />
              </FormRow>
              <FormRow label="Credit Rating">
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.credit_rating}
                  onChange={(e) => setForm((f) => ({ ...f, credit_rating: e.target.value }))}
                  placeholder="e.g. A+"
                />
              </FormRow>
            </div>
            <FormRow label="Delivery Address">
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                value={form.delivery_address}
                onChange={(e) => setForm((f) => ({ ...f, delivery_address: e.target.value }))}
                rows={2}
                placeholder="Full delivery address"
              />
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Contact Email">
                <input
                  type="email"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.contact_email}
                  onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                  placeholder="e.g. ops@company.com"
                />
              </FormRow>
              <FormRow label="Contact Phone">
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.contact_phone}
                  onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                  placeholder="e.g. +31 20 123 4567"
                />
              </FormRow>
            </div>
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
