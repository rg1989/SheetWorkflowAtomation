import type {
  Workflow,
  WorkflowCreate,
  WorkflowUpdate,
  Run,
  FileParseResult,
  RunResult,
  DriveFileResponse,
  ExportResponse,
  FullResultData,
} from '../types'

const API_BASE = '/api'

const defaultFetchOptions: RequestInit = {
  credentials: 'include',
}

export interface AuthUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  driveConnected: boolean  // NEW: whether user has Drive scopes
}

export interface DriveStatus {
  connected: boolean
  scopes: string[]
  hasLegacyScope: boolean
  needsReconnect: boolean
}

// Auth API
export const authApi = {
  me: (): Promise<AuthUser> =>
    fetch(`${API_BASE}/auth/me`, { ...defaultFetchOptions }).then((r) =>
      r.ok ? r.json() : Promise.reject(new Error('Not authenticated'))
    ),

  logout: (): Promise<void> =>
    fetch(`${API_BASE}/auth/logout`, {
      ...defaultFetchOptions,
      method: 'POST',
    }).then(() => undefined),

  loginUrl: (): string => `${API_BASE}/auth/login`,

  driveStatus: (): Promise<DriveStatus> =>
    fetch(`${API_BASE}/auth/drive-status`, { ...defaultFetchOptions }).then((r) =>
      r.ok ? r.json() : Promise.reject(new Error('Failed to get Drive status'))
    ),

  disconnectDrive: (): Promise<{ success: boolean; message: string }> =>
    fetch(`${API_BASE}/auth/disconnect-drive`, {
      ...defaultFetchOptions,
      method: 'POST',
    }).then((r) => r.json()),
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...defaultFetchOptions,
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}

// Workflow API
export const workflowApi = {
  list: () => fetchJSON<Workflow[]>('/workflows'),
  
  get: (id: string) => fetchJSON<Workflow>(`/workflows/${id}`),
  
  create: (workflow: WorkflowCreate) =>
    fetchJSON<Workflow>('/workflows', {
      method: 'POST',
      body: JSON.stringify(workflow),
    }),
  
  update: (id: string, workflow: WorkflowUpdate) =>
    fetchJSON<Workflow>(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workflow),
    }),
  
  delete: (id: string) =>
    fetchJSON<{ message: string }>(`/workflows/${id}`, {
      method: 'DELETE',
    }),
  
  /**
   * Run a workflow with uploaded files and/or Drive files.
   * @param id - Workflow ID
   * @param files - Array of local files to process (can be empty for Drive-only workflows)
   * @param fileConfigs - Map of file ID to {source, sheetName, headerRow, driveFileId, driveMimeType}
   */
  run: async (
    id: string,
    files: File[],
    fileConfigs: Record<string, {
      source?: 'local' | 'drive'
      sheetName?: string
      headerRow: number
      driveFileId?: string
      driveMimeType?: string
    }>
  ): Promise<RunResult> => {
    const formData = new FormData()

    // Add files
    for (const file of files) {
      formData.append('files', file)
    }

    // Add file configs as JSON
    formData.append('file_configs', JSON.stringify(fileConfigs))

    const response = await fetch(`${API_BASE}/workflows/${id}/run`, {
      ...defaultFetchOptions,
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return response.json()
  },
  
  /**
   * Get download URL for workflow result.
   */
  downloadUrl: (workflowId: string, runId: string) =>
    `${API_BASE}/workflows/${workflowId}/download/${runId}`,

  /**
   * Get full result data for preview and search.
   */
  getResultData: (workflowId: string, runId: string) =>
    fetchJSON<FullResultData>(`/workflows/${workflowId}/results/${runId}`),
}

// Run API
export const runApi = {
  get: (runId: string) => fetchJSON<Run>(`/runs/${runId}`),
  
  list: (workflowId?: string) => {
    const params = workflowId ? `?workflow_id=${workflowId}` : ''
    return fetchJSON<Run[]>(`/runs${params}`)
  },
  
  delete: (runId: string) =>
    fetchJSON<{ message: string }>(`/runs/${runId}`, {
      method: 'DELETE',
    }),
  
  deleteAll: () =>
    fetchJSON<{ message: string }>('/runs', {
      method: 'DELETE',
    }),
  
  downloadUrl: (runId: string, fileType: 'excel' | 'pdf') =>
    `${API_BASE}/runs/${runId}/download/${fileType}`,
}

// File API
export const fileApi = {
  /**
   * Parse an Excel file and return column information.
   * @param file - The Excel file to parse
   * @param sheetName - Optional sheet name to parse. If not provided, parses the first sheet.
   * @param headerRow - Which row contains headers (1-indexed, default: 1)
   */
  parseColumns: async (file: File, sheetName?: string, headerRow: number = 1): Promise<FileParseResult> => {
    const formData = new FormData()
    formData.append('file', file)
    if (sheetName) {
      formData.append('sheet_name', sheetName)
    }
    formData.append('header_row', headerRow.toString())

    const response = await fetch(`${API_BASE}/files/parse-columns`, {
      ...defaultFetchOptions,
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return response.json()
  },
}

// Drive API
export const driveApi = {
  /** Fetch valid Google access token for Picker initialization */
  getToken: async (): Promise<{ access_token: string; expires_at: string | null }> => {
    const response = await fetch(`${API_BASE}/auth/token`, {
      ...defaultFetchOptions,
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Not authenticated' }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }
    return response.json()
  },

  /** Download and parse a Drive file by ID */
  downloadFile: (fileId: string, headerRow?: number) =>
    fetchJSON<DriveFileResponse>('/drive/download', {
      method: 'POST',
      body: JSON.stringify({ file_id: fileId, header_row: headerRow }),
    }),

  /** Read a Google Sheet by spreadsheet ID */
  readSheet: (spreadsheetId: string, rangeName?: string, headerRow?: number) =>
    fetchJSON<DriveFileResponse>('/drive/read', {
      method: 'POST',
      body: JSON.stringify({
        spreadsheet_id: spreadsheetId,
        range_name: rangeName,
        header_row: headerRow,
      }),
    }),

  /** Fetch list of sheet tabs for a Google Sheets spreadsheet */
  getSheetTabs: (spreadsheetId: string) =>
    fetchJSON<{ tabs: Array<{ title: string; index: number; sheetId: number }> }>(
      `/drive/sheets/tabs?spreadsheet_id=${encodeURIComponent(spreadsheetId)}`
    ),

  /** Create a new Google Sheet with workflow results */
  exportCreate: (runId: string, title: string) =>
    fetchJSON<ExportResponse>('/drive/export/create', {
      method: 'POST',
      body: JSON.stringify({ run_id: runId, title }),
    }),

  /** Update an existing Google Sheet with workflow results */
  exportUpdate: (runId: string, spreadsheetId: string) =>
    fetchJSON<ExportResponse>('/drive/export/update', {
      method: 'POST',
      body: JSON.stringify({ run_id: runId, spreadsheet_id: spreadsheetId }),
    }),
}
