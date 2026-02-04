import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus, Columns, X, Check, CheckSquare, Trash2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { generateId } from '../../../lib/utils'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { OutputColumnCard } from '../OutputColumnCard'
import { ColumnSourceEditor } from '../ColumnSourceEditor'
import { FileLegend } from '../FileLegend'
import { getFileColor } from '../../../lib/colors'
import type { FileDefinition, OutputColumn, ColumnSource } from '../../../types'

interface OutputColumnsStepProps {
  files: FileDefinition[]
  outputColumns: OutputColumn[]
  onOutputColumnsChange: (columns: OutputColumn[]) => void
}

export function OutputColumnsStep({
  files,
  outputColumns,
  onOutputColumnsChange,
}: OutputColumnsStepProps) {
  const [isAddingColumn, setIsAddingColumn] = useState(false)
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [newColumnName, setNewColumnName] = useState('')
  const [newColumnSource, setNewColumnSource] = useState<ColumnSource>({
    type: 'direct',
    fileId: files[0]?.id ?? '',
    column: files[0]?.columns[0]?.name ?? '',
  })

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const oldIndex = outputColumns.findIndex((col) => col.id === active.id)
        const newIndex = outputColumns.findIndex((col) => col.id === over.id)
        const newColumns = arrayMove(outputColumns, oldIndex, newIndex).map(
          (col, index) => ({ ...col, order: index })
        )
        onOutputColumnsChange(newColumns)
      }
    },
    [outputColumns, onOutputColumnsChange]
  )

  const handleAddColumn = useCallback(() => {
    if (!newColumnName.trim()) return

    const newColumn: OutputColumn = {
      id: generateId(),
      name: newColumnName.trim(),
      source: newColumnSource,
      order: outputColumns.length,
    }

    onOutputColumnsChange([...outputColumns, newColumn])
    setNewColumnName('')
    setNewColumnSource({
      type: 'direct',
      fileId: files[0]?.id ?? '',
      column: files[0]?.columns[0]?.name ?? '',
    })
    setIsAddingColumn(false)
  }, [newColumnName, newColumnSource, outputColumns, onOutputColumnsChange, files])

  const handleEditColumn = useCallback(
    (columnId: string) => {
      const column = outputColumns.find((c) => c.id === columnId)
      if (column) {
        setNewColumnName(column.name)
        setNewColumnSource(column.source)
        setEditingColumnId(columnId)
        setIsAddingColumn(true)
      }
    },
    [outputColumns]
  )

  const handleSaveEdit = useCallback(() => {
    if (!editingColumnId || !newColumnName.trim()) return

    const updatedColumns = outputColumns.map((col) =>
      col.id === editingColumnId
        ? { ...col, name: newColumnName.trim(), source: newColumnSource }
        : col
    )
    onOutputColumnsChange(updatedColumns)
    setEditingColumnId(null)
    setNewColumnName('')
    setNewColumnSource({
      type: 'direct',
      fileId: files[0]?.id ?? '',
      column: files[0]?.columns[0]?.name ?? '',
    })
    setIsAddingColumn(false)
  }, [editingColumnId, newColumnName, newColumnSource, outputColumns, onOutputColumnsChange, files])

  const handleRemoveColumn = useCallback(
    (columnId: string) => {
      const updatedColumns = outputColumns
        .filter((col) => col.id !== columnId)
        .map((col, index) => ({ ...col, order: index }))
      onOutputColumnsChange(updatedColumns)
    },
    [outputColumns, onOutputColumnsChange]
  )

  const handleQuickAddColumn = useCallback(
    (fileId: string, columnName: string) => {
      const file = files.find((f) => f.id === fileId)
      if (!file) return

      const newColumn: OutputColumn = {
        id: generateId(),
        name: columnName,
        source: { type: 'direct', fileId, column: columnName },
        order: outputColumns.length,
      }

      onOutputColumnsChange([...outputColumns, newColumn])
    },
    [files, outputColumns, onOutputColumnsChange]
  )

  // Select all columns from a specific file
  const handleSelectAllFromFile = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId)
      if (!file) return

      // Get columns that haven't been added yet from this file
      const columnsToAdd = file.columns.filter(
        (col) =>
          !outputColumns.some(
            (oc) =>
              oc.source.type === 'direct' &&
              oc.source.fileId === fileId &&
              oc.source.column === col.name
          )
      )

      if (columnsToAdd.length === 0) return

      const newColumns: OutputColumn[] = columnsToAdd.map((col, index) => ({
        id: generateId(),
        name: col.name,
        source: { type: 'direct', fileId, column: col.name },
        order: outputColumns.length + index,
      }))

      onOutputColumnsChange([...outputColumns, ...newColumns])
    },
    [files, outputColumns, onOutputColumnsChange]
  )

  // Clear all output columns
  const handleClearAll = useCallback(() => {
    onOutputColumnsChange([])
  }, [onOutputColumnsChange])

  const cancelEdit = () => {
    setIsAddingColumn(false)
    setEditingColumnId(null)
    setNewColumnName('')
    setNewColumnSource({
      type: 'direct',
      fileId: files[0]?.id ?? '',
      column: files[0]?.columns[0]?.name ?? '',
    })
  }

  // Get columns that haven't been added yet (for quick add)
  const availableColumns = files.flatMap((file) =>
    file.columns
      .filter(
        (col) =>
          !outputColumns.some(
            (oc) =>
              oc.source.type === 'direct' &&
              oc.source.fileId === file.id &&
              oc.source.column === col.name
          )
      )
      .map((col) => ({
        fileId: file.id,
        fileName: file.name,
        colorIndex: file.colorIndex,
        columnName: col.name,
      }))
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Define Output Columns
        </h2>
        <p className="text-slate-500">
          Choose which columns will appear in your output. Drag to reorder.
        </p>
      </div>

      {/* File legend */}
      <FileLegend files={files} />

      <div className="grid grid-cols-2 gap-6">
        {/* Left panel: Available columns */}
        <div className="space-y-4">
          <h3 className="font-medium text-slate-700 flex items-center gap-2">
            <Columns className="w-4 h-4" />
            Available Columns
          </h3>
          <p className="text-sm text-slate-500">
            Click to quickly add a column, or use the button below for advanced options.
          </p>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {files.map((file) => {
              const color = getFileColor(file.colorIndex)
              const fileColumns = availableColumns.filter(
                (c) => c.fileId === file.id
              )

              if (fileColumns.length === 0) return null

              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('rounded-lg border p-3', color.borderLight, color.bgLight)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={cn('font-medium text-sm', color.textDark)}>
                      {file.name}
                    </h4>
                    <button
                      onClick={() => handleSelectAllFromFile(file.id)}
                      className={cn(
                        'flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-all',
                        'hover:bg-white/50',
                        color.text
                      )}
                      title={`Select all columns from ${file.name}`}
                    >
                      <CheckSquare className="w-3 h-3" />
                      Select All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {fileColumns.map((col) => (
                      <motion.button
                        key={`${col.fileId}-${col.columnName}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() =>
                          handleQuickAddColumn(col.fileId, col.columnName)
                        }
                        className={cn(
                          'px-2 py-1 text-xs rounded border transition-all',
                          color.border,
                          'bg-white hover:shadow-sm',
                          color.text
                        )}
                      >
                        {col.columnName}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )
            })}

            {availableColumns.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">
                All columns have been added
              </p>
            )}
          </div>

          <Button
            variant="secondary"
            onClick={() => setIsAddingColumn(true)}
            className="w-full"
          >
            <Plus className="w-4 h-4" />
            Add Custom Column
          </Button>
        </div>

        {/* Right panel: Output columns */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-700 flex items-center gap-2">
              <Columns className="w-4 h-4" />
              Output Columns ({outputColumns.length})
            </h3>
            {outputColumns.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-all"
                title="Clear all output columns"
              >
                <Trash2 className="w-3 h-3" />
                Clear All
              </button>
            )}
          </div>
          <p className="text-sm text-slate-500">
            These columns will appear in your output, in this order.
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={outputColumns.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                <AnimatePresence>
                  {outputColumns.map((column) => (
                    <OutputColumnCard
                      key={column.id}
                      column={column}
                      files={files}
                      onEdit={() => handleEditColumn(column.id)}
                      onRemove={() => handleRemoveColumn(column.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>

          {outputColumns.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center"
            >
              <Columns className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-400">No output columns defined</p>
              <p className="text-sm text-slate-400 mt-1">
                Click on columns from the left panel to add them
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Add/Edit Column Modal */}
      <AnimatePresence>
        {isAddingColumn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) cancelEdit()
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  {editingColumnId ? 'Edit Column' : 'Add Column'}
                </h3>
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <Input
                  label="Column Name"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="Enter column name"
                  autoFocus
                />

                <ColumnSourceEditor
                  files={files}
                  source={newColumnSource}
                  onChange={setNewColumnSource}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="secondary" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button
                  onClick={editingColumnId ? handleSaveEdit : handleAddColumn}
                  disabled={!newColumnName.trim()}
                >
                  <Check className="w-4 h-4" />
                  {editingColumnId ? 'Save Changes' : 'Add Column'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
