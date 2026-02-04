import { motion } from 'framer-motion'
import { FileSpreadsheet, Columns, ArrowRight } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { Input } from '../../ui/Input'
import { OutputPreview } from '../OutputPreview'
import { getFileColor } from '../../../lib/colors'
import type { FileDefinition, OutputColumn } from '../../../types/merge'

interface PreviewStepProps {
  files: FileDefinition[]
  outputColumns: OutputColumn[]
  workflowName: string
  workflowDescription: string
  onWorkflowNameChange: (name: string) => void
  onWorkflowDescriptionChange: (description: string) => void
}

export function PreviewStep({
  files,
  outputColumns,
  workflowName,
  workflowDescription,
  onWorkflowNameChange,
  onWorkflowDescriptionChange,
}: PreviewStepProps) {
  // Count columns by source type
  const columnsByType = outputColumns.reduce(
    (acc, col) => {
      acc[col.source.type] = (acc[col.source.type] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Review & Save
        </h2>
        <p className="text-slate-500">
          Preview your merged output and give your workflow a name.
        </p>
      </div>

      {/* Workflow name and description */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 gap-4"
      >
        <Input
          label="Workflow Name"
          value={workflowName}
          onChange={(e) => onWorkflowNameChange(e.target.value)}
          placeholder="e.g., Monthly Sales Merge"
          autoFocus
        />
        <Input
          label="Description (optional)"
          value={workflowDescription}
          onChange={(e) => onWorkflowDescriptionChange(e.target.value)}
          placeholder="What does this workflow do?"
        />
      </motion.div>

      {/* Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-4"
      >
        {/* Files summary */}
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 text-slate-600 mb-3">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="font-medium">Input Files</span>
          </div>
          <div className="space-y-2">
            {files.map((file, index) => {
              const color = getFileColor(file.colorIndex)
              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + index * 0.05 }}
                  className="flex items-center gap-2"
                >
                  <span className={cn('w-3 h-3 rounded-full', color.bg)} />
                  <span className="text-sm text-slate-700 truncate flex-1">
                    {file.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {file.columns.length} cols
                  </span>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center"
          >
            <ArrowRight className="w-6 h-6 text-primary-600" />
          </motion.div>
        </div>

        {/* Output summary */}
        <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
          <div className="flex items-center gap-2 text-primary-700 mb-3">
            <Columns className="w-4 h-4" />
            <span className="font-medium">Output</span>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-primary-800">
              <span className="font-semibold">{outputColumns.length}</span> columns
            </p>
            {Object.entries(columnsByType).map(([type, count]) => (
              <p key={type} className="text-xs text-primary-600">
                {count} {type} column{count !== 1 ? 's' : ''}
              </p>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Output preview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
          <Columns className="w-4 h-4" />
          Output Preview
        </h3>
        <OutputPreview
          files={files}
          outputColumns={outputColumns}
          previewRows={5}
        />
      </motion.div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-center gap-6 text-xs text-slate-500"
      >
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          Direct mapping
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          Concatenation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Calculation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          Custom value
        </span>
      </motion.div>
    </div>
  )
}
