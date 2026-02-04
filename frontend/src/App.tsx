import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/ui/Layout'
import { WorkflowsPage } from './pages/WorkflowsPage'
import { WorkflowEditorPage } from './pages/WorkflowEditorPage'
import { RunWorkflowPage } from './pages/RunWorkflowPage'
import { HistoryPage } from './pages/HistoryPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/workflows" replace />} />
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="workflows/new" element={<WorkflowEditorPage />} />
          <Route path="workflows/:id" element={<WorkflowEditorPage />} />
          <Route path="workflows/:id/run" element={<RunWorkflowPage />} />
          <Route path="history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
