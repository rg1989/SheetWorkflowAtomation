import { useCallback, useState } from 'react'
import { Cloud, Loader2 } from 'lucide-react'
import { useDriveFilePicker } from '../../hooks/useDriveFilePicker'
import { driveApi } from '../../lib/api'
import type { DrivePickerFile, ColumnInfo } from '../../types'

interface DriveFilePickerProps {
  onFileReady: (params: {
    name: string
    filename: string
    columns: ColumnInfo[]
    sampleData?: Record<string, unknown>[]
    driveFileId: string
    driveMimeType: string
    driveModifiedTime?: string
    availableSheets?: string[]
    sheetName?: string
  }) => void
  onError?: (error: string) => void
  disabled?: boolean
}

export function DriveFilePicker({ onFileReady, onError, disabled }: DriveFilePickerProps) {
  const [isParsing, setIsParsing] = useState(false)

  const handleFileSelected = useCallback(async (pickerFile: DrivePickerFile) => {
    setIsParsing(true)
    try {
      // Call backend to download and parse the Drive file
      const result = await driveApi.downloadFile(pickerFile.id)

      // Convert backend column strings to ColumnInfo objects
      // Backend returns plain column name strings + sample_data rows
      const columns: ColumnInfo[] = result.columns.map((colName) => {
        // Infer type from sample data
        const sampleValues = result.sample_data
          .slice(0, 3)
          .map((row) => row[colName] as string | number | null)

        return {
          name: colName,
          type: 'text' as const, // Default to text; backend doesn't return types
          sampleValues,
        }
      })

      // Fetch sheet tabs if this is a Google Sheets file or Excel file
      const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const SHEETS_MIME = 'application/vnd.google-apps.spreadsheet'

      let availableSheets: string[] | undefined
      let sheetName: string | undefined
      if (pickerFile.mimeType === SHEETS_MIME || pickerFile.mimeType === EXCEL_MIME) {
        try {
          const tabsResult = await driveApi.getSheetTabs(pickerFile.id, pickerFile.mimeType)
          availableSheets = tabsResult.tabs.map(t => t.title)
          sheetName = availableSheets[0] // Default to first tab
        } catch (err) {
          // If fetching tabs fails, continue without them (user can still use the file)
          console.warn('Failed to fetch sheet tabs:', err)
        }
      }

      onFileReady({
        name: result.file_metadata.name.replace(/\.[^/.]+$/, ''),
        filename: result.file_metadata.name,
        columns,
        sampleData: result.sample_data,
        driveFileId: pickerFile.id,
        driveMimeType: pickerFile.mimeType,
        driveModifiedTime: pickerFile.lastEditedUtc
          ? new Date(pickerFile.lastEditedUtc).toISOString()
          : result.file_metadata.modified_time,
        availableSheets,
        sheetName,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Drive file'
      onError?.(message)
    } finally {
      setIsParsing(false)
    }
  }, [onFileReady, onError])

  const { openPicker, isLoading: isPickerLoading } = useDriveFilePicker({
    onSelect: handleFileSelected,
    onError,
  })

  const isLoading = isPickerLoading || isParsing

  return (
    <button
      onClick={openPicker}
      disabled={disabled || isLoading}
      className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed w-full h-full justify-center"
    >
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
        {isLoading ? (
          <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
        ) : (
          <Cloud className="w-6 h-6 text-primary-600" />
        )}
      </div>
      <div>
        <div className="font-medium text-slate-900">
          {isParsing ? 'Loading file...' : isPickerLoading ? 'Opening Drive...' : 'Select from Google Drive'}
        </div>
        <div className="text-sm text-slate-500">
          Browse Google Sheets from Drive
        </div>
      </div>
    </button>
  )
}
