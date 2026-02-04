import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet, History, CheckCircle, XCircle, Eye, Trash2 } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { runApi, workflowApi } from '../lib/api'
import { formatDate, formatRelativeTime } from '../lib/utils'
import type { RunStatus } from '../types'

const statusConfig: Record<RunStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info'; icon: typeof CheckCircle }> = {
  preview: { label: 'Preview', variant: 'info', icon: Eye },
  completed: { label: 'Completed', variant: 'success', icon: CheckCircle },
  failed: { label: 'Failed', variant: 'error', icon: XCircle },
}

export function HistoryPage() {
  const queryClient = useQueryClient()

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

  const handleDownload = (runId: string, type: 'excel' | 'pdf') => {
    window.open(runApi.downloadUrl(runId, type), '_blank')
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
              <Card key={run.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 bg-slate-100 rounded-lg">
                    <FileSpreadsheet className="w-4 h-4 text-slate-600" />
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload(run.id, 'excel')}
                    >
                      <Download className="w-4 h-4" />
                      Excel
                    </Button>
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
    </div>
  )
}
