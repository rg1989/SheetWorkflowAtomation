import { motion } from 'framer-motion'
import { X, Pencil, Check, FileSpreadsheet, ChevronDown, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { FilePreviewTable } from './FilePreviewTable'
import { getFileColor } from '../../lib/colors'
import type { FileDefinition } from '../../types/merge'

interface FileCardProps {
  file: FileDefinition
  index: number
  onRemove: () => void
  onUpdateName: (name: string) => void
  onChangeSheet?: (sheetName: string) => Promise<void>
  onChangeHeaderRow?: (headerRow: number) => Promise<void>
  showPreview?: boolean
  isChangingSheet?: boolean
  isChangingHeaderRow?: boolean
}

// Available header row options (1-10)
const HEADER_ROW_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function FileCard({
  file,
  index,
  onRemove,
  onUpdateName,
  onChangeSheet,
  onChangeHeaderRow,
  showPreview = true,
  isChangingSheet = false,
  isChangingHeaderRow = false,
}: FileCardProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState(file.name)
  const [isSheetDropdownOpen, setIsSheetDropdownOpen] = useState(false)
  const [isHeaderRowDropdownOpen, setIsHeaderRowDropdownOpen] = useState(false)
  const color = getFileColor(file.colorIndex)
  
  const hasMultipleSheets = file.availableSheets && file.availableSheets.length > 1
  const currentHeaderRow = file.headerRow ?? 1
  const isLoading = isChangingSheet || isChangingHeaderRow

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdateName(editName.trim())
    } else {
      setEditName(file.name)
    }
    setIsEditingName(false)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
        delay: index * 0.1,
      }}
      className={cn(
        'rounded-xl border-2 overflow-hidden bg-white shadow-sm',
        color.border
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'px-4 py-3 flex items-center justify-between',
          color.bgLight
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              color.bg
            )}
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
          </div>

          {isEditingName ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') {
                    setEditName(file.name)
                    setIsEditingName(false)
                  }
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveName}
                className={cn(color.text)}
              >
                <Check className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="min-w-0">
                <h3 className={cn('font-semibold truncate', color.textDark)}>
                  {file.name}
                </h3>
                <p className="text-xs text-slate-500 truncate">{file.filename}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingName(true)}
                className="flex-shrink-0 text-slate-400 hover:text-slate-600"
              >
                <Pencil className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {/* Sheet selector dropdown */}
          {hasMultipleSheets && (
            <div className="relative">
              <button
                onClick={() => setIsSheetDropdownOpen(!isSheetDropdownOpen)}
                disabled={isLoading}
                className={cn(
                  'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border transition-colors',
                  'hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500',
                  isLoading && 'opacity-50 cursor-not-allowed',
                  color.border, color.text
                )}
              >
                {isChangingSheet ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <span className="max-w-[100px] truncate">{file.sheetName || file.availableSheets?.[0]}</span>
                    <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
              
              {isSheetDropdownOpen && !isLoading && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsSheetDropdownOpen(false)}
                  />
                  {/* Dropdown menu */}
                  <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[150px] max-h-[200px] overflow-y-auto">
                    {file.availableSheets?.map((sheet) => (
                      <button
                        key={sheet}
                        onClick={() => {
                          setIsSheetDropdownOpen(false)
                          if (sheet !== file.sheetName && onChangeSheet) {
                            onChangeSheet(sheet)
                          }
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors',
                          sheet === file.sheetName && 'bg-primary-50 text-primary-700 font-medium'
                        )}
                      >
                        {sheet}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Header row selector dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsHeaderRowDropdownOpen(!isHeaderRowDropdownOpen)}
              disabled={isLoading}
              title="Select which row contains column headers"
              className={cn(
                'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border transition-colors',
                'hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500',
                isLoading && 'opacity-50 cursor-not-allowed',
                'border-slate-300 text-slate-600'
              )}
            >
              {isChangingHeaderRow ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <span>Row {currentHeaderRow}</span>
                  <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
            
            {isHeaderRowDropdownOpen && !isLoading && (
              <>
                {/* Backdrop to close dropdown */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsHeaderRowDropdownOpen(false)}
                />
                {/* Dropdown menu */}
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[100px] max-h-[200px] overflow-y-auto">
                  <div className="px-3 py-1 text-xs text-slate-400 border-b border-slate-100">
                    Header row
                  </div>
                  {HEADER_ROW_OPTIONS.map((row) => (
                    <button
                      key={row}
                      onClick={() => {
                        setIsHeaderRowDropdownOpen(false)
                        if (row !== currentHeaderRow && onChangeHeaderRow) {
                          onChangeHeaderRow(row)
                        }
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors',
                        row === currentHeaderRow && 'bg-primary-50 text-primary-700 font-medium'
                      )}
                    >
                      Row {row}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          
          <span className={cn('text-xs font-medium px-2 py-1 rounded-full', color.bgLight, color.text)}>
            {file.columns.length} columns
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-slate-400 hover:text-red-500 hover:bg-red-50"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Preview table */}
      {showPreview && file.columns.length > 0 && (
        <div className="p-4 pt-0 -mt-0">
          <FilePreviewTable
            columns={file.columns}
            sampleData={file.sampleData}
            color={color}
            compact
            maxRows={3}
          />
        </div>
      )}
    </motion.div>
  )
}
