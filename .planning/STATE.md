# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-07)

**Core value:** Users can connect their Google Drive and seamlessly use Drive files as workflow inputs and push results back — eliminating the download/upload cycle entirely.
**Current focus:** Phase 2 in progress — Backend Drive Service (service layer foundation)

## Current Position

Phase: 2 of 6 (Backend Drive Service)
Plan: 02 of 2 in phase
Status: Phase complete
Last activity: 2026-02-07 — Completed 02-02-PLAN.md (Native Sheets API read)

Progress: [███░░░░░░░] 33%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 2 min
- Total execution time: 0.13 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-token-management-foundation | 2/2 | 3 min | 1.5 min |
| 02-backend-drive-service | 2/2 | 5 min | 2.5 min |

**Recent Trend:**
- 01-01: 2 min (Token storage and encryption)
- 01-02: 1 min (OAuth flow integration)
- 02-01: 3 min (Drive service foundation)
- 02-02: 2 min (Native Sheets API read)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Use Google Picker (not custom file browser) for familiar UX and less code to maintain
- Expand existing OAuth scopes (not separate Drive auth) for single auth flow simplicity
- Use drive.file scope (not full drive access) following principle of least privilege
- Remember Drive refs as optional per-workflow checkbox for flexible use cases
- Use PBKDF2HMAC with 480000 iterations for key derivation (not raw secret as Fernet key) - 01-01
- Support TOKEN_ENCRYPTION_KEY env var with fallback to SESSION_SECRET_KEY for flexibility - 01-01
- Store scopes as space-separated string (not JSON array) for simplicity and OAuth compatibility - 01-01
- Use scope query parameter for incremental authorization (not separate endpoints) - simpler API surface - 01-02
- Store oauth_scope_mode in session during OAuth flow (not in database) - temporary state only - 01-02
- Use 5-minute token expiry buffer to prevent mid-request expiry - 01-02
- Return 401 with 'drive_reconnect_required' detail for all refresh failures - clear frontend signal - 01-02
- Preserve existing refresh_token when OAuth returns none - Google only returns refresh_token on consent - 01-02
- Use asyncio.to_thread() to wrap Google API blocking calls for FastAPI compatibility - 02-01
- Apply @drive_retry decorator with 5 attempts, 2-60s exponential backoff for 429/5xx - 02-01
- Map 403 -> permission denied, 404 -> not found, 429 -> rate limit for clear UX - 02-01
- Strip column names whitespace to match existing ExcelParser behavior - 02-01
- Reuse drive_retry decorator and _handle_drive_error from drive.py for consistency - 02-02
- Pad ragged rows with None to prevent DataFrame construction errors - 02-02
- Default to first sheet tab when range_name not specified - 02-02
- Add sheets_service as optional parameter to download_drive_file_to_df for backward compatibility - 02-02
- Keep _export_google_sheet_to_df as fallback when Sheets service not available - 02-02

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 1 considerations:**
- ~~Token encryption key management: Need to decide if deriving key from SESSION_SECRET_KEY or using separate TOKEN_ENCRYPTION_KEY (research flags this but doesn't specify strategy)~~ **RESOLVED** - Implemented both: TOKEN_ENCRYPTION_KEY env var with SESSION_SECRET_KEY fallback using PBKDF2HMAC
- Railway OAuth redirect URI: Must validate that RAILWAY_PUBLIC_DOMAIN env var exposes domain correctly for OAuth callbacks
- OAuth verification timeline: Google approval for sensitive scopes takes 1-4 weeks—should start privacy policy creation before Phase 1 completion

## Session Continuity

Last session: 2026-02-07 10:49:32 UTC
Stopped at: Completed 02-02-PLAN.md (Native Sheets API read) - Phase 2 complete
Resume file: None
Next: Phase 3 (Frontend File Picker) when ready
