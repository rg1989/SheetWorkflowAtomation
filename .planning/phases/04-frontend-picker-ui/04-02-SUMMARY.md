---
phase: 04-frontend-picker-ui
plan: 02
subsystem: ui
tags: [react, typescript, google-picker, google-drive, oauth, file-upload, dual-source]

# Dependency graph
requires:
  - phase: 04-01
    provides: DriveFilePicker component, useDriveFilePicker hook, extended FileDefinition type
  - phase: 03-backend-drive-endpoints
    provides: /api/drive/download endpoint with file parsing
  - phase: 01-token-management-foundation
    provides: OAuth scope management and incremental authorization
provides:
  - WorkflowWizard handleAddDriveFile callback for Drive file additions
  - FilesStep dual-source UI (local upload + Drive picker) with responsive grid layout
  - Connect Google Drive button for users without Drive scopes
  - Drive reconnect UI for scope updates
  - Backend disconnect-drive endpoint for re-authorization
affects: [05-workflow-run-integration, frontend-workflows, drive-file-handling]

# Tech tracking
tech-stack:
  added: []
  patterns: [Dual-source file input pattern, Auth gate UI pattern, Scope update flow with disconnect/reconnect]

key-files:
  created: []
  modified:
    - frontend/src/components/WorkflowWizard/WorkflowWizard.tsx
    - frontend/src/components/WorkflowWizard/steps/FilesStep.tsx
    - frontend/src/lib/api.ts
    - backend/app/auth/router.py
    - backend/app/services/drive.py
    - backend/app/api/drive.py

key-decisions:
  - "Use drive.readonly scope (not drive.file) to allow access to all user-selected Drive files"
  - "Add disconnect-drive endpoint for scope updates without full logout"
  - "Show reconnect banner when legacy drive.file scope detected"
  - "Grid layout with two equal columns for local and Drive options side by side"
  - "Preserve all existing drag-and-drop handlers for local file uploads"

patterns-established:
  - "Auth gate pattern: Show 'Connect [Service]' button when service not connected, redirect to OAuth with specific scope"
  - "Dual-source input pattern: Side-by-side options with consistent visual weight"
  - "Scope update pattern: Detect insufficient scope → show banner → disconnect → re-authenticate → verify"

# Metrics
duration: 50min
completed: 2026-02-07
---

# Phase 4 Plan 2: FilesStep Drive Integration Summary

**Dual-source file input with Google Picker, OAuth scope fix (drive.readonly), and reconnect UI for seamless scope updates**

## Performance

- **Duration:** 50 min
- **Started:** 2026-02-07T14:01:18+0200
- **Completed:** 2026-02-07T14:50:56+0200
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 6

## Accomplishments
- Integrated Google Drive Picker into workflow wizard FilesStep with dual-source UI
- User can select Drive files alongside local uploads in the same workflow
- Fixed OAuth scope issue: changed from drive.file to drive.readonly for full Drive file access
- Built reconnect UI for users to update OAuth scopes without confusion
- Added disconnect-drive endpoint for re-authorization without logging out
- Successfully verified end-to-end: user selected Drive file, backend parsed it, file appeared as card with columns and preview

## Task Commits

Each task was committed atomically:

1. **Task 1: Add handleAddDriveFile callback** - `469000b` (feat)
2. **Task 2: Integrate Drive picker into FilesStep with dual-source input** - `aae5047` (feat)
3. **Task 3: Human verification checkpoint** - APPROVED by user

**Bug fixes during checkpoint:**

4. **Fix OAuth scope issue** - `3fae07d` (fix)
5. **Add scope debugging and error messages** - `c1db898` (fix)
6. **Add disconnect-drive endpoint** - `e5bc774` (feat)
7. **Add Drive reconnect UI** - `b73b383` (feat)

## Files Created/Modified
- `frontend/src/components/WorkflowWizard/WorkflowWizard.tsx` - Added handleAddDriveFile callback that creates FileDefinition with source: 'drive' and Drive metadata
- `frontend/src/components/WorkflowWizard/steps/FilesStep.tsx` - Integrated DriveFilePicker into dual-source grid layout; added Connect Google Drive button for auth gate; added reconnect banner for scope updates
- `frontend/src/lib/api.ts` - Added driveApi.disconnectDrive and driveApi.getDriveStatus functions
- `backend/app/auth/router.py` - Changed scope from drive.file to drive.readonly; updated scope checks to accept both for backward compatibility; added /disconnect-drive and /drive-status endpoints
- `backend/app/services/drive.py` - Added scope logging and insufficientPermissions error detection with reconnect guidance
- `backend/app/api/drive.py` - Added user scope logging for debugging file access issues

## Decisions Made
- **Use drive.readonly scope instead of drive.file:** Google Picker shows all Drive files, but drive.file scope only grants access to files created by the app. Switching to drive.readonly (read-only access to all Drive files) aligns with the app's purpose of reading user-selected spreadsheets
- **Backward compatibility for scope checks:** Updated /me and /drive-status endpoints to accept both drive.file (legacy) and drive.readonly (new) so existing users aren't blocked
- **Disconnect endpoint for scope updates:** Users can disconnect and reconnect Drive to get new scopes without logging out completely
- **Reconnect UI with banner:** Show clear warning when user has legacy drive.file scope, with one-click reconnect button
- **Grid layout for dual-source input:** Side-by-side columns (local upload + Drive picker) with equal visual weight on md+ screens, stacked on mobile

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] OAuth scope insufficient for user-selected Drive files**
- **Found during:** Task 3 (Human verification checkpoint)
- **Issue:** Plan specified drive.file scope, but this only grants access to files created by the app or explicitly opened through the File Picker API. Google Picker shows all Drive files, but when user selected a file, backend returned 404 'File not found' because access token lacked permission for user's existing files.
- **Fix:** Changed OAuth scope from drive.file to drive.readonly to grant read-only access to all of the user's Drive files after consent. Updated scope checks in /me and /drive-status endpoints to accept both drive.file (legacy) and drive.readonly (new) for backward compatibility.
- **Files modified:** backend/app/auth/router.py
- **Verification:** User selected Drive file "LEAD SCRAPER" from Picker, backend successfully downloaded and parsed it, returned 7 columns and sample data
- **Committed in:** `3fae07d`

**2. [Rule 2 - Missing Critical] Scope debugging and error messages for access issues**
- **Found during:** Task 3 (Human verification checkpoint)
- **Issue:** When file access failed, error message was generic "File not found". No visibility into which scope user had or why access was denied. Users would be confused about what went wrong.
- **Fix:** Added logging to show user's current Drive scopes during file download. Detect insufficientPermissions errors and suggest reconnecting. Add needsReconnect flag to /auth/drive-status endpoint. Provide clear guidance when legacy drive.file scope blocks access.
- **Files modified:** backend/app/services/drive.py, backend/app/auth/router.py, backend/app/api/drive.py
- **Verification:** Error messages now show specific scope issue and suggest reconnecting to fix
- **Committed in:** `c1db898`

**3. [Rule 2 - Missing Critical] Disconnect-drive endpoint for scope updates**
- **Found during:** Task 3 (Human verification checkpoint)
- **Issue:** Users with legacy drive.file scope needed to update to drive.readonly, but plan didn't include a way to disconnect Drive without logging out completely. Logging out loses all workflow data and forces full re-authentication.
- **Fix:** Added /auth/disconnect-drive endpoint that removes Drive-related fields from user record (oauth_access_token, oauth_refresh_token, oauth_token_expiry, oauth_scopes) without affecting email/password authentication. Users can disconnect and reconnect to get updated scopes.
- **Files modified:** backend/app/auth/router.py
- **Verification:** Endpoint tested, successfully clears Drive tokens while preserving login session
- **Committed in:** `e5bc774`

**4. [Rule 2 - Missing Critical] Drive reconnect UI for scope updates**
- **Found during:** Task 3 (Human verification checkpoint)
- **Issue:** Users with legacy drive.file scope had no UI guidance for updating to drive.readonly. They would see file access errors without understanding how to fix them.
- **Fix:** Added Drive status check on FilesStep mount. Show reconnect banner when needsReconnect flag is true. Banner displays warning that user has legacy scope and provides one-click "Reconnect Google Drive" button that calls disconnect endpoint then re-authenticates with new scope.
- **Files modified:** frontend/src/components/WorkflowWizard/steps/FilesStep.tsx, frontend/src/lib/api.ts
- **Verification:** Banner renders correctly, reconnect button works, user successfully updated to drive.readonly scope
- **Committed in:** `b73b383`

---

**Total deviations:** 4 auto-fixed (1 bug, 3 missing critical)
**Impact on plan:** All auto-fixes necessary for correct Drive file access and good UX during scope migration. No scope creep - addressing real issues discovered during verification.

## Issues Encountered

**OAuth scope mismatch between Picker and API access:**
- Google Picker shows all Drive files by default (user can see and select any file)
- drive.file scope only grants access to files created by app or explicitly opened through File Picker API
- User-selected file from Picker resulted in 404 because scope was insufficient
- Resolved by switching to drive.readonly which grants read-only access to all Drive files after user consent
- This aligns with app's purpose: reading spreadsheets that users explicitly select

**Scope migration challenge:**
- Existing users had drive.file scope from Phase 1-3
- Needed smooth path to update scope without losing data or causing confusion
- Built disconnect/reconnect flow with clear UI guidance
- Backward compatibility ensures existing drive.file users can still use app while we encourage migration

## User Setup Required

**External services require manual configuration.** See [04-USER-SETUP.md](./04-USER-SETUP.md) for:
- Environment variables to add (VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_API_KEY)
- Google Cloud Console configuration (OAuth consent screen, Picker API)
- Verification commands

Note: 04-USER-SETUP.md should be created by orchestrator or in Phase 4 completion if not already exists.

## Next Phase Readiness

**Ready for Phase 5 (Workflow Run Integration):**
- Dual-source file input complete and verified
- Drive files selectable and parsed correctly
- OAuth scope issue resolved (drive.readonly)
- Reconnect flow built for scope updates
- FileDefinition.source field distinguishes Drive vs local files
- Backend can download and parse Drive files on demand

**Next work:**
- Update workflow run submission to handle Drive files
- Pass driveFileId to backend during run creation
- Backend fetches Drive file content during run execution
- Sheet selection for Drive files (currently defaults to first sheet)
- Drive file refresh/re-parse when modified in Drive

**No blockers.** OAuth scope issue fully resolved, end-to-end flow verified by user.

---
*Phase: 04-frontend-picker-ui*
*Completed: 2026-02-07*

## Self-Check: PASSED

All files and commits verified:
- frontend/src/components/WorkflowWizard/WorkflowWizard.tsx ✓
- frontend/src/components/WorkflowWizard/steps/FilesStep.tsx ✓
- frontend/src/lib/api.ts ✓
- backend/app/auth/router.py ✓
- backend/app/services/drive.py ✓
- backend/app/api/drive.py ✓
- Commit 469000b ✓
- Commit aae5047 ✓
- Commit 3fae07d ✓
- Commit c1db898 ✓
- Commit e5bc774 ✓
- Commit b73b383 ✓
