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

  function goBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  return (
    <AppShell title={`Return Order — ${orderNumber}`}>
      <div style={{ padding: 32 }}>
        {loading && <p style={{ color: 'var(--fg-muted)' }}>Loading…</p>}
        {error && <p style={{ color: 'var(--alert)' }}>{error}</p>}
        {orderId && (
          <ReturnDetailPanel
            returnId={orderId}
            role={role}
            onBack={goBack}
          />
        )}
      </div>
    </AppShell>
  )
}
