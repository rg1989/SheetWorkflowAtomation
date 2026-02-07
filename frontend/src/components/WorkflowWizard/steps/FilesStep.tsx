import { useCallback, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileSpreadsheet, AlertCircle, Cloud, RefreshCw } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { MAX_FILES, FILE_COLORS } from '../../../lib/colors'
import { FileCard } from '../FileCard'
import { fileApi, authApi } from '../../../lib/api'
import { useAuth } from '../../../context/AuthContext'
import { DriveFilePicker } from '../DriveFilePicker'
import type { FileDefinition, ColumnInfo } from '../../../types'

interface FilesStepProps {
  files: FileDefinition[]
  onAddFile: (file: File, columns: ColumnInfo[], sampleData?: Record<string, unknown>[], sheetName?: string, availableSheets?: string[], headerRow?: number) => void
  onAddDriveFile: (params: {
    name: string
    filename: string
    columns: ColumnInfo[]
    sampleData?: Record<string, unknown>[]
    driveFileId: string
    driveMimeType: string
    driveModifiedTime?: string
  }) => void
  onRemoveFile: (fileId: string) => void
  onUpdateFileName: (fileId: string, name: string) => void
  onUpdateFileSheet: (fileId: string, columns: ColumnInfo[], sampleData?: Record<string, unknown>[], sheetName?: string) => void
  onUpdateFileHeaderRow: (fileId: string, columns: ColumnInfo[], sampleData?: Record<string, unknown>[], headerRow?: number) => void
}

export function FilesStep({
  files,
  onAddFile,
  onAddDriveFile,
  onRemoveFile,
  onUpdateFileName,
  onUpdateFileSheet,
  onUpdateFileHeaderRow,
}: FilesStepProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [changingSheetFileId, setChangingSheetFileId] = useState<string | null>(null)
  const [changingHeaderRowFileId, setChangingHeaderRowFileId] = useState<string | null>(null)
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)

  const { driveConnected, loginWithDrive } = useAuth()
  const canAddMore = files.length < MAX_FILES

  // Check if user needs to reconnect Drive (has legacy scope)
  useEffect(() => {
    if (driveConnected) {
      authApi.driveStatus().then((status) => {
        setNeedsReconnect(status.needsReconnect)
      }).catch(() => {
        // Ignore errors - reconnect banner is optional
      })
    }
  }, [driveConnected])

  const handleDriveError = useCallback((errorMessage: string) => {
    setError(errorMessage)
  }, [])

  const handleReconnectDrive = useCallback(async () => {
    setIsReconnecting(true)
    try {
      await authApi.disconnectDrive()
      // Redirect to OAuth with Drive scopes
      loginWithDrive()
    } catch (err) {
      setError('Failed to reconnect Drive. Please try again.')
      setIsReconnecting(false)
    }
  }, [loginWithDrive])

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      setError(null)
      const filesToProcess = Array.from(fileList).slice(0, MAX_FILES - files.length)

      for (const file of filesToProcess) {
        if (!file.name.match(/\.xlsx?$/i)) {
          setError('Only Excel files (.xlsx, .xls) are supported')
          continue
        }

        setIsUploading(true)
        try {
          const result = await fileApi.parseColumns(file)
          // Extract sample data from the parse result if available
          const sampleData = result.sampleData ?? result.columns.map((col: ColumnInfo) => ({
            [col.name]: col.sampleValues?.[0] ?? null,
          }))
          onAddFile(file, result.columns, sampleData, result.sheetName, result.availableSheets, result.headerRow)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to parse file')
        } finally {
          setIsUploading(false)
        }
      }
    },
    [files.length, onAddFile]
  )

  const handleChangeSheet = useCallback(
    async (fileId: string, originalFile: File | undefined, sheetName: string, currentHeaderRow: number = 1) => {
      if (!originalFile) {
        setError('Cannot change sheet: original file reference not available')
        return
      }

      setError(null)
      setChangingSheetFileId(fileId)

      try {
        // Preserve the current header row setting when changing sheets
        const result = await fileApi.parseColumns(originalFile, sheetName, currentHeaderRow)
        const sampleData = result.sampleData ?? result.columns.map((col: ColumnInfo) => ({
          [col.name]: col.sampleValues?.[0] ?? null,
        }))
        onUpdateFileSheet(fileId, result.columns, sampleData, result.sheetName)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse sheet')
      } finally {
        setChangingSheetFileId(null)
      }
    },
    [onUpdateFileSheet]
  )

  const handleChangeHeaderRow = useCallback(
    async (fileId: string, originalFile: File | undefined, sheetName: string | undefined, headerRow: number) => {
      if (!originalFile) {
        setError('Cannot change header row: original file reference not available')
        return
      }

      setError(null)
      setChangingHeaderRowFileId(fileId)

      try {
        const result = await fileApi.parseColumns(originalFile, sheetName, headerRow)
        const sampleData = result.sampleData ?? result.columns.map((col: ColumnInfo) => ({
          [col.name]: col.sampleValues?.[0] ?? null,
        }))
        onUpdateFileHeaderRow(fileId, result.columns, sampleData, result.headerRow)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse with new header row')
      } finally {
        setChangingHeaderRowFileId(null)
      }
    },
    [onUpdateFileHeaderRow]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (canAddMore) setIsDragging(true)
  }, [canAddMore])

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

      if (!canAddMore) return

      const files = e.dataTransfer.files
      if (files.length > 0) {
        handleFiles(files)
      }
    },
    [canAddMore, handleFiles]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        handleFiles(files)
      }
      e.target.value = ''
    },
    [handleFiles]
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Add Your Files
        </h2>
        <p className="text-slate-500">
          Upload Excel files or select from Google Drive. You can add up to {MAX_FILES} files.
        </p>
      </div>

      {/* Reconnect Drive banner */}
      <AnimatePresence>
        {needsReconnect && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg"
          >
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-amber-900 font-medium mb-1">
                Drive Permissions Update Required
              </p>
              <p className="text-sm text-amber-700 mb-3">
                Your Google Drive connection needs to be updated to access all your files.
                Click reconnect to grant the latest permissions.
              </p>
              <button
                onClick={handleReconnectDrive}
                disabled={isReconnecting}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isReconnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Reconnecting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Reconnect Google Drive
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Color legend */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-500">File colors:</span>
        <div className="flex items-center gap-2">
          {FILE_COLORS.map((color, index) => (
            <motion.div
              key={color.name}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.05, type: 'spring', stiffness: 500 }}
              className={cn('w-4 h-4 rounded-full', color.bg)}
              title={`File ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* File source options */}
      {canAddMore && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Local upload option */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer',
                isDragging
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50',
                isUploading && 'pointer-events-none opacity-50'
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.xls"
                multiple
                onChange={handleFileInput}
                className="hidden"
              />

              <motion.div
                animate={isDragging ? { scale: 1.05 } : { scale: 1 }}
                className="flex flex-col items-center"
              >
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors duration-200',
                    isDragging ? 'bg-primary-100' : 'bg-slate-100'
                  )}
                >
                  {isUploading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <FileSpreadsheet className="w-6 h-6 text-slate-500" />
                    </motion.div>
                  ) : (
                    <Upload className={cn('w-6 h-6', isDragging ? 'text-primary-600' : 'text-slate-500')} />
                  )}
                </div>

                <p className="font-medium text-slate-700 mb-1">
                  {isUploading ? 'Processing...' : isDragging ? 'Drop files here' : 'Upload from Computer'}
                </p>
                <p className="text-sm text-slate-500">
                  Drop Excel files or click to browse
                </p>
              </motion.div>
            </motion.div>

            {/* Drive picker option */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              {driveConnected ? (
                <DriveFilePicker
                  onFileReady={onAddDriveFile}
                  onError={handleDriveError}
                  disabled={!canAddMore || isUploading}
                />
              ) : (
                <button
                  onClick={loginWithDrive}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all duration-200 w-full h-full justify-center"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <Cloud className="w-6 h-6 text-primary-400" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">Connect Google Drive</div>
                    <div className="text-sm text-slate-500">
                      Grant access to select files from Drive
                    </div>
                  </div>
                </button>
              )}
            </motion.div>
          </div>

          <p className="text-center text-xs text-slate-400">
            {MAX_FILES - files.length} more file{MAX_FILES - files.length !== 1 ? 's' : ''} can be added
          </p>
        </div>
      )}

      {/* File limit reached message */}
      {!canAddMore && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm text-center"
        >
          Maximum of {MAX_FILES} files reached. Remove a file to add a new one.
        </motion.div>
      )}

      {/* File cards */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {files.map((file, index) => (
            <FileCard
              key={file.id}
              file={file}
              index={index}
              onRemove={() => onRemoveFile(file.id)}
              onUpdateName={(name) => onUpdateFileName(file.id, name)}
              onChangeSheet={(sheetName) => handleChangeSheet(file.id, file.originalFile, sheetName, file.headerRow ?? 1)}
              onChangeHeaderRow={(headerRow) => handleChangeHeaderRow(file.id, file.originalFile, file.sheetName, headerRow)}
              isChangingSheet={changingSheetFileId === file.id}
              isChangingHeaderRow={changingHeaderRowFileId === file.id}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {files.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center py-8 text-slate-400"
        >
          <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No files uploaded yet</p>
          <p className="text-sm">Upload at least one file to continue</p>
        </motion.div>
      )}
    </div>
  )
}
