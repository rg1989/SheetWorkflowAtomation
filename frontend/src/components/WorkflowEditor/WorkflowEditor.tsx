import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Save, Play, ArrowLeft, Upload } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { StepEditor } from './StepEditor'
import { FileUploadZone } from '../FileUpload/FileUploadZone'
import { generateId } from '../../lib/utils'
import { workflowApi, fileApi } from '../../lib/api'
import type { Workflow, WorkflowStep, SourceConfig, ColumnInfo } from '../../types'

// Helper function to extract all column names used in a workflow
function extractColumnsFromWorkflow(workflow: Workflow | undefined): { source: string[]; target: string[] } {
  if (!workflow) return { source: [], target: [] }
  
  const sourceSet = new Set<string>()
  const targetSet = new Set<string>()
  
  // Add key column to both
  if (workflow.sourceConfig?.keyColumn) {
    sourceSet.add(workflow.sourceConfig.keyColumn)
    targetSet.add(workflow.sourceConfig.keyColumn)
  }
  
  // Extract columns from steps
  for (const step of workflow.steps) {
    // Condition columns come from source file
    for (const condition of step.conditions) {
      if (condition.column) {
        sourceSet.add(condition.column)
      }
    }
    
    // Action columns: targetColumn -> target file, sourceColumn -> source file
    for (const action of step.actions) {
      if (action.targetColumn) {
        targetSet.add(action.targetColumn)
      }
      if (action.sourceColumn) {
        sourceSet.add(action.sourceColumn)
      }
    }
  }
  
  return {
    source: Array.from(sourceSet),
    target: Array.from(targetSet),
  }
}

interface WorkflowEditorProps {
  workflow?: Workflow
  isNew?: boolean
}

export function WorkflowEditor({ workflow, isNew = false }: WorkflowEditorProps) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Extract columns from existing workflow for editing
  const extractedColumns = useMemo(() => extractColumnsFromWorkflow(workflow), [workflow])

  // Form state
  const [name, setName] = useState(workflow?.name ?? '')
  const [description, setDescription] = useState(workflow?.description ?? '')
  const [keyColumn, setKeyColumn] = useState(workflow?.sourceConfig?.keyColumn ?? '')
  const [steps, setSteps] = useState<WorkflowStep[]>(workflow?.steps ?? [])

  // Column detection - initialize with extracted columns when editing existing workflow
  const [sourceColumns, setSourceColumns] = useState<string[]>(extractedColumns.source)
  const [targetColumns, setTargetColumns] = useState<string[]>(extractedColumns.target)
  const [showFileUpload, setShowFileUpload] = useState(isNew && extractedColumns.source.length === 0)

  // Merge unique columns from both files
  const allColumns = [...new Set([...sourceColumns, ...targetColumns])]

  // Update columns when workflow is loaded asynchronously
  useEffect(() => {
    if (workflow && !isNew) {
      const extracted = extractColumnsFromWorkflow(workflow)
      // Only update if we have columns to add and current arrays are empty
      if (extracted.source.length > 0 && sourceColumns.length === 0) {
        setSourceColumns(extracted.source)
      }
      if (extracted.target.length > 0 && targetColumns.length === 0) {
        setTargetColumns(extracted.target)
      }
      // Also update form state if not already set
      if (workflow.name && !name) setName(workflow.name)
      if (workflow.description && !description) setDescription(workflow.description)
      if (workflow.sourceConfig?.keyColumn && !keyColumn) setKeyColumn(workflow.sourceConfig.keyColumn)
      if (workflow.steps?.length && steps.length === 0) setSteps(workflow.steps)
    }
  }, [workflow, isNew])

  const handleSampleFileUpload = async (file: File, type: 'source' | 'target') => {
    try {
      const result = await fileApi.parseColumns(file)
      const columns = result.columns.map((c: ColumnInfo) => c.name)
      
      if (type === 'source') {
        setSourceColumns(columns)
      } else {
        setTargetColumns(columns)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file')
    }
  }

  const addStep = () => {
    const newStep: WorkflowStep = {
      id: generateId(),
      name: `Step ${steps.length + 1}`,
      conditions: [],
      actions: [],
    }
    setSteps([...steps, newStep])
  }

  const updateStep = (index: number, step: WorkflowStep) => {
    const newSteps = [...steps]
    newSteps[index] = step
    setSteps(newSteps)
  }

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index))
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= steps.length) return
    
    const newSteps = [...steps]
    const temp = newSteps[index]
    newSteps[index] = newSteps[newIndex]
    newSteps[newIndex] = temp
    setSteps(newSteps)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Workflow name is required')
      return
    }
    if (!keyColumn) {
      setError('Key column is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const data = {
        name,
        description,
        sourceConfig: {
          type: 'custom' as const,
          keyColumn,
        },
        steps,
      }

      if (isNew) {
        const created = await workflowApi.create(data)
        navigate(`/workflows/${created.id}`)
      } else if (workflow) {
        await workflowApi.update(workflow.id, data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow')
    } finally {
      setSaving(false)
    }
  }

  const handleRun = () => {
    if (workflow) {
      navigate(`/workflows/${workflow.id}/run`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/workflows')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isNew ? 'Create Workflow' : 'Edit Workflow'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {!isNew && (
            <Button variant="secondary" onClick={handleRun}>
              <Play className="w-4 h-4" />
              Run Workflow
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        
        <div className="grid grid-cols-2 gap-6">
          <Input
            label="Workflow Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Sales Deduction"
          />
          <Input
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this workflow do?"
          />
        </div>
      </Card>

      {/* Column detection */}
      {showFileUpload && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Sample Files</CardTitle>
          </CardHeader>
          <p className="text-sm text-slate-500 mb-4">
            Upload sample Excel files to detect columns. This helps configure your workflow.
          </p>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="label">Source File (e.g., Sales)</label>
              <FileUploadZone
                onFileSelect={(file) => handleSampleFileUpload(file, 'source')}
                accept=".xlsx,.xls"
                compact
              />
              {sourceColumns.length > 0 && (
                <p className="mt-2 text-sm text-emerald-600">
                  Detected {sourceColumns.length} columns
                </p>
              )}
            </div>
            <div>
              <label className="label">Target File (e.g., Inventory)</label>
              <FileUploadZone
                onFileSelect={(file) => handleSampleFileUpload(file, 'target')}
                accept=".xlsx,.xls"
                compact
              />
              {targetColumns.length > 0 && (
                <p className="mt-2 text-sm text-emerald-600">
                  Detected {targetColumns.length} columns
                </p>
              )}
            </div>
          </div>

          {(sourceColumns.length > 0 || targetColumns.length > 0) && (
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setShowFileUpload(false)}>
                Continue to Configuration
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Source configuration */}
      {!showFileUpload && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <CardTitle>Source Configuration</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowFileUpload(true)}>
                  <Upload className="w-4 h-4" />
                  Re-detect Columns
                </Button>
              </div>
            </CardHeader>
            
            <div className="max-w-md">
              <Select
                label="Key Column (for matching rows)"
                value={keyColumn}
                onChange={(e) => setKeyColumn(e.target.value)}
                options={allColumns.map((col) => ({ value: col, label: col }))}
                placeholder="Select the key column (e.g., SKU)"
              />
              <p className="mt-2 text-sm text-slate-500">
                This column is used to match rows between the source and target files.
              </p>
            </div>
          </Card>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Workflow Steps</h2>
              <Button onClick={addStep}>
                <Plus className="w-4 h-4" />
                Add Step
              </Button>
            </div>

            {steps.length === 0 ? (
              <Card className="py-12">
                <div className="text-center">
                  <p className="text-slate-500 mb-4">No steps defined yet</p>
                  <Button onClick={addStep}>
                    <Plus className="w-4 h-4" />
                    Add Your First Step
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <StepEditor
                    key={step.id}
                    step={step}
                    stepIndex={index}
                    columns={targetColumns.length > 0 ? targetColumns : allColumns}
                    sourceColumns={sourceColumns.length > 0 ? sourceColumns : allColumns}
                    onChange={(s) => updateStep(index, s)}
                    onRemove={() => removeStep(index)}
                    onMoveUp={index > 0 ? () => moveStep(index, 'up') : undefined}
                    onMoveDown={index < steps.length - 1 ? () => moveStep(index, 'down') : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
