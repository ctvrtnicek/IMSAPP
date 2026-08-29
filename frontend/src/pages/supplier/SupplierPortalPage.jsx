import { useState, useEffect } from 'react'
import { getPOs, getPO, importSerials, uploadDocumentForExtraction } from '../../api/purchase_orders.js'

// ---------------------------------------------------------------------------
// Status pill colours
// ---------------------------------------------------------------------------
const PO_STATUS_STYLES = {
  Draft:              { backgroundColor: '#9ca3af', color: '#fff' },
  Issued:             { backgroundColor: '#2563eb', color: '#fff' },
  'Partially Received': { backgroundColor: '#ca8a04', color: '#fff' },
  Received:           { backgroundColor: '#16a34a', color: '#fff' },
  Cancelled:          { backgroundColor: '#dc2626', color: '#fff' },
}

function StatusBadge({ status }) {
  const style = PO_STATUS_STYLES[status] || { backgroundColor: '#6b7280', color: '#fff' }
  return (
    <span className="e2o-pill" style={{ ...style, fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Nav tabs
// ---------------------------------------------------------------------------
const PORTAL_TABS = [
  { id: 'pos', label: 'My Purchase Orders' },
  { id: 'import', label: 'Import Serials' },
  { id: 'alerts', label: 'Alerts' },
]

// ---------------------------------------------------------------------------
// PO Detail with Import Serials
// ---------------------------------------------------------------------------
function PODetail({ poId, onBack }) {
  const [po, setPO] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Manual import
  const [showManualImport, setShowManualImport] = useState(false)
  const [serialsText, setSerialsText] = useState('')
  const [shipmentRef, setShipmentRef] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importSuccess, setImportSuccess] = useState(null)

  // Document upload flow
  const [showDocUpload, setShowDocUpload] = useState(false)
  const [docFile, setDocFile] = useState(null)
  const [docUploading, setDocUploading] = useState(false)
  const [docError, setDocError] = useState(null)
  const [extractedData, setExtractedData] = useState(null)
  const [editRows, setEditRows] = useState([])
  const [docShipmentRef, setDocShipmentRef] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmSuccess, setConfirmSuccess] = useState(null)

  useEffect(() => { loadPO() }, [poId])

  async function loadPO() {
    setLoading(true)
    setError(null)
    try {
      const res = await getPO(poId)
      setPO(res.data)
    } catch {
      setError('Failed to load purchase order.')
    } finally {
      setLoading(false)
    }
  }

  // Manual import
  async function handleManualImport(e) {
    e.preventDefault()
    if (!serialsText.trim()) return
    setImportLoading(true)
    setImportError(null)
    setImportSuccess(null)
    try {
      const serials = serialsText.split('\n').map(s => s.trim()).filter(Boolean).map(s => {
        const parts = s.split(',')
        return { serial_number: parts[0]?.trim(), product_code: parts[1]?.trim() || null }
      })
      await importSerials(poId, { po_id: poId, serials, shipment_reference: shipmentRef || null })
      setImportSuccess(`${serials.length} serial(s) imported successfully.`)
      setSerialsText('')
      setShipmentRef('')
      loadPO()
    } catch (err) {
      setImportError(err.response?.data?.detail || 'Failed to import serials.')
    } finally {
      setImportLoading(false)
    }
  }

  // Document upload
  async function handleDocUpload() {
    if (!docFile) return
    setDocUploading(true)
    setDocError(null)
    try {
      const res = await uploadDocumentForExtraction(poId, docFile)
      setExtractedData(res.data)
      const rows = (res.data.serials || []).map((s, i) => ({ id: i, serial_number: s.serial_number || '', product_code: s.product_code || '' }))
      setEditRows(rows)
    } catch (err) {
      setDocError(err.response?.data?.detail || 'Failed to process document. Is the document processor enabled?')
    } finally {
      setDocUploading(false)
    }
  }

  function handleEditRow(idx, field, value) {
    setEditRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  function handleAddRow() {
    setEditRows(prev => [...prev, { id: Date.now(), serial_number: '', product_code: '' }])
  }

  function handleRemoveRow(idx) {
    setEditRows(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleConfirmDocImport(e) {
    e.preventDefault()
    if (!docShipmentRef.trim()) return
    const serials = editRows.filter(r => r.serial_number.trim()).map(r => ({
      serial_number: r.serial_number.trim(),
      product_code: r.product_code?.trim() || null,
    }))
    if (serials.length === 0) return
    setConfirmLoading(true)
    setDocError(null)
    try {
      const res = await importSerials(poId, { po_id: poId, serials, shipment_reference: docShipmentRef.trim() })
      const { created = 0, errors: importErrors = [] } = res.data || {}
      if (created === 0 && importErrors.length > 0) {
        setDocError(`0 serials imported. Errors: ${importErrors.slice(0, 3).join('; ')}`)
        return
      }
      setConfirmSuccess(`${created} serial(s) imported successfully.`)
      setShowDocUpload(false)
      setExtractedData(null)
      setEditRows([])
      setDocFile(null)
      setDocShipmentRef('')
      loadPO()
    } catch (err) {
      const detail = err.response?.data?.detail
      setDocError(typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : 'Failed to confirm import.')
    } finally {
      setConfirmLoading(false)
    }
  }

  if (loading) return <p style={{ color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)' }}>Loading...</p>
  if (error) return <p style={{ color: 'var(--alert)', fontSize: 'var(--fs-body-sm)' }}>{error}</p>
  if (!po) return null

  return (
    <div>
      <button onClick={onBack} style={{ color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>
        &larr; Back to Purchase Orders
      </button>

      {/* PO header */}
      <div className="e2o-card" style={{ padding: '1.25rem 1.5rem', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <h2 style={{ fontSize: 'var(--fs-h3)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>{po.po_number}</h2>
          <StatusBadge status={po.status} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, fontSize: 'var(--fs-body-sm)', color: 'var(--fg-2)' }}>
          <span><strong>Supplier:</strong> {po.supplier_name || '--'}</span>
          <span><strong>Ordered:</strong> {po.ordered_date?.slice(0, 10) || '--'}</span>
          <span><strong>Lines:</strong> {po.lines?.length || 0}</span>
          <span><strong>Serials:</strong> {po.serials?.length || 0}</span>
        </div>
      </div>

      {/* PO Lines */}
      {po.lines && po.lines.length > 0 && (
        <div className="e2o-card" style={{ padding: '1.25rem 1.5rem', marginBottom: 16 }}>
          <p className="e2o-eyebrow" style={{ marginBottom: 10 }}>Order Lines</p>
          <table style={{ width: '100%', fontSize: 'var(--fs-body-sm)', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-1)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase' }}>#</th>
                <th style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase' }}>Product</th>
                <th style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase' }}>Qty Ordered</th>
                <th style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase' }}>Qty Received</th>
                <th style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase' }}>Unit Price</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line) => (
                <tr key={line.id} style={{ borderBottom: '1px solid var(--border-1)' }}>
                  <td style={{ padding: '6px 8px', color: 'var(--fg-muted)' }}>{line.line_number}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--fg-1)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{line.product_code || '--'}</span>
                    {line.product_name && <span style={{ color: 'var(--fg-3)', marginLeft: 6 }}>— {line.product_name}</span>}
                  </td>
                  <td style={{ padding: '6px 8px', color: 'var(--fg-2)' }}>{line.qty_ordered ?? '--'}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--fg-2)' }}>{line.qty_received ?? '--'}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--fg-2)' }}>
                    {line.price_per_product != null ? `${line.price_currency || ''} ${Number(line.price_per_product).toFixed(2)}`.trim() : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Import actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="e2o-btn e2o-btn-primary" onClick={() => { setShowManualImport(!showManualImport); setShowDocUpload(false) }}>
          Import Serials (Manual)
        </button>
        <button className="e2o-btn" onClick={() => { setShowDocUpload(!showDocUpload); setShowManualImport(false) }} style={{ background: '#7c3aed', color: '#fff', border: 'none' }}>
          Import from Document
        </button>
      </div>

      {importSuccess && (
        <div className="e2o-card" style={{ padding: '0.75rem 1rem', marginBottom: 12, borderLeft: '3px solid #16a34a', background: '#f0fdf4' }}>
          <span style={{ color: '#16a34a', fontSize: 'var(--fs-body-sm)' }}>{importSuccess}</span>
        </div>
      )}

      {confirmSuccess && (
        <div className="e2o-card" style={{ padding: '0.75rem 1rem', marginBottom: 12, borderLeft: '3px solid #16a34a', background: '#f0fdf4' }}>
          <span style={{ color: '#16a34a', fontSize: 'var(--fs-body-sm)' }}>{confirmSuccess}</span>
        </div>
      )}

      {/* Manual import form */}
      {showManualImport && (
        <div className="e2o-card" style={{ padding: '1.25rem 1.5rem', marginBottom: 16 }}>
          <p className="e2o-eyebrow" style={{ marginBottom: 10 }}>Manual Serial Import</p>
          <form onSubmit={handleManualImport} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {importError && (
              <div style={{ background: '#fdf2f2', border: '1px solid #e9a8a4', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 'var(--fs-body-sm)', color: 'var(--alert)' }}>
                {importError}
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--fg-2)', marginBottom: 4 }}>
                Serials (one per line, format: serial_number,product_code)
              </label>
              <textarea
                className="e2o-input"
                rows={6}
                value={serialsText}
                onChange={(e) => setSerialsText(e.target.value)}
                placeholder="A400M-5001,V400M&#10;A400M-5002,V400M"
                style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--fg-2)', marginBottom: 4 }}>
                Shipment Reference
              </label>
              <input className="e2o-input" type="text" value={shipmentRef} onChange={(e) => setShipmentRef(e.target.value)} placeholder="e.g. SHIP-2025-001" />
            </div>
            <button type="submit" className="e2o-btn e2o-btn-primary" disabled={importLoading} style={{ alignSelf: 'flex-start' }}>
              {importLoading ? 'Importing...' : 'Import'}
            </button>
          </form>
        </div>
      )}

      {/* Document upload flow */}
      {showDocUpload && !extractedData && (
        <div className="e2o-card" style={{ padding: '1.25rem 1.5rem', marginBottom: 16 }}>
          <p className="e2o-eyebrow" style={{ marginBottom: 10 }}>Import from Document</p>
          {docError && (
            <div style={{ background: '#fdf2f2', border: '1px solid #e9a8a4', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 'var(--fs-body-sm)', color: 'var(--alert)', marginBottom: 12 }}>
              {docError}
            </div>
          )}
          <p style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)', marginBottom: 12 }}>
            Upload a document (PDF, JPG, XLS, CSV, TXT) containing serial numbers. The system will extract serial numbers automatically.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.csv,.txt"
              onChange={(e) => setDocFile(e.target.files[0] || null)}
              style={{ fontSize: 'var(--fs-body-sm)' }}
            />
            <button className="e2o-btn e2o-btn-primary" onClick={handleDocUpload} disabled={!docFile || docUploading}>
              {docUploading ? 'Processing...' : 'Upload & Extract'}
            </button>
          </div>
        </div>
      )}

      {/* Extraction results - editable confirmation */}
      {extractedData && (
        <div className="e2o-card" style={{ padding: '1.25rem 1.5rem', marginBottom: 16 }}>
          <p className="e2o-eyebrow" style={{ marginBottom: 4 }}>Extraction Results</p>
          <p style={{ fontSize: 'var(--fs-body-sm)', color: 'var(--fg-3)', marginBottom: 12 }}>
            Provider: <span style={{ fontWeight: 600 }}>{extractedData.provider || 'unknown'}</span>
            {' -- '}Extracted {editRows.length} serial(s). Review and edit before confirming.
          </p>

          {extractedData.errors && extractedData.errors.length > 0 && (
            <div style={{ background: '#fdf2f2', border: '1px solid #e9a8a4', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 'var(--fs-body-sm)', color: 'var(--alert)', marginBottom: 12 }}>
              {extractedData.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          {docError && (
            <div style={{ background: '#fdf2f2', border: '1px solid #e9a8a4', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 'var(--fs-body-sm)', color: 'var(--alert)', marginBottom: 12 }}>
              {docError}
            </div>
          )}

          <form onSubmit={handleConfirmDocImport}>
            <table style={{ width: '100%', fontSize: 'var(--fs-body-sm)', borderCollapse: 'collapse', marginBottom: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-1)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase' }}>#</th>
                  <th style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase' }}>Serial Number</th>
                  <th style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase' }}>Product Code</th>
                  <th style={{ padding: '6px 8px', width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {editRows.map((row, i) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border-1)' }}>
                    <td style={{ padding: '4px 8px', color: 'var(--fg-muted)' }}>{i + 1}</td>
                    <td style={{ padding: '4px 8px' }}>
                      <input
                        className="e2o-input"
                        type="text"
                        value={row.serial_number}
                        onChange={(e) => handleEditRow(i, 'serial_number', e.target.value)}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 12, padding: '4px 8px' }}
                      />
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <input
                        className="e2o-input"
                        type="text"
                        value={row.product_code}
                        onChange={(e) => handleEditRow(i, 'product_code', e.target.value)}
                        style={{ fontSize: 12, padding: '4px 8px' }}
                      />
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <button type="button" onClick={() => handleRemoveRow(i)} style={{ color: 'var(--alert)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }} title="Remove row">
                        x
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button type="button" className="e2o-btn" onClick={handleAddRow} style={{ fontSize: 'var(--fs-body-sm)', marginBottom: 12 }}>
              + Add Row
            </button>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 'var(--fs-body-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--fg-2)', marginBottom: 4 }}>
                Shipment Reference *
              </label>
              <input
                className="e2o-input"
                type="text"
                value={docShipmentRef}
                onChange={(e) => setDocShipmentRef(e.target.value)}
                placeholder="e.g. SHIP-2025-001"
                required
                style={{ maxWidth: 320 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="e2o-btn e2o-btn-primary" disabled={confirmLoading}>
                {confirmLoading ? 'Confirming...' : 'Confirm Import'}
              </button>
              <button type="button" className="e2o-btn" onClick={() => { setExtractedData(null); setEditRows([]); setDocFile(null); setDocError(null) }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Serials table */}
      {po.serials && po.serials.length > 0 && (
        <div className="e2o-card" style={{ padding: '1.25rem 1.5rem' }}>
          <p className="e2o-eyebrow" style={{ marginBottom: 10 }}>Serials ({po.serials.length})</p>
          <table style={{ width: '100%', fontSize: 'var(--fs-body-sm)', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-1)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase' }}>Serial Number</th>
                <th style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase' }}>Product</th>
                <th style={{ padding: '6px 8px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase' }}>State</th>
              </tr>
            </thead>
            <tbody>
              {po.serials.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-1)' }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', color: 'var(--fg-1)' }}>{s.serial_number}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--fg-2)' }}>{s.product_code || '--'}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--fg-2)' }}>{s.current_state_code || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main SupplierPortalPage
// ---------------------------------------------------------------------------

export default function SupplierPortalPage() {
  const [activeTab, setActiveTab] = useState('pos')
  const [pos, setPOs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedPO, setSelectedPO] = useState(null)

  useEffect(() => { loadPOs() }, [])

  async function loadPOs() {
    setLoading(true)
    setError(null)
    try {
      const res = await getPOs()
      setPOs(res.data)
    } catch {
      setError('Failed to load purchase orders.')
    } finally {
      setLoading(false)
    }
  }

  function handleSignOut() {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('roles')
    localStorage.removeItem('username')
    window.location.href = '/login'
  }

  const username = localStorage.getItem('username') || 'Supplier'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-2)' }}>
      {/* Top bar */}
      <header className="e2o-topbar" style={{ flexShrink: 0, justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-body-lg)', letterSpacing: '0.02em' }}>
          Supplier Portal
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
          <span style={{ fontSize: 'var(--fs-body-sm)', opacity: 0.85 }}>
            {username} <span style={{ opacity: 0.65, fontSize: 'var(--fs-label)' }}>(Supplier)</span>
          </span>
          <button
            onClick={handleSignOut}
            style={{
              fontSize: 'var(--fs-body-sm)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.4)',
              padding: '4px 14px', borderRadius: 'var(--radius-sm)',
              background: 'transparent', cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Tab nav */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-1)', background: '#fff', padding: '0 32px' }}>
        {PORTAL_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedPO(null) }}
            className={`e2o-tab${activeTab === tab.id ? ' active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        {activeTab === 'pos' && !selectedPO && (
          <div>
            <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', marginBottom: 16 }}>My Purchase Orders</h2>

            {loading ? (
              <p style={{ color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)' }}>Loading...</p>
            ) : error ? (
              <p style={{ color: 'var(--alert)', fontSize: 'var(--fs-body-sm)' }}>{error}</p>
            ) : pos.length === 0 ? (
              <div className="e2o-card" style={{ padding: '1.5rem', maxWidth: 400 }}>
                <p style={{ color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)' }}>No purchase orders found.</p>
              </div>
            ) : (
              <div className="e2o-card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: 'var(--fs-body-sm)', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-1)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase', fontWeight: 600 }}>PO Number</th>
                      <th style={{ padding: '10px 12px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '10px 12px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase', fontWeight: 600 }}>Ordered</th>
                      <th style={{ padding: '10px 12px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase', fontWeight: 600 }}>Lines</th>
                      <th style={{ padding: '10px 12px', color: 'var(--fg-muted)', fontSize: 'var(--fs-label)', textTransform: 'uppercase', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pos.map((po) => (
                      <tr key={po.id} style={{ borderBottom: '1px solid var(--border-1)' }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--fg-1)' }}>{po.po_number}</td>
                        <td style={{ padding: '10px 12px' }}><StatusBadge status={po.status} /></td>
                        <td style={{ padding: '10px 12px', color: 'var(--fg-2)' }}>{po.ordered_date?.slice(0, 10) || '--'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--fg-2)' }}>{po.lines?.length || 0}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <button
                            onClick={() => setSelectedPO(po.id)}
                            className="e2o-btn e2o-btn-primary"
                            style={{ fontSize: 'var(--fs-label)', padding: '4px 12px' }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pos' && selectedPO && (
          <PODetail poId={selectedPO} onBack={() => setSelectedPO(null)} />
        )}

        {activeTab === 'import' && (
          <div>
            <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', marginBottom: 16 }}>Import Serials</h2>
            <div className="e2o-card" style={{ padding: '1.5rem', maxWidth: 500 }}>
              <p style={{ color: 'var(--fg-2)', fontSize: 'var(--fs-body-sm)', marginBottom: 12 }}>
                Select a Purchase Order from the "My Purchase Orders" tab, then use the Import Serials buttons to add serial numbers.
              </p>
              <button className="e2o-btn e2o-btn-primary" onClick={() => setActiveTab('pos')}>
                Go to Purchase Orders
              </button>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div>
            <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', marginBottom: 16 }}>Alerts</h2>
            <div className="e2o-card" style={{ padding: '1.5rem', maxWidth: 500 }}>
              <p style={{ color: 'var(--fg-muted)', fontSize: 'var(--fs-body-sm)' }}>No alerts at this time.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
