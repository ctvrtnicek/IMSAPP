import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import TerminalDetailPage from './pages/inventory/TerminalDetailPage.jsx'
import PODetailStandalonePage from './pages/orders/PODetailStandalonePage.jsx'
import OutboundDetailStandalonePage from './pages/orders/OutboundDetailStandalonePage.jsx'
import ReturnDetailStandalonePage from './pages/returns/ReturnDetailStandalonePage.jsx'
import RepairDetailStandalonePage from './pages/returns/RepairDetailStandalonePage.jsx'
import WorkOrderDetailPage from './pages/warehouse/WorkOrderDetailPage.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

function getInitialAuth() {
  return {
    token: localStorage.getItem('token') || null,
    role: localStorage.getItem('role') || null,
    username: localStorage.getItem('username') || null,
  }
}

export default function App() {
  const [auth, setAuth] = useState(getInitialAuth)

  function handleSetAuth(data) {
    if (data) {
      localStorage.setItem('token', data.token)
      localStorage.setItem('role', data.role)
      localStorage.setItem('username', data.username)
    } else {
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      localStorage.removeItem('username')
    }
    setAuth(data || { token: null, role: null, username: null })
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage setAuth={handleSetAuth} />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage auth={auth} setAuth={handleSetAuth} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/terminal/:serialId"
        element={
          <ProtectedRoute>
            <TerminalDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/po/:poNumber"
        element={
          <ProtectedRoute>
            <PODetailStandalonePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/order/:orderNumber"
        element={
          <ProtectedRoute>
            <OutboundDetailStandalonePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/return/:orderNumber"
        element={
          <ProtectedRoute>
            <ReturnDetailStandalonePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/repair/:orderNumber"
        element={
          <ProtectedRoute>
            <RepairDetailStandalonePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/work-order/:orderNumber"
        element={
          <ProtectedRoute>
            <WorkOrderDetailPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
