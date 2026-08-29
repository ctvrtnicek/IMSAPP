import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getRepairOrderByNumber } from '../../api/returns.js'
import { RepairDetailPanel } from './RepairOrdersPage.jsx'
import AppShell from '../../components/AppShell.jsx'

export default function RepairDetailStandalonePage() {
  const { orderNumber } = useParams()
  const navigate = useNavigate()
  const role = localStorage.getItem('role') || ''

  const [orderId, setOrderId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getRepairOrderByNumber(orderNumber)
      .then((res) => { setOrderId(res.data.id); setLoading(false) })
      .catch(() => { setError(`Repair order "${orderNumber}" not found.`); setLoading(false) })
  }, [orderNumber])

  function goBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  return (
    <AppShell title={`Repair Order — ${orderNumber}`} onBack={goBack}>
      <div style={{ padding: '2rem', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
        {loading && <p style={{ color: 'var(--fg-muted)' }}>Loading…</p>}
        {error && <p style={{ color: 'var(--alert)' }}>{error}</p>}
        {orderId && (
          <RepairDetailPanel
            repairId={orderId}
            role={role}
            onBack={() => navigate(-1)}
          />
        )}
      </div>
    </AppShell>
  )
}
