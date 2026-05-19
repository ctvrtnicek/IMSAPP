import { useState, useEffect } from 'react'
import { getExpecting } from '../../api/inventory.js'

export default function ExpectingPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getExpecting()
      .then((res) => { setRows(res.data); setLoading(false) })
      .catch(() => { setError('Failed to load data.'); setLoading(false) })
  }, [])

  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--cadet-dark)', marginBottom: '1.25rem' }}>Expecting</h2>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
        Terminals where a PO has been raised and a serial number assigned by the supplier, but not yet physically received.
      </p>

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '2.5rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          No terminals currently in EXPECTING state.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                {['Serial Number', 'Product', 'Supplier', 'PO Reference', 'Location (Destination)', 'Stock Type', 'Created At'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#6b7280', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--cadet-dark)' }}><a href={`/terminal/${s.id}`} style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: '#9ca3af' }}>{s.serial_number}</a></td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontWeight: 600 }}>{s.product_code}</span>
                    {s.product_name && <span style={{ color: '#6b7280', marginLeft: 4 }}>— {s.product_name}</span>}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{s.supplier_name || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{s.po_id ? `PO-${s.po_id}` : '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{s.current_location_name || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{s.stock_type}</td>
                  <td style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
                    {s.created_at ? s.created_at.slice(0, 10) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '8px 14px', color: '#9ca3af', fontSize: '0.78rem', borderTop: '1px solid #f3f4f6' }}>
            {rows.length} terminal{rows.length !== 1 ? 's' : ''} expecting
          </div>
        </div>
      )}
    </div>
  )
}
