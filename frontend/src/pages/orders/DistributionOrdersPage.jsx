import { useState } from 'react'
import OutboundListPage from './OutboundListPage.jsx'
import OutboundDetailPage from './OutboundDetailPage.jsx'

const DS_TYPES = ['Distribution']

export default function DistributionOrdersPage({ role }) {
  const [activeOrderDetail, setActiveOrderDetail] = useState(null)

  return (
    <div className="flex flex-col h-full">
      {activeOrderDetail === null ? (
        <OutboundListPage
          role={role}
          allowedTypes={DS_TYPES}
          onViewOrder={(id) => setActiveOrderDetail(id)}
        />
      ) : (
        <OutboundDetailPage
          orderId={activeOrderDetail}
          role={role}
          onBack={() => setActiveOrderDetail(null)}
        />
      )}
    </div>
  )
}
