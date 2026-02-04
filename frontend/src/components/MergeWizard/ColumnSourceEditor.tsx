import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, GripVertical } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { getFileColor } from '../../lib/colors'
import type { FileDefinition } from '../../types/merge'
import type { ColumnSource, ConcatPart, MathOperand } from '../../types/merge'

interface ColumnSourceEditorProps {
  files: FileDefinition[]
  source: ColumnSource
  onChange: (source: ColumnSource) => void
}

const SOURCE_TYPES = [
  { value: 'direct', label: 'Direct - Copy from column' },
  { value: 'concat', label: 'Concat - Combine values' },
  { value: 'math', label: 'Math - Calculate value' },
  { value: 'custom', label: 'Custom - Static value' },
]

const MATH_OPERATIONS = [
  { value: 'add', label: 'Add (+)' },
  { value: 'subtract', label: 'Subtract (-)' },
  { value: 'multiply', label: 'Multiply (×)' },
  { value: 'divide', label: 'Divide (÷)' },
]

export function ColumnSourceEditor({
  files,
  source,
  onChange,
}: ColumnSourceEditorProps) {
  const handleTypeChange = (newType: string) => {
    switch (newType) {
      case 'direct':
        onChange({
          type: 'direct',
          fileId: files[0]?.id ?? '',
          column: files[0]?.columns[0]?.name ?? '',
        })
        break
      case 'concat':
        onChange({
          type: 'concat',
          parts: [],
          separator: '',
        })
        break
      case 'math':
        onChange({
          type: 'math',
          operation: 'add',
          operands: [],
        })
        break
      case 'custom':
        onChange({
          type: 'custom',
          defaultValue: '',
        })
        break
    }
  }

  return (
    <div className="space-y-4">
      {/* Source type selector */}
      <Select
        label="Source Type"
        value={source.type}
        onChange={(e) => handleTypeChange(e.target.value)}
        options={SOURCE_TYPES}
      />

      {/* Type-specific editors */}
      <AnimatePresence mode="wait">
        <motion.div
          key={source.type}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
        >
          {source.type === 'direct' && (
            <DirectSourceEditor
              files={files}
              source={source}
              onChange={onChange}
            />
          )}
          {source.type === 'concat' && (
            <ConcatSourceEditor
              files={files}
              source={source}
              onChange={onChange}
            />
          )}
          {source.type === 'math' && (
            <MathSourceEditor
              files={files}
              source={source}
              onChange={onChange}
            />
          )}
          {source.type === 'custom' && (
            <CustomSourceEditor source={source} onChange={onChange} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// Direct source editor - simple column selection
function DirectSourceEditor({
  files,
  source,
  onChange,
}: {
  files: FileDefinition[]
  source: Extract<ColumnSource, { type: 'direct' }>
  onChange: (source: ColumnSource) => void
}) {
  const selectedFile = files.find((f) => f.id === source.fileId)
  const color = selectedFile ? getFileColor(selectedFile.colorIndex) : null

  return (
    <div className="space-y-3">
      <Select
        label="From File"
        value={source.fileId}
        onChange={(e) =>
          onChange({
            ...source,
            fileId: e.target.value,
            column: files.find((f) => f.id === e.target.value)?.columns[0]?.name ?? '',
          })
        }
        options={files.map((f) => ({
          value: f.id,
          label: f.name,
        }))}
      />
      {color && (
        <div className={cn('w-full h-1 rounded-full', color.bg)} />
      )}
      <Select
        label="Column"
        value={source.column}
        onChange={(e) => onChange({ ...source, column: e.target.value })}
        options={
          selectedFile?.columns.map((c) => ({
            value: c.name,
            label: c.name,
          })) ?? []
        }
      />
    </div>
  )
}

// Concat source editor - combine multiple parts
function ConcatSourceEditor({
  files,
  source,
  onChange,
}: {
  files: FileDefinition[]
  source: Extract<ColumnSource, { type: 'concat' }>
  onChange: (source: ColumnSource) => void
}) {
  const [newPartType, setNewPartType] = useState<'column' | 'literal'>('column')

  const addPart = () => {
    const newPart: ConcatPart =
      newPartType === 'column'
        ? {
            type: 'column',
            fileId: files[0]?.id ?? '',
            column: files[0]?.columns[0]?.name ?? '',
          }
        : { type: 'literal', value: '' }

    onChange({
      ...source,
      parts: [...source.parts, newPart],
    })
  }

  const updatePart = (index: number, part: ConcatPart) => {
    const newParts = [...source.parts]
    newParts[index] = part
    onChange({ ...source, parts: newParts })
  }

  const removePart = (index: number) => {
    onChange({
      ...source,
      parts: source.parts.filter((_, i) => i !== index),
    })
  }

  return (
    <div className="space-y-3">
      <Input
        label="Separator (optional)"
        value={source.separator ?? ''}
        onChange={(e) => onChange({ ...source, separator: e.target.value })}
        placeholder="e.g., - or space"
      />

      <div className="space-y-2">
        <label className="label">Parts to concatenate</label>
        <AnimatePresence>
          {source.parts.map((part, index) => (
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-2"
            >
              <GripVertical className="w-4 h-4 text-slate-400" />
              {part.type === 'column' ? (
                <ColumnPartEditor
                  files={files}
                  part={part}
                  onChange={(p) => updatePart(index, p)}
                />
              ) : (
                <Input
                  value={part.value}
                  onChange={(e) =>
                    updatePart(index, { type: 'literal', value: e.target.value })
                  }
                  placeholder="Text value"
                  className="flex-1"
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removePart(index)}
                className="text-slate-400 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={newPartType}
          onChange={(e) => setNewPartType(e.target.value as 'column' | 'literal')}
          options={[
            { value: 'column', label: 'Column' },
            { value: 'literal', label: 'Text' },
          ]}
          className="w-32"
        />
        <Button variant="secondary" size="sm" onClick={addPart}>
          <Plus className="w-4 h-4" />
          Add Part
        </Button>
      </div>
    </div>
  )
}

// Column part editor for concat
function ColumnPartEditor({
  files,
  part,
  onChange,
}: {
  files: FileDefinition[]
  part: Extract<ConcatPart, { type: 'column' }>
  onChange: (part: ConcatPart) => void
}) {
  const file = files.find((f) => f.id === part.fileId)
  const color = file ? getFileColor(file.colorIndex) : null

  return (
    <div className="flex items-center gap-2 flex-1">
      {color && (
        <div className={cn('w-2 h-8 rounded-full', color.bg)} />
      )}
      <Select
        value={part.fileId}
        onChange={(e) =>
          onChange({
            type: 'column',
            fileId: e.target.value,
            column: files.find((f) => f.id === e.target.value)?.columns[0]?.name ?? '',
          })
        }
        options={files.map((f) => ({ value: f.id, label: f.name }))}
        className="w-32"
      />
      <Select
        value={part.column}
        onChange={(e) => onChange({ ...part, column: e.target.value })}
        options={file?.columns.map((c) => ({ value: c.name, label: c.name })) ?? []}
        className="flex-1"
      />
    </div>
  )
}

// Math source editor - calculations
function MathSourceEditor({
  files,
  source,
  onChange,
}: {
  files: FileDefinition[]
  source: Extract<ColumnSource, { type: 'math' }>
  onChange: (source: ColumnSource) => void
}) {
  const [newOperandType, setNewOperandType] = useState<'column' | 'literal'>('column')

  const addOperand = () => {
    const newOperand: MathOperand =
      newOperandType === 'column'
        ? {
            type: 'column',
            fileId: files[0]?.id,
            column: files[0]?.columns[0]?.name,
          }
        : { type: 'literal', value: 0 }

    onChange({
      ...source,
      operands: [...source.operands, newOperand],
    })
  }

  const updateOperand = (index: number, operand: MathOperand) => {
    const newOperands = [...source.operands]
    newOperands[index] = operand
    onChange({ ...source, operands: newOperands })
  }

  const removeOperand = (index: number) => {
    onChange({
      ...source,
      operands: source.operands.filter((_, i) => i !== index),
    })
  }

  return (
    <div className="space-y-3">
      <Select
        label="Operation"
        value={source.operation}
        onChange={(e) =>
          onChange({
            ...source,
            operation: e.target.value as 'add' | 'subtract' | 'multiply' | 'divide',
          })
        }
        options={MATH_OPERATIONS}
      />

      <div className="space-y-2">
        <label className="label">Operands</label>
        <AnimatePresence>
          {source.operands.map((operand, index) => (
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-2"
            >
              {index > 0 && (
                <span className="text-slate-400 w-6 text-center">
                  {source.operation === 'add' && '+'}
                  {source.operation === 'subtract' && '−'}
                  {source.operation === 'multiply' && '×'}
                  {source.operation === 'divide' && '÷'}
                </span>
              )}
              {operand.type === 'column' ? (
                <OperandColumnEditor
                  files={files}
                  operand={operand}
                  onChange={(o) => updateOperand(index, o)}
                />
              ) : (
                <Input
                  type="number"
                  value={operand.value ?? 0}
                  onChange={(e) =>
                    updateOperand(index, {
                      type: 'literal',
                      value: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-24"
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeOperand(index)}
                className="text-slate-400 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={newOperandType}
          onChange={(e) => setNewOperandType(e.target.value as 'column' | 'literal')}
          options={[
            { value: 'column', label: 'Column' },
            { value: 'literal', label: 'Number' },
          ]}
          className="w-32"
        />
        <Button variant="secondary" size="sm" onClick={addOperand}>
          <Plus className="w-4 h-4" />
          Add Operand
        </Button>
      </div>
    </div>
  )
}

// Operand column editor for math
function OperandColumnEditor({
  files,
  operand,
  onChange,
}: {
  files: FileDefinition[]
  operand: MathOperand
  onChange: (operand: MathOperand) => void
}) {
  const file = files.find((f) => f.id === operand.fileId)
  const color = file ? getFileColor(file.colorIndex) : null

  return (
    <div className="flex items-center gap-2 flex-1">
      {color && (
        <div className={cn('w-2 h-8 rounded-full', color.bg)} />
      )}
      <Select
        value={operand.fileId ?? ''}
        onChange={(e) =>
          onChange({
            type: 'column',
            fileId: e.target.value,
            column: files.find((f) => f.id === e.target.value)?.columns[0]?.name,
          })
        }
        options={files.map((f) => ({ value: f.id, label: f.name }))}
        className="w-32"
      />
      <Select
        value={operand.column ?? ''}
        onChange={(e) => onChange({ ...operand, column: e.target.value })}
        options={
          file?.columns.map((c) => ({ 
            value: c.name, 
            label: c.type === 'number' || c.type === 'integer' 
              ? c.name 
              : `${c.name} (${c.type})` 
          })) ?? []
        }
        className="flex-1"
        placeholder="Select column"
      />
    </div>
  )
}

// Custom source editor - static value
function CustomSourceEditor({
  source,
  onChange,
}: {
  source: Extract<ColumnSource, { type: 'custom' }>
  onChange: (source: ColumnSource) => void
}) {
  return (
    <Input
      label="Default Value"
      value={source.defaultValue}
      onChange={(e) => onChange({ ...source, defaultValue: e.target.value })}
      placeholder="Enter a static value for all rows"
    />
  )
}
