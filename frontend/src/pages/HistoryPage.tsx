import { useQuery } from '@tanstack/react-query'
import { Download, FileSpreadsheet, FileText, History, CheckCircle, XCircle, Clock, Eye } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { runApi, workflowApi } from '../lib/api'
import { formatDate, formatRelativeTime } from '../lib/utils'
import type { Run, RunStatus } from '../types'

const statusConfig: Record<RunStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info'; icon: typeof CheckCircle }> = {
  preview: { label: 'Preview', variant: 'info', icon: Eye },
  approved: { label: 'Approved', variant: 'warning', icon: Clock },
  completed: { label: 'Completed', variant: 'success', icon: CheckCircle },
  failed: { label: 'Failed', variant: 'error', icon: XCircle },
}

export function HistoryPage() {
  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['runs'],
    queryFn: () => runApi.list(),
  })

  const { data: workflows } = useQuery({
    queryKey: ['workflows'],
    queryFn: workflowApi.list,
  })

  const workflowMap = new Map(workflows?.map((w) => [w.id, w.name]) ?? [])

  const handleDownload = (runId: string, type: 'excel' | 'pdf') => {
    window.open(runApi.downloadUrl(runId, type), '_blank')
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
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Run History</h1>
        <p className="text-slate-500 mt-1">
          View past workflow executions and download outputs
        </p>
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
        <div className="space-y-4">
          {runs.map((run) => {
            const status = statusConfig[run.status]
            const StatusIcon = status.icon

            return (
              <Card key={run.id} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5 text-slate-600" />
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-slate-900">
                        {workflowMap.get(run.workflowId) || 'Unknown Workflow'}
                      </h3>
                      <Badge variant={status.variant}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span>Run ID: {run.id.slice(0, 8)}...</span>
                      <span>{formatRelativeTime(run.createdAt)}</span>
                      {run.completedAt && (
                        <span>Completed: {formatDate(run.completedAt)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {run.status === 'completed' && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload(run.id, 'excel')}
                    >
                      <Download className="w-4 h-4" />
                      Excel
                    </Button>
                    {run.outputPdf && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(run.id, 'pdf')}
                      >
                        <FileText className="w-4 h-4" />
                        PDF
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
