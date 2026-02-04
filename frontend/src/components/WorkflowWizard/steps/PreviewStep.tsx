import { motion } from 'framer-motion'
import { FileSpreadsheet, Columns, ArrowRight, GitMerge, Star } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { Input } from '../../ui/Input'
import { OutputPreview } from '../OutputPreview'
import { getFileColor } from '../../../lib/colors'
import type { FileDefinition, OutputColumn, JoinConfig } from '../../../types'
import { JOIN_TYPE_INFO } from '../../../types'

interface PreviewStepProps {
  files: FileDefinition[]
  outputColumns: OutputColumn[]
  joinConfig?: JoinConfig
  workflowName: string
  workflowDescription: string
  onWorkflowNameChange: (name: string) => void
  onWorkflowDescriptionChange: (description: string) => void
}

export function PreviewStep({
  files,
  outputColumns,
  joinConfig,
  workflowName,
  workflowDescription,
  onWorkflowNameChange,
  onWorkflowDescriptionChange,
}: PreviewStepProps) {
  // Get primary file info
  const primaryFile = files.find((f) => f.id === joinConfig?.primaryFileId) || files[0]
  const joinType = joinConfig?.joinType || 'left'
  const joinInfo = JOIN_TYPE_INFO[joinType]
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
          Preview your output and give your workflow a name.
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
          placeholder="e.g., Monthly Data Combine"
          autoFocus
        />
        <Input
          label="Description (optional)"
          value={workflowDescription}
          onChange={(e) => onWorkflowDescriptionChange(e.target.value)}
          placeholder="What does this workflow do?"
        />
      </motion.div>

      {/* Join Configuration Summary */}
      {joinConfig && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 bg-blue-50 rounded-lg border border-blue-200"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <GitMerge className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-blue-900">{joinInfo.label}</p>
              <p className="text-sm text-blue-700">{joinInfo.description}</p>
            </div>
            {(joinType === 'left' || joinType === 'right') && primaryFile && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-blue-200">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="text-sm font-medium text-slate-700">
                  Primary: {primaryFile.name}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}

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
