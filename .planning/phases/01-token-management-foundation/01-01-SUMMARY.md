---
phase: 01-token-management-foundation
plan: 01
subsystem: database
tags: [sqlalchemy, fernet, cryptography, oauth, token-storage, encryption]

# Dependency graph
requires:
  - phase: none
    provides: base database infrastructure (UserDB, create_tables)
provides:
  - Token storage columns in UserDB (google_access_token, google_refresh_token, token_expiry, drive_scopes)
  - Fernet-based token encryption/decryption utilities
  - Database migration for adding token columns to existing users table
affects: [02-oauth-flow, 03-drive-picker, token-refresh, drive-operations]

# Tech tracking
tech-stack:
  added: [cryptography>=42.0.0]
  patterns: [Fernet symmetric encryption with PBKDF2 key derivation, idempotent SQLite migrations via PRAGMA table_info]

key-files:
  created: [backend/app/auth/encryption.py]
  modified: [backend/app/db/models.py, backend/app/db/database.py, backend/requirements.txt]

key-decisions:
  - "Use PBKDF2HMAC with 480000 iterations for key derivation (not raw secret as Fernet key)"
  - "Support TOKEN_ENCRYPTION_KEY env var with fallback to SESSION_SECRET_KEY for flexibility"
  - "Store scopes as space-separated string (not JSON array) for simplicity and OAuth compatibility"

patterns-established:
  - "Token encryption: encrypt before database write, decrypt after database read"
  - "Migration pattern: PRAGMA table_info + conditional ALTER TABLE for idempotency"
  - "Key derivation: PBKDF2HMAC with fixed salt for deterministic key generation from secret"

# Metrics
duration: 2min
completed: 2026-02-07
---

# Phase 01 Plan 01: Token Management Foundation Summary

**Extended UserDB with encrypted token storage columns (google_access_token, google_refresh_token, token_expiry, drive_scopes) and created Fernet-based encryption utilities with PBKDF2 key derivation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-07T09:00:33Z
- **Completed:** 2026-02-07T09:02:48Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended UserDB model with four token storage columns for OAuth token persistence
- Created encryption.py module with Fernet-based encrypt_token/decrypt_token functions using PBKDF2HMAC key derivation
- Added cryptography>=42.0.0 dependency to requirements.txt
- Extended database migration to add token columns to existing users table idempotently

## Task Commits

Each task was committed atomically:

1. **Task 1: Add token columns to UserDB and create encryption module** - `da44c45` (feat)
2. **Task 2: Extend database migration to add token columns to existing tables** - `51205e0` (feat)

## Files Created/Modified
- `backend/app/auth/encryption.py` - Fernet symmetric encryption utilities with PBKDF2 key derivation (480000 iterations, SHA256)
- `backend/app/db/models.py` - Extended UserDB with google_access_token, google_refresh_token, token_expiry, drive_scopes columns
- `backend/app/db/database.py` - Added migration logic to add token columns to existing users table
- `backend/requirements.txt` - Added cryptography>=42.0.0 dependency

## Decisions Made

**1. PBKDF2HMAC key derivation instead of raw secret**
- Rationale: Fernet requires 32-byte URL-safe base64 key. Using raw SESSION_SECRET_KEY directly would fail if secret isn't proper length/format. PBKDF2HMAC derives deterministic 32-byte key from any secret string.

**2. TOKEN_ENCRYPTION_KEY env var with SESSION_SECRET_KEY fallback**
- Rationale: Allows dedicated encryption key for better security isolation (token encryption decoupled from session signing) while maintaining backward compatibility during gradual rollout.

**3. Space-separated string for drive_scopes**
- Rationale: OAuth scope grants are space-separated strings. Storing in same format avoids JSON serialization overhead and matches OAuth library conventions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed as specified with verifications passing.

## User Setup Required

None - no external service configuration required.

Optional: Users can set `TOKEN_ENCRYPTION_KEY` environment variable for dedicated token encryption key (separate from SESSION_SECRET_KEY). If not set, system falls back to SESSION_SECRET_KEY automatically.

## Next Phase Readiness

**Ready for Phase 01 Plan 02 (OAuth Flow):**
- Token storage columns exist in database
- Encryption utilities available for protecting refresh tokens at rest
- Migration tested and idempotent (safe to deploy)

**No blockers.** Next phase can implement OAuth callback handling to populate these token columns.

---
*Phase: 01-token-management-foundation*
*Completed: 2026-02-07*

## Self-Check: PASSED

All files and commits verified:
- backend/app/auth/encryption.py: FOUND
- Commit da44c45: FOUND
- Commit 51205e0: FOUND
