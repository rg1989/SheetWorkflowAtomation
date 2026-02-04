import { X } from 'lucide-react'
import { Select } from '../ui/Select'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { ACTION_TYPES, needsSourceColumn, needsActionValue } from '../../lib/utils'
import type { Action, ActionType } from '../../types'

interface ActionBuilderProps {
  action: Action
  columns: string[]
  sourceColumns: string[]
  onChange: (action: Action) => void
  onRemove: () => void
}

export function ActionBuilder({
  action,
  columns,
  sourceColumns,
  onChange,
  onRemove,
}: ActionBuilderProps) {
  const showSourceColumn = needsSourceColumn(action.type)
  const showValue = needsActionValue(action.type)

  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg group">
      <div className="flex-1 grid grid-cols-4 gap-3">
        {/* Action type */}
        <Select
          value={action.type}
          onChange={(e) =>
            onChange({
              ...action,
              type: e.target.value as ActionType,
              sourceColumn: needsSourceColumn(e.target.value) ? action.sourceColumn : undefined,
              value: needsActionValue(e.target.value) ? action.value : undefined,
            })
          }
          options={ACTION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        />

        {/* Target column */}
        <Select
          value={action.targetColumn}
          onChange={(e) => onChange({ ...action, targetColumn: e.target.value })}
          options={columns.map((col) => ({ value: col, label: col }))}
          placeholder="Target column"
        />

        {/* Source column (for copyFrom, increment, decrement) */}
        {showSourceColumn ? (
          <Select
            value={action.sourceColumn ?? ''}
            onChange={(e) => onChange({ ...action, sourceColumn: e.target.value })}
            options={sourceColumns.map((col) => ({ value: col, label: col }))}
            placeholder="Source column"
          />
        ) : (
          <div />
        )}

        {/* Value input */}
        {showValue && !showSourceColumn ? (
          <Input
            value={action.value?.toString() ?? ''}
            onChange={(e) => onChange({ ...action, value: e.target.value })}
            placeholder="Value"
          />
        ) : showValue && showSourceColumn ? (
          <Input
            value={action.value?.toString() ?? ''}
            onChange={(e) => onChange({ ...action, value: e.target.value })}
            placeholder="Or fixed value"
          />
        ) : (
          <div />
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  )
}
