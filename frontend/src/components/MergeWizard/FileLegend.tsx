import { motion } from 'framer-motion'
import { FileSpreadsheet } from 'lucide-react'
import { cn } from '../../lib/utils'
import { getFileColor } from '../../lib/colors'
import type { FileDefinition } from '../../types/merge'

interface FileLegendProps {
  files: FileDefinition[]
  className?: string
}

/**
 * Compact file legend showing color-to-file mapping.
 * Displays a small colored indicator with the file name for each file.
 */
export function FileLegend({ files, className }: FileLegendProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-1 p-3 bg-slate-50 rounded-lg border border-slate-200',
        className
      )}
    >
      <span className="text-xs font-medium text-slate-500 mr-2">Your files:</span>
      <div className="flex items-center gap-4">
        {files.map((file, index) => {
          const color = getFileColor(file.colorIndex)
          return (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-1.5"
            >
              <div
                className={cn(
                  'w-4 h-4 rounded flex items-center justify-center shadow-sm',
                  color.bg
                )}
              >
                <FileSpreadsheet className="w-2.5 h-2.5 text-white" />
              </div>
              <span className={cn('text-sm font-medium', color.textDark)}>
                {file.name}
              </span>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
