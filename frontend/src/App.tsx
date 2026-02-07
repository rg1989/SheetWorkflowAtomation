import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom'
import { Layout } from './components/ui/Layout'
import { WorkflowsPage } from './pages/WorkflowsPage'
import { WorkflowEditorPage } from './pages/WorkflowEditorPage'
import { RunWorkflowPage } from './pages/RunWorkflowPage'
import { HistoryPage } from './pages/HistoryPage'
import { LoginPage } from './pages/LoginPage'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Spinner } from './components/ui/Spinner'

function AuthGuard() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner className="w-8 h-8 text-primary-600" />
      </div>
    )
  }

  if (!user) {
    if (location.pathname === '/') return <Outlet />
    return <Navigate to="/" replace state={{ from: location }} />
  }

  if (location.pathname === '/') {
    return <Navigate to="/workflows" replace />
  }

  return <Outlet />
}

function LoginOrHome() {
  const { user } = useAuth()
  if (user) return <Navigate to="/workflows" replace />
  return <LoginPage />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AuthGuard />}>
        <Route index element={<LoginOrHome />} />
        <Route path="workflows" element={<Layout />}>
          <Route index element={<WorkflowsPage />} />
          <Route path="new" element={<WorkflowEditorPage />} />
          <Route path=":id" element={<WorkflowEditorPage />} />
          <Route path=":id/run" element={<RunWorkflowPage />} />
        </Route>
        <Route path="history" element={<Layout />}>
          <Route index element={<HistoryPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
