import { useEffect, useRef, useState } from 'react'
import api from '../../api/auth.js'

const BRAND = 'var(--cadet-dark)'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadTemplate(type, filename) {
  const token = localStorage.getItem('token')
  fetch(`/api/upload/template/${type}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((r) => r.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `template_${type}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    })
}

// ---------------------------------------------------------------------------
// Reusable UI
// ---------------------------------------------------------------------------

function SectionCard({ title, description, accent, children }) {
  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100"
        style={{ borderLeftWidth: 4, borderLeftColor: accent, borderLeftStyle: 'solid' }}>
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  )
}

function TemplateBtn({ type, label, filename }) {
  return (
    <button
      onClick={() => downloadTemplate(type, filename)}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
    >
      ↓ {label}
    </button>
  )
}

function FileDropZone({ onFile, file, accept = '.xlsx,.xls' }) {
  const inputRef = useRef()
  const [dragging, setDragging] = useState(false)

  function handleDrop(e) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current.click()}
      className={`cursor-pointer border-2 border-dashed rounded-xl px-4 py-6 text-center transition
        ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]) }} />
      {file ? (
        <p className="text-sm font-medium text-blue-700">📄 {file.name}</p>
      ) : (
        <p className="text-sm text-gray-400">Drop a file here, or <span className="text-blue-500 underline">browse</span></p>
      )}
    </div>
  )
}

function ResultBox({ result }) {
  if (!result) return null
  const hasErrors = result.errors?.length > 0
  return (
    <div className={`rounded-xl p-4 text-sm space-y-1 ${hasErrors ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
      <p className="font-semibold text-gray-800">Upload complete</p>
      {result.po_number && <p className="text-gray-600">PO: <strong>{result.po_number}</strong></p>}
      {result.order_number && <p className="text-gray-600">Order: <strong>{result.order_number}</strong></p>}
      <p className="text-gray-600">Rows processed: <strong>{result.total_rows}</strong></p>
      {result.created   !== undefined && <p className="text-green-700">Created: <strong>{result.created}</strong></p>}
      {result.updated   !== undefined && <p className="text-green-700">Updated: <strong>{result.updated}</strong></p>}
      {result.allocated !== undefined && <p className="text-green-700">Allocated: <strong>{result.allocated}</strong></p>}
      {result.duplicates > 0 && <p className="text-amber-700">Duplicates skipped: <strong>{result.duplicates}</strong></p>}
      {result.skipped_duplicates > 0 && <p className="text-amber-700">Already allocated (skipped): <strong>{result.skipped_duplicates}</strong></p>}
      {result.not_found > 0 && <p className="text-red-600">Not found: <strong>{result.not_found}</strong></p>}
      {hasErrors && (
        <div className="mt-2">
          <p className="font-semibold text-red-700">Errors ({result.errors.length}):</p>
          <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
            {result.errors.map((e, i) => <li key={i} className="text-red-600 text-xs font-mono">{e}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'
const BTN_PRIMARY = `text-sm px-4 py-2 rounded-lg text-white font-medium transition hover:opacity-90 disabled:opacity-50`

function SimpleUploadPanel({ endpoint, templateType, templateFilename, templateLabel, extraFields, buildFormData }) {
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) { setError('Please select a file.'); return }
    setSubmitting(true); setResult(null); setError(null)
    try {
      const fd = buildFormData ? buildFormData(file) : (() => { const f = new FormData(); f.append('file', file); return f })()
      const res = await api.post(endpoint, fd)
      setResult(res.data); setFile(null)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Upload failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TemplateBtn type={templateType} label={templateLabel} filename={templateFilename} />
      {extraFields}
      <FormField label="File *">
        <FileDropZone file={file} onFile={setFile} />
      </FormField>
      {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-2">{error}</p>}
      <ResultBox result={result} />
      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className={BTN_PRIMARY}
          style={{ backgroundColor: submitting ? '#9ca3af' : BRAND }}>
          {submitting ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Upload Panels
// ---------------------------------------------------------------------------

function TerminalsReceivingPanel() {
  const [pos, setPos] = useState([])
  const [poId, setPoId] = useState('')

  useEffect(() => {
    api.get('/purchase-orders').then((r) => {
      const open = r.data.filter((p) => ['Issued','Expected','Partially Received'].includes(p.status))
      setPos(open)
    }).catch(() => {})
  }, [])

  return (
    <SimpleUploadPanel
      endpoint="/upload/terminals-receiving"
      templateType="terminals-receiving"
      templateLabel="Download Terminals Receiving Template"
      templateFilename="template_terminals_receiving.xlsx"
      extraFields={
        <FormField label="Purchase Order (optional — overrides PO# in file)">
          <select className={INPUT} value={poId} onChange={(e) => setPoId(e.target.value)}>
            <option value="">— Auto-match from file's PO# column —</option>
            {pos.map((p) => (
              <option key={p.id} value={p.id}>{p.po_number} — {p.supplier_name} ({p.status})</option>
            ))}
          </select>
        </FormField>
      }
      buildFormData={(file) => {
        const fd = new FormData()
        if (poId) fd.append('po_id', poId)
        fd.append('file', file)
        return fd
      }}
    />
  )
}

function InboundPanel() {
  const [pos, setPos] = useState([])
  const [poId, setPoId] = useState('')
  const [shipRef, setShipRef] = useState('')
  const [carrier, setCarrier] = useState('')
  const [trackRef, setTrackRef] = useState('')
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/purchase-orders').then((r) => {
      const open = r.data.filter((p) => ['Issued', 'Partially Received'].includes(p.status))
      setPos(open)
      if (open.length) setPoId(String(open[0].id))
    }).catch(() => {})
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) { setError('Please select a file.'); return }
    if (!poId) { setError('Please select a Purchase Order.'); return }
    setSubmitting(true); setResult(null); setError(null)
    try {
      const fd = new FormData()
      fd.append('po_id', poId)
      if (shipRef) fd.append('shipment_reference', shipRef)
      if (carrier) fd.append('carrier', carrier)
      if (trackRef) fd.append('carrier_tracking_ref', trackRef)
      fd.append('file', file)
      const res = await api.post('/upload/inbound', fd)
      setResult(res.data); setFile(null)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Upload failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TemplateBtn type="inbound" label="Download Inbound Serials Template" filename="template_inbound_serials.xlsx" />
      <FormField label="Purchase Order *">
        <select className={INPUT} value={poId} onChange={(e) => setPoId(e.target.value)} required>
          <option value="">— Select a PO —</option>
          {pos.map((p) => <option key={p.id} value={p.id}>{p.po_number} — {p.supplier_name} ({p.status})</option>)}
        </select>
      </FormField>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Shipment Ref">
          <input className={INPUT} value={shipRef} onChange={(e) => setShipRef(e.target.value)} placeholder="SHP-001" />
        </FormField>
        <FormField label="Carrier">
          <input className={INPUT} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="DHL" />
        </FormField>
        <FormField label="Tracking Ref">
          <input className={INPUT} value={trackRef} onChange={(e) => setTrackRef(e.target.value)} placeholder="1Z999AA1…" />
        </FormField>
      </div>
      <FormField label="Excel File *">
        <FileDropZone file={file} onFile={setFile} />
      </FormField>
      {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-2">{error}</p>}
      <ResultBox result={result} />
      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className={BTN_PRIMARY}
          style={{ backgroundColor: submitting ? '#9ca3af' : BRAND }}>
          {submitting ? 'Uploading…' : 'Upload & Import'}
        </button>
      </div>
    </form>
  )
}

function OutboundAllocPanel() {
  const [orders, setOrders] = useState([])
  const [orderId, setOrderId] = useState('')
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/outbound-orders').then((r) => {
      const open = r.data.filter((o) => ['Issued', 'Allocated'].includes(o.status))
      setOrders(open)
      if (open.length) setOrderId(String(open[0].id))
    }).catch(() => {})
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) { setError('Please select a file.'); return }
    if (!orderId) { setError('Please select an Outbound Order.'); return }
    setSubmitting(true); setResult(null); setError(null)
    try {
      const fd = new FormData()
      fd.append('order_id', orderId)
      fd.append('file', file)
      const res = await api.post('/upload/outbound-alloc', fd)
      setResult(res.data); setFile(null)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Upload failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TemplateBtn type="outbound-alloc" label="Download Outbound Allocation Template" filename="template_outbound_allocation.xlsx" />
      <FormField label="Outbound Order *">
        <select className={INPUT} value={orderId} onChange={(e) => setOrderId(e.target.value)} required>
          <option value="">— Select an order —</option>
          {orders.map((o) => <option key={o.id} value={o.id}>{o.order_number} — {o.order_type} ({o.status})</option>)}
        </select>
      </FormField>
      <FormField label="File *">
        <FileDropZone file={file} onFile={setFile} />
      </FormField>
      {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-2">{error}</p>}
      <ResultBox result={result} />
      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className={BTN_PRIMARY}
          style={{ backgroundColor: submitting ? '#9ca3af' : BRAND }}>
          {submitting ? 'Uploading…' : 'Upload & Allocate'}
        </button>
      </div>
    </form>
  )
}

function StateUpdatePanel() {
  const [states, setStates] = useState([])
  useEffect(() => { api.get('/inventory/states').then((r) => setStates(r.data)).catch(() => {}) }, [])

  return (
    <SimpleUploadPanel
      endpoint="/upload/state-update"
      templateType="state-update"
      templateLabel="Download State Update Template"
      templateFilename="template_state_update.xlsx"
      extraFields={states.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Valid state codes:</p>
          <div className="flex flex-wrap gap-1.5">
            {states.map((s) => (
              <span key={s.id} className="font-mono text-xs bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-700">{s.code}</span>
            ))}
          </div>
        </div>
      )}
      buildFormData={(file) => { const fd = new FormData(); fd.append('file', file); return fd }}
    />
  )
}

// ---------------------------------------------------------------------------
// Tab configuration
// ---------------------------------------------------------------------------

const TABS = [
  {
    id: 'terminals',   label: '1 — Terminals Receiving',     accent: BRAND,
    description: 'Upload multi-sheet XLS from supplier (Terminals_receiving-Sample format). Creates serials in EXPECTING state.',
    component: <TerminalsReceivingPanel />,
  },
  {
    id: 'inbound',     label: '2 — Inbound (Simple)',         accent: '#0369a1',
    description: 'Upload a simple 2-column Excel (serial_number, product_code) against a PO.',
    component: <InboundPanel />,
  },
  {
    id: 'state',       label: '3 — State Update',             accent: '#f59e0b',
    description: 'Bulk-update terminal states.',
    component: <StateUpdatePanel />,
  },
  {
    id: 'outbound',    label: '4 — Outbound Allocation',      accent: '#7c3aed',
    description: 'Allocate serial numbers to an open outbound order.',
    component: <OutboundAllocPanel />,
  },
  {
    id: 'products',    label: '5 — Products',                 accent: '#0d9488',
    description: 'Bulk upload product master data.',
    component: (
      <SimpleUploadPanel
        endpoint="/upload/state-update"
        templateType="products"
        templateLabel="Download Products Template"
        templateFilename="template_products.xlsx"
        buildFormData={(file) => { const fd = new FormData(); fd.append('file', file); return fd }}
      />
    ),
  },
  {
    id: 'purchases',   label: '6 — Purchase Orders',          accent: '#16a34a',
    description: 'Bulk create purchase orders.',
    component: (
      <SimpleUploadPanel
        endpoint="/upload/state-update"
        templateType="purchases"
        templateLabel="Download Purchase Orders Template"
        templateFilename="template_purchase_orders.xlsx"
        buildFormData={(file) => { const fd = new FormData(); fd.append('file', file); return fd }}
      />
    ),
  },
  {
    id: 'sales-orders', label: '7 — Sales Orders',           accent: '#2563eb',
    description: 'Bulk create sales orders.',
    component: (
      <SimpleUploadPanel
        endpoint="/upload/state-update"
        templateType="sales-orders"
        templateLabel="Download Sales Orders Template"
        templateFilename="template_sales_orders.xlsx"
        buildFormData={(file) => { const fd = new FormData(); fd.append('file', file); return fd }}
      />
    ),
  },
  {
    id: 'dist-out',   label: '8 — Distribution Outbound',    accent: '#0d9488',
    description: 'Create distribution outbound shipments.',
    component: (
      <SimpleUploadPanel
        endpoint="/upload/state-update"
        templateType="dist-outbound"
        templateLabel="Download Distribution Outbound Template"
        templateFilename="template_distribution_outbound.xlsx"
        buildFormData={(file) => { const fd = new FormData(); fd.append('file', file); return fd }}
      />
    ),
  },
  {
    id: 'dist-in',    label: '9 — Distribution Inbound',     accent: '#0d9488',
    description: 'Record distribution inbound receipts.',
    component: (
      <SimpleUploadPanel
        endpoint="/upload/state-update"
        templateType="dist-inbound"
        templateLabel="Download Distribution Inbound Template"
        templateFilename="template_distribution_inbound.xlsx"
        buildFormData={(file) => { const fd = new FormData(); fd.append('file', file); return fd }}
      />
    ),
  },
  {
    id: 'rr-out',     label: '10 — R&R Outbound Dispatch',   accent: '#0369a1',
    description: 'Bulk dispatch serials for repair or rework.',
    component: (
      <SimpleUploadPanel
        endpoint="/upload/state-update"
        templateType="rr-outbound"
        templateLabel="Download R&R Outbound Template"
        templateFilename="template_rr_outbound.xlsx"
        buildFormData={(file) => { const fd = new FormData(); fd.append('file', file); return fd }}
      />
    ),
  },
  {
    id: 'rr-in',      label: '11 — R&R Inbound Return',      accent: '#0369a1',
    description: 'Record repair / rework returns and outcomes.',
    component: (
      <SimpleUploadPanel
        endpoint="/upload/state-update"
        templateType="rr-inbound"
        templateLabel="Download R&R Inbound Template"
        templateFilename="template_rr_inbound.xlsx"
        buildFormData={(file) => { const fd = new FormData(); fd.append('file', file); return fd }}
      />
    ),
  },
]

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ExcelUploadPage() {
  const [tab, setTab] = useState('terminals')
  const active = TABS.find((t) => t.id === tab)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Upload</h1>
        <p className="text-xs text-gray-400">Supports .xlsx and .xls files</p>
      </div>

      {/* Scrollable tab bar */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-xs px-3 py-2 rounded-lg font-medium transition border whitespace-nowrap
              ${tab === t.id ? 'text-white border-transparent shadow-sm' : 'text-gray-600 border-gray-200 bg-white hover:bg-gray-50'}`}
            style={tab === t.id ? { backgroundColor: t.accent, borderColor: t.accent } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      {active && (
        <SectionCard title={active.label} description={active.description} accent={active.accent}>
          {active.component}
        </SectionCard>
      )}
    </div>
  )
}
