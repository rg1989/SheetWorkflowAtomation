import { ArrowRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { CellChange } from '../../types'

interface CellDiffProps {
  change: CellChange
  compact?: boolean
}

export function CellDiff({ change, compact = false }: CellDiffProps) {
  const oldValue = change.oldValue ?? '(empty)'
  const newValue = change.newValue ?? '(empty)'

  // Calculate the difference for numeric values
  let diff: number | null = null
  if (
    typeof change.oldValue === 'number' &&
    typeof change.newValue === 'number'
  ) {
    diff = change.newValue - change.oldValue
  } else if (
    change.oldValue !== null &&
    change.newValue !== null &&
    !isNaN(Number(change.oldValue)) &&
    !isNaN(Number(change.newValue))
  ) {
    diff = Number(change.newValue) - Number(change.oldValue)
  }

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 text-sm">
        <span className="text-red-600 line-through">{String(oldValue)}</span>
        <ArrowRight className="w-3 h-3 text-slate-400" />
        <span className="text-emerald-600 font-medium">{String(newValue)}</span>
        {diff !== null && (
          <span
            className={cn(
              'text-xs px-1.5 py-0.5 rounded',
              diff > 0
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            )}
          >
            {diff > 0 ? '+' : ''}
            {diff}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {change.column}
        </span>
        {change.stepName && (
          <span className="text-xs text-slate-400">via {change.stepName}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Old value */}
        <div className="flex-1 p-2.5 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-500 mb-1">Before</p>
          <p className="text-sm font-medium text-red-700">{String(oldValue)}</p>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center w-8 h-8 bg-white rounded-full border border-slate-200 shadow-sm">
          <ArrowRight className="w-4 h-4 text-slate-400" />
        </div>

        {/* New value */}
        <div className="flex-1 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-xs text-emerald-500 mb-1">After</p>
          <p className="text-sm font-medium text-emerald-700">{String(newValue)}</p>
        </div>
      </div>

      {/* Difference badge */}
      {diff !== null && (
        <div className="flex justify-end">
          <span
            className={cn(
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
              diff > 0
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            )}
          >
            {diff > 0 ? '+' : ''}
            {diff}
          </span>
        </div>
      )}
    </div>
  )
}
