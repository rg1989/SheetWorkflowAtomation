---
phase: 03-backend-drive-endpoints
plan: 01
subsystem: api
tags: [fastapi, pydantic, rest-api, google-drive, google-sheets]

# Dependency graph
requires:
  - phase: 02-backend-drive-service
    provides: Drive/Sheets service layer with download_drive_file_to_df, get_drive_file_metadata, read_sheet_to_df
  - phase: 01-token-management-foundation
    provides: OAuth token storage, encryption, refresh logic, and build_drive_service/build_sheets_service
provides:
  - POST /api/drive/download endpoint accepting file_id, returning DriveFileResponse with metadata and data preview
  - POST /api/drive/read endpoint accepting spreadsheet_id and optional range_name, returning DriveFileResponse
  - GET /api/auth/token endpoint returning valid access token for Google Picker initialization
  - Pydantic models for request/response validation (DownloadRequest, SheetsReadRequest, FileMetadata, DriveFileResponse)
affects: [04-frontend-picker, 05-frontend-workflow-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [pydantic-request-response-models, nan-to-none-serialization, rest-endpoint-service-layer-separation]

key-files:
  created:
    - backend/app/api/drive.py
  modified:
    - backend/app/main.py
    - backend/app/auth/router.py

key-decisions:
  - "Return same DriveFileResponse shape for both /download and /read endpoints - simplifies frontend handling"
  - "Extract _sanitize_sample_rows() helper to avoid NaN serialization duplication"
  - "Use get_valid_access_token() in /token endpoint for automatic refresh before returning to Picker"
  - "Include file metadata from get_drive_file_metadata() in both endpoints for SELECT-02 compliance"

patterns-established:
  - "NaN-to-None conversion pattern: _sanitize_sample_rows() helper using math.isnan() check before JSON serialization"
  - "REST endpoint pattern: Pydantic request models, service layer calls, HTTPException for errors, response models"
  - "Authentication pattern: Depends(get_current_user) and Depends(get_db) for all endpoints requiring auth"

# Metrics
duration: 2min
completed: 2026-02-07
---

# Phase 03 Plan 01: Backend Drive Endpoints Summary

**FastAPI REST endpoints exposing Drive file download, Sheets read, and Picker token retrieval with Pydantic validation and NaN-safe JSON serialization**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-07T11:12:58Z
- **Completed:** 2026-02-07T11:15:53Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created POST /api/drive/download endpoint with file_id parameter returning metadata and data preview
- Created POST /api/drive/read endpoint with spreadsheet_id and optional range_name parameter
- Added GET /api/auth/token endpoint for frontend Picker initialization with automatic token refresh
- Implemented Pydantic models (DownloadRequest, SheetsReadRequest, FileMetadata, DriveFileResponse) for request/response validation
- NaN-to-None conversion for safe JSON serialization of pandas DataFrame sample rows

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Drive and Sheets API endpoints with Pydantic models** - `9c036b7` (feat)
2. **Task 2: Add token endpoint to auth router for Picker authentication** - `af55345` (feat)

## Files Created/Modified
- `backend/app/api/drive.py` - Drive and Sheets REST endpoints with Pydantic models
- `backend/app/main.py` - Registered drive router at /api/drive prefix
- `backend/app/auth/router.py` - Added GET /token endpoint for Picker authentication

## Decisions Made
- **Same response shape for both endpoints:** Used DriveFileResponse for both /download and /read to simplify frontend handling. Both operations return file metadata, row count, columns, and sample data in identical structure.
- **Extracted NaN sanitization helper:** Created _sanitize_sample_rows() function to avoid code duplication since both endpoints need NaN-to-None conversion for JSON serialization.
- **Use get_valid_access_token() for /token endpoint:** Rather than manually decrypting, leverage existing token refresh logic to ensure returned token is always valid for immediate Picker use.
- **Include Drive metadata in both endpoints:** Both /download and /read call get_drive_file_metadata() to satisfy SELECT-02 requirement (name, owner, modified time, webViewLink) before performing data operations.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 4 (Frontend Picker Integration):**
- All three REST endpoints operational and accessible
- POST /api/drive/download accepts file_id, returns DriveFileResponse with metadata + preview
- POST /api/drive/read accepts spreadsheet_id + optional range_name, returns DriveFileResponse
- GET /api/auth/token returns valid access token for Picker initialization
- File metadata includes all SELECT-02 fields: id, name, mime_type, modified_time, owner, web_view_link
- Sample data properly serialized (NaN → None) for JSON transport
- Authentication enforced via Depends(get_current_user) on all endpoints

**No blockers or concerns** - Frontend can now implement Google Picker UI and call these endpoints.

## Self-Check: PASSED

All files and commits verified:
- ✓ backend/app/api/drive.py (created)
- ✓ backend/app/main.py (modified)
- ✓ backend/app/auth/router.py (modified)
- ✓ Commit 9c036b7 exists
- ✓ Commit af55345 exists

---
*Phase: 03-backend-drive-endpoints*
*Completed: 2026-02-07*
