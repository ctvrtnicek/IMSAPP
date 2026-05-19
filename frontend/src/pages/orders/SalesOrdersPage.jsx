import { useState } from 'react'
import ClaimsPage from '../claims/ClaimsPage.jsx'
import POListPage from './POListPage.jsx'
import PODetailPage from './PODetailPage.jsx'
import OutboundListPage from './OutboundListPage.jsx'
import OutboundDetailPage from './OutboundDetailPage.jsx'

const SALES_TYPES = ['Sales', 'Rental', 'Replacement']

const TABS = [
  { id: 'purchase', label: 'Purchase Orders' },
  { id: 'sales',    label: 'Sales / Rental / Replacement' },
  { id: 'claims',   label: 'Claims' },
]

export default function SalesOrdersPage({ role }) {
  const [activeTab, setActiveTab] = useState(
    () => sessionStorage.getItem('dash_orders_tab') || 'purchase'
  )
  const [activePODetail, setActivePODetail] = useState(null)
  const [activeOrderDetail, setActiveOrderDetail] = useState(null)

  function handleTabChange(id) {
    setActiveTab(id)
    setActivePODetail(null)
    setActiveOrderDetail(null)
    sessionStorage.setItem('dash_orders_tab', id)
  }

  return (
    <div className="flex flex-col h-full">
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-1)' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`e2o-tab${activeTab === tab.id ? ' active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1">
        {activeTab === 'purchase' && (
          activePODetail === null ? (
            <POListPage role={role} onViewPO={(id) => setActivePODetail(id)} />
          ) : (
            <PODetailPage poId={activePODetail} role={role} onBack={() => setActivePODetail(null)} />
          )
        )}
        {activeTab === 'sales' && (
          activeOrderDetail === null ? (
            <OutboundListPage
              role={role}
              allowedTypes={SALES_TYPES}
              onViewOrder={(id) => setActiveOrderDetail(id)}
            />
          ) : (
            <OutboundDetailPage
              orderId={activeOrderDetail}
              role={role}
              onBack={() => setActiveOrderDetail(null)}
            />
          )
        )}
        {activeTab === 'claims' && <ClaimsPage role={role} />}
      </div>
    </div>
  )
}
