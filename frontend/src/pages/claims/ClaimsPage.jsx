import { useState, useEffect } from 'react'
import { listClaims, createClaim, updateClaim, listClaimTypes, listClaimAttachments, uploadClaimAttachment, deleteClaimAttachment, downloadClaimAttachment } from '../../api/claims.js'
import { getPOs } from '../../api/purchase_orders.js'
import Modal from '../../components/Modal.jsx'

const STATUS_COLOURS = {
  'Open':         { bg: '#dbeafe', color: '#1d4ed8' },
  'Under Review': { bg: '#fef9c3', color: '#854d0e' },
  'Resolved':     { bg: '#dcfce7', color: '#166534' },
  'Rejected':     { bg: '#fee2e2', color: '#991b1b' },
}

const URGENCY_COLOURS = {
  'Urgent':    { bg: '#fee2e2', color: '#991b1b' },
  'Important': { bg: '#fef9c3', color: '#854d0e' },
  'Normal':    { bg: '#f3f4f6', color: '#374151' },
}

function UrgencyBadge({ urgency }) {
  const u = urgency || 'Normal'
  const c = URGENCY_COLOURS[u] || URGENCY_COLOURS['Normal']
  return <span className="e2o-pill" style={{ background: c.bg, color: c.color }}>{u}</span>
}

function StatusBadge({ status }) {
  const c = STATUS_COLOURS[status] || { bg: '#f3f4f6', color: '#374151' }
  return <span className="e2o-pill" style={{ background: c.bg, color: c.color }}>{status}</span>
}

function fmtDate(iso) {
  if (!iso) return '—'
  return iso.slice(0, 16).replace('T', ' ') + ' UTC'
}

export default function ClaimsPage({ role }) {
  const [claims, setClaims] = useState([])
  const [claimTypes, setClaimTypes] = useState([])
  const [pos, setPos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAgainst, setFilterAgainst] = useState('')

  // Paging state
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(0)

  // New claim modal
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ po_id: '', serial_id: '', claim_type_id: '', raised_against: 'Supplier', urgency: 'Normal', description: '' })
  const [newError, setNewError] = useState(null)
  const [newSaving, setNewSaving] = useState(false)
  const [newFile, setNewFile] = useState(null)

  // Detail edit
  const [editStatus, setEditStatus] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editUrgency, setEditUrgency] = useState('Normal')
  const [savingDetail, setSavingDetail] = useState(false)
  const [detailError, setDetailError] = useState(null)

  // Attachments
  const [attachments, setAttachments] = useState([])
  const [attLoading, setAttLoading] = useState(false)

  const canEdit = ['admin', 'supply_planner'].includes(role)
  const canCreate = ['admin', 'supply_planner', 'warehouse_user'].includes(role)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (filterAgainst) params.raised_against = filterAgainst
      const [clRes, ctRes, poRes] = await Promise.all([
        listClaims(params),
        listClaimTypes(),
        getPOs(),
      ])
      setClaims(clRes.data)
      setClaimTypes(ctRes.data)
      setPos(poRes.data)
    } catch {
      setError('Failed to load claims')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterStatus, filterAgainst])

  // Reset page when filters change
  useEffect(() => { setCurrentPage(0) }, [filterStatus, filterAgainst])

  const selected = claims.find((c) => c.id === selectedId) || null

  function handleSelect(c) {
    if (selectedId === c.id) { setSelectedId(null); setAttachments([]); return }
    setSelectedId(c.id)
    setEditStatus(c.status)
    setEditNotes(c.resolution_notes || '')
    setEditDescription(c.description || '')
    setEditUrgency(c.urgency || 'Normal')
    setDetailError(null)
    setAttLoading(true)
    listClaimAttachments(c.id)
      .then((res) => { setAttachments(res.data); setAttLoading(false) })
      .catch(() => setAttLoading(false))
  }

  async function handleAttachUpload(e) {
    const file = e.target.files[0]
    if (!file || !selectedId) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      await uploadClaimAttachment(selectedId, fd)
      const res = await listClaimAttachments(selectedId)
      setAttachments(res.data)
    } catch {
      // silently ignore upload errors — user sees no change
    }
    e.target.value = ''
  }

  async function handleAttachDelete(attId) {
    if (!selectedId) return
    try {
      await deleteClaimAttachment(selectedId, attId)
      setAttachments((prev) => prev.filter((a) => a.id !== attId))
    } catch {
      // silently ignore
    }
  }

  async function handleAttachDownload(att) {
    try {
      const res = await downloadClaimAttachment(selectedId, att.id)
      const url = URL.createObjectURL(new Blob([res.data], { type: att.content_type || 'application/octet-stream' }))
      const a = document.createElement('a')
      a.href = url
      a.download = att.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silently ignore
    }
  }

  async function handleSaveDetail() {
    if (!selected) return
    setSavingDetail(true)
    setDetailError(null)
    try {
      await updateClaim(selected.id, { status: editStatus, resolution_notes: editNotes, description: editDescription, urgency: editUrgency })
      await load()
    } catch (err) {
      setDetailError(err.response?.data?.detail || 'Save failed')
    } finally {
      setSavingDetail(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setNewError(null)
    if (!newForm.claim_type_id) { setNewError('Claim type is required'); return }
    if (!newForm.po_id && !newForm.serial_id.trim()) { setNewError('PO or serial number is required'); return }
    setNewSaving(true)
    try {
      const payload = {
        claim_type_id: Number(newForm.claim_type_id),
        raised_against: newForm.raised_against,
        urgency: newForm.urgency || 'Normal',
        description: newForm.description || null,
        po_id: newForm.po_id ? Number(newForm.po_id) : null,
        serial_id: null,
      }
      // If only serial text entered with no PO, show error
      if (!payload.po_id && newForm.serial_id.trim()) {
        setNewError('Please select a Purchase Order to link the claim')
        setNewSaving(false)
        return
      }
      const res = await createClaim(payload)
      if (newFile) {
        const fd = new FormData()
        fd.append('file', newFile)
        await uploadClaimAttachment(res.data.id, fd)
      }
      setShowNew(false)
      setNewForm({ po_id: '', serial_id: '', claim_type_id: '', raised_against: 'Supplier', urgency: 'Normal', description: '' })
      setNewFile(null)
      await load()
    } catch (err) {
      setNewError(err.response?.data?.detail || 'Failed to create claim')
    } finally {
      setNewSaving(false)
    }
  }

  const totalPages = Math.ceil(claims.length / pageSize)
  const paged = claims.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', margin: 0 }}>
          Claims
        </h2>
        {canCreate && (
          <button
            onClick={() => { setShowNew(true); setNewError(null) }}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
            style={{ backgroundColor: 'var(--cadet-dark)' }}
          >
            + New Claim
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12 }}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-body-sm)', background: '#fff' }}
        >
          <option value="">All Statuses</option>
          {['Open', 'Under Review', 'Resolved', 'Rejected'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={filterAgainst}
          onChange={(e) => setFilterAgainst(e.target.value)}
          style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-body-sm)', background: '#fff' }}
        >
          <option value="">All — Raised Against</option>
          <option value="Supplier">Supplier</option>
          <option value="Carrier">Carrier</option>
        </select>
      </div>

      {/* Table */}
      {error && <div style={{ color: 'var(--alert)', fontSize: 'var(--fs-body-sm)' }}>{error}</div>}
      <div className="e2o-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="e2o-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Claim #</th>
              <th>Type</th>
              <th>Raised Against</th>
              <th>PO #</th>
              <th>Serial</th>
              <th>Urgency</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>Loading…</td></tr>
            ) : claims.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fg-muted)' }}>No claims found.</td></tr>
            ) : paged.map((c) => (
              <>
                <tr
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  style={{ cursor: 'pointer', background: selectedId === c.id ? 'var(--bg-tint-cadet)' : 'transparent' }}
                >
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)', color: 'var(--cadet-dark)' }}>{c.claim_number}</td>
                  <td>{c.claim_type_name || '—'}</td>
                  <td>
                    <span className="e2o-pill" style={{ background: c.raised_against === 'Supplier' ? '#ede9fe' : '#fef9c3', color: c.raised_against === 'Supplier' ? '#5b21b6' : '#854d0e' }}>
                      {c.raised_against}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{c.po_number || '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{c.serial_number || '—'}</td>
                  <td><UrgencyBadge urgency={c.urgency} /></td>
                  <td><StatusBadge status={c.status} /></td>
                  <td style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-body-sm)' }}>{fmtDate(c.created_at)}</td>
                </tr>
                {selectedId === c.id && (
                  <tr key={`detail-${c.id}`}>
                    <td colSpan={8} style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', borderTop: '1px solid var(--border-1)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', maxWidth: 800 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--fg-3)', marginBottom: 4 }}>DESCRIPTION</label>
                          {canEdit ? (
                            <textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              rows={3}
                              style={{ width: '100%', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-body-sm)', resize: 'vertical' }}
                            />
                          ) : (
                            <p style={{ color: 'var(--fg-2)', fontSize: 'var(--fs-body-sm)', margin: 0 }}>{c.description || '—'}</p>
                          )}
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--fg-3)', marginBottom: 4 }}>RESOLUTION NOTES</label>
                          {canEdit ? (
                            <textarea
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              rows={3}
                              style={{ width: '100%', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-body-sm)', resize: 'vertical' }}
                            />
                          ) : (
                            <p style={{ color: 'var(--fg-2)', fontSize: 'var(--fs-body-sm)', margin: 0 }}>{c.resolution_notes || '—'}</p>
                          )}
                        </div>
                        {canEdit && (
                          <div>
                            <label style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--fg-3)', marginBottom: 4 }}>STATUS</label>
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}
                              style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-body-sm)', background: '#fff' }}
                            >
                              {['Open', 'Under Review', 'Resolved', 'Rejected'].map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {canEdit && (
                          <div>
                            <label style={{ display: 'block', fontSize: 'var(--fs-label)', color: 'var(--fg-3)', marginBottom: 4 }}>URGENCY</label>
                            <select
                              value={editUrgency}
                              onChange={(e) => setEditUrgency(e.target.value)}
                              style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--fs-body-sm)', background: '#fff' }}
                            >
                              {['Normal', 'Important', 'Urgent'].map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                          {canEdit && (
                            <button
                              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                              style={{ backgroundColor: 'var(--cadet-dark)' }}
                              onClick={handleSaveDetail}
                              disabled={savingDetail}
                            >
                              {savingDetail ? 'Saving…' : 'Save Changes'}
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedId(null)}
                            style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '6px 14px', background: '#fff', cursor: 'pointer', fontSize: 'var(--fs-body-sm)' }}
                          >
                            Close
                          </button>
                          {detailError && <span style={{ color: 'var(--alert)', fontSize: 'var(--fs-body-sm)' }}>{detailError}</span>}
                        </div>
                      </div>
                      <div style={{ marginTop: '0.75rem', fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)' }}>
                        Created by <strong>{c.created_by_username || '—'}</strong> · Last updated {fmtDate(c.updated_at)}
                      </div>
                      {/* Attachments section */}
                      <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-1)', paddingTop: '1rem' }}>
                        <div style={{ fontWeight: 700, fontSize: 'var(--fs-label)', color: 'var(--fg-3)', marginBottom: '0.5rem' }}>ATTACHMENTS</div>
                        {attLoading ? (
                          <p style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-muted)' }}>Loading…</p>
                        ) : attachments.length === 0 ? (
                          <p style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-muted)' }}>No attachments.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '0.75rem' }}>
                            {attachments.map((att) => (
                              <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-body-sm)' }}>
                                <span style={{ flex: 1, color: 'var(--fg-2)' }}>{att.filename}</span>
                                <span style={{ color: 'var(--fg-muted)', fontSize: '0.72rem' }}>{att.uploaded_at ? att.uploaded_at.slice(0, 16).replace('T', ' ') : ''}</span>
                                <button
                                  onClick={() => handleAttachDownload(att)}
                                  style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)', padding: '2px 10px', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--fg-2)' }}
                                >
                                  Download
                                </button>
                                <button
                                  onClick={() => handleAttachDelete(att.id)}
                                  style={{ border: '1px solid #fca5a5', borderRadius: 'var(--radius-sm)', padding: '2px 10px', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', color: '#991b1b' }}
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <span style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-2)', fontWeight: 600 }}>Upload file:</span>
                          <input type="file" onChange={handleAttachUpload} style={{ fontSize: 'var(--fs-body-sm)' }} />
                        </label>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {claims.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: '1px solid #f3f4f6', fontSize: '0.82rem', color: '#6b7280', flexWrap: 'wrap' }}>
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(0) }}
              style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '2px 6px', fontSize: '0.82rem' }}
            >
              {[50, 100, 150].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={{ marginLeft: 'auto' }}>
              {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, claims.length)} of {claims.length}
            </span>
            <button disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}
              style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: currentPage === 0 ? '#f9fafb' : '#fff', cursor: currentPage === 0 ? 'default' : 'pointer' }}>
              ‹ Prev
            </button>
            <button disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}
              style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: currentPage >= totalPages - 1 ? '#f9fafb' : '#fff', cursor: currentPage >= totalPages - 1 ? 'default' : 'pointer' }}>
              Next ›
            </button>
          </div>
        )}
      </div>

      {/* New Claim Modal */}
      {showNew && (
        <Modal title="New Claim" onClose={() => setShowNew(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Purchase Order *</label>
              <select
                value={newForm.po_id}
                onChange={(e) => setNewForm((p) => ({ ...p, po_id: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select PO…</option>
                {pos.map((p) => (
                  <option key={p.id} value={p.id}>{p.po_number} — {p.supplier_name || ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Claim Type *</label>
              <select
                value={newForm.claim_type_id}
                onChange={(e) => setNewForm((p) => ({ ...p, claim_type_id: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select claim type…</option>
                {claimTypes.filter((ct) => ct.active).map((ct) => (
                  <option key={ct.id} value={ct.id}>{ct.name} ({ct.raised_against})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Raised Against *</label>
              <select
                value={newForm.raised_against}
                onChange={(e) => setNewForm((p) => ({ ...p, raised_against: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="Supplier">Supplier</option>
                <option value="Carrier">Carrier</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Urgency</label>
              <select
                value={newForm.urgency || 'Normal'}
                onChange={(e) => setNewForm((p) => ({ ...p, urgency: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="Normal">Normal</option>
                <option value="Important">Important</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
              <textarea
                value={newForm.description}
                onChange={(e) => setNewForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="Describe the issue…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-y"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Attachment</label>
              <input
                type="file"
                onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-600"
              />
            </div>
            {newError && <p className="text-red-600 text-sm">{newError}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 transition">Cancel</button>
              <button
                type="submit"
                disabled={newSaving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition"
                style={{ backgroundColor: 'var(--cadet-dark)' }}
              >
                {newSaving ? 'Creating…' : 'Create Claim'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
