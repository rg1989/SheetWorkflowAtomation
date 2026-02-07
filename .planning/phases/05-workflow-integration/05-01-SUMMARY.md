---
phase: 05-workflow-integration
plan: 01
subsystem: api
tags: [fastapi, google-drive, google-sheets, workflow-execution, pandas]

# Dependency graph
requires:
  - phase: 02-backend-drive-service
    provides: download_drive_file_to_df, read_sheet_to_df, get_sheet_tabs service functions
  - phase: 03-backend-drive-endpoints
    provides: REST endpoint patterns for Drive operations
  - phase: 04-frontend-picker-ui
    provides: Frontend Drive file selection with metadata
provides:
  - Workflow run endpoint accepts mixed local and Drive file inputs
  - Drive files downloaded and parsed to DataFrames at workflow execution time
  - Sheet tabs listing endpoint for Google Sheets tab selection
affects: [05-workflow-integration-frontend, 06-export-to-drive]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mixed-source file handling: source field routing to local vs Drive processors"
    - "Lazy service initialization: Build Drive/Sheets services only when needed"
    - "Backward compatibility via default values: Missing source field defaults to local"

key-files:
  created: []
  modified:
    - backend/app/api/workflows.py
    - backend/app/api/drive.py

key-decisions:
  - "Make files parameter optional (File(default=[])) for Drive-only workflows"
  - "Default source to local when missing for backward compatibility"
  - "Build Drive/Sheets services lazily (only when Drive files present)"
  - "Use read_sheet_to_df for Google Sheets with tab selection"
  - "Track file_info_list with mix of filenames and Drive IDs for audit trail"

patterns-established:
  - "Source-based routing: Check config.get('source', 'local') to route to local vs Drive handlers"
  - "Lazy service building: Initialize drive_service/sheets_service as None, build on first Drive file"
  - "Local file index tracking: Separate counter for local files to avoid index mismatch in mixed workflows"
  - "Drive error wrapping: Wrap Drive download errors with HTTPException including driveFileId for debugging"

# Metrics
duration: 2min
completed: 2026-02-07
---

# Phase 5 Plan 1: Workflow Run Integration Summary

**Workflow run endpoint accepts mixed local and Drive file inputs, downloads Drive files at execution time, with sheet tabs listing for tab selection**

## Performance

- **Duration:** 2 min 22 sec
- **Started:** 2026-02-07T13:34:15Z
- **Completed:** 2026-02-07T13:36:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended workflow run endpoint to handle both local uploads and Drive file references
- Drive files downloaded and parsed into DataFrames during workflow execution
- Google Sheets can be read with specific tab selection via read_sheet_to_df
- Added GET /drive/sheets/tabs endpoint for listing spreadsheet tabs
- Maintained full backward compatibility with existing local-only workflows

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend workflow run endpoint for mixed file sources** - `35b5043` (feat)
2. **Task 2: Add sheet tabs listing endpoint** - `0cd772f` (feat)

## Files Created/Modified
- `backend/app/api/workflows.py` - Extended POST /{workflow_id}/run to accept mixed local and Drive file sources, route based on source field, build Drive/Sheets services lazily, track file_info_list for audit
- `backend/app/api/drive.py` - Added GET /sheets/tabs endpoint to list spreadsheet tabs using get_sheet_tabs service

## Decisions Made

- **Made files parameter optional:** Changed from `File(...)` to `File(default=[])` to support Drive-only workflows with zero local uploads
- **Default source to local:** When source field missing in file_configs, default to "local" for backward compatibility with existing API callers
- **Lazy service initialization:** Build Drive/Sheets services only when first Drive file encountered, avoiding unnecessary service creation for local-only workflows
- **Route based on MIME type and sheet selection:** For Google Sheets with tab selection, use read_sheet_to_df directly with range_name; for other files use download_drive_file_to_df
- **Track file info for audit:** Build file_info_list with mix of filenames (local) and Drive:{fileId} (Drive) for comprehensive audit trail in RunDB

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Backend workflow integration complete. Ready for:
- Frontend workflow run UI updates to send Drive file metadata in file_configs
- Tab selector UI component for Google Sheets files
- Mixed-source workflow testing

No blockers. Drive files now fully integrated into workflow execution pipeline.

## Self-Check: PASSED

---
*Phase: 05-workflow-integration*
*Completed: 2026-02-07*
