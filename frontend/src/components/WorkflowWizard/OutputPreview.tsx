import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { getFileColor } from '../../lib/colors'
import type { OutputColumn, FileDefinition } from '../../types'

interface OutputPreviewProps {
  files: FileDefinition[]
  outputColumns: OutputColumn[]
  previewRows?: number
}

export function OutputPreview({
  files,
  outputColumns,
  previewRows = 5,
}: OutputPreviewProps) {
  // Get the color for a column based on its source
  const getColumnColor = (column: OutputColumn) => {
    const source = column.source
    if (source.type === 'direct') {
      const file = files.find((f) => f.id === source.fileId)
      return file ? getFileColor(file.colorIndex) : null
    }
    if (source.type === 'concat' && source.parts.length > 0) {
      const firstColumnPart = source.parts.find((p) => p.type === 'column')
      if (firstColumnPart && firstColumnPart.type === 'column') {
        const file = files.find((f) => f.id === firstColumnPart.fileId)
        return file ? getFileColor(file.colorIndex) : null
      }
    }
    if (source.type === 'math' && source.operands.length > 0) {
      const firstColumnOp = source.operands.find((o) => o.type === 'column')
      if (firstColumnOp) {
        const file = files.find((f) => f.id === firstColumnOp.fileId)
        return file ? getFileColor(file.colorIndex) : null
      }
    }
    return null
  }

  // Generate placeholder values based on source type
  const getPlaceholderValue = (column: OutputColumn, rowIndex: number): string => {
    const source = column.source
    switch (source.type) {
      case 'direct': {
        const file = files.find((f) => f.id === source.fileId)
        const colInfo = file?.columns.find((c) => c.name === source.column)
        if (colInfo?.sampleValues?.[rowIndex % colInfo.sampleValues.length]) {
          const val = colInfo.sampleValues[rowIndex % colInfo.sampleValues.length]
          // Return blurred/masked version
          if (typeof val === 'number') {
            return '•••'
          }
          const str = String(val)
          if (str.length <= 3) return '•'.repeat(str.length)
          return str.slice(0, 2) + '•'.repeat(Math.min(str.length - 2, 5))
        }
        return '•••'
      }
      case 'concat': {
        return source.parts
          .map((part) => {
            if (part.type === 'literal') return part.value
            return '••'
          })
          .join(source.separator ?? '')
      }
      case 'math': {
        return '##.##'
      }
      case 'custom': {
        const val = source.defaultValue
        if (val.length <= 3) return '•'.repeat(val.length || 3)
        return val.slice(0, 2) + '•'.repeat(Math.min(val.length - 2, 5))
      }
      default:
        return '•••'
    }
  }

  if (outputColumns.length === 0) {
    return (
      <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
        <p className="text-slate-400">No columns defined yet</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              {outputColumns.map((column, index) => {
                const color = getColumnColor(column)
                return (
                  <motion.th
                    key={column.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative px-4 py-3 text-left font-medium text-slate-700 whitespace-nowrap border-b border-slate-200"
                  >
                    <div className="flex items-center gap-2">
                      {color && (
                        <span
                          className={cn('w-2 h-2 rounded-full flex-shrink-0', color.bg)}
                        />
                      )}
                      <span>{column.name}</span>
                    </div>
                    {/* Color indicator bar */}
                    {color && (
                      <motion.div
                        layoutId={`column-bar-${column.id}`}
                        className={cn('absolute bottom-0 left-0 right-0 h-0.5', color.bg)}
                      />
                    )}
                  </motion.th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: previewRows }).map((_, rowIndex) => (
              <motion.tr
                key={rowIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + rowIndex * 0.03 }}
                className={cn(
                  'border-b last:border-b-0 border-slate-100',
                  rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                )}
              >
                {outputColumns.map((column) => {
                  const color = getColumnColor(column)
                  return (
                    <td
                      key={column.id}
                      className="px-4 py-2.5 whitespace-nowrap"
                    >
                      <span
                        className={cn(
                          'font-mono text-xs tracking-wider',
                          color ? color.text : 'text-slate-400',
                          'opacity-70'
                        )}
                        style={{
                          filter: 'blur(0.5px)',
                        }}
                      >
                        {getPlaceholderValue(column, rowIndex)}
                      </span>
                    </td>
                  )
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">
        Preview with placeholder data • Actual values will appear when running the workflow
      </div>
    </div>
  )
}
