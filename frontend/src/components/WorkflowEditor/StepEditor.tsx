import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2, GripVertical } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { ConditionBuilder } from './ConditionBuilder'
import { ActionBuilder } from './ActionBuilder'
import { generateId } from '../../lib/utils'
import type { WorkflowStep, Condition, Action, ConditionOperator, ActionType } from '../../types'

interface StepEditorProps {
  step: WorkflowStep
  stepIndex: number
  columns: string[]
  sourceColumns: string[]
  onChange: (step: WorkflowStep) => void
  onRemove: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export function StepEditor({
  step,
  stepIndex,
  columns,
  sourceColumns,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: StepEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const addCondition = () => {
    const newCondition: Condition = {
      id: generateId(),
      column: columns[0] ?? '',
      operator: 'exists' as ConditionOperator,
    }
    onChange({
      ...step,
      conditions: [...step.conditions, newCondition],
    })
  }

  const updateCondition = (index: number, condition: Condition) => {
    const newConditions = [...step.conditions]
    newConditions[index] = condition
    onChange({ ...step, conditions: newConditions })
  }

  const removeCondition = (index: number) => {
    onChange({
      ...step,
      conditions: step.conditions.filter((_, i) => i !== index),
    })
  }

  const addAction = () => {
    const newAction: Action = {
      id: generateId(),
      type: 'decrement' as ActionType,
      targetColumn: columns[0] ?? '',
      sourceColumn: sourceColumns[0],
    }
    onChange({
      ...step,
      actions: [...step.actions, newAction],
    })
  }

  const updateAction = (index: number, action: Action) => {
    const newActions = [...step.actions]
    newActions[index] = action
    onChange({ ...step, actions: newActions })
  }

  const removeAction = (index: number) => {
    onChange({
      ...step,
      actions: step.actions.filter((_, i) => i !== index),
    })
  }

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Step header */}
      <div className="flex items-center gap-3 p-4 bg-slate-50 border-b border-slate-200">
        <button className="cursor-grab text-slate-400 hover:text-slate-600">
          <GripVertical className="w-5 h-5" />
        </button>

        <div className="flex-1">
          <Input
            value={step.name}
            onChange={(e) => onChange({ ...step, name: e.target.value })}
            placeholder="Step name"
            className="bg-white font-medium"
          />
        </div>

        <div className="flex items-center gap-1">
          {onMoveUp && (
            <Button variant="ghost" size="sm" onClick={onMoveUp}>
              <ChevronUp className="w-4 h-4" />
            </Button>
          )}
          {onMoveDown && (
            <Button variant="ghost" size="sm" onClick={onMoveDown}>
              <ChevronDown className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Step content */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Conditions section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-700">
                Conditions
                <span className="text-slate-400 font-normal ml-2">
                  (all must match)
                </span>
              </h4>
              <Button variant="ghost" size="sm" onClick={addCondition}>
                <Plus className="w-4 h-4" />
                Add Condition
              </Button>
            </div>

            {step.conditions.length === 0 ? (
              <p className="text-sm text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                No conditions - all rows will match
              </p>
            ) : (
              <div className="space-y-2">
                {step.conditions.map((condition, index) => (
                  <ConditionBuilder
                    key={condition.id}
                    condition={condition}
                    columns={sourceColumns}
                    onChange={(c) => updateCondition(index, c)}
                    onRemove={() => removeCondition(index)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Actions section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-slate-700">Actions</h4>
              <Button variant="ghost" size="sm" onClick={addAction}>
                <Plus className="w-4 h-4" />
                Add Action
              </Button>
            </div>

            {step.actions.length === 0 ? (
              <p className="text-sm text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                No actions defined
              </p>
            ) : (
              <div className="space-y-2">
                {step.actions.map((action, index) => (
                  <ActionBuilder
                    key={action.id}
                    action={action}
                    columns={columns}
                    sourceColumns={sourceColumns}
                    onChange={(a) => updateAction(index, a)}
                    onRemove={() => removeAction(index)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
