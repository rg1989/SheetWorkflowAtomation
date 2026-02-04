import { Link } from 'react-router-dom'
import { Play, Trash2, FileSpreadsheet, ArrowDown, Table2, Pencil } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/Button'
import { getFileColor } from '../lib/colors'
import { formatRelativeTime } from '../lib/utils'
import type { Workflow } from '../types'

interface WorkflowCardProps {
  workflow: Workflow
  onDelete: () => void
  isDeleting?: boolean
}

export function WorkflowCard({ workflow, onDelete, isDeleting }: WorkflowCardProps) {
  const files = workflow.files || []
  const outputColumns = workflow.outputColumns || []

  return (
    <div className="border border-slate-200 rounded-lg hover:border-slate-300 transition-all hover:shadow-sm bg-white p-3">
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
    </div>
  )
}
