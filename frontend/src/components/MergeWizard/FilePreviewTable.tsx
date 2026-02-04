import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import type { ColumnInfo } from '../../types'
import type { FileColor } from '../../lib/colors'

interface FilePreviewTableProps {
  columns: ColumnInfo[]
  sampleData?: Record<string, unknown>[]
  maxRows?: number
  color: FileColor
  compact?: boolean
}

export function FilePreviewTable({
  columns,
  sampleData,
  maxRows = 5,
  color,
  compact = false,
}: FilePreviewTableProps) {
  // Generate placeholder data if no sample data
  const displayData = sampleData?.slice(0, maxRows) ?? 
    Array.from({ length: Math.min(maxRows, 3) }, () => 
      columns.reduce((acc, col) => {
        acc[col.name] = col.sampleValues?.[0] ?? '***'
        return acc
      }, {} as Record<string, unknown>)
    )

  return (
    <div className={cn('overflow-hidden rounded-lg border', color.borderLight)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={cn(color.bgLight)}>
              {columns.slice(0, compact ? 4 : 6).map((col, index) => (
                <motion.th
                  key={col.name}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'px-3 py-2 text-left font-medium whitespace-nowrap border-b',
                    color.textDark,
                    color.borderLight
                  )}
                >
                  {col.name}
                </motion.th>
              ))}
              {columns.length > (compact ? 4 : 6) && (
                <th className={cn(
                  'px-3 py-2 text-left font-medium whitespace-nowrap border-b text-slate-400',
                  color.borderLight
                )}>
                  +{columns.length - (compact ? 4 : 6)} more
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, rowIndex) => (
              <motion.tr
                key={rowIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + rowIndex * 0.03 }}
                className="border-b last:border-b-0 border-slate-100"
              >
                {columns.slice(0, compact ? 4 : 6).map((col) => (
                  <td
                    key={col.name}
                    className="px-3 py-2 text-slate-600 whitespace-nowrap max-w-[150px] truncate"
                  >
                    {renderCellValue(row[col.name])}
                  </td>
                ))}
                {columns.length > (compact ? 4 : 6) && (
                  <td className="px-3 py-2 text-slate-400">...</td>
                )}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      {sampleData && sampleData.length > maxRows && (
        <div className={cn(
          'px-3 py-1.5 text-xs text-center border-t',
          color.text,
          color.bgLight,
          color.borderLight
        )}>
          +{sampleData.length - maxRows} more rows
        </div>
      )}
    </div>
  )
}

function renderCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
