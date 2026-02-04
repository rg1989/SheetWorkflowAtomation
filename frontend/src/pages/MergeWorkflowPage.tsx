import { useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MergeWizard } from '../components/MergeWizard'
import { mergeWorkflowApi } from '../lib/api'
import { Spinner } from '../components/ui/Spinner'
import { Card } from '../components/ui/Card'
import type { MergeWizardState, FileDefinition } from '../types/merge'

export function MergeWorkflowPage() {
  const { id } = useParams<{ id: string }>()
  const isEditMode = !!id

  // Fetch existing workflow if in edit mode
  const { data: workflow, isLoading, error } = useQuery({
    queryKey: ['merge-workflow', id],
    queryFn: () => mergeWorkflowApi.get(id!),
    enabled: isEditMode,
  })

  const handleSave = useCallback(async (state: MergeWizardState) => {
    // Convert wizard state to API format
    const workflowData = {
      name: state.workflowName,
      description: state.workflowDescription || undefined,
      files: state.files.map((f) => ({
        id: f.id,
        name: f.name,
        filename: f.filename,
        colorIndex: f.colorIndex,
        columns: f.columns,
        sheetName: f.sheetName,
        headerRow: f.headerRow,
      })),
      keyColumn: state.keyColumn,
      outputColumns: state.outputColumns,
    }

    if (isEditMode && id) {
      await mergeWorkflowApi.update(id, workflowData)
    } else {
      await mergeWorkflowApi.create(workflowData)
    }
  }, [isEditMode, id])

  // Show loading state when fetching existing workflow
  if (isEditMode && isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  // Show error if workflow couldn't be loaded
  if (isEditMode && error) {
    return (
      <Card className="bg-red-50 border-red-200 max-w-2xl mx-auto">
        <p className="text-red-700">
          Failed to load workflow: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </Card>
    )
  }

  // Convert workflow to initial wizard state for edit mode
  const initialState: Partial<MergeWizardState> | undefined = workflow
    ? {
        currentStep: 0,
        files: workflow.files.map((f): FileDefinition => ({
          id: f.id,
          name: f.name,
          filename: f.filename,
          colorIndex: f.colorIndex,
          columns: f.columns,
          sheetName: (f as any).sheetName,
          headerRow: (f as any).headerRow,
        })),
        keyColumn: workflow.keyColumn,
        outputColumns: workflow.outputColumns,
        workflowName: workflow.name,
        workflowDescription: workflow.description || '',
      }
    : undefined

  return (
    <MergeWizard
      initialState={initialState}
      onSave={handleSave}
      isEditMode={isEditMode}
    />
  )
}
