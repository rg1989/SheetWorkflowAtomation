import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Upload, Play, Download, FileSpreadsheet, Check, AlertCircle, ChevronDown, Loader2, Cloud, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { workflowApi, fileApi, driveApi } from '../lib/api'
import { cn } from '../lib/utils'
import { getFileColor } from '../lib/colors'
import { useAuth } from '../context/AuthContext'
import { useDriveFilePicker } from '../hooks/useDriveFilePicker'
import type { FileDefinition, ColumnInfo, DriveRunFileState, DrivePickerFile } from '../types'

interface UploadedFileState {
  file: File
  validated: boolean
  error?: string
  availableSheets?: string[]
  selectedSheet?: string
  headerRow: number
  columns?: ColumnInfo[]
  isRevalidating?: boolean
}

// Available header row options (1-10)
const HEADER_ROW_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface FileSlotCardProps {
  expectedFile: FileDefinition
  uploaded?: UploadedFileState
  driveFile?: DriveRunFileState
  color: ReturnType<typeof getFileColor>
  columnNames: string[]
  showVersionWarning: boolean
  driveConnected: boolean
  index: number
  onFileUpload: (expectedFile: FileDefinition, file: File) => void
  onSheetChange: (expectedFile: FileDefinition, uploaded: UploadedFileState, newSheet: string) => void
  onHeaderRowChange: (expectedFile: FileDefinition, uploaded: UploadedFileState, newHeaderRow: number) => void
  onDriveFileSelect: (expectedFile: FileDefinition, pickedFile: DrivePickerFile) => void
  onDriveTabChange: (expectedFile: FileDefinition, driveFile: DriveRunFileState, newTab: string) => void
  onDriveHeaderRowChange: (expectedFile: FileDefinition, driveFile: DriveRunFileState, newHeaderRow: number) => void
}

function FileSlotCard({
  expectedFile,
  uploaded,
  driveFile,
  color,
  columnNames,
  showVersionWarning,
  driveConnected,
  index,
  onFileUpload,
  onSheetChange,
  onHeaderRowChange,
  onDriveFileSelect,
  onDriveTabChange,
  onDriveHeaderRowChange,
}: FileSlotCardProps) {
  const { openPicker: openDrivePicker, isLoading: isPickerLoading } = useDriveFilePicker({
    onSelect: (pickedFile) => onDriveFileSelect(expectedFile, pickedFile),
    onError: (error) => console.error('Drive picker error:', error),
  })

  const isValidated = uploaded?.validated || driveFile?.validated
  const hasError = uploaded?.error || driveFile?.error

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        'border-2 rounded-lg p-4 transition-all',
        isValidated
          ? 'border-green-300 bg-green-50'
          : hasError
          ? 'border-red-300 bg-red-50'
          : cn(color.borderLight, color.bgLight)
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn('w-6 h-6 rounded flex items-center justify-center', color.bg)}>
              <FileSpreadsheet className="w-4 h-4 text-white" />
            </div>
            <span className={cn('font-semibold', color.textDark)}>
              {expectedFile.name}
            </span>
            {isValidated && (
              <Badge variant="success" className="flex items-center gap-1">
                <Check className="w-3 h-3" />
                Ready
              </Badge>
            )}
            {hasError && (
              <Badge variant="error" className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Invalid
              </Badge>
            )}
            {showVersionWarning && (
              <Badge variant="warning" className="flex items-center gap-1 text-xs">
                File unchanged since last run
              </Badge>
            )}
          </div>

          {/* Expected columns */}
          <div className="mb-2">
            <p className="text-xs text-slate-500 mb-1">Expected columns:</p>
            <div className="flex flex-wrap gap-1">
              {columnNames.slice(0, 8).map((col) => (
                <span
                  key={col}
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded border',
                    color.border,
                    'bg-white',
                    color.text
                  )}
                >
                  {col}
                </span>
              ))}
              {columnNames.length > 8 && (
                <span className="text-xs text-slate-400">
                  +{columnNames.length - 8} more
                </span>
              )}
            </div>
          </div>

          {/* Uploaded local file info */}
          {uploaded && (
            <div className="text-sm space-y-2">
              <span className="text-slate-600">
                Uploaded: <strong>{uploaded.file.name}</strong>
              </span>

              {/* Sheet and Header Row selectors */}
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {/* Sheet selector */}
                {uploaded.availableSheets && uploaded.availableSheets.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Sheet:</label>
                    <div className="relative">
                      <select
                        value={uploaded.selectedSheet || ''}
                        onChange={(e) => onSheetChange(expectedFile, uploaded, e.target.value)}
                        disabled={uploaded.isRevalidating}
                        className={cn(
                          'appearance-none text-xs px-2 py-1 pr-7 rounded border bg-white',
                          'focus:outline-none focus:ring-2 focus:ring-primary-500',
                          uploaded.isRevalidating && 'opacity-50 cursor-not-allowed',
                          uploaded.validated ? 'border-green-300' : 'border-slate-300'
                        )}
                      >
                        {uploaded.availableSheets.map((sheet) => (
                          <option key={sheet} value={sheet}>
                            {sheet}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Header row selector */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Header row:</label>
                  <div className="relative">
                    <select
                      value={uploaded.headerRow}
                      onChange={(e) => onHeaderRowChange(expectedFile, uploaded, parseInt(e.target.value))}
                      disabled={uploaded.isRevalidating}
                      className={cn(
                        'appearance-none text-xs px-2 py-1 pr-7 rounded border bg-white',
                        'focus:outline-none focus:ring-2 focus:ring-primary-500',
                        uploaded.isRevalidating && 'opacity-50 cursor-not-allowed',
                        uploaded.validated ? 'border-green-300' : 'border-slate-300'
                      )}
                    >
                      {HEADER_ROW_OPTIONS.map((row) => (
                        <option key={row} value={row}>
                          Row {row}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Loading indicator */}
                {uploaded.isRevalidating && (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                )}
              </div>

              {uploaded.error && (
                <p className="text-red-600 text-xs mt-1">{uploaded.error}</p>
              )}
            </div>
          )}

          {/* Drive file info */}
          {driveFile && (
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-600" />
                <span className="text-slate-600">
                  Drive: <strong>{driveFile.name}</strong>
                </span>
              </div>

              {/* Tab and Header Row selectors */}
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {/* Tab selector for Google Sheets */}
                {driveFile.availableTabs && driveFile.availableTabs.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Tab:</label>
                    <div className="relative">
                      <select
                        value={driveFile.selectedTab || ''}
                        onChange={(e) => onDriveTabChange(expectedFile, driveFile, e.target.value)}
                        disabled={driveFile.isLoading}
                        className={cn(
                          'appearance-none text-xs px-2 py-1 pr-7 rounded border bg-white',
                          'focus:outline-none focus:ring-2 focus:ring-primary-500',
                          driveFile.isLoading && 'opacity-50 cursor-not-allowed',
                          driveFile.validated ? 'border-green-300' : 'border-slate-300'
                        )}
                      >
                        {driveFile.availableTabs.map((tab) => (
                          <option key={tab.title} value={tab.title}>
                            {tab.title}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Header row selector */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Header row:</label>
                  <div className="relative">
                    <select
                      value={driveFile.headerRow ?? 1}
                      onChange={(e) => onDriveHeaderRowChange(expectedFile, driveFile, parseInt(e.target.value))}
                      disabled={driveFile.isLoading}
                      className={cn(
                        'appearance-none text-xs px-2 py-1 pr-7 rounded border bg-white',
                        'focus:outline-none focus:ring-2 focus:ring-primary-500',
                        driveFile.isLoading && 'opacity-50 cursor-not-allowed',
                        driveFile.validated ? 'border-green-300' : 'border-slate-300'
                      )}
                    >
                      {HEADER_ROW_OPTIONS.map((row) => (
                        <option key={row} value={row}>
                          Row {row}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Loading indicator */}
                {driveFile.isLoading && (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                )}
              </div>

              {/* Preview data */}
              {driveFile.sampleData && driveFile.sampleData.length > 0 && (
                <div className="mt-3 p-2 bg-white rounded border border-slate-200">
                  <p className="text-xs font-medium text-slate-700 mb-2">
                    Preview: {driveFile.rowCount} rows, {driveFile.columns?.length} columns
                  </p>
                  <div className="overflow-x-auto max-h-40">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200">
                          {driveFile.columns?.slice(0, 5).map((col) => (
                            <th key={col.name} className="px-2 py-1 text-left font-medium text-slate-600">
                              {col.name}
                            </th>
                          ))}
                          {(driveFile.columns?.length || 0) > 5 && (
                            <th className="px-2 py-1 text-left text-slate-400">...</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {driveFile.sampleData.slice(0, 3).map((row, rowIdx) => (
                          <tr key={rowIdx} className="border-b border-slate-100">
                            {driveFile.columns?.slice(0, 5).map((col) => (
                              <td key={col.name} className="px-2 py-1 text-slate-600 truncate max-w-[100px]">
                                {row[col.name] != null ? String(row[col.name]) : '—'}
                              </td>
                            ))}
                            {(driveFile.columns?.length || 0) > 5 && (
                              <td className="px-2 py-1 text-slate-400">...</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {driveFile.error && (
                <p className="text-red-600 text-xs mt-1">{driveFile.error}</p>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <label
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg cursor-pointer transition-colors',
              uploaded?.validated
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            )}
          >
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onFileUpload(expectedFile, file)
                e.target.value = ''
              }}
              className="hidden"
            />
            <Upload className="w-4 h-4" />
            {uploaded ? 'Replace' : 'Upload'}
          </label>

          {driveConnected && (
            <Button
              variant="secondary"
              size="sm"
              onClick={openDrivePicker}
              disabled={isPickerLoading}
              className="inline-flex items-center gap-2"
            >
              <Cloud className="w-4 h-4" />
              {driveFile ? 'Change' : 'Pick from Drive'}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function RunWorkflowPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { driveConnected } = useAuth()

  // Fetch workflow
  const { data: workflow, isLoading, error } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowApi.get(id!),
    enabled: !!id,
  })

  // Track uploaded files for each expected file slot
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFileState>>({})
  // Track Drive files for each expected file slot
  const [driveFiles, setDriveFiles] = useState<Record<string, DriveRunFileState>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    runId?: string
    rowCount?: number
    columns?: string[]
    previewData?: Record<string, unknown>[]
    warnings?: string[]
  } | null>(null)
  // Track Drive export state
  const [isExporting, setIsExporting] = useState(false)
  const [exportResult, setExportResult] = useState<{ url: string; id: string } | null>(null)

  // Validate file columns against expected columns
  const validateFileColumns = useCallback((
    uploadedColumns: ColumnInfo[] | string[],
    expectedColumns: ColumnInfo[] | string[]
  ): boolean => {
    const uploadedColNames = Array.isArray(uploadedColumns) && typeof uploadedColumns[0] === 'object'
      ? (uploadedColumns as ColumnInfo[]).map(c => c.name)
      : uploadedColumns as string[]
    const expectedColNames = Array.isArray(expectedColumns) && typeof expectedColumns[0] === 'object'
      ? (expectedColumns as ColumnInfo[]).map(c => c.name)
      : expectedColumns as string[]

    const missingColumns = expectedColNames.filter(col => !uploadedColNames.includes(col))
    return missingColumns.length === 0
  }, [])

  // Generate error message for missing columns
  const getMissingColumnsError = useCallback((
    uploadedColumns: ColumnInfo[] | string[],
    expectedColumns: ColumnInfo[] | string[]
  ): string => {
    const uploadedColNames = Array.isArray(uploadedColumns) && typeof uploadedColumns[0] === 'object'
      ? (uploadedColumns as ColumnInfo[]).map(c => c.name)
      : uploadedColumns as string[]
    const expectedColNames = Array.isArray(expectedColumns) && typeof expectedColumns[0] === 'object'
      ? (expectedColumns as ColumnInfo[]).map(c => c.name)
      : expectedColumns as string[]

    const missingColumns = expectedColNames.filter(col => !uploadedColNames.includes(col))
    return `Missing columns: ${missingColumns.slice(0, 3).join(', ')}${missingColumns.length > 3 ? ` (+${missingColumns.length - 3} more)` : ''}`
  }, [])

  // Handle Drive file selection
  const handleDriveFileSelect = useCallback(async (expectedFile: FileDefinition, pickedFile: DrivePickerFile) => {
    // 1. Set loading state
    setDriveFiles(prev => ({
      ...prev,
      [expectedFile.id]: {
        driveFileId: pickedFile.id,
        driveMimeType: pickedFile.mimeType,
        name: pickedFile.name,
        validated: false,
        isLoading: true,
      }
    }))

    // 2. Clear any existing local upload for this slot
    setUploadedFiles(prev => {
      const next = { ...prev }
      delete next[expectedFile.id]
      return next
    })

    try {
      // 3. Download file metadata + sample data
      const downloadResult = await driveApi.downloadFile(pickedFile.id)

      // 4. If Google Sheet, also fetch available tabs
      let availableTabs: DriveRunFileState['availableTabs'] = undefined
      if (pickedFile.mimeType === 'application/vnd.google-apps.spreadsheet') {
        const tabsResult = await driveApi.getSheetTabs(pickedFile.id)
        availableTabs = tabsResult.tabs
      }

      // 5. Convert columns from string[] to ColumnInfo[]
      const columns: ColumnInfo[] = downloadResult.columns.map(col => ({
        name: col,
        type: 'text' as const,
        sampleValues: [],
      }))

      // 6. Validate columns against expected columns (reuse validateFileColumns)
      const validated = validateFileColumns(columns, expectedFile.columns || [])

      // 7. Store complete state (including originalFile for re-fetching)
      setDriveFiles(prev => ({
        ...prev,
        [expectedFile.id]: {
          driveFileId: pickedFile.id,
          driveMimeType: pickedFile.mimeType,
          driveModifiedTime: pickedFile.lastEditedUtc ? new Date(pickedFile.lastEditedUtc).toISOString() : downloadResult.file_metadata.modified_time,
          name: pickedFile.name,
          validated,
          columns,
          sampleData: downloadResult.sample_data,
          rowCount: downloadResult.row_count,
          availableTabs,
          selectedTab: availableTabs?.[0]?.title,
          headerRow: 1, // Default to row 1 as header
          originalFile: pickedFile, // Store for re-fetching with different settings
          isLoading: false,
          error: validated ? undefined : getMissingColumnsError(columns, expectedFile.columns || []),
        }
      }))
    } catch (err) {
      setDriveFiles(prev => ({
        ...prev,
        [expectedFile.id]: {
          driveFileId: pickedFile.id,
          driveMimeType: pickedFile.mimeType,
          name: pickedFile.name,
          validated: false,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load Drive file',
        }
      }))
    }
  }, [validateFileColumns, getMissingColumnsError])

  const handleFileUpload = useCallback(async (expectedFile: FileDefinition, file: File) => {
    // Clear any existing Drive file for this slot
    setDriveFiles(prev => {
      const next = { ...prev }
      delete next[expectedFile.id]
      return next
    })

    // First, parse the file to get available sheets
    try {
      // Use the expected sheet and header row from workflow if available
      const expectedSheet = expectedFile.sheetName
      const expectedHeaderRow = expectedFile.headerRow ?? 1
      const parseResult = await fileApi.parseColumns(file, expectedSheet, expectedHeaderRow)

      const hasMultipleSheets = (parseResult.availableSheets?.length ?? 0) > 1
      const expectedColumns = expectedFile.columns || []
      const uploadedColumns = parseResult.columns

      // Validate columns
      const validated = validateFileColumns(uploadedColumns, expectedColumns)

      // If validation fails and there are multiple sheets, don't show error immediately
      // Let user select the correct sheet first
      const error = validated ? undefined : getMissingColumnsError(uploadedColumns, expectedColumns)
      const errorMsg = error && hasMultipleSheets ? error + ' - Try selecting a different sheet below' : error

      setUploadedFiles(prev => ({
        ...prev,
        [expectedFile.id]: {
          file,
          validated,
          availableSheets: parseResult.availableSheets,
          selectedSheet: parseResult.sheetName,
          headerRow: expectedHeaderRow,
          columns: parseResult.columns,
          error: errorMsg,
        }
      }))
    } catch (err) {
      setUploadedFiles(prev => ({
        ...prev,
        [expectedFile.id]: {
          file,
          validated: false,
          headerRow: 1,
          error: err instanceof Error ? err.message : 'Failed to parse file'
        }
      }))
    }
  }, [validateFileColumns])

  // Handle sheet change for an uploaded file
  const handleSheetChange = useCallback(async (
    expectedFile: FileDefinition,
    uploaded: UploadedFileState,
    newSheet: string
  ) => {
    setUploadedFiles(prev => ({
      ...prev,
      [expectedFile.id]: { ...uploaded, isRevalidating: true }
    }))

    try {
      const parseResult = await fileApi.parseColumns(uploaded.file, newSheet, uploaded.headerRow)
      const expectedColumns = expectedFile.columns || []
      const uploadedColumns = parseResult.columns
      const validated = validateFileColumns(uploadedColumns, expectedColumns)

      setUploadedFiles(prev => ({
        ...prev,
        [expectedFile.id]: {
          ...uploaded,
          validated,
          selectedSheet: newSheet,
          columns: parseResult.columns,
          error: validated ? undefined : getMissingColumnsError(uploadedColumns, expectedColumns),
          isRevalidating: false
        }
      }))
    } catch (err) {
      setUploadedFiles(prev => ({
        ...prev,
        [expectedFile.id]: {
          ...uploaded,
          validated: false,
          selectedSheet: newSheet,
          error: err instanceof Error ? err.message : 'Failed to parse sheet',
          isRevalidating: false
        }
      }))
    }
  }, [validateFileColumns, getMissingColumnsError])

  // Handle header row change for an uploaded file
  const handleHeaderRowChange = useCallback(async (
    expectedFile: FileDefinition,
    uploaded: UploadedFileState,
    newHeaderRow: number
  ) => {
    setUploadedFiles(prev => ({
      ...prev,
      [expectedFile.id]: { ...uploaded, isRevalidating: true }
    }))

    try {
      const parseResult = await fileApi.parseColumns(uploaded.file, uploaded.selectedSheet, newHeaderRow)
      const expectedColumns = expectedFile.columns || []
      const uploadedColumns = parseResult.columns
      const validated = validateFileColumns(uploadedColumns, expectedColumns)

      setUploadedFiles(prev => ({
        ...prev,
        [expectedFile.id]: {
          ...uploaded,
          validated,
          headerRow: newHeaderRow,
          columns: parseResult.columns,
          error: validated ? undefined : getMissingColumnsError(uploadedColumns, expectedColumns),
          isRevalidating: false
        }
      }))
    } catch (err) {
      setUploadedFiles(prev => ({
        ...prev,
        [expectedFile.id]: {
          ...uploaded,
          validated: false,
          headerRow: newHeaderRow,
          error: err instanceof Error ? err.message : 'Failed to parse with new header row',
          isRevalidating: false
        }
      }))
    }
  }, [validateFileColumns, getMissingColumnsError])

  // Handle Drive tab change for Google Sheets
  const handleDriveTabChange = useCallback(async (
    expectedFile: FileDefinition,
    driveFile: DriveRunFileState,
    newTab: string
  ) => {
    setDriveFiles(prev => ({
      ...prev,
      [expectedFile.id]: { ...driveFile, isLoading: true }
    }))

    try {
      // Read the specific tab from the sheet
      const readResult = await driveApi.readSheet(driveFile.driveFileId, newTab)

      // Convert columns from string[] to ColumnInfo[]
      const columns: ColumnInfo[] = readResult.columns.map(col => ({
        name: col,
        type: 'text' as const,
        sampleValues: [],
      }))

      // Validate columns
      const validated = validateFileColumns(columns, expectedFile.columns || [])

      setDriveFiles(prev => ({
        ...prev,
        [expectedFile.id]: {
          ...driveFile,
          selectedTab: newTab,
          columns,
          sampleData: readResult.sample_data,
          rowCount: readResult.row_count,
          validated,
          error: validated ? undefined : getMissingColumnsError(columns, expectedFile.columns || []),
          isLoading: false,
        }
      }))
    } catch (err) {
      setDriveFiles(prev => ({
        ...prev,
        [expectedFile.id]: {
          ...driveFile,
          selectedTab: newTab,
          validated: false,
          error: err instanceof Error ? err.message : 'Failed to read sheet tab',
          isLoading: false,
        }
      }))
    }
  }, [validateFileColumns, getMissingColumnsError])

  // Handle Drive header row change
  const handleDriveHeaderRowChange = useCallback(async (
    expectedFile: FileDefinition,
    driveFile: DriveRunFileState,
    newHeaderRow: number
  ) => {
    // Check if we have original file reference
    if (!driveFile.originalFile) {
      alert('Cannot modify Drive file settings. Please re-select the file.')
      return
    }

    setDriveFiles(prev => ({
      ...prev,
      [expectedFile.id]: { ...driveFile, isLoading: true }
    }))

    try {
      // For Google Sheets with tabs, use readSheet with the current tab
      // For other files or default tab, use downloadFile
      let readResult: Awaited<ReturnType<typeof driveApi.readSheet>> | Awaited<ReturnType<typeof driveApi.downloadFile>>

      if (driveFile.driveMimeType === 'application/vnd.google-apps.spreadsheet' && driveFile.selectedTab) {
        // Use readSheet for Google Sheets with specific tab and header row
        readResult = await driveApi.readSheet(driveFile.driveFileId, driveFile.selectedTab, newHeaderRow)
      } else {
        // Use downloadFile for other file types with header row
        readResult = await driveApi.downloadFile(driveFile.driveFileId, newHeaderRow)
      }

      // Convert columns from string[] to ColumnInfo[]
      const columns: ColumnInfo[] = readResult.columns.map(col => ({
        name: col,
        type: 'text' as const,
        sampleValues: [],
      }))

      // Validate columns
      const validated = validateFileColumns(columns, expectedFile.columns || [])

      setDriveFiles(prev => ({
        ...prev,
        [expectedFile.id]: {
          ...driveFile,
          headerRow: newHeaderRow,
          columns,
          sampleData: readResult.sample_data,
          rowCount: readResult.row_count,
          validated,
          error: validated ? undefined : getMissingColumnsError(columns, expectedFile.columns || []),
          isLoading: false,
        }
      }))
    } catch (err) {
      setDriveFiles(prev => ({
        ...prev,
        [expectedFile.id]: {
          ...driveFile,
          headerRow: newHeaderRow,
          validated: false,
          error: err instanceof Error ? err.message : 'Failed to update header row',
          isLoading: false,
        }
      }))
    }
  }, [validateFileColumns, getMissingColumnsError])

  const allFilesUploaded = workflow?.files?.every(f => uploadedFiles[f.id]?.validated || driveFiles[f.id]?.validated) ?? false

  const handleRun = useCallback(async () => {
    if (!workflow || !allFilesUploaded || !id) return

    setIsProcessing(true)
    setResult(null)
    setExportResult(null) // Reset export result on new run

    try {
      // Prepare files array and configs with mixed sources
      const expectedFiles = workflow.files || []
      const filesToSend: File[] = []
      const fileConfigs: Record<string, {
        source?: 'local' | 'drive'
        sheetName?: string
        headerRow: number
        driveFileId?: string
        driveMimeType?: string
      }> = {}

      for (const expectedFile of expectedFiles) {
        const uploaded = uploadedFiles[expectedFile.id]
        const driveFile = driveFiles[expectedFile.id]

        if (uploaded) {
          // Local file
          filesToSend.push(uploaded.file)
          fileConfigs[expectedFile.id] = {
            source: 'local',
            sheetName: uploaded.selectedSheet,
            headerRow: uploaded.headerRow,
          }
        } else if (driveFile) {
          // Drive file (no file to upload, just metadata)
          fileConfigs[expectedFile.id] = {
            source: 'drive',
            sheetName: driveFile.selectedTab,
            headerRow: driveFile.headerRow ?? 1, // Use selected header row, default to 1
            driveFileId: driveFile.driveFileId,
            driveMimeType: driveFile.driveMimeType,
          }
        } else {
          throw new Error(`Missing file for ${expectedFile.name}`)
        }
      }

      // Call the workflow API
      const runResult = await workflowApi.run(id, filesToSend, fileConfigs)

      setResult({
        success: true,
        message: `Workflow completed successfully! ${runResult.rowCount} rows generated.`,
        runId: runResult.runId,
        rowCount: runResult.rowCount,
        columns: runResult.columns,
        previewData: runResult.previewData,
        warnings: runResult.warnings,
      })
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to run workflow'
      })
    } finally {
      setIsProcessing(false)
    }
  }, [workflow, allFilesUploaded, uploadedFiles, driveFiles, id])

  const handleExportToDrive = useCallback(async () => {
    if (!workflow || !result?.runId) return

    setIsExporting(true)
    try {
      const exportResponse = await driveApi.exportCreate(result.runId, workflow.name + ' - Results')
      setExportResult({
        url: exportResponse.spreadsheet_url,
        id: exportResponse.spreadsheet_id,
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export to Drive')
    } finally {
      setIsExporting(false)
    }
  }, [workflow, result])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !workflow) {
    return (
      <Card className="bg-red-50 border-red-200">
        <p className="text-red-700">
          Failed to load workflow: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </Card>
    )
  }

  const expectedFiles = workflow.files || []

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/workflows')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Run: {workflow.name}
            </h1>
            {workflow.description && (
              <p className="text-slate-500 mt-1">{workflow.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Upload Files Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Input Files
          </CardTitle>
        </CardHeader>
        <p className="text-sm text-slate-500 mb-4">
          Upload the files that match the expected structure. The workflow will process them based on your configuration.
        </p>

        <div className="grid gap-4">
          {expectedFiles.map((expectedFile, index) => {
            const color = getFileColor(expectedFile.colorIndex)
            const uploaded = uploadedFiles[expectedFile.id]
            const driveFile = driveFiles[expectedFile.id]
            const columnNames = expectedFile.columns?.map(c => c.name) || []

            // Check if Drive file hasn't changed since last workflow run
            const showVersionWarning = !!(driveFile && expectedFile.driveModifiedTime &&
              driveFile.driveModifiedTime === expectedFile.driveModifiedTime)

            return (
              <FileSlotCard
                key={expectedFile.id}
                expectedFile={expectedFile}
                uploaded={uploaded}
                driveFile={driveFile}
                color={color}
                columnNames={columnNames}
                showVersionWarning={showVersionWarning}
                driveConnected={driveConnected}
                index={index}
                onFileUpload={handleFileUpload}
                onSheetChange={handleSheetChange}
                onHeaderRowChange={handleHeaderRowChange}
                onDriveFileSelect={handleDriveFileSelect}
                onDriveTabChange={handleDriveTabChange}
                onDriveHeaderRowChange={handleDriveHeaderRowChange}
              />
            )
          })}
        </div>
      </Card>

      {/* Run Button */}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate('/workflows')}>
          Cancel
        </Button>
        <Button
          onClick={handleRun}
          disabled={!allFilesUploaded || isProcessing}
        >
          {isProcessing ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Processing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Workflow
            </>
          )}
        </Button>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Status card */}
            <Card
              className={cn(
                result.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {result.success ? (
                    <Check className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  )}
                  <p className={result.success ? 'text-green-700' : 'text-red-700'}>
                    {result.message}
                  </p>
                </div>
                {result.success && result.runId && id && (
                  <div className="flex items-center gap-2">
                    <a
                      href={workflowApi.downloadUrl(id, result.runId)}
                      download
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download Result
                    </a>
                    {driveConnected && !exportResult && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleExportToDrive}
                        disabled={isExporting}
                      >
                        {isExporting ? (
                          <>
                            <Spinner size="sm" className="mr-2" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <Cloud className="w-4 h-4" />
                            Export to Drive
                          </>
                        )}
                      </Button>
                    )}
                    {exportResult && (
                      <a
                        href={exportResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View in Google Sheets
                      </a>
                    )}
                  </div>
                )}
              </div>
              
              {/* Warnings */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <p className="text-xs font-medium text-amber-700 mb-1">Warnings:</p>
                  <ul className="text-xs text-amber-600 list-disc list-inside">
                    {result.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
            
            {/* Preview table */}
            {result.success && result.previewData && result.columns && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5" />
                    Preview ({result.previewData.length} of {result.rowCount} rows)
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        {result.columns.map((col) => (
                          <th
                            key={col}
                            className="px-3 py-2 text-left font-medium text-slate-700 whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.previewData.map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className={cn(
                            'border-b border-slate-100',
                            rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                          )}
                        >
                          {result.columns!.map((col) => (
                            <td
                              key={col}
                              className="px-3 py-2 text-slate-600 whitespace-nowrap max-w-[200px] truncate"
                              title={String(row[col] ?? '')}
                            >
                              {row[col] != null ? String(row[col]) : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.rowCount && result.rowCount > 20 && (
                  <p className="text-xs text-slate-400 mt-3 text-center">
                    Showing first 20 rows of {result.rowCount} total. Download the file for complete data.
                  </p>
                )}
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
