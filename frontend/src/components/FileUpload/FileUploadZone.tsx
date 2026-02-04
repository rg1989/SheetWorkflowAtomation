import { useState, useCallback, useRef } from 'react'
import { Upload, FileSpreadsheet, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void
  accept?: string
  label?: string
  compact?: boolean
  selectedFile?: File | null
  onClear?: () => void
}

export function FileUploadZone({
  onFileSelect,
  accept = '.xlsx,.xls',
  label,
  compact = false,
  selectedFile,
  onClear,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        onFileSelect(files[0])
      }
    },
    [onFileSelect]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        onFileSelect(files[0])
      }
    },
    [onFileSelect]
  )

  const handleClick = () => {
    inputRef.current?.click()
  }

  if (selectedFile) {
    return (
      <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
        <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-lg">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-emerald-900 truncate">
            {selectedFile.name}
          </p>
          <p className="text-xs text-emerald-600">
            {(selectedFile.size / 1024).toFixed(1)} KB
          </p>
        </div>
        {onClear && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200',
        isDragging
          ? 'border-primary-500 bg-primary-50'
          : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50',
        compact ? 'p-4' : 'p-8'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex flex-col items-center text-center">
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-slate-100 mb-3',
            compact ? 'w-10 h-10' : 'w-12 h-12'
          )}
        >
          <Upload
            className={cn(
              'text-slate-500',
              compact ? 'w-5 h-5' : 'w-6 h-6'
            )}
          />
        </div>

        <p className={cn('font-medium text-slate-700', compact ? 'text-sm' : 'text-base')}>
          {label || 'Drop file here or click to upload'}
        </p>
        <p className={cn('text-slate-500 mt-1', compact ? 'text-xs' : 'text-sm')}>
          Excel files (.xlsx, .xls)
        </p>
      </div>
    </div>
  )
}
