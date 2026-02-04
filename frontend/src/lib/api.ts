import type {
  Workflow,
  WorkflowCreate,
  WorkflowUpdate,
  Run,
  FileParseResult,
  RunResult,
} from '../types'

const API_BASE = '/api'

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
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
   * Run a workflow with uploaded files.
   * @param id - Workflow ID
   * @param files - Array of files to process (in order of expected files)
   * @param fileConfigs - Map of file ID to {sheetName, headerRow}
   */
  run: async (
    id: string,
    files: File[],
    fileConfigs: Record<string, { sheetName?: string; headerRow: number }>
  ): Promise<RunResult> => {
    const formData = new FormData()
    
    // Add files
    for (const file of files) {
      formData.append('files', file)
    }
    
    // Add file configs as JSON
    formData.append('file_configs', JSON.stringify(fileConfigs))
    
    const response = await fetch(`${API_BASE}/workflows/${id}/run`, {
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
