// Workflow types
export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'exists'
  | 'isEmpty'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'

export type ActionType =
  | 'setValue'
  | 'increment'
  | 'decrement'
  | 'copyFrom'
  | 'formula'
  | 'flag'
  | 'clear'

export interface Condition {
  id: string
  column: string
  operator: ConditionOperator
  value?: string | number
}

export interface Action {
  id: string
  type: ActionType
  targetColumn: string
  sourceColumn?: string
  value?: string | number
  formula?: string
}

export interface WorkflowStep {
  id: string
  name: string
  conditions: Condition[]
  actions: Action[]
}

export interface SourceConfig {
  type: 'inventory' | 'sales' | 'custom'
  keyColumn: string
}

export interface Workflow {
  id: string
  name: string
  description?: string
  sourceConfig: SourceConfig
  steps: WorkflowStep[]
  createdAt: string
  updatedAt: string
}

export interface WorkflowCreate {
  name: string
  description?: string
  sourceConfig: SourceConfig
  steps: WorkflowStep[]
}

// Diff types
export type ChangeType = 'added' | 'removed' | 'modified' | 'unchanged'

export interface CellChange {
  row: number
  column: string
  keyValue: string
  oldValue: string | number | null
  newValue: string | number | null
  changeType: ChangeType
  stepId?: string
  stepName?: string
}

export interface RowChange {
  rowIndex: number
  keyValue: string
  cells: CellChange[]
  hasWarning: boolean
  warningMessage?: string
}

export interface DiffSummary {
  rowsAffected: number
  cellsModified: number
  totalRows: number
  warnings: number
  errors: number
}

export interface Warning {
  type: string
  message: string
  row?: number
  column?: string
}

export interface DiffResult {
  summary: DiffSummary
  changes: RowChange[]
  warnings: Warning[]
  columns: string[]
  keyColumn: string
}

// Run types
export type RunStatus = 'preview' | 'approved' | 'completed' | 'failed'

export interface Run {
  id: string
  workflowId: string
  status: RunStatus
  createdAt: string
  completedAt?: string
  outputExcel?: string
  outputPdf?: string
}

export interface RunPreview {
  runId: string
  workflowId: string
  diff: DiffResult
  status: RunStatus
}

// File types
export interface ColumnInfo {
  name: string
  type: 'text' | 'number' | 'date' | 'integer' | 'boolean'
  sampleValues: (string | number)[]
}

export interface FileParseResult {
  filename: string
  rowCount: number
  columns: ColumnInfo[]
  sampleData?: Record<string, unknown>[]
  sheetName?: string // The sheet that was parsed
  availableSheets?: string[] // All sheets in the file
  headerRow?: number // Which row was used as headers (1-indexed)
}
