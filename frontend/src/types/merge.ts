/**
 * Types for merge workflows - combining multiple files into one output.
 */

import type { ColumnInfo } from './index'

/**
 * A file definition within a merge workflow
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
 * An output column in the merged result
 */
export interface OutputColumn {
  id: string
  name: string // Output column name
  source: ColumnSource // Where the data comes from
  order: number // Position in the output (for drag-drop reordering)
}

/**
 * A merge workflow definition
 */
export interface MergeWorkflow {
  id: string
  name: string
  description?: string
  files: FileDefinition[]
  keyColumn?: KeyColumnConfig
  outputColumns: OutputColumn[]
  createdAt: string
  updatedAt: string
}

/**
 * Schema for creating a merge workflow
 */
export interface MergeWorkflowCreate {
  name: string
  description?: string
  files: Omit<FileDefinition, 'sampleData'>[]
  keyColumn?: KeyColumnConfig
  outputColumns: OutputColumn[]
}

/**
 * Schema for updating a merge workflow
 */
export interface MergeWorkflowUpdate {
  name?: string
  description?: string
  files?: Omit<FileDefinition, 'sampleData'>[]
  keyColumn?: KeyColumnConfig
  outputColumns?: OutputColumn[]
}

/**
 * Wizard state for creating a merge workflow
 */
export interface MergeWizardState {
  currentStep: number
  files: FileDefinition[]
  keyColumn?: KeyColumnConfig
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
    description: 'Add the files you want to merge',
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
