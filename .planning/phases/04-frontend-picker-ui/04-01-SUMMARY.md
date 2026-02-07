---
phase: 04-frontend-picker-ui
plan: 01
subsystem: ui
tags: [react, typescript, google-picker, google-drive, react-hooks]

# Dependency graph
requires:
  - phase: 03-backend-drive-endpoints
    provides: /api/auth/token endpoint, /api/drive/download endpoint, DriveFileResponse shape
  - phase: 02-backend-drive-service
    provides: Drive file download and parsing capability
  - phase: 01-token-management-foundation
    provides: Token storage and refresh logic
provides:
  - Extended FileDefinition type supporting both local and Drive file sources
  - Drive API client functions (getToken, downloadFile, readSheet)
  - useDriveFilePicker hook wrapping react-google-drive-picker with backend token fetching
  - DriveFilePicker component handling full pick-parse-callback flow
  - Auth context with driveConnected field and loginWithDrive function
affects: [05-frontend-picker-integration, frontend-workflows]

# Tech tracking
tech-stack:
  added: [react-google-drive-picker@1.2.2]
  patterns: [Custom hook wrapping third-party library with backend integration, Dual-source type pattern with optional discriminator field]

key-files:
  created:
    - frontend/src/hooks/useDriveFilePicker.ts
    - frontend/src/components/WorkflowWizard/DriveFilePicker.tsx
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api.ts
    - frontend/src/context/AuthContext.tsx
    - frontend/package.json

key-decisions:
  - "Source field in FileDefinition is optional (not required) for full backward compatibility with existing local file code"
  - "DrivePickerFile lastEditedUtc has precedence over file_metadata.modified_time for more accurate timestamps"
  - "Column type defaults to 'text' since backend returns raw column names without type inference"
  - "supportDrives: true enables Shared Drives per SELECT-03 requirement"
  - "viewId: 'DOCS' shows all file types (Sheets, Excel, CSV) - backend validates on download"
  - "multiselect: false for one file at a time to match current workflow UX"

patterns-established:
  - "Custom hook pattern: Wrap third-party library (react-google-drive-picker) with backend integration (token fetching)"
  - "Component pattern: Button component handles full flow (open picker → call backend → convert to app types → callback)"
  - "Dual-source type pattern: Optional discriminator field (source?) with metadata fields only populated when source === 'drive'"

# Metrics
duration: 3min
completed: 2026-02-07
---

# Phase 4 Plan 1: Frontend Picker UI Summary

**React Google Drive Picker integration with backend token fetching, extended types supporting dual file sources, and full pick-parse-callback component**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-07T13:53:15Z
- **Completed:** 2026-02-07T13:55:53Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Extended FileDefinition type to support both local and Drive file sources with full backward compatibility
- Created reusable Drive API client with getToken, downloadFile, and readSheet functions
- Built useDriveFilePicker hook that fetches fresh tokens from backend and opens Google Picker
- Implemented DriveFilePicker button component with two loading states and full error handling
- Added driveConnected field to auth context and loginWithDrive function for incremental authorization
- Enabled Shared Drives support per SELECT-03 requirement

## Task Commits

Each task was committed atomically:

1. **Task 1: Install picker package, extend types, add Drive API functions, update auth context** - `ec5d463` (feat)
2. **Task 2: Create useDriveFilePicker hook and DriveFilePicker component** - `1cf32fd` (feat)

## Files Created/Modified
- `frontend/src/types/index.ts` - Extended FileDefinition with source and Drive metadata fields; added DrivePickerFile and DriveFileResponse types
- `frontend/src/lib/api.ts` - Added driveApi object with getToken, downloadFile, readSheet functions; updated AuthUser with driveConnected field
- `frontend/src/context/AuthContext.tsx` - Added driveConnected convenience accessor and loginWithDrive function for Drive scope authorization
- `frontend/src/hooks/useDriveFilePicker.ts` - Custom hook wrapping react-google-drive-picker with backend token fetching and Shared Drives support
- `frontend/src/components/WorkflowWizard/DriveFilePicker.tsx` - Button component handling full picker flow with two loading states (picker opening, file parsing)
- `frontend/package.json` - Added react-google-drive-picker@1.2.2

## Decisions Made
- **Backward-compatible source field:** Made `source` optional in FileDefinition so existing code creating FileDefinition objects without it continues to work
- **Token fetch on-demand:** Token fetched each time picker opens (not cached in frontend) - backend handles caching and refresh automatically
- **No MIME type filtering:** Used `viewId: 'DOCS'` instead of `viewMimeTypes` to show all file types - lets user see all files, backend validates supported types on download
- **Shared Drives enabled:** Set `supportDrives: true` per SELECT-03 requirement from research phase
- **Column type defaulting:** Backend returns plain column name strings without types, so component defaults to 'text' type for all columns
- **Timestamp precedence:** Use `lastEditedUtc` from Picker when available (milliseconds since epoch), fall back to `file_metadata.modified_time` from backend if not present

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compilation and Vite build succeeded on first attempt. All imports resolved correctly, types aligned between backend and frontend as expected.

## User Setup Required

**External services require manual configuration.** This plan references env vars that will be documented in 04-USER-SETUP.md when created:
- `VITE_GOOGLE_CLIENT_ID` - OAuth client ID for Picker (same as backend GOOGLE_CLIENT_ID)
- `VITE_GOOGLE_API_KEY` - Browser API key for Google Picker API (requires HTTP referrer restrictions)

Dashboard configuration required:
- Enable Google Picker API in Google Cloud Console
- Create API key restricted to HTTP referrers and Google Picker API only

Note: USER-SETUP.md not generated in this plan (foundation only). Integration plan (04-02) will create comprehensive setup doc.

## Next Phase Readiness

**Ready for Plan 04-02 (Frontend Picker Integration):**
- All foundation pieces available: types, API functions, hook, component
- FileDefinition supports dual sources with backward compatibility
- DriveFilePicker can be imported into FilesStep
- Auth context exposes driveConnected for conditional UI rendering

**Next work:**
- Wire DriveFilePicker into existing FilesStep component
- Show Drive status and re-auth UI when driveConnected is false
- Handle Drive files in workflow run API calls
- Update FileCard to show Drive file metadata (modified time, Drive icon)

**No blockers.**

---
*Phase: 04-frontend-picker-ui*
*Completed: 2026-02-07*

## Self-Check: PASSED

All files and commits verified:
- frontend/src/hooks/useDriveFilePicker.ts ✓
- frontend/src/components/WorkflowWizard/DriveFilePicker.tsx ✓
- Commit ec5d463 ✓
- Commit 1cf32fd ✓
