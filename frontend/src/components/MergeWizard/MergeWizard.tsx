import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Save } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { WizardProgress } from './WizardProgress'
import { FilesStep } from './steps/FilesStep'
import { KeyColumnStep } from './steps/KeyColumnStep'
import { OutputColumnsStep } from './steps/OutputColumnsStep'
import { PreviewStep } from './steps/PreviewStep'
import { generateId } from '../../lib/utils'
import { getNextColorIndex, MAX_FILES } from '../../lib/colors'
import type {
  FileDefinition,
  KeyColumnConfig,
  OutputColumn,
  MergeWizardState,
} from '../../types/merge'
import type { ColumnInfo } from '../../types'

interface MergeWizardProps {
  initialState?: Partial<MergeWizardState>
  onSave?: (state: MergeWizardState) => Promise<void>
  isEditMode?: boolean
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
}

export function MergeWizard({ initialState, onSave, isEditMode = false }: MergeWizardProps) {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(initialState?.currentStep ?? 0)
  const [direction, setDirection] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Wizard state
  const [files, setFiles] = useState<FileDefinition[]>(initialState?.files ?? [])
  const [keyColumn, setKeyColumn] = useState<KeyColumnConfig | undefined>(
    initialState?.keyColumn
  )
  const [outputColumns, setOutputColumns] = useState<OutputColumn[]>(
    initialState?.outputColumns ?? []
  )
  const [workflowName, setWorkflowName] = useState(
    initialState?.workflowName ?? ''
  )
  const [workflowDescription, setWorkflowDescription] = useState(
    initialState?.workflowDescription ?? ''
  )

  // File management
  const handleAddFile = useCallback(
    (
      file: File,
      columns: ColumnInfo[],
      sampleData?: Record<string, unknown>[],
      sheetName?: string,
      availableSheets?: string[],
      headerRow?: number
    ) => {
      setFiles((prev) => {
        // Check limit using current state
        if (prev.length >= MAX_FILES) {
          setError(`Maximum of ${MAX_FILES} files allowed`)
          return prev
        }

        // Calculate color based on current state (not stale closure)
        const usedColorIndices = prev.map((f) => f.colorIndex)
        const colorIndex = getNextColorIndex(usedColorIndices)

        const newFile: FileDefinition = {
          id: generateId(),
          name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for display name
          filename: file.name,
          colorIndex,
          columns,
          sampleData,
          sheetName,
          availableSheets,
          originalFile: file, // Keep reference for re-parsing with different sheet
          headerRow: headerRow ?? 1,
        }

        setError(null)
        return [...prev, newFile]
      })
    },
    []
  )

  const handleRemoveFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
    // Also remove any output columns that reference this file
    setOutputColumns((prev) =>
      prev.filter((col) => {
        if (col.source.type === 'direct') {
          return col.source.fileId !== fileId
        }
        if (col.source.type === 'concat') {
          return !col.source.parts.some(
            (p) => p.type === 'column' && p.fileId === fileId
          )
        }
        if (col.source.type === 'math') {
          return !col.source.operands.some(
            (o) => o.type === 'column' && o.fileId === fileId
          )
        }
        return true
      })
    )
    // Remove file from key column mappings
    setKeyColumn((prev) => {
      if (!prev) return prev
      const newMappings = { ...prev.mappings }
      delete newMappings[fileId]
      // If no mappings left, clear keyColumn entirely
      return Object.keys(newMappings).length > 0 ? { mappings: newMappings } : undefined
    })
  }, [])

  const handleUpdateFileName = useCallback((fileId: string, name: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, name } : f))
    )
  }, [])

  const handleUpdateFileSheet = useCallback(
    (
      fileId: string,
      columns: ColumnInfo[],
      sampleData?: Record<string, unknown>[],
      sheetName?: string
    ) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, columns, sampleData, sheetName } : f
        )
      )
      // When sheet changes, the columns may be different
      // Remove any output columns that reference columns that no longer exist
      setOutputColumns((prevOutputs) =>
        prevOutputs.filter((col) => {
          if (col.source.type === 'direct' && col.source.fileId === fileId) {
            const newColumnNames = columns.map((c) => c.name)
            return newColumnNames.includes(col.source.column)
          }
          return true
        })
      )
      // Also update key column if it references a column that no longer exists
      setKeyColumn((prevKey) => {
        if (!prevKey) return prevKey
        const currentMapping = prevKey.mappings[fileId]
        if (currentMapping) {
          const newColumnNames = columns.map((c) => c.name)
          if (!newColumnNames.includes(currentMapping)) {
            const newMappings = { ...prevKey.mappings }
            delete newMappings[fileId]
            return Object.keys(newMappings).length > 0
              ? { mappings: newMappings }
              : undefined
          }
        }
        return prevKey
      })
    },
    []
  )

  const handleUpdateFileHeaderRow = useCallback(
    (
      fileId: string,
      columns: ColumnInfo[],
      sampleData?: Record<string, unknown>[],
      headerRow?: number
    ) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, columns, sampleData, headerRow } : f
        )
      )
      // When header row changes, the columns may be different
      // Remove any output columns that reference columns that no longer exist
      setOutputColumns((prevOutputs) =>
        prevOutputs.filter((col) => {
          if (col.source.type === 'direct' && col.source.fileId === fileId) {
            const newColumnNames = columns.map((c) => c.name)
            return newColumnNames.includes(col.source.column)
          }
          return true
        })
      )
      // Also update key column if it references a column that no longer exists
      setKeyColumn((prevKey) => {
        if (!prevKey) return prevKey
        const currentMapping = prevKey.mappings[fileId]
        if (currentMapping) {
          const newColumnNames = columns.map((c) => c.name)
          if (!newColumnNames.includes(currentMapping)) {
            const newMappings = { ...prevKey.mappings }
            delete newMappings[fileId]
            return Object.keys(newMappings).length > 0
              ? { mappings: newMappings }
              : undefined
          }
        }
        return prevKey
      })
    },
    []
  )

  // Navigation
  const canGoNext = useCallback(() => {
    switch (currentStep) {
      case 0: // Files step
        return files.length >= 1
      case 1: // Key column step - all files must have a key column selected
        return keyColumn && 
          files.length > 0 && 
          files.every((f) => keyColumn.mappings[f.id])
      case 2: // Output columns step
        return outputColumns.length > 0
      case 3: // Preview step
        return workflowName.trim().length > 0
      default:
        return false
    }
  }, [currentStep, files, keyColumn, outputColumns, workflowName])

  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step <= 3 && step <= currentStep) {
        setDirection(step > currentStep ? 1 : -1)
        setCurrentStep(step)
      }
    },
    [currentStep]
  )

  const goNext = useCallback(() => {
    if (currentStep < 3 && canGoNext()) {
      setDirection(1)
      setCurrentStep((prev) => prev + 1)
    }
  }, [currentStep, canGoNext])

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1)
      setCurrentStep((prev) => prev - 1)
    }
  }, [currentStep])

  const handleSave = useCallback(async () => {
    if (!workflowName.trim()) {
      setError('Please enter a workflow name')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const state: MergeWizardState = {
        currentStep,
        files,
        keyColumn,
        outputColumns,
        workflowName,
        workflowDescription,
      }

      if (onSave) {
        await onSave(state)
      }

      navigate('/workflows')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow')
    } finally {
      setSaving(false)
    }
  }, [
    currentStep,
    files,
    keyColumn,
    outputColumns,
    workflowName,
    workflowDescription,
    onSave,
    navigate,
  ])

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <FilesStep
            files={files}
            onAddFile={handleAddFile}
            onRemoveFile={handleRemoveFile}
            onUpdateFileName={handleUpdateFileName}
            onUpdateFileSheet={handleUpdateFileSheet}
            onUpdateFileHeaderRow={handleUpdateFileHeaderRow}
          />
        )
      case 1:
        return (
          <KeyColumnStep
            files={files}
            keyColumn={keyColumn}
            onKeyColumnChange={setKeyColumn}
          />
        )
      case 2:
        return (
          <OutputColumnsStep
            files={files}
            outputColumns={outputColumns}
            onOutputColumnsChange={setOutputColumns}
          />
        )
      case 3:
        return (
          <PreviewStep
            files={files}
            outputColumns={outputColumns}
            workflowName={workflowName}
            workflowDescription={workflowDescription}
            onWorkflowNameChange={setWorkflowName}
            onWorkflowDescriptionChange={setWorkflowDescription}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/workflows')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isEditMode ? 'Edit Merge Workflow' : 'Create Merge Workflow'}
          </h1>
        </div>
      </div>

      {/* Progress indicator */}
      <WizardProgress currentStep={currentStep} onStepClick={goToStep} />

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Step content */}
      <Card className="min-h-[400px] overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            className="p-6"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </Card>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="secondary"
          onClick={goPrev}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          {currentStep === 3 ? (
            <Button onClick={handleSave} disabled={saving || !canGoNext()}>
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : isEditMode ? 'Update Workflow' : 'Save Workflow'}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canGoNext()}>
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
