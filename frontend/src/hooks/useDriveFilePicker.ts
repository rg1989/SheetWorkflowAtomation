import { useCallback, useState } from 'react'
import useDrivePicker from 'react-google-drive-picker'
import { driveApi } from '../lib/api'
import type { DrivePickerFile } from '../types'

interface UseDriveFilePickerOptions {
  onSelect: (file: DrivePickerFile) => void
  onError?: (error: string) => void
}

export function useDriveFilePicker({ onSelect, onError }: UseDriveFilePickerOptions) {
  const [openPicker] = useDrivePicker()
  const [isLoading, setIsLoading] = useState(false)

  const handleOpenPicker = useCallback(async () => {
    setIsLoading(true)
    try {
      // Fetch fresh token from backend (handles refresh automatically)
      const tokenData = await driveApi.getToken()

      openPicker({
        clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        developerKey: import.meta.env.VITE_GOOGLE_API_KEY,
        token: tokenData.access_token,
        viewId: 'DOCS',
        supportDrives: true,     // Enable Shared Drives (SELECT-03)
        multiselect: false,
        showUploadView: false,
        showUploadFolders: false,
        callbackFunction: (data) => {
          if (data.action === 'picked' && data.docs?.length > 0) {
            const doc = data.docs[0]
            onSelect({
              id: doc.id,
              name: doc.name,
              mimeType: doc.mimeType,
              lastEditedUtc: doc.lastEditedUtc,
              sizeBytes: doc.sizeBytes,
            })
          }
          // data.action === 'cancel' -> user closed picker, no-op
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open Drive picker'
      onError?.(message)
    } finally {
      setIsLoading(false)
    }
  }, [openPicker, onSelect, onError])

  return {
    openPicker: handleOpenPicker,
    isLoading,
  }
}
