import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Upload, Play, Download, FileSpreadsheet, Check, AlertCircle, ChevronDown, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { workflowApi, fileApi } from '../lib/api'
import { cn } from '../lib/utils'
import { getFileColor } from '../lib/colors'
import type { FileDefinition, ColumnInfo, RunResult } from '../types'

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

export function RunWorkflowPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Fetch workflow
  const { data: workflow, isLoading, error } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowApi.get(id!),
    enabled: !!id,
  })

  // Track uploaded files for each expected file slot
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFileState>>({})
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

  // Validate file columns against expected columns
  const validateFileColumns = useCallback((
    uploadedColumns: string[],
    expectedColumns: string[]
  ): { valid: boolean; error?: string } => {
    const missingColumns = expectedColumns.filter(col => !uploadedColumns.includes(col))
    
    if (missingColumns.length > 0) {
      return {
        valid: false,
        error: `Missing columns: ${missingColumns.slice(0, 3).join(', ')}${missingColumns.length > 3 ? ` (+${missingColumns.length - 3} more)` : ''}`
      }
    }
    return { valid: true }
  }, [])

  const handleFileUpload = useCallback(async (expectedFile: FileDefinition, file: File) => {
    // First, parse the file to get available sheets
    try {
      // Use the expected header row from workflow if available, default to 1
      const expectedHeaderRow = expectedFile.headerRow ?? 1
      const parseResult = await fileApi.parseColumns(file, undefined, expectedHeaderRow)
      
      const hasMultipleSheets = (parseResult.availableSheets?.length ?? 0) > 1
      const expectedColumns = expectedFile.columns?.map(c => c.name) || []
      const uploadedColumns = parseResult.columns.map(c => c.name)
      
      // Validate columns
      const validation = validateFileColumns(uploadedColumns, expectedColumns)
      
      // If validation fails and there are multiple sheets, don't show error immediately
      // Let user select the correct sheet first
      if (!validation.valid && hasMultipleSheets) {
        setUploadedFiles(prev => ({
          ...prev,
          [expectedFile.id]: {
            file,
            validated: false,
            availableSheets: parseResult.availableSheets,
            selectedSheet: parseResult.sheetName,
            headerRow: expectedHeaderRow,
            columns: parseResult.columns,
            error: validation.error + ' - Try selecting a different sheet below'
          }
        }))
      } else if (!validation.valid) {
        setUploadedFiles(prev => ({
          ...prev,
          [expectedFile.id]: {
            file,
            validated: false,
            availableSheets: parseResult.availableSheets,
            selectedSheet: parseResult.sheetName,
            headerRow: expectedHeaderRow,
            columns: parseResult.columns,
            error: validation.error
          }
        }))
      } else {
        setUploadedFiles(prev => ({
          ...prev,
          [expectedFile.id]: {
            file,
            validated: true,
            availableSheets: parseResult.availableSheets,
            selectedSheet: parseResult.sheetName,
            headerRow: expectedHeaderRow,
            columns: parseResult.columns
          }
        }))
      }
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
      const expectedColumns = expectedFile.columns?.map(c => c.name) || []
      const uploadedColumns = parseResult.columns.map(c => c.name)
      const validation = validateFileColumns(uploadedColumns, expectedColumns)

      setUploadedFiles(prev => ({
        ...prev,
        [expectedFile.id]: {
          ...uploaded,
          validated: validation.valid,
          selectedSheet: newSheet,
          columns: parseResult.columns,
          error: validation.error,
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
  }, [validateFileColumns])

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
      const expectedColumns = expectedFile.columns?.map(c => c.name) || []
      const uploadedColumns = parseResult.columns.map(c => c.name)
      const validation = validateFileColumns(uploadedColumns, expectedColumns)

      setUploadedFiles(prev => ({
        ...prev,
        [expectedFile.id]: {
          ...uploaded,
          validated: validation.valid,
          headerRow: newHeaderRow,
          columns: parseResult.columns,
          error: validation.error,
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
  }, [validateFileColumns])

  const allFilesUploaded = workflow?.files?.every(f => uploadedFiles[f.id]?.validated) ?? false

  const handleRun = useCallback(async () => {
    if (!workflow || !allFilesUploaded || !id) return

    setIsProcessing(true)
    setResult(null)

    try {
      // Prepare files array in the order of expected files
      const expectedFiles = workflow.files || []
      const filesToSend: File[] = []
      const fileConfigs: Record<string, { sheetName?: string; headerRow: number }> = {}
      
      for (const expectedFile of expectedFiles) {
        const uploaded = uploadedFiles[expectedFile.id]
        if (!uploaded) {
          throw new Error(`Missing file for ${expectedFile.name}`)
        }
        filesToSend.push(uploaded.file)
        fileConfigs[expectedFile.id] = {
          sheetName: uploaded.selectedSheet,
          headerRow: uploaded.headerRow,
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
  }, [workflow, allFilesUploaded, uploadedFiles, id])

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
            const columnNames = expectedFile.columns?.map(c => c.name) || []

            return (
              <motion.div
                key={expectedFile.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'border-2 rounded-lg p-4 transition-all',
                  uploaded?.validated
                    ? 'border-green-300 bg-green-50'
                    : uploaded?.error
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
                      {uploaded?.validated && (
                        <Badge variant="success" className="flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Ready
                        </Badge>
                      )}
                      {uploaded?.error && (
                        <Badge variant="error" className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Invalid
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

                    {/* Uploaded file info */}
                    {uploaded && (
                      <div className="text-sm space-y-2">
                        <span className="text-slate-600">
                          Uploaded: <strong>{uploaded.file.name}</strong>
                        </span>
                        
                        {/* Sheet and Header Row selectors */}
                        {uploaded.file && (
                          <div className="flex flex-wrap items-center gap-3 mt-2">
                            {/* Sheet selector */}
                            {uploaded.availableSheets && uploaded.availableSheets.length > 1 && (
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-slate-500">Sheet:</label>
                                <div className="relative">
                                  <select
                                    value={uploaded.selectedSheet || ''}
                                    onChange={(e) => handleSheetChange(expectedFile, uploaded, e.target.value)}
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
                                  onChange={(e) => handleHeaderRowChange(expectedFile, uploaded, parseInt(e.target.value))}
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
                        )}
                        
                        {uploaded.error && (
                          <p className="text-red-600 text-xs mt-1">{uploaded.error}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Upload button */}
                  <div className="flex-shrink-0">
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
                          if (file) handleFileUpload(expectedFile, file)
                          e.target.value = ''
                        }}
                        className="hidden"
                      />
                      <Upload className="w-4 h-4" />
                      {uploaded ? 'Replace' : 'Upload'}
                    </label>
                  </div>
                </div>
              </motion.div>
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
                  <a
                    href={workflowApi.downloadUrl(id, result.runId)}
                    download
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Result
                  </a>
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
