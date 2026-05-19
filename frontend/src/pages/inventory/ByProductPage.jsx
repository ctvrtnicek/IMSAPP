import { useState, useEffect } from 'react'
import { getByProduct } from '../../api/inventory.js'

const inputStyle = {
  border: '1px solid #d1d5db', borderRadius: '0.5rem', padding: '0.35rem 0.7rem',
  fontSize: '0.85rem', outline: 'none', background: '#fff',
}

function CountCell({ value }) {
  if (!value) return <span style={{ color: '#d1d5db' }}>—</span>
  return <span style={{ fontWeight: 600 }}>{value}</span>
}

export default function ByProductPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')

  useEffect(() => {
    getByProduct()
      .then((res) => { setRows(res.data); setLoading(false) })
      .catch(() => { setError('Failed to load data.'); setLoading(false) })
  }, [])

  const filtered = rows.filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.product_code?.toLowerCase().includes(q) || r.product_name?.toLowerCase().includes(q)
  })

  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--cadet-dark)', marginBottom: '1rem' }}>Inventory by Product</h2>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder="Search product…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, minWidth: 200 }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ ...inputStyle, cursor: 'pointer', color: '#6b7280' }}>Clear</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#9ca3af' }}>{filtered.length} product{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
          No products found.
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                {['Product Code', 'Product Name', 'Total', 'Available', 'In Transit', 'In Repair', 'Total Cost (€)'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#6b7280', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.product_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--cadet-dark)' }}>{r.product_code}</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{r.product_name}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--cadet-dark)' }}>{r.total}</td>
                  <td style={{ padding: '10px 14px' }}><CountCell value={r.available} /></td>
                  <td style={{ padding: '10px 14px' }}><CountCell value={r.in_transit} /></td>
                  <td style={{ padding: '10px 14px' }}><CountCell value={r.in_repair} /></td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.82rem' }}>€ {(r.total_cost || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '8px 14px', color: '#9ca3af', fontSize: '0.78rem', borderTop: '1px solid #f3f4f6' }}>
            {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
