import { motion } from 'framer-motion'
import { Key, Info, Check, Link2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { getFileColor } from '../../../lib/colors'
import { FileLegend } from '../FileLegend'
import type { FileDefinition, KeyColumnConfig } from '../../../types/merge'

interface KeyColumnStepProps {
  files: FileDefinition[]
  keyColumn?: KeyColumnConfig
  onKeyColumnChange: (keyColumn: KeyColumnConfig | undefined) => void
}

export function KeyColumnStep({
  files,
  keyColumn,
  onKeyColumnChange,
}: KeyColumnStepProps) {
  const mappings = keyColumn?.mappings || {}

  // Check if all files have a key column selected
  const allFilesHaveKey = files.every((f) => mappings[f.id])

  // Find columns that exist in all files with the same name (for quick select)
  const allColumnNames = files.map((f) => f.columns.map((c) => c.name))
  const commonColumns = allColumnNames.reduce((common, fileColumns) =>
    common.filter((col) => fileColumns.includes(col))
  )

  const handleSelectColumn = (fileId: string, column: string) => {
    const newMappings = { ...mappings, [fileId]: column }
    onKeyColumnChange({ mappings: newMappings })
  }

  const handleQuickSelectCommon = (columnName: string) => {
    // Set the same column name for all files
    const newMappings: Record<string, string> = {}
    files.forEach((f) => {
      newMappings[f.id] = columnName
    })
    onKeyColumnChange({ mappings: newMappings })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Select Key Columns
        </h2>
        <p className="text-slate-500">
          Choose a column from each file that contains matching values.
          Rows with the same value in these columns will be merged together.
        </p>
      </div>

      {/* File legend */}
      <FileLegend files={files} />

      {/* Quick select for common columns */}
      {commonColumns.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 mb-2">
                Quick select: Columns with same name in all files
              </p>
              <div className="flex flex-wrap gap-2">
                {commonColumns.map((col) => {
                  const isSelected = files.every((f) => mappings[f.id] === col)
                  return (
                    <button
                      key={col}
                      onClick={() => handleQuickSelectCommon(col)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                      {col}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Per-file column selection */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-slate-500" />
          <h3 className="font-medium text-slate-700">
            Select matching column from each file
          </h3>
        </div>

        <div className="grid gap-4">
          {files.map((file, fileIndex) => {
            const color = getFileColor(file.colorIndex)
            const selectedColumn = mappings[file.id]

            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: fileIndex * 0.1 }}
                className={cn(
                  'border-2 rounded-lg p-4 transition-all',
                  selectedColumn
                    ? cn(color.borderLight, color.bgLight)
                    : 'border-slate-200 bg-white'
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn('w-6 h-6 rounded flex items-center justify-center', color.bg)}>
                    <span className="text-white text-xs font-bold">{fileIndex + 1}</span>
                  </div>
                  <span className={cn('font-semibold', color.textDark)}>{file.name}</span>
                  {selectedColumn && (
                    <span className={cn('ml-auto flex items-center gap-1 text-sm', color.text)}>
                      <Key className="w-3.5 h-3.5" />
                      {selectedColumn}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {file.columns.map((col) => {
                    const isSelected = selectedColumn === col.name

                    return (
                      <motion.button
                        key={col.name}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelectColumn(file.id, col.name)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                          isSelected
                            ? cn(color.bg, 'text-white border-transparent shadow-sm')
                            : cn(
                                'bg-white border-slate-200 text-slate-700',
                                'hover:border-slate-300 hover:shadow-sm'
                              )
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                        {col.name}
                      </motion.button>
                    )
                  })}
                </div>

                {/* Show sample values for selected column */}
                {selectedColumn && (
                  <div className="mt-3 pt-3 border-t border-slate-200/50">
                    <p className="text-xs text-slate-500 mb-1">Sample values:</p>
                    <div className="flex flex-wrap gap-1">
                      {file.columns
                        .find((c) => c.name === selectedColumn)
                        ?.sampleValues?.slice(0, 4)
                        .map((val, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-0.5 bg-white rounded border border-slate-200 text-slate-600"
                          >
                            {String(val).slice(0, 20)}
                            {String(val).length > 20 ? '...' : ''}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Summary when all files have keys */}
      {allFilesHaveKey && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-50 rounded-lg border border-green-200"
        >
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-800">Key columns configured</span>
          </div>
          <p className="text-sm text-green-700">
            Rows will be matched based on:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((file, i) => {
              const color = getFileColor(file.colorIndex)
              return (
                <span key={file.id} className="flex items-center gap-1">
                  <span
                    className={cn(
                      'text-sm px-2 py-0.5 rounded font-medium',
                      color.bg,
                      'text-white'
                    )}
                  >
                    {file.name}: {mappings[file.id]}
                  </span>
                  {i < files.length - 1 && (
                    <span className="text-green-600">=</span>
                  )}
                </span>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
