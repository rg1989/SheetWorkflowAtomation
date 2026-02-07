---
phase: 01-token-management-foundation
plan: 02
subsystem: auth
tags: [oauth, google-api, token-refresh, drive-api, httpx, authlib]

# Dependency graph
requires:
  - phase: 01-01
    provides: Token storage columns, encryption utilities
provides:
  - Extended OAuth flow requesting Drive and Sheets scopes with offline access
  - Encrypted token storage on OAuth callback (access_token, refresh_token, expiry, scopes)
  - Automatic token refresh logic handling expiry, revocation, and encryption errors
  - Drive status API endpoint exposing scope connection state
  - driveConnected field in /auth/me endpoint
affects: [03-drive-picker, 04-drive-operations, drive-file-input]

# Tech tracking
tech-stack:
  added: [httpx (for token refresh HTTP requests)]
  patterns: [OAuth incremental authorization via scope query param, Automatic token refresh with 5-minute expiry buffer, HTTPException 401 with "drive_reconnect_required" detail for revoked tokens]

key-files:
  created: [backend/app/auth/token_refresh.py]
  modified: [backend/app/auth/router.py]

key-decisions:
  - "Use scope query parameter for incremental authorization (not separate endpoints) - simpler API surface"
  - "Store oauth_scope_mode in session during OAuth flow (not in database) - temporary state only"
  - "Use 5-minute token expiry buffer to prevent mid-request expiry"
  - "Return 401 with 'drive_reconnect_required' detail for all refresh failures - clear frontend signal"
  - "Preserve existing refresh_token when OAuth returns none - Google only returns refresh_token on consent"

patterns-established:
  - "OAuth flow pattern: /auth/login?scope=drive for incremental authorization"
  - "Token refresh pattern: get_valid_access_token() transparently handles expiry and refresh"
  - "Error signaling: HTTPException 401 with 'drive_reconnect_required' detail triggers frontend re-auth"
  - "Token storage: Never overwrite existing refresh_token if new one not present"

# Metrics
duration: 1min
completed: 2026-02-07
---

# Phase 01 Plan 02: OAuth Flow Integration Summary

**Extended OAuth flow to request Drive/Sheets scopes with offline access, store encrypted tokens on callback, and auto-refresh expired tokens via httpx with 5-minute buffer**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-07T10:15:35Z
- **Completed:** 2026-02-07T10:16:35Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- OAuth login flow now supports incremental authorization via `/auth/login?scope=drive` query parameter
- OAuth callback stores encrypted access_token, refresh_token, token_expiry, and drive_scopes in database
- Automatic token refresh module handles expired tokens transparently with Google's token endpoint
- Added `/auth/drive-status` endpoint to expose Drive connection state and granted scopes
- Extended `/auth/me` endpoint with `driveConnected` boolean field

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend OAuth flow with Drive scopes and token storage** - `8e8b9ae` (feat)
2. **Task 2: Implement automatic token refresh logic** - `53a563e` (feat)

## Files Created/Modified
- `backend/app/auth/router.py` - Extended login endpoint with scope parameter, callback stores encrypted tokens, added drive-status endpoint, added driveConnected to /auth/me
- `backend/app/auth/token_refresh.py` - Created get_valid_access_token() function with automatic refresh, 5-minute expiry buffer, and error handling for revoked tokens

## Decisions Made

**1. Use scope query parameter for incremental authorization**
- Rationale: Single `/auth/login?scope=drive` endpoint simpler than separate `/auth/login-drive` endpoint. Matches industry patterns (e.g., GitHub OAuth).

**2. Store oauth_scope_mode in session (not database)**
- Rationale: Temporary state during OAuth flow. No need to persist beyond callback. Session storage is appropriate for ephemeral data.

**3. 5-minute token expiry buffer**
- Rationale: Prevents mid-request expiry. Google access tokens last 1 hour. Refreshing 5 minutes early ensures Drive API calls never fail due to expiry race conditions.

**4. Return 401 with "drive_reconnect_required" detail**
- Rationale: Unified error signal for all refresh failures (revoked token, encryption key change, missing refresh token). Frontend can detect this specific detail and prompt re-authentication.

**5. Preserve existing refresh_token when OAuth returns none**
- Rationale: Google only returns refresh_token on first consent or when prompt=consent is used. Subsequent logins without prompt=consent don't return new refresh token. Must preserve existing one to avoid losing refresh capability.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed as specified with verifications passing.

## User Setup Required

None - no external service configuration required.

OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) already configured from previous phase. No additional setup needed.

## Next Phase Readiness

**Ready for Phase 02 (Google Drive Picker Integration):**
- OAuth flow supports Drive scopes
- Token storage and encryption working
- Token refresh logic handles expiry automatically
- Drive status API available for frontend detection

**No blockers.** Next phase can implement Drive Picker integration with confidence that token management is fully operational.

---
*Phase: 01-token-management-foundation*
*Completed: 2026-02-07*

## Self-Check: PASSED

All files and commits verified:
- backend/app/auth/token_refresh.py: FOUND
- Commit 8e8b9ae: FOUND
- Commit 53a563e: FOUND
