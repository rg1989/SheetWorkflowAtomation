---
phase: quick-007
plan: 01
subsystem: frontend-backend-integration
tags: [drive, excel, sheets, ui]
requires: [quick-005]
provides: ["Sheet selection for Drive Excel files"]
affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - backend/app/api/drive.py
    - frontend/src/lib/api.ts
    - frontend/src/components/WorkflowWizard/steps/FilesStep.tsx
decisions: []
metrics:
  duration: 8 min
  completed: 2026-02-07
---

# Quick Task 007: Enable Sheet Selection for Drive Excel Files Summary

**One-liner:** Thread `sheet_name` parameter through backend API → frontend API client → FilesStep handler to enable sheet selection for Drive Excel files.

## What Was Done

### Problem Identified
Users saw "Sheet selection only available for Google Sheets" error when trying to change sheets on Drive Excel files, even though the backend `download_drive_file_to_df` function already supported a `sheet_name` parameter. The parameter just wasn't being passed through the API layers.

### Solution Implemented
Threaded the `sheet_name` parameter through the full stack:

1. **Backend endpoint** (`/drive/download`): Added `sheet_name` to `DownloadRequest` model and passed it to `download_drive_file_to_df`
2. **Frontend API client** (`driveApi.downloadFile`): Added optional `sheetName` parameter and included it in request body
3. **Frontend handler** (`handleChangeSheet`): Replaced error message with actual implementation that calls `driveApi.downloadFile` with sheet name for Drive Excel files
4. **Frontend header row handler** (`handleChangeHeaderRow`): Updated to preserve current sheet name when changing header row

### Technical Details

**Backend changes** (`backend/app/api/drive.py`):
- Added `sheet_name: Optional[str]` field to `DownloadRequest` Pydantic model (line 37)
- Updated `download_drive_file` endpoint to pass `sheet_name=request.sheet_name` to `download_drive_file_to_df` (line 158)

**Frontend API changes** (`frontend/src/lib/api.ts`):
- Updated `driveApi.downloadFile` signature to accept optional `sheetName` parameter (line 225)
- Conditionally include `sheet_name` in request body only when provided (using spread operator)

**Frontend UI changes** (`frontend/src/components/WorkflowWizard/steps/FilesStep.tsx`):
- In `handleChangeSheet` (lines 130-140): Replaced error block with implementation that calls `driveApi.downloadFile(fileId, headerRow, sheetName)` for Drive Excel/CSV files
- In `handleChangeHeaderRow` (line 183): Added `sheetName` parameter to `driveApi.downloadFile` call to preserve selected sheet when changing header row

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add sheet_name to backend DownloadRequest and pass through | [0bd4308](../../commit/0bd4308) | backend/app/api/drive.py |
| 2 | Update frontend API client and FilesStep sheet change handler | [32a0581](../../commit/32a0581) | frontend/src/lib/api.ts, frontend/src/components/WorkflowWizard/steps/FilesStep.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## User-Facing Impact

**Before:** Users couldn't change sheets on Drive Excel files - they saw "Sheet selection only available for Google Sheets" error.

**After:** Users can now:
- Select any sheet from a Drive Excel file using the sheet dropdown
- Preview updates automatically with the correct data
- Change header row while preserving selected sheet
- Experience identical sheet selection UX for both Google Sheets and Drive Excel files

## Verification Results

1. ✅ **Backend model validation**: `DownloadRequest(file_id='test', sheet_name='Sheet2')` successfully accepts and stores `sheet_name`
2. ✅ **TypeScript compilation**: `npx tsc --noEmit` passes with no errors
3. ✅ **No regressions expected**:
   - Google Sheets sheet selection uses `readSheet` path (unchanged)
   - Local file sheet selection uses `fileApi.parseColumns` path (unchanged)
   - Only Drive Excel/CSV files gained new functionality

## Next Phase Readiness

**Status:** Ready

**Validation needed:** Manual testing recommended:
1. Create workflow with Drive Excel file that has multiple sheets
2. Select different sheets from dropdown
3. Verify preview updates with correct data
4. Change header row and verify sheet selection is preserved
5. Test with both Google Sheets (existing path) and Drive Excel files (new path)

**No blockers or concerns.**

## Self-Check: PASSED

All commits exist:
- 0bd4308 ✅
- 32a0581 ✅

All modified files exist:
- backend/app/api/drive.py ✅
- frontend/src/lib/api.ts ✅
- frontend/src/components/WorkflowWizard/steps/FilesStep.tsx ✅
