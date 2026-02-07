import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet, History, CheckCircle, XCircle, Eye, Trash2, Cloud } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { FileNamingModal } from '../components/FileNamingModal'
import { runApi, workflowApi, driveApi } from '../lib/api'
import { formatDate, formatRelativeTime } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import type { RunStatus } from '../types'

const statusConfig: Record<RunStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info'; icon: typeof CheckCircle }> = {
  preview: { label: 'Preview', variant: 'info', icon: Eye },
  completed: { label: 'Completed', variant: 'success', icon: CheckCircle },
  failed: { label: 'Failed', variant: 'error', icon: XCircle },
}

export function HistoryPage() {
  const queryClient = useQueryClient()
  const { driveConnected } = useAuth()

  // Track which run is currently exporting and which have been exported
  const [exportingRunId, setExportingRunId] = useState<string | null>(null)
  const [exportedRuns, setExportedRuns] = useState<Record<string, string>>({})

  // File naming modal state
  const [namingModal, setNamingModal] = useState<{
    isOpen: boolean
    action: 'download' | 'drive'
    runId: string
    workflowName: string
  }>({ isOpen: false, action: 'download', runId: '', workflowName: '' })
  const [fileName, setFileName] = useState('')

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['runs'],
    queryFn: () => runApi.list(),
  })

  const { data: workflows } = useQuery({
    queryKey: ['workflows'],
    queryFn: workflowApi.list,
  })

  const deleteMutation = useMutation({
    mutationFn: runApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] })
    },
  })

  const deleteAllMutation = useMutation({
    mutationFn: runApi.deleteAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runs'] })
    },
  })

  const workflowMap = new Map(workflows?.map((w) => [w.id, w.name]) ?? [])

  // Generate default file name
  const getDefaultFileName = (workflowName: string, createdAt: string) => {
    const relativeTime = formatRelativeTime(createdAt)
    return `${workflowName} - ${relativeTime}`
  }

  const handleDownload = (runId: string, workflowName: string, createdAt: string) => {
    setFileName(getDefaultFileName(workflowName, createdAt))
    setNamingModal({ isOpen: true, action: 'download', runId, workflowName })
  }

  const handleDelete = (runId: string) => {
    if (confirm('Are you sure you want to delete this run?')) {
      deleteMutation.mutate(runId)
    }
  }

  const handleClearAll = () => {
    if (confirm('Are you sure you want to delete ALL run history? This cannot be undone.')) {
      deleteAllMutation.mutate()
    }
  }

  const handleExportToDrive = async (runId: string, workflowName: string, createdAt: string) => {
    setFileName(getDefaultFileName(workflowName, createdAt))
    setNamingModal({ isOpen: true, action: 'drive', runId, workflowName })
  }

  const handleNamingConfirm = async (confirmedName: string) => {
    if (namingModal.action === 'download') {
      // Download with custom name
      try {
        const response = await fetch(runApi.downloadUrl(namingModal.runId, 'excel'), {
          credentials: 'include',
        })
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = confirmedName.endsWith('.xlsx') ? confirmedName : `${confirmedName}.xlsx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setNamingModal({ isOpen: false, action: 'download', runId: '', workflowName: '' })
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to download file')
      }
    } else {
      // Export to Drive with custom name
      setExportingRunId(namingModal.runId)
      try {
        const exportResponse = await driveApi.exportCreate(namingModal.runId, confirmedName)
        setExportedRuns(prev => ({ ...prev, [namingModal.runId]: exportResponse.spreadsheet_url }))
        setNamingModal({ isOpen: false, action: 'download', runId: '', workflowName: '' })
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to export to Drive')
      } finally {
        setExportingRunId(null)
      }
    }
  }

  if (runsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Run History</h1>
          <p className="text-slate-500 mt-1">
            View past workflow executions and download outputs
          </p>
        </div>
        {runs && runs.length > 0 && (
          <Button
            variant="secondary"
            onClick={handleClearAll}
            disabled={deleteAllMutation.isPending}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </Button>
        )}
      </div>

      {/* History list */}
      {!runs || runs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History className="w-6 h-6 text-slate-400" />}
            title="No runs yet"
            description="Run a workflow to see execution history here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const status = statusConfig[run.status] || statusConfig.completed
            const StatusIcon = status.icon

            return (
              <Card key={run.id} className="flex items-center justify-between py-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 bg-primary-100 rounded-lg">
                    <FileSpreadsheet className="w-4 h-4 text-primary-600" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-medium text-slate-900 text-sm">
                        {workflowMap.get(run.workflowId) || 'Unknown Workflow'}
                      </h3>
                      <Badge variant={status.variant}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{formatRelativeTime(run.createdAt)}</span>
                      {run.completedAt && (
                        <span>Completed: {formatDate(run.completedAt)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {run.status === 'completed' && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDownload(run.id, workflowMap.get(run.workflowId) || 'Workflow', run.createdAt)}
                      >
                        <Download className="w-4 h-4" />
                        Excel
                      </Button>
                      {exportedRuns[run.id] ? (
                        <a
                          href={exportedRuns[run.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          Sheets
                        </a>
                      ) : driveConnected ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleExportToDrive(run.id, workflowMap.get(run.workflowId) || 'Workflow', run.createdAt)}
                          disabled={exportingRunId === run.id}
                        >
                          {exportingRunId === run.id ? (
                            <>
                              <Spinner size="sm" className="mr-2" />
                              Exporting...
                            </>
                          ) : (
                            <>
                              <Cloud className="w-4 h-4" />
                              Export to Drive
                            </>
                          )}
                        </Button>
                      ) : null}
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(run.id)}
                    disabled={deleteMutation.isPending}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 !px-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <FileNamingModal
        isOpen={namingModal.isOpen}
        onClose={() => setNamingModal({ isOpen: false, action: 'download', runId: '', workflowName: '' })}
        onConfirm={handleNamingConfirm}
        defaultName={fileName}
        actionLabel={namingModal.action === 'download' ? 'Download' : 'Export to Drive'}
        isLoading={namingModal.action === 'drive' ? exportingRunId === namingModal.runId : false}
      />
    </div>
  )
}
