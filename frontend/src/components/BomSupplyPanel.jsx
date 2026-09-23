import { useEffect, useState } from 'react'
import { getBomSupply } from '../api/firmware.js'

// R3 #9 — BOM Component Supply: for each component of a BOM product, stock per location
// (on hand / reserved / free / short) and open purchase orders still to arrive.
// Components are bought on their own POs; this tracks their arrival against the BOM.
// Order context: locationId limits incoming POs to that fulfilling warehouse; orderId
// highlights what is reserved/pegged for that order
// Quantity held for the order being viewed
function HighlightQty({ qty }) {
  return (
    <span className="ml-1 px-1.5 py-0.5 rounded font-semibold" style={{ background: '#dbeafe', color: '#1e40af' }}>
      {qty} this order
    </span>
  )
}

export default function BomSupplyPanel({ productId, locationId, orderId, title = 'BOM Component Supply' }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setData(null)
    setError(null)
    getBomSupply(productId, locationId, orderId)
      .then((res) => alive && setData(res.data))
      .catch((err) => alive && setError(err.response?.data?.detail || 'Failed to load BOM supply'))
    return () => { alive = false }
  }, [productId, locationId, orderId])

  if (error) return <p className="text-red-500 text-sm">{error}</p>
  if (!data) return <p className="text-gray-500 text-sm">Loading BOM supply...</p>
  if (!data.components.length) return <p className="text-gray-400 text-sm">No BOM components configured.</p>

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        {title} for <span className="font-semibold">{data.product_code}</span> — assembly lead time {data.assembly_days} day{data.assembly_days === 1 ? '' : 's'} (longest component)
      </p>
      {data.components.map((c) => (
        <div key={c.component_product_id} className="mb-4 border border-gray-100 rounded-lg p-3">
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
            <span className="font-semibold text-gray-800">
              {c.component_code} <span className="font-normal text-gray-500">– {c.component_name}</span>
            </span>
            <span className="text-xs text-gray-500">
              {c.quantity_per_unit} per unit · on hand {c.totals.on_hand}
              {c.totals.staging > 0 && ` (+${c.totals.staging} staging)`} · reserved {c.totals.reserved}
              {c.totals.this_order > 0 && <HighlightQty qty={c.totals.this_order} />} · free {c.totals.free}
              {c.totals.short > 0 && <span className="font-semibold text-red-600"> · short {c.totals.short}</span>}
            </span>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 uppercase border-b border-gray-100">
                  <th className="px-2 py-1 font-semibold">Location</th>
                  <th className="px-2 py-1 font-semibold text-right">On hand</th>
                  <th className="px-2 py-1 font-semibold text-right">Reserved</th>
                  <th className="px-2 py-1 font-semibold text-right">Free</th>
                </tr>
              </thead>
              <tbody>
                {c.stock.length === 0 ? (
                  <tr><td colSpan={4} className="px-2 py-1 text-gray-400">No stock</td></tr>
                ) : c.stock.map((s) => (
                  <tr key={s.location_id} className="border-b border-gray-50">
                    <td className="px-2 py-1 text-gray-700">{s.location_code}</td>
                    <td className="px-2 py-1 text-right">
                      {s.on_hand}
                      {s.staging > 0 && <span className="text-gray-400" title="Quarantine / Staging / Configuring"> +{s.staging} staging</span>}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {s.reserved}
                      {s.this_order > 0 && <HighlightQty qty={s.this_order} />}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {s.free}
                      {s.short > 0 && <span className="text-red-600 font-semibold"> (short {s.short})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 uppercase border-b border-gray-100">
                  <th className="px-2 py-1 font-semibold">Incoming PO{data.po_location_code ? ` → ${data.po_location_code}` : ''}</th>
                  <th className="px-2 py-1 font-semibold">Supplier</th>
                  <th className="px-2 py-1 font-semibold text-right">Open qty</th>
                  <th className="px-2 py-1 font-semibold">Expected</th>
                </tr>
              </thead>
              <tbody>
                {c.open_purchase_orders.length === 0 ? (
                  <tr><td colSpan={4} className="px-2 py-1 text-gray-400">No open POs</td></tr>
                ) : c.open_purchase_orders.map((p) => (
                  <tr key={p.po_id} className="border-b border-gray-50">
                    <td className="px-2 py-1">
                      <a href={`/po/${p.po_number}`} className="underline font-mono">{p.po_number}</a>
                      <span className="text-gray-400"> → {p.destination_code}</span>
                    </td>
                    <td className="px-2 py-1 text-gray-600">{p.supplier_name || '—'}</td>
                    <td className="px-2 py-1 text-right">{p.qty_open}</td>
                    <td className="px-2 py-1 text-gray-600">{p.expected_arrival_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
