---
phase: 02-backend-drive-service
plan: 02
subsystem: api
tags: [google-sheets-api, pandas, asyncio, tenacity, native-read]

# Dependency graph
requires:
  - phase: 02-backend-drive-service
    provides: Drive service foundation (02-01) with retry logic and error handling
provides:
  - Native Google Sheets API reader converting spreadsheets to pandas DataFrames
  - Sheet tab metadata listing (get_sheet_tabs)
  - Intelligent routing in Drive service preferring native Sheets read over export
  - Edge case handling for empty sheets, header-only sheets, and ragged rows
affects: [03-frontend-file-picker, 04-workflow-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Native Sheets API read via Sheets API v4 (more efficient than Drive export)"
    - "Intelligent routing: prefer native read when sheets_service available, fallback to export"
    - "Edge case handling: empty sheets, header-only sheets, ragged row padding"

key-files:
  created:
    - backend/app/services/sheets.py
  modified:
    - backend/app/services/drive.py

key-decisions:
  - "Reuse drive_retry decorator and _handle_drive_error from drive.py for consistency"
  - "Pad ragged rows with None to prevent DataFrame construction errors"
  - "Default to first sheet tab when range_name not specified"
  - "Add sheets_service as optional parameter to download_drive_file_to_df for backward compatibility"
  - "Keep _export_google_sheet_to_df as fallback when Sheets service not available"

patterns-established:
  - "Native API preference pattern: use specialized API (Sheets v4) when available, fallback to generic API (Drive export)"
  - "Service parameter injection: optional service parameters enable feature enhancement without breaking existing callers"

# Metrics
duration: 2min
completed: 2026-02-07
---

# Phase 2 Plan 2: Native Sheets API Read Summary

**Native Google Sheets reading via Sheets API v4 with intelligent routing, edge case handling, and export fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-07T10:47:49Z
- **Completed:** 2026-02-07T10:49:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Native Google Sheets reader via Sheets API v4 converts spreadsheets to pandas DataFrames (more efficient than Drive export)
- Sheet tab metadata listing with get_sheet_tabs() returns tab names, indexes, and sheet IDs
- Empty sheets return empty DataFrame, header-only sheets return DataFrame with columns but no rows
- Ragged rows automatically padded with None to match header length
- Drive service intelligently routes Google Sheets to native read when sheets_service provided, falls back to export otherwise

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Sheets API service for native spreadsheet reading** - `664192d` (feat)
2. **Task 2: Update Drive service to route Google Sheets to native Sheets API** - `c4bea0a` (feat)

## Files Created/Modified
- `backend/app/services/sheets.py` - Native Google Sheets reading via Sheets API v4 with edge case handling
- `backend/app/services/drive.py` - Updated download_drive_file_to_df to prefer native Sheets read when sheets_service available

## Decisions Made

**Reuse drive_retry and error handling from drive.py**
- Rationale: Both Drive and Sheets APIs return same HTTP error structure. Reusing existing retry decorator and error handler ensures consistent behavior and reduces code duplication.

**Pad ragged rows with None**
- Rationale: Sheets API returns rows as variable-length lists. When data rows have fewer values than headers, pandas DataFrame construction fails. Padding short rows with None matches pandas' expectation of rectangular data.

**Default to first sheet tab when range_name empty**
- Rationale: Most spreadsheets have one sheet. Defaulting to first tab provides intuitive behavior - read_sheet_to_df(service, spreadsheet_id) reads the first sheet without requiring tab name lookup.

**Add sheets_service as optional parameter**
- Rationale: Maintains backward compatibility. Existing callers with only Drive service continue to work via export path. New callers with both services get native read efficiency automatically.

**Keep _export_google_sheet_to_df as fallback**
- Rationale: Not all callers will have Sheets service available (e.g., limited OAuth scopes). Export fallback ensures the function works in all contexts, gracefully degrading to less efficient approach when needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed as specified.

## User Setup Required

None - no external service configuration required. Uses existing OAuth tokens from Phase 1.

## Next Phase Readiness

**Ready for:**
- Phase 3: Frontend file picker integration (backend can now read all three file types: Excel, CSV, Google Sheets)
- Phase 4: Workflow integration (download_drive_file_to_df provides unified DataFrame interface)

**Phase 2 complete.** All success criteria met:
- ✓ Excel files → DataFrame
- ✓ CSV files → DataFrame
- ✓ Google Sheets → DataFrame (native read preferred, export fallback)
- ✓ Error handling for 403/404/429
- ✓ Retry logic for rate limits
- ✓ Edge cases handled (empty sheets, header-only sheets, ragged rows)

**No blockers.**

---
*Phase: 02-backend-drive-service*
*Completed: 2026-02-07*

## Self-Check: PASSED

All claimed files and commits verified:
- ✓ backend/app/services/sheets.py
- ✓ backend/app/services/drive.py (modified)
- ✓ Commit 664192d
- ✓ Commit c4bea0a
