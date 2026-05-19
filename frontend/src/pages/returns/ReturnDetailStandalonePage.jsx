import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getReturnOrderByNumber } from '../../api/returns.js'
import { ReturnDetailPanel } from './ReturnOrdersPage.jsx'
import AppShell from '../../components/AppShell.jsx'

export default function ReturnDetailStandalonePage() {
  const { orderNumber } = useParams()
  const navigate = useNavigate()
  const role = localStorage.getItem('role') || ''

  const [orderId, setOrderId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getReturnOrderByNumber(orderNumber)
      .then((res) => { setOrderId(res.data.id); setLoading(false) })
      .catch(() => { setError(`Return order "${orderNumber}" not found.`); setLoading(false) })
  }, [orderNumber])

  return (
    <AppShell title={`Return Order — ${orderNumber}`} onBack={() => navigate(-1)}>
      <div style={{ padding: '2rem', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        {loading && <p style={{ color: 'var(--fg-muted)' }}>Loading…</p>}
        {error && <p style={{ color: 'var(--alert)' }}>{error}</p>}
        {orderId && (
          <ReturnDetailPanel
            returnId={orderId}
            role={role}
            onBack={() => navigate(-1)}
          />
        )}
      </div>
    </AppShell>
  )
}
