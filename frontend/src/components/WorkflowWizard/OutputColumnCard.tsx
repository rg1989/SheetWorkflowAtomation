import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { GripVertical, Pencil, Trash2, Columns } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { getFileColor } from '../../lib/colors'
import type { OutputColumn, FileDefinition } from '../../types'

interface OutputColumnCardProps {
  column: OutputColumn
  files: FileDefinition[]
  onEdit: () => void
  onRemove: () => void
}

export const OutputColumnCard = forwardRef<HTMLDivElement, OutputColumnCardProps>(
  function OutputColumnCard({ column, files, onEdit, onRemove }, ref) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: column.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    }

    // Get color based on source
    const getSourceColor = () => {
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

    const color = getSourceColor()

    const getSourceDescription = () => {
      const source = column.source
      switch (source.type) {
        case 'direct': {
          const file = files.find((f) => f.id === source.fileId)
          return `${file?.name ?? 'Unknown'} → ${source.column}`
        }
        case 'concat': {
          const partCount = source.parts.length
          return `Concat ${partCount} part${partCount !== 1 ? 's' : ''}`
        }
        case 'math': {
          const opSymbol = {
            add: '+',
            subtract: '−',
            multiply: '×',
            divide: '÷',
          }[source.operation]
          return `${source.operands.length} values ${opSymbol}`
        }
        case 'custom':
          return `Static: "${source.defaultValue}"`
        default:
          return 'Unknown source'
      }
    }

    return (
      <motion.div
        ref={(node) => {
          setNodeRef(node)
          if (typeof ref === 'function') {
            ref(node)
          } else if (ref) {
            ref.current = node
          }
        }}
        style={style}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ 
          opacity: isDragging ? 0.8 : 1, 
          y: 0,
          scale: isDragging ? 1.02 : 1,
          boxShadow: isDragging 
            ? '0 10px 25px -5px rgba(0,0,0,0.15)' 
            : '0 1px 3px rgba(0,0,0,0.1)',
        }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          'flex items-center gap-3 p-3 bg-white border rounded-lg group transition-colors',
          isDragging ? 'border-primary-300 bg-primary-50' : 'border-slate-200',
          color && `border-l-4 ${color.border}`
        )}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 p-1 rounded hover:bg-slate-100 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-4 h-4 text-slate-400" />
        </button>

        {/* Column info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Columns className={cn('w-4 h-4', color?.text ?? 'text-slate-400')} />
            <span className="font-medium text-slate-900 truncate">
              {column.name}
            </span>
          </div>
          <p className="text-sm text-slate-500 truncate mt-0.5">
            {getSourceDescription()}
          </p>
        </div>

        {/* Source type badge */}
        <span
          className={cn(
            'text-xs font-medium px-2 py-1 rounded-full flex-shrink-0',
            column.source.type === 'direct' && 'bg-blue-100 text-blue-700',
            column.source.type === 'concat' && 'bg-purple-100 text-purple-700',
            column.source.type === 'math' && 'bg-amber-100 text-amber-700',
            column.source.type === 'custom' && 'bg-slate-100 text-slate-700'
          )}
        >
          {column.source.type}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="text-slate-400 hover:text-primary-600"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-slate-400 hover:text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    )
  }
)
