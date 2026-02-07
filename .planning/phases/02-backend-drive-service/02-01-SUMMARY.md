---
phase: 02-backend-drive-service
plan: 01
subsystem: api
tags: [google-drive-api, google-sheets-api, pandas, tenacity, oauth2, fastapi]

# Dependency graph
requires:
  - phase: 01-token-management-foundation
    provides: Token storage with encryption (get_valid_access_token, decrypt_token)
provides:
  - Credential builder for Google Drive and Sheets API services
  - Drive file download service converting Excel/CSV/Sheets to pandas DataFrames
  - Error handling with user-friendly messages for 403/404/429 errors
  - Exponential backoff retry logic for rate limits and server errors
affects: [02-backend-drive-service, 03-frontend-file-picker, 04-workflow-integration]

# Tech tracking
tech-stack:
  added: [google-api-python-client, google-auth, google-auth-oauthlib, tenacity]
  patterns:
    - "Async wrappers around sync Google API calls using asyncio.to_thread()"
    - "Tenacity retry decorator with exponential backoff for API resilience"
    - "User-friendly error mapping from HTTP status codes to domain messages"

key-files:
  created:
    - backend/app/services/google_auth.py
    - backend/app/services/drive.py
    - backend/app/services/__init__.py
  modified:
    - backend/requirements.txt

key-decisions:
  - "Use asyncio.to_thread() to wrap Google API blocking calls for FastAPI compatibility"
  - "Apply @drive_retry decorator with 5 attempts, 2-60s exponential backoff for 429/5xx"
  - "Map 403 -> permission denied, 404 -> not found, 429 -> rate limit for clear UX"
  - "Strip column names whitespace to match existing ExcelParser behavior"

patterns-established:
  - "Service builder pattern: _build_credentials() helper shared by Drive and Sheets builders"
  - "MIME type routing: Google Sheets export, Excel/CSV binary download"
  - "Error handler pattern: _handle_drive_error() centralizes status code mapping"

# Metrics
duration: 3min
completed: 2026-02-07
---

# Phase 2 Plan 1: Drive Service Foundation Summary

**Google Drive and Sheets API service builders with DataFrame download, exponential backoff retry, and user-friendly error handling**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-07T10:41:07Z
- **Completed:** 2026-02-07T10:44:28Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Credential builder constructs authenticated Drive v3 and Sheets v4 service objects from Phase 1 encrypted tokens
- Drive download service converts Excel, CSV, and Google Sheets files to pandas DataFrames
- Resilient API usage with tenacity retry (5 attempts, exponential backoff 2-60s) for rate limits and server errors
- User-friendly error messages for common failures (permission denied, file not found, rate limit exceeded)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Google API dependencies and create credential builder** - `c093a8f` (feat)
2. **Task 2: Create Drive file download service with error handling and retry** - `624d057` (feat)

## Files Created/Modified
- `backend/requirements.txt` - Added google-api-python-client, google-auth, google-auth-oauthlib, tenacity
- `backend/app/services/__init__.py` - Services module marker
- `backend/app/services/google_auth.py` - Build Drive v3 and Sheets v4 service objects using Phase 1 tokens
- `backend/app/services/drive.py` - Download Drive files to DataFrames with retry logic and error handling

## Decisions Made

**Use asyncio.to_thread() for Google API calls**
- Rationale: google-api-python-client is synchronous, but FastAPI is async. Wrapping .execute() calls in asyncio.to_thread() prevents blocking the event loop while maintaining async function signatures.

**Apply @drive_retry decorator at function level**
- Rationale: Retry logic only on API-calling functions (_download_binary_to_df, _export_google_sheet_to_df, get_drive_file_metadata) not the routing function (download_drive_file_to_df) to avoid retrying logic errors.

**Map HTTP errors to domain messages**
- Rationale: Raw Google API errors are developer-focused. Mapping 403 -> "Access denied", 404 -> "File not found", 429 -> "Rate limit exceeded" provides actionable feedback for end users.

**Strip DataFrame column whitespace**
- Rationale: Matches existing ExcelParser behavior from app.core.parser to ensure consistent data format across file sources.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed as specified.

## User Setup Required

None - no external service configuration required. Uses existing GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables from Phase 1.

## Next Phase Readiness

**Ready for:**
- Plan 02-02: Drive file picker integration (uses build_drive_service)
- Plan 02-03: Sheets integration (uses build_sheets_service)
- Frontend file picker (Phase 3) needs backend endpoints that call download_drive_file_to_df

**No blockers.**

---
*Phase: 02-backend-drive-service*
*Completed: 2026-02-07*

## Self-Check: PASSED

All claimed files and commits verified:
- ✓ backend/app/services/google_auth.py
- ✓ backend/app/services/drive.py
- ✓ backend/app/services/__init__.py
- ✓ backend/requirements.txt
- ✓ Commit c093a8f
- ✓ Commit 624d057
