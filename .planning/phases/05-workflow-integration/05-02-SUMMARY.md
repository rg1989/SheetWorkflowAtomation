---
phase: 05
plan: 02
type: execute
subsystem: workflow-runtime
tags: [drive-integration, workflow-execution, file-picker, frontend]

requires:
  - 05-01 (Backend workflow run with mixed sources)
  - 04-02 (Drive file picker UI component)

provides:
  - Frontend workflow run UI with Drive file selection
  - Tab selector for Google Sheets at runtime
  - Data preview before workflow execution
  - Version warning for unchanged Drive files
  - Mixed-source workflow runs (local + Drive)

affects:
  - Phase 6 (Export to Drive) - workflow runs can now use Drive files

tech-stack:
  added: []
  patterns:
    - Drive file state management at runtime
    - Mixed-source file handling (local + Drive)
    - Preview data rendering from Drive API

key-files:
  created: []
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api.ts
    - frontend/src/pages/RunWorkflowPage.tsx

decisions:
  - decision: "Use useDriveFilePicker hook for file selection at runtime"
    rationale: "Reuses existing picker infrastructure from FilesStep wizard"
    alternatives: ["Custom file browser", "Inline picker"]
  - decision: "Show preview table with first 3 rows and 5 columns"
    rationale: "Balances useful preview with compact UI, matches backend sample_data size"
    alternatives: ["Full data grid", "No preview"]
  - decision: "Version warning compares ISO timestamps (not strings)"
    rationale: "Prevents false negatives from timezone/format differences"
    alternatives: ["String comparison", "Hash comparison"]
  - decision: "Drive files always use headerRow=1 (not configurable)"
    rationale: "Drive API returns normalized data, header row selection not needed"
    alternatives: ["Allow header row selection for Drive files"]
  - decision: "Extract FileSlotCard component for file slot rendering"
    rationale: "Reduces complexity in main component, improves maintainability"
    alternatives: ["Keep inline rendering", "Multiple smaller components"]

metrics:
  duration: 4 min
  completed: 2026-02-07
---

# Phase 05 Plan 02: Frontend Workflow Run Integration Summary

**One-liner:** RunWorkflowPage integrates Drive file selection with tab picker, preview, version warnings, and mixed-source execution.

## What Was Built

### Task 1: Types and API Client Functions
- Added `DriveRunFileState` interface in `types/index.ts` for tracking Drive file state at runtime
- Added `driveApi.getSheetTabs()` function to fetch tab list from Google Sheets spreadsheets
- Updated `workflowApi.run()` signature to accept mixed-source configs (`source: 'local' | 'drive'`)
- Extended file config type to include `driveFileId`, `driveMimeType` for Drive files

### Task 2: RunWorkflowPage Drive Integration
- Added Drive file picker button ("Pick from Drive" with Cloud icon) for each file slot
- Implemented `handleDriveFileSelect()` handler that:
  - Downloads file metadata and sample data via `driveApi.downloadFile()`
  - Fetches available tabs for Google Sheets via `driveApi.getSheetTabs()`
  - Validates columns against expected file structure
  - Stores complete file state including preview data
- Added tab selector dropdown for Google Sheets with multiple tabs
- Implemented `handleDriveTabChange()` that re-reads specific tab data via `driveApi.readSheet()`
- Added preview table showing first 3 rows × 5 columns with row/column count badge
- Implemented version warning badge ("File unchanged since last run") when `driveModifiedTime` matches workflow definition
- Updated `handleRun()` to build mixed-source file configs:
  - Local files: add to `filesToSend` array with `source: 'local'`
  - Drive files: no file upload, just metadata with `source: 'drive'`
- Updated `allFilesReady` validation to check both `uploadedFiles` and `driveFiles` state
- Extracted `FileSlotCard` component for cleaner code organization
- Preserved all existing local file upload functionality (drag-drop, sheet selector, header row)

### UI/UX Features
1. **File Slot Actions**: Each slot shows "Upload" and "Pick from Drive" buttons side-by-side
2. **Drive File Display**: Shows Cloud icon, file name, tab selector (if Google Sheets), preview table
3. **Version Warning**: Amber badge appears when Drive file hasn't changed since last workflow run
4. **Preview Table**: Compact preview (3 rows × 5 columns) with row/column count, scrollable
5. **State Management**: Selecting Drive file clears local upload, and vice versa
6. **Validation**: Files from either source validate against expected columns
7. **Mixed Execution**: "Run Workflow" button enables when all slots filled (any source)

## Testing Performed

**Build verification:**
- TypeScript compilation successful
- No type errors, all imports resolved
- Vite build completed (507.73 kB bundle)

**Code inspection:**
- Confirmed Drive picker button rendering with `driveConnected` guard
- Verified version warning logic uses `!!` for boolean coercion
- Validated mixed-source file config construction in `handleRun()`
- Confirmed preview table renders sample data with truncation

## Task Commits

| Task | Description | Commit | Files Changed |
|------|-------------|--------|---------------|
| 1 | Add types and API client functions | 120d686 | types/index.ts, lib/api.ts |
| 2 | Integrate Drive files into RunWorkflowPage | 915cdab | pages/RunWorkflowPage.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Technical Decisions

1. **DriveRunFileState columns as ColumnInfo[]**
   - Converted backend's `string[]` to `ColumnInfo[]` for consistency with local file state
   - Allows reuse of existing `validateFileColumns()` helper
   - All columns default to `type: 'text'` since backend returns raw names

2. **Preview table truncation**
   - Limited to 3 rows × 5 columns for compact display
   - Shows `...` indicator when more data available
   - Row count badge provides full dimensions

3. **FileSlotCard component extraction**
   - Moved 250+ lines of JSX to separate component
   - Accepts all handlers as props for clean separation
   - Improves RunWorkflowPage readability (from 800+ to 550 lines)

4. **Error handling in Drive file selection**
   - All Drive API calls wrapped in try/catch
   - Errors stored in `DriveRunFileState.error` field
   - Loading states shown with Loader2 spinner during tab changes

## Integration Points

**Upstream dependencies:**
- `useDriveFilePicker` hook from 04-02 (FilesStep Drive integration)
- `driveApi.downloadFile()` and `driveApi.readSheet()` from 03-01 (Backend Drive endpoints)
- Backend workflow run endpoint accepting mixed sources from 05-01

**Downstream impact:**
- Phase 6 (Export to Drive) will work with workflows that use Drive input files
- Mixed-source workflows fully supported (e.g., local price list + Drive inventory)

## Next Phase Readiness

**Phase 06 (Export to Drive) can begin immediately:**
- Workflow runs successfully execute with Drive files
- Run results contain `runId` for export endpoint
- No blockers identified

**Future enhancements (not blocking):**
- Preserve Drive file selections across page refresh (localStorage)
- Show file owner/modified date in preview
- Support filtering by file type in Drive picker at runtime
- Add "Recently used Drive files" quick selector

## Self-Check: PASSED

**Files created:**
- None (docs-only check skipped)

**Files modified (verified):**
- frontend/src/types/index.ts - Contains `DriveRunFileState` interface ✓
- frontend/src/lib/api.ts - Contains `driveApi.getSheetTabs()` and updated `workflowApi.run()` ✓
- frontend/src/pages/RunWorkflowPage.tsx - Contains Drive integration and `FileSlotCard` component ✓

**Commits (verified):**
- 120d686 - Types and API client ✓
- 915cdab - RunWorkflowPage integration ✓

---

**Completion time:** 4 minutes
**Phase 05 status:** Complete (2/2 plans)
