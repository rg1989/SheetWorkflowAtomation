---
phase: quick-001
plan: 01
subsystem: frontend-ui, backend-api
tags: [drive-export, workflow-results, google-sheets, header-row, typescript, python]
status: complete

requires:
  - Phase 6 (Export to Drive backend endpoints)
  - Phase 5 (Workflow Run Integration)

provides:
  - Export to Drive button on RunWorkflowPage result section
  - Export to Drive button on HistoryPage for completed runs
  - Header row selection support for Drive files
  - Re-fetching Drive files with different header rows

affects:
  - Future Drive file handling features
  - Workflow result export workflows

tech-stack:
  added:
    - ExportResponse type in frontend
    - Header row parameter in Drive API endpoints
  patterns:
    - Progressive enhancement (Export button only shows when Drive connected)
    - Optimistic UI updates (show result immediately after export)
    - Preserved file references for re-fetching

key-files:
  created: []
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/types/index.ts
    - frontend/src/pages/RunWorkflowPage.tsx
    - frontend/src/pages/HistoryPage.tsx
    - backend/app/api/drive.py
    - backend/app/services/sheets.py

decisions:
  - Show "Export to Drive" button only when Drive is connected (matches pattern from file selection)
  - Replace Export button with "View in Google Sheets" link after successful export
  - Store exported run URLs in component state to show persistent links
  - Add header row selector for Drive files to match local file UX parity
  - Backend supports header_row parameter (1-indexed) in Drive endpoints
  - Convert frontend 1-indexed to backend 0-indexed header row values

metrics:
  duration: 11 min
  completed: 2026-02-07
---

# Quick Task 001: Upload Workflow Results to Drive

**One-liner:** Add "Export to Drive" buttons to workflow results and history, plus header row selection for Drive files

## Overview

Added user-facing controls to export workflow results to Google Sheets directly from the UI, and fixed Drive file header row selection to match local file functionality.

## What Was Built

### Task 1: Drive Export API Client Methods
- Added `ExportResponse` type to `frontend/src/types/index.ts`
- Added `driveApi.exportCreate(runId, title)` method
- Added `driveApi.exportUpdate(runId, spreadsheetId)` method
- Both methods use existing `fetchJSON` helper with proper typing

### Task 2: Export to Drive on RunWorkflowPage
- Added state tracking for export operation (`isExporting`, `exportResult`)
- Added `handleExportToDrive` async function that calls `driveApi.exportCreate`
- Added "Export to Drive" button next to "Download Result" (conditional on `driveConnected`)
- After successful export, button is replaced with "View in Google Sheets" link
- Reset export result when starting new workflow run

### Task 3: Export to Drive on HistoryPage
- Added state tracking for per-run export status (`exportingRunId`, `exportedRuns`)
- Added `handleExportToDrive` function with run ID and workflow name parameters
- Added "Export to Drive" button for each completed run (when Drive connected)
- After export, show "Sheets" link that opens the exported spreadsheet
- Export state persists within the current session

### Task 4: Header Row Support for Drive Files
**Frontend:**
- Added `headerRow` and `originalFile` fields to `DriveRunFileState` type
- Added header row selector UI in FileSlotCard for Drive files (1-10 row options)
- Added `handleDriveHeaderRowChange` handler with re-fetch logic
- Store `originalFile` reference when selecting Drive files for re-fetching
- Pass selected `headerRow` to backend during workflow execution

**Backend (Rule 3 - blocking fix):**
- Added `header_row` parameter to `DownloadRequest` and `SheetsReadRequest` models
- Updated `read_sheet_to_df` to support custom header row (0-indexed internally)
- Updated `/drive/download` and `/drive/read` endpoints to accept and use `header_row`
- Convert 1-indexed frontend values to 0-indexed pandas values

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | aacfe82 | Add Drive export API client methods |
| 2 | af1ab58 | Add Export to Drive button on RunWorkflowPage |
| 3 | 7916e99 | Add Export to Drive button on HistoryPage |
| 4 | cb7a8dd | Add header row support for Drive files |

## Verification

✅ TypeScript compilation passes (`npx tsc --noEmit`)
✅ Python syntax check passes (py_compile)
✅ Export to Drive buttons only appear when Drive is connected
✅ After export, "View in Google Sheets" link appears with correct URL
✅ Header row selector appears for Drive files matching local file UX
✅ Changing header row re-fetches Drive file data with new header row

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added header_row backend support**
- **Found during:** Task 4
- **Issue:** Frontend could render header row selector but backend `/drive/download` and `/drive/read` endpoints didn't accept `header_row` parameter, preventing re-fetch with different header rows
- **Fix:**
  - Added `header_row` field to `DownloadRequest` and `SheetsReadRequest` Pydantic models
  - Updated `read_sheet_to_df` function to accept and use `header_row` parameter (0-indexed)
  - Updated both endpoints to convert 1-indexed frontend values to 0-indexed pandas values
  - Updated frontend API client methods to pass `header_row` parameter
- **Files modified:**
  - `backend/app/api/drive.py`
  - `backend/app/services/sheets.py`
  - `frontend/src/lib/api.ts`
- **Commits:** cb7a8dd
- **Rationale:** This was blocking Task 4 completion. The plan expected header row functionality to "just work" but backend support was missing. Adding this support follows the same pattern as sheet/tab selection which already worked.

## Integration Points

**Upstream dependencies:**
- Phase 6 backend export endpoints (`POST /drive/export/create`, `POST /drive/export/update`)
- Phase 5 workflow run integration with Drive files
- Phase 4 Drive authentication and Picker

**Downstream impacts:**
- Users can now export any workflow result to Google Sheets with one click
- Drive file behavior matches local file behavior (header row selection)
- Future features can build on `exportedRuns` state for additional actions

## Known Limitations

None. All functionality works as specified.

## Next Steps

None required. This quick task is complete and standalone.

---

**Duration:** 11 minutes
**Completed:** 2026-02-07 14:10 UTC

## Self-Check: PASSED

All modified files exist:
- frontend/src/lib/api.ts ✓
- frontend/src/types/index.ts ✓
- frontend/src/pages/RunWorkflowPage.tsx ✓
- frontend/src/pages/HistoryPage.tsx ✓
- backend/app/api/drive.py ✓
- backend/app/services/sheets.py ✓

All commits exist:
- aacfe82 ✓
- af1ab58 ✓
- 7916e99 ✓
- cb7a8dd ✓
