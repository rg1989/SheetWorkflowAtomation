import { X } from 'lucide-react'
import { Select } from '../ui/Select'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { CONDITION_OPERATORS, needsValue } from '../../lib/utils'
import type { Condition, ConditionOperator } from '../../types'

interface ConditionBuilderProps {
  condition: Condition
  columns: string[]
  onChange: (condition: Condition) => void
  onRemove: () => void
}

export function ConditionBuilder({
  condition,
  columns,
  onChange,
  onRemove,
}: ConditionBuilderProps) {
  const showValue = needsValue(condition.operator)

  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg group">
      <div className="flex-1 grid grid-cols-3 gap-3">
        {/* Column select */}
        <Select
          value={condition.column}
          onChange={(e) => onChange({ ...condition, column: e.target.value })}
          options={columns.map((col) => ({ value: col, label: col }))}
          placeholder="Select column"
        />

        {/* Operator select */}
        <Select
          value={condition.operator}
          onChange={(e) =>
            onChange({
              ...condition,
              operator: e.target.value as ConditionOperator,
              value: needsValue(e.target.value) ? condition.value : undefined,
            })
          }
          options={CONDITION_OPERATORS.map((op) => ({
            value: op.value,
            label: op.label,
          }))}
        />

        {/* Value input */}
        {showValue ? (
          <Input
            value={condition.value?.toString() ?? ''}
            onChange={(e) =>
              onChange({
                ...condition,
                value: e.target.value,
              })
            }
            placeholder="Value"
          />
        ) : (
          <div className="flex items-center text-sm text-slate-500 italic">
            No value needed
          </div>
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
