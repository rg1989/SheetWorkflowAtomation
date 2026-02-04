/**
 * Core types for the Sheet Workflow Automation application.
 */

// ============================================================================
// File and Column Types
// ============================================================================

export interface ColumnInfo {
  name: string
  type: 'text' | 'number' | 'date' | 'integer' | 'boolean'
  sampleValues: (string | number | null)[]
}

export interface FileParseResult {
  filename: string
  rowCount: number
  columns: ColumnInfo[]
  sampleData?: Record<string, unknown>[]
  sheetName?: string
  availableSheets?: string[]
  headerRow?: number
}

/**
 * A file definition within a workflow
 */
export interface FileDefinition {
  id: string
  name: string // User-friendly name (e.g., "Sales Data")
  filename: string // Original filename
  colorIndex: number // 0-4 for predefined colors
  columns: ColumnInfo[] // Detected columns from the file
  sampleData?: Record<string, unknown>[] // First few rows for preview
  sheetName?: string // Selected sheet name (for multi-sheet Excel files)
  availableSheets?: string[] // All available sheets in the file
  originalFile?: File // Keep reference to original file for re-parsing
  headerRow?: number // Which row contains headers (1-indexed, default: 1)
}

// ============================================================================
// Key Column and Join Configuration
// ============================================================================

/**
 * Configuration for the key column used to match rows across files.
 * Maps each file ID to its key column name (allows different column names per file).
 */
export interface KeyColumnConfig {
  // Map of fileId -> column name for matching
  // e.g., { "file1": "Name", "file2": "Item Name" }
  mappings: Record<string, string>
}

/**
 * Types of joins supported for merging tables.
 * - inner: Only rows with matching keys in ALL files
 * - left: All rows from primary file, matching from others (most common)
 * - right: All rows from last file, matching from others
 * - full: All rows from ALL files (union of keys)
 */
export type JoinType = 'inner' | 'left' | 'right' | 'full'

/**
 * Configuration for how tables should be joined.
 */
export interface JoinConfig {
  joinType: JoinType
  primaryFileId: string // Which file to keep all rows from (for LEFT join)
}

/**
 * Metadata about each join type for UI display
 */
export const JOIN_TYPE_INFO: Record<
  JoinType,
  { label: string; description: string; icon: string }
> = {
  left: {
    label: 'Keep All Primary Rows',
    description: 'Keep all rows from the primary file. Other files fill in matching data.',
    icon: 'arrow-left',
  },
  inner: {
    label: 'Only Matching Rows',
    description: 'Only include rows that have matching keys in ALL files.',
    icon: 'git-merge',
  },
  full: {
    label: 'Keep All Rows',
    description: 'Include all rows from all files, even if some have no matches.',
    icon: 'maximize-2',
  },
  right: {
    label: 'Keep All Secondary Rows',
    description: 'Keep all rows from the last file. Primary file fills in matching data.',
    icon: 'arrow-right',
  },
}

// ============================================================================
// Output Column Configuration
// ============================================================================

/**
 * A part of a concatenation - either a column reference or a literal string
 */
export type ConcatPart =
  | { type: 'column'; fileId: string; column: string }
  | { type: 'literal'; value: string }

/**
 * An operand in a math operation - either a column or a number
 */
export interface MathOperand {
  type: 'column' | 'literal'
  fileId?: string
  column?: string
  value?: number
}

/**
 * The source of data for an output column
 */
export type ColumnSource =
  | { type: 'direct'; fileId: string; column: string }
  | { type: 'concat'; parts: ConcatPart[]; separator?: string }
  | {
      type: 'math'
      operation: 'add' | 'subtract' | 'multiply' | 'divide'
      operands: MathOperand[]
    }
  | { type: 'custom'; defaultValue: string }

/**
 * An output column in the result
 */
export interface OutputColumn {
  id: string
  name: string // Output column name
  source: ColumnSource // Where the data comes from
  order: number // Position in the output (for drag-drop reordering)
}

// ============================================================================
// Workflow Types
// ============================================================================

/**
 * A workflow definition
 */
export interface Workflow {
  id: string
  name: string
  description?: string
  files: FileDefinition[]
  keyColumn?: KeyColumnConfig
  joinConfig?: JoinConfig
  outputColumns: OutputColumn[]
  createdAt: string
  updatedAt: string
}

/**
 * Schema for creating a workflow
 */
export interface WorkflowCreate {
  name: string
  description?: string
  files: Omit<FileDefinition, 'sampleData'>[]
  keyColumn?: KeyColumnConfig
  joinConfig?: JoinConfig
  outputColumns: OutputColumn[]
}

/**
 * Schema for updating a workflow
 */
export interface WorkflowUpdate {
  name?: string
  description?: string
  files?: Omit<FileDefinition, 'sampleData'>[]
  keyColumn?: KeyColumnConfig
  joinConfig?: JoinConfig
  outputColumns?: OutputColumn[]
}

// ============================================================================
// Wizard State
// ============================================================================

/**
 * Wizard state for creating a workflow
 */
export interface WizardState {
  currentStep: number
  files: FileDefinition[]
  keyColumn?: KeyColumnConfig
  joinConfig?: JoinConfig
  outputColumns: OutputColumn[]
  workflowName: string
  workflowDescription: string
}

/**
 * Available wizard steps
 */
export type WizardStep = 'files' | 'key-column' | 'output-columns' | 'preview'

export const WIZARD_STEPS: { id: WizardStep; title: string; description: string }[] = [
  {
    id: 'files',
    title: 'Upload Files',
    description: 'Add the files you want to combine',
  },
  {
    id: 'key-column',
    title: 'Match Rows',
    description: 'Select how to match rows across files',
  },
  {
    id: 'output-columns',
    title: 'Define Output',
    description: 'Configure the columns in your result',
  },
  {
    id: 'preview',
    title: 'Review & Save',
    description: 'Preview and save your workflow',
  },
]

// ============================================================================
// Run Types
// ============================================================================

export type RunStatus = 'preview' | 'completed' | 'failed'

export interface Run {
  id: string
  workflowId: string
  status: RunStatus
  createdAt: string
  completedAt?: string
  outputExcel?: string
  outputPdf?: string
}

export interface RunResult {
  success: boolean
  runId: string
  rowCount: number
  columns: string[]
  previewData: Record<string, unknown>[]
  warnings: string[]
}
