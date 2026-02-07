import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Play, Trash2, FileSpreadsheet, ArrowDown, Table2, Pencil, ChevronDown, ChevronUp, CheckCircle, XCircle, Eye, Download, History } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { Spinner } from './ui/Spinner'
import { FileNamingModal } from './FileNamingModal'
import { getFileColor } from '../lib/colors'
import { formatRelativeTime } from '../lib/utils'
import { runApi } from '../lib/api'
import type { Workflow, RunStatus } from '../types'

const statusConfig: Record<RunStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info'; icon: typeof CheckCircle }> = {
  preview: { label: 'Preview', variant: 'info', icon: Eye },
  completed: { label: 'Completed', variant: 'success', icon: CheckCircle },
  failed: { label: 'Failed', variant: 'error', icon: XCircle },
}

interface WorkflowCardProps {
  workflow: Workflow
  onDelete: () => void
  isDeleting?: boolean
}

export function WorkflowCard({ workflow, onDelete, isDeleting }: WorkflowCardProps) {
  const files = workflow.files || []
  const outputColumns = workflow.outputColumns || []
  const [expanded, setExpanded] = useState(false)

  // File naming modal state
  const [namingModal, setNamingModal] = useState<{
    isOpen: boolean
    runId: string
  }>({ isOpen: false, runId: '' })
  const [fileName, setFileName] = useState('')

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['runs', workflow.id],
    queryFn: () => runApi.list(workflow.id),
    enabled: expanded,
  })

  // Generate default file name
  const getDefaultFileName = (createdAt: string) => {
    const relativeTime = formatRelativeTime(createdAt)
    return `${workflow.name} - ${relativeTime}`
  }

  const handleDownload = (runId: string, createdAt: string) => {
    setFileName(getDefaultFileName(createdAt))
    setNamingModal({ isOpen: true, runId })
  }

  const handleNamingConfirm = async (confirmedName: string) => {
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
      setNamingModal({ isOpen: false, runId: '' })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download file')
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg hover:border-slate-300 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-white p-3">
      {/* Top row: name, description, actions */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 truncate">
              {workflow.name}
            </h3>
            <span className="text-xs text-slate-400">
              {formatRelativeTime(workflow.updatedAt)}
            </span>
          </div>
          {workflow.description && (
            <p className="text-sm text-slate-500 truncate">{workflow.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Link to={`/workflows/${workflow.id}`}>
            <Button variant="secondary" size="sm">
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          </Link>
          <Link to={`/workflows/${workflow.id}/run`}>
            <Button size="sm">
              <Play className="w-3.5 h-3.5" />
              Run
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 !px-2"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Input files row */}
      <div className="flex items-center gap-2 overflow-x-auto">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wide flex-shrink-0">Input:</span>
        {files.map((file, index) => {
          const color = getFileColor(file.colorIndex)
          const columnNames = file.columns?.slice(0, 3).map(c => c.name) || []
          const moreCount = (file.columns?.length || 0) - 3

          return (
            <div key={file.id} className="flex items-center gap-2 flex-shrink-0">
              {index > 0 && <span className="text-slate-300">+</span>}
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded border text-sm',
                  color.borderLight,
                  color.bgLight
                )}
              >
                <FileSpreadsheet className={cn('w-3.5 h-3.5', color.text)} />
                <span className={cn('font-medium', color.textDark)}>{file.name}</span>
                <span className="text-slate-400">·</span>
                <div className="flex items-center gap-1">
                  {columnNames.map((col) => (
                    <span
                      key={col}
                      className={cn('text-xs px-1 rounded', color.bg, 'text-white')}
                    >
                      {col}
                    </span>
                  ))}
                  {moreCount > 0 && (
                    <span className={cn('text-xs', color.text)}>+{moreCount}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Arrow down */}
      <div className="flex justify-center py-1">
        <ArrowDown className="w-4 h-4 text-indigo-400" />
      </div>

      {/* Output row - prominent indigo theme */}
      <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg px-3 py-2 border-2 border-indigo-300">
        <div className="flex items-center gap-2">
          <Table2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span className="text-xs text-indigo-700 font-bold uppercase tracking-wide flex-shrink-0">Output:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {outputColumns.map((col) => (
              <span
                key={col.id}
                className="text-sm px-2 py-0.5 bg-indigo-600 text-white rounded font-medium shadow-sm"
              >
                {col.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Expand/Collapse Run History toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors duration-200"
      >
        <History className="w-3.5 h-3.5" />
        Run History
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {/* Expanded run history list */}
      {expanded && (
        <div className="mt-1 border-t border-slate-100 pt-2">
          {runsLoading ? (
            <div className="flex items-center justify-center py-3">
              <Spinner size="sm" />
            </div>
          ) : !runs || runs.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-2">No runs yet</p>
          ) : (
            <div className="space-y-1.5">
              {runs.map((run) => {
                const status = statusConfig[run.status] || statusConfig.completed
                const StatusIcon = status.icon

                return (
                  <div
                    key={run.id}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={status.variant}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {formatRelativeTime(run.createdAt)}
                      </span>
                    </div>
                    {run.status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(run.id, run.createdAt)}
                        className="!px-2 !py-1 text-slate-500 hover:text-primary-600"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <FileNamingModal
        isOpen={namingModal.isOpen}
        onClose={() => setNamingModal({ isOpen: false, runId: '' })}
        onConfirm={handleNamingConfirm}
        defaultName={fileName}
        actionLabel="Download"
      />
    </div>
  )
}
