import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getOutboundOrderByNumber } from '../../api/outbound_orders.js'
import OutboundDetailPage from './OutboundDetailPage.jsx'
import AppShell from '../../components/AppShell.jsx'

export default function OutboundDetailStandalonePage() {
  const { orderNumber } = useParams()
  const navigate = useNavigate()
  const role = localStorage.getItem('role') || ''

  const [orderId, setOrderId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getOutboundOrderByNumber(orderNumber)
      .then((res) => { setOrderId(res.data.id); setLoading(false) })
      .catch(() => { setError(`Order "${orderNumber}" not found.`); setLoading(false) })
  }, [orderNumber])

  function goBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  return (
    <AppShell title={`Order — ${orderNumber}`} onBack={goBack}>
      <div style={{ padding: '2rem', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
        {loading && <p style={{ color: 'var(--fg-muted)' }}>Loading…</p>}
        {error && <p style={{ color: 'var(--alert)' }}>{error}</p>}
        {orderId && (
          <OutboundDetailPage
            orderId={orderId}
            role={role}
            onBack={() => navigate(-1)}
          />
        )}
      </div>
    </AppShell>
  )
}
