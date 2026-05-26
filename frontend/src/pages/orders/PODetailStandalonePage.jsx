import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPOByNumber } from '../../api/purchase_orders.js'
import PODetailPage from './PODetailPage.jsx'
import AppShell from '../../components/AppShell.jsx'

export default function PODetailStandalonePage() {
  const { poNumber } = useParams()
  const navigate = useNavigate()
  const role = localStorage.getItem('role') || ''

  const [poId, setPoId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getPOByNumber(poNumber)
      .then((res) => { setPoId(res.data.id); setLoading(false) })
      .catch(() => { setError(`Purchase order "${poNumber}" not found.`); setLoading(false) })
  }, [poNumber])

  return (
    <AppShell title={`Purchase Order — ${poNumber}`} onBack={() => navigate(-1)}>
      <div style={{ padding: '2rem', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
        {loading && <p style={{ color: 'var(--fg-muted)' }}>Loading…</p>}
        {error && <p style={{ color: 'var(--alert)' }}>{error}</p>}
        {poId && (
          <PODetailPage
            poId={poId}
            role={role}
            onBack={() => navigate(-1)}
          />
        )}
      </div>
    </AppShell>
  )
}
