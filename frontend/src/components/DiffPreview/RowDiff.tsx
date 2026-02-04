import { useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { CellDiff } from './CellDiff'
import type { RowChange } from '../../types'

interface RowDiffProps {
  rowChange: RowChange
  keyColumn: string
}

export function RowDiff({ rowChange, keyColumn }: RowDiffProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden transition-all duration-200',
        rowChange.hasWarning
          ? 'border-amber-200 bg-amber-50/50'
          : 'border-slate-200 bg-white'
      )}
    >
      {/* Row header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="text-slate-400">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase">
              {keyColumn}:
            </span>
            <span className="font-medium text-slate-900">
              {rowChange.keyValue}
            </span>
          </div>

          <span className="text-sm text-slate-500">
            {rowChange.cells.length} cell{rowChange.cells.length !== 1 ? 's' : ''} changed
          </span>
        </div>

        {rowChange.hasWarning && (
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{rowChange.warningMessage}</span>
          </div>
        )}

        {/* Preview of changes */}
        {!isExpanded && rowChange.cells.length > 0 && (
          <div className="hidden md:flex items-center gap-2">
            <CellDiff change={rowChange.cells[0]} compact />
            {rowChange.cells.length > 1 && (
              <span className="text-xs text-slate-400">
                +{rowChange.cells.length - 1} more
              </span>
            )}
          </div>
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {rowChange.cells.map((cell, idx) => (
              <CellDiff key={`${cell.column}-${idx}`} change={cell} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
