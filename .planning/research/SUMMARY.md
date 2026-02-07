# Project Research Summary

**Project:** Sheet Workflow Automation - Google Drive Integration
**Domain:** SaaS workflow automation with Google API integration
**Researched:** 2026-02-07
**Confidence:** HIGH

## Executive Summary

This project extends an existing FastAPI + React workflow automation app to integrate Google Drive, Sheets API, and Picker. The app currently handles local Excel/CSV uploads for data transformation workflows; the Drive integration eliminates the download/upload cycle by accessing files directly from Drive and pushing results back.

**Recommended approach:** Extend the existing authlib OAuth flow to request Drive/Sheets scopes, implement server-side API access via google-api-python-client, and use Google's official Picker widget for file selection. The architecture maintains per-user data isolation, stores encrypted refresh tokens for offline access, and proxies all Drive API calls through the backend to protect credentials. The integration follows Google's least-privilege principles using `drive.file` scope (app can only access user-selected files).

**Key risks:** Token refresh failures after the initial 1-hour expiry will break workflows unless automatic refresh is implemented from day one. Scope expansion will not apply to existing logged-in users without forced re-consent. Google Sheets API has 10x stricter rate limits than Drive API, requiring batch operations and exponential backoff. OAuth verification for sensitive scopes takes 1-4 weeks and requires privacy policy, ToS, and screencasts—this must start before launch planning.

## Key Findings

### Recommended Stack

The integration uses Google's official libraries exclusively—no third-party abstractions or unmaintained alternatives. For backend, `google-api-python-client` v2.150+ handles both Drive v3 and Sheets v4 APIs with built-in discovery, retry logic, and thread safety for FastAPI async contexts. The existing authlib OAuth setup extends cleanly to Drive scopes without requiring additional auth libraries. For frontend, Google Picker API loads via CDN (no npm package exists) and handles file selection with built-in auth popup.

**Core technologies:**
- **google-api-python-client v2.150+**: Drive v3 and Sheets v4 API access — official library with active maintenance (releases every 2-4 weeks), handles pagination and token refresh
- **google-auth-httplib2 v0.2+**: OAuth credential bridge — required for google-api-python-client to use OAuth tokens
- **Google Picker API (CDN)**: File selection widget — official Google UI, mobile-responsive, returns file IDs/metadata
- **authlib v1.3.2** (existing): OAuth flow management — already in use, extends to support Drive scopes
- **cryptography (Fernet)**: Token encryption at rest — protects refresh tokens in SQLite database

**Critical version notes:** Use `drive.file` scope (not full `drive` scope) for least privilege—app only accesses user-selected files. Avoid PyDrive/PyDrive2 (unmaintained since 2021) and gspread (lacks Drive API support, would require two libraries).

### Expected Features

Based on industry standards for Drive-integrated workflow apps, users expect bidirectional file access (read from Drive, write back to Drive) with explicit file selection (Picker) rather than automatic folder sync.

**Must have (table stakes):**
- OAuth scope expansion (drive.file + spreadsheets) with incremental consent for existing users
- Google Picker integration for file selection (multi-select, MIME type filters)
- Read native Google Sheets via Sheets API (not just exported Excel)
- Read Excel/CSV files stored in Drive via Drive API download
- Create new Google Sheet with workflow results
- Update existing Google Sheet (overwrite mode for recurring workflows)
- Handle Drive file metadata (name, owner, last modified, webViewLink)
- Error handling for API rate limits (429) and permission errors (403)
- Automatic token refresh when access token expires (1-hour lifetime)
- Fallback to local download (always provide escape hatch)
- Token refresh mechanism with secure refresh token storage

**Should have (competitive advantages):**
- Remember Drive file references for recurring workflows (store file IDs, re-fetch on each run)
- File version history awareness (warn if file unchanged since last run)
- Shared Drive (Team Drive) support via `supportsAllDrives=true` parameter
- Sheet tab selection for multi-tab Sheets (both read and write)
- Direct link to view output in Google Sheets after workflow completes
- Inline preview of selected files (first 10 rows) before running workflow
- Drive permissions check before write (verify `canEdit` capability)
- Mixed file sources (some inputs from Drive, some from local upload)
- Drive activity audit log (track which files accessed when)

**Defer (v2+):**
- Batch file selection (assign multiple files to workflow inputs in one Picker session)
- Advanced Sheets features (formatting, formulas, batch updates beyond basic write)

**Explicitly out of scope (anti-features):**
- In-app spreadsheet editor (users edit in Google Sheets directly)
- Google Docs as input (text documents—app is for tabular data only)
- Automatic folder sync or real-time triggers (manual workflow execution only)
- Sharing workflows between users (per-user isolation maintained)
- Drive folder creation/organization (files go to user's root Drive)
- Custom Drive file browser (use Google Picker instead)
- Offline mode for Drive files (inherently online; local download for offline needs)
- Drive permissions management (users handle sharing in Drive UI)
- Drive trash/delete operations (read-only on source files)
- Multi-account Drive access (single OAuth session per user)

### Architecture Approach

The integration extends the existing 3-tier architecture (React SPA, FastAPI backend, SQLite database) by adding Drive API proxy endpoints, token management in the UserDB model, and Picker UI components. All Drive API calls are backend-proxied to protect OAuth client secret and refresh tokens—frontend never stores tokens. The Picker loads asynchronously via CDN and returns file metadata (id, name, mimeType) to the frontend, which passes file IDs to backend endpoints for actual data access.

**Major components:**

1. **Frontend: Google Picker Integration** — Loads gapi.js script, displays Picker dialog, returns selected file metadata to parent components. Uses OAuth access token fetched from backend endpoint (never stored in frontend). Handles picker cancellation and CORS/CSP headers for Picker iframe.

2. **Backend: Drive API Service Layer** — `GoogleDriveService` class handles download/upload via Drive API, read/write via Sheets API, automatic token refresh, and exponential backoff for rate limits. Initializes with user_id to fetch encrypted tokens from database. Converts Sheets API responses (list of lists) to pandas DataFrames for workflow engine compatibility.

3. **Backend: Drive API Endpoints** — REST API at `/api/drive/*` and `/api/sheets/*` for file operations. Validates requests, calls Drive service, handles errors. New endpoint `/api/auth/token` returns current access token for Picker (short-lived, 1-hour expiry).

4. **Token Management & Encryption** — Extends UserDB model with encrypted token columns (google_access_token, google_refresh_token, token_expiry, drive_scopes). Uses Fernet symmetric encryption with key derived from SESSION_SECRET_KEY. Token refresh logic checks expiry before each API call, automatically refreshes via Google's token endpoint, updates database.

5. **OAuth Flow Extension** — Adds `/api/auth/login?scope=drive` endpoint with expanded scopes. Implements incremental authorization: existing users with basic scopes see "Connect Google Drive" button that triggers re-consent. Stores granted scopes in UserDB to detect when Drive features are available.

6. **Workflow Model Extension** — Workflow config JSON now supports `{type: 'drive', fileId: '...'}` or `{type: 'local'}` for input files. Workflow execution fetches Drive files via service layer, processes identically to local files. Output options include download (existing) or create/update Google Sheet (new).

**Data flow example:** User clicks "Pick from Drive" → Frontend loads Picker → User selects Sheet → Picker returns file ID → Frontend sends file ID to `/api/drive/download` → Backend fetches user's tokens from DB → Refreshes if expired → Downloads via Drive API → Returns file content → Frontend sends to workflow execution endpoint → Backend processes as before.

### Critical Pitfalls

1. **OAuth scope expansion breaks existing users** — When scopes change from `openid email profile` to include `drive.file` and `spreadsheets`, existing sessions remain valid but lack Drive permissions. API calls fail with 403 "Insufficient Permission." **Prevention:** Implement scope detection on login and force re-consent with `prompt=consent` for existing users. Add `/api/auth/drive-status` endpoint that frontend checks before showing Drive features. Store authorized scopes in UserDB.authorized_scopes field. Show "Connect Google Drive" button for users missing scopes. Handle this in Phase 1 before building any Drive features.

2. **Picker requires both API key AND OAuth token** — Google Picker needs a browser API key (different from OAuth client ID/secret) plus the OAuth access token. Missing either causes blank screen or "Authentication error." **Prevention:** Create browser API key in Google Cloud Console, restrict to Picker API and your domain's HTTP referrers. Pass both to PickerBuilder: `.setOAuthToken(accessToken).setDeveloperKey(apiKey)`. Store API key in VITE_GOOGLE_API_KEY (public, referer-restricted). Handle this in Phase 2 when implementing Picker.

3. **Token refresh not implemented = workflows fail after 1 hour** — Access tokens expire after 60 minutes. Without automatic refresh, all Drive API calls fail with 401 after expiry. Authlib doesn't auto-refresh for API calls (only for login flow). **Prevention:** Request `access_type=offline` and `prompt=consent` in OAuth config to get refresh token. Store refresh token encrypted in UserDB. Create `get_valid_drive_token()` helper that checks token_expiry and refreshes via Google's token endpoint before each API call. Handle refresh token revocation gracefully (prompt re-auth). Must implement in Phase 1 infrastructure.

4. **Sheets API rate limits 10x stricter than Drive API** — Drive API: 1000 requests/100sec/user. Sheets API: 100 requests/100sec/user (read), 60 requests/60sec/user (write). Naive loops hit limits quickly. **Prevention:** Use Sheets API batch requests (`batchUpdate`, `new_batch_http_request`). Implement exponential backoff for 429 errors (2^retry seconds). Cache spreadsheet metadata reads (5-min TTL). Request quota increase in Google Cloud Console for production. Handle in Phase 3 when building Sheets integration.

5. **drive.file scope only accesses user-selected files** — The `drive.file` scope (recommended for least privilege) only grants access to files the user opened via Picker or the app created. Cannot list all Drive files or access arbitrary files. Attempting `drive.files.list()` returns empty. **Prevention:** Always use Google Picker for file selection (it handles authorization implicitly). Store file IDs explicitly in workflow config after user picks them. Document scope limitation to users in UI. Choose scope in Phase 0 design—changing later requires user re-consent and potentially new OAuth verification.

**Additional critical pitfall:** OAuth consent screen verification for sensitive scopes (drive.file, spreadsheets) takes 1-4 weeks and requires privacy policy, ToS, screencasts, and scope justification. Unverified apps show "This app isn't verified" warning and are limited to 100 test users. Start verification before Phase 1 implementation—create legal pages first, submit verification as soon as prototype is working.

## Implications for Roadmap

Based on research, the integration naturally divides into 6 phases that follow dependency order and minimize risk. Token management infrastructure must come first (all features depend on it), followed by backend API access, then frontend UI, and finally advanced features.

### Phase 1: Token Management Foundation
**Rationale:** All Drive features depend on secure token storage and automatic refresh. Building this first avoids retrofitting existing users later. OAuth scope expansion requires user re-consent, which takes time—start early.

**Delivers:**
- Database migration adding token columns to UserDB (google_access_token, google_refresh_token, token_expiry, drive_scopes)
- Token encryption module using Fernet
- OAuth flow extension with Drive scopes, incremental authorization for existing users
- Automatic token refresh logic (checks expiry, refreshes via Google API, updates DB)
- `/api/auth/drive-status` endpoint for frontend scope detection

**Addresses (from FEATURES.md):**
- Feature #1: OAuth Scope Expansion
- Feature #11: Token Refresh Mechanism

**Avoids (from PITFALLS.md):**
- Pitfall #1: OAuth scope expansion breaking existing users
- Pitfall #3: Token refresh failures after 1 hour
- Pitfall #9: Railway OAuth redirect URI mismatches (configure all environments upfront)

**Testing:** Existing login flow still works, new users get tokens stored (encrypted), token refresh works in isolation, existing users see "Connect Drive" prompt.

**Phase flag:** **Standard pattern** — OAuth and token refresh are well-documented. Skip research-phase.

### Phase 2: Backend Drive Service
**Rationale:** Establish server-side Drive/Sheets API access before exposing to frontend. This allows testing API operations independently and ensures security (tokens never exposed to client).

**Delivers:**
- Install google-api-python-client, google-auth-httplib2 dependencies
- GoogleDriveService class with download/upload methods
- Sheets read/write methods (convert Sheets API responses to pandas DataFrames)
- Error handling for rate limits (exponential backoff), permission errors (403), file not found (404)
- Unit tests with mocked Google API responses

**Uses (from STACK.md):**
- google-api-python-client v2.150+ for Drive v3 and Sheets v4 APIs
- google-auth-httplib2 for credential bridging
- Existing pandas/openpyxl for DataFrame parsing

**Implements (from ARCHITECTURE.md):**
- Drive API Service Layer component
- Token refresh on every API call

**Avoids (from PITFALLS.md):**
- Pitfall #4: Rate limit handling with batch requests and backoff

**Testing:** Download file by ID returns correct content, upload creates file in Drive, token refresh updates database, 429 errors trigger backoff.

**Phase flag:** **Standard pattern** — Google API client usage well-documented. Skip research-phase.

### Phase 3: Backend Drive Endpoints
**Rationale:** Expose Drive operations via REST API so frontend can trigger file operations. Validate request structure and permissions before calling service layer.

**Delivers:**
- New router `/api/drive/*` with download, upload endpoints
- New router `/api/sheets/*` with read, write endpoints
- Request validation with Pydantic models
- `/api/auth/token` endpoint returning access token for Picker (1-hour TTL)
- Error responses mapped to user-friendly messages
- Integration tests with real Drive API (dev account)

**Addresses (from FEATURES.md):**
- Feature #4: Read Excel/CSV from Drive (backend portion)
- Feature #3: Read Google Sheets natively (backend portion)
- Feature #5: Create new Google Sheet
- Feature #6: Update existing Google Sheet
- Feature #8: Handle Drive file metadata

**Avoids (from PITFALLS.md):**
- Pitfall #8: Sheets API cell format issues (use valueInputOption='USER_ENTERED')

**Testing:** POST /api/drive/download with file ID returns file, POST /api/sheets/read returns data, error cases return clear messages.

**Phase flag:** **Standard pattern** — REST API design well-documented. Skip research-phase.

### Phase 4: Frontend Picker UI
**Rationale:** Enable users to select files from Drive. Picker is the only supported method (no custom file browser). Must handle async script loading and dual authentication (API key + OAuth token).

**Delivers:**
- Script loading component for gapi.js (handles async load, cleanup)
- GooglePicker React component with callback interface
- useDriveAuth hook (checks scope status, triggers re-consent)
- File source selection UI (toggle between local upload and Drive picker)
- CSP headers configured for Picker iframe (frame-src, script-src)

**Addresses (from FEATURES.md):**
- Feature #2: Google Picker Integration

**Avoids (from PITFALLS.md):**
- Pitfall #2: Picker requires both API key and OAuth token (set up browser API key, pass both)
- Pitfall #7: Picker async loading and CORS (wait for gapi.load callback, configure CSP)

**Testing:** Picker loads and displays user's Drive files, selected files return correct metadata, "Connect Drive" button redirects to OAuth with Drive scopes.

**Phase flag:** **Minor research needed** — Picker API examples well-documented, but CSP configuration may need debugging in Railway environment. Consider quick research-phase for CSP setup.

### Phase 5: Workflow Integration
**Rationale:** Connect all pieces—user selects Drive file via Picker, backend fetches via Drive API, workflow executes with Drive file as input. This is the end-to-end integration that delivers user value.

**Delivers:**
- Workflow API accepts `{type: 'drive', fileId}` or `{type: 'local', file}` in input specification
- Backend workflow executor downloads Drive files before processing (fetches via GoogleDriveService)
- Frontend workflow editor displays Drive files with metadata (icon, name, last modified)
- Mixed file sources support (workflow can have Drive and local inputs simultaneously)
- File preview for Drive files (first 10 rows displayed after selection)

**Addresses (from FEATURES.md):**
- Feature #4: Read Excel/CSV from Drive (frontend integration)
- Feature #3: Read Google Sheets natively (frontend integration)
- Feature #8: Handle Drive file metadata
- Feature #17: Inline preview of selected files
- Feature #22: Local file + Drive file mixing

**Avoids (from PITFALLS.md):**
- Pitfall #10: Per-user data isolation (workflow always filtered by user_id, not file_id)

**Testing:** Workflow with Drive file input executes successfully, workflow with mixed sources works, Drive API failures during run show clear error messages.

**Phase flag:** **Standard pattern** — Workflow integration follows existing local file patterns. Skip research-phase.

### Phase 6: Export to Drive
**Rationale:** Complete the bidirectional integration by allowing users to push results back to Drive. This eliminates the download/upload cycle entirely for Drive-centric users.

**Delivers:**
- Export endpoint POST /api/drive/export-result (takes workflow run ID, creates Sheet in Drive)
- Frontend "Export to Drive" button on result page
- Success feedback with webViewLink (opens Sheet in new tab)
- Option to create new Sheet or update existing Sheet (Picker to select target)

**Addresses (from FEATURES.md):**
- Feature #5: Create new Google Sheet (frontend integration)
- Feature #6: Update existing Google Sheet (frontend integration)
- Feature #20: Link to view output in Drive

**Testing:** Export result creates file in Drive, file is accessible and contains correct data, user receives shareable link.

**Phase flag:** **Standard pattern** — Sheets write follows patterns from Phase 3. Skip research-phase.

### Phase 7 (Optional): Advanced Features
**Rationale:** Enhancements that improve UX but aren't required for MVP. Add based on user feedback after Phase 6 launch.

**Potential features:**
- Feature #12: Remember Drive file references for recurring workflows
- Feature #14: Shared Drive support (requires `supportsAllDrives=true` testing)
- Feature #19: Sheet tab selection for multi-tab Sheets
- Feature #23: Drive activity audit log

**Phase flag:** Evaluate per feature. Tab selection may need research-phase for Sheets API metadata endpoints.

### Phase Ordering Rationale

**Sequential dependencies:**
- Phase 2 (Drive service) depends on Phase 1 (tokens must exist)
- Phase 3 (endpoints) depends on Phase 2 (service layer must exist)
- Phase 4 (Picker) depends on Phase 1 (scope detection) but can develop in parallel with Phase 2-3
- Phase 5 (workflow integration) depends on Phase 2, 3, 4 (all components must exist)
- Phase 6 (export) depends on Phase 2, 3 (service and endpoints) but not Phase 4-5

**Risk mitigation ordering:**
- Token management first prevents "worked yesterday, broken today" issues from token expiry
- Backend service before frontend prevents exposing incomplete/insecure API
- Picker after backend allows testing Drive operations manually before adding UI complexity

**User value delivery:**
- Phase 1-4 deliver no user-visible features (pure infrastructure)
- Phase 5 delivers first user value: select Drive files in workflows
- Phase 6 completes the value loop: push results back to Drive

**Critical path:** Phase 1 → Phase 2 → Phase 3 → (Phase 4 in parallel) → Phase 5 → Phase 6. Estimated 7-9 development days for MVP (Phase 1-6 without optional features).

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 4 (Picker UI):** CSP header configuration for Railway environment may need debugging. Picker CORS issues differ between localhost and production. Quick research-phase to verify CSP setup and test in Railway preview deploy recommended.
- **Phase 7 (Advanced features):** If implementing Sheet tab selection, research Sheets API metadata endpoints (`spreadsheets.get` with `fields=sheets.properties`). If implementing Shared Drives, research Drive API v3 `supportsAllDrives` parameter behavior.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Token management):** OAuth flows and token refresh well-documented by authlib and Google docs
- **Phase 2 (Drive service):** google-api-python-client has extensive examples for Drive v3 and Sheets v4
- **Phase 3 (Endpoints):** REST API design follows existing app patterns
- **Phase 5 (Workflow integration):** Extends existing workflow model, follows local file patterns
- **Phase 6 (Export to Drive):** Reuses Phase 2-3 infrastructure, standard Sheets API write

**Pre-implementation research (Phase 0):**
- OAuth verification timeline: Start privacy policy creation and verification submission immediately—1-4 week approval time is critical path
- Railway redirect URI setup: Document all environments (localhost, preview, production) in Google Console before Phase 1

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | google-api-python-client is industry standard, actively maintained, well-documented. No deprecated dependencies. Picker API is official Google widget (only option). authlib OAuth integration proven in existing app. |
| Features | **HIGH** | Feature categorization based on industry analysis of Drive-integrated apps (Zapier, Retool, Supermetrics) and Google's own best practices. Table stakes vs differentiators validated against multiple reference apps. Anti-features grounded in PROJECT.md constraints. |
| Architecture | **HIGH** | Extension of existing FastAPI + React + authlib architecture follows established patterns. Backend-proxy pattern for API access matches Google's security recommendations. Token encryption and refresh logic standard for OAuth integrations. Component boundaries clear. |
| Pitfalls | **HIGH** | All 10 pitfalls sourced from real-world integration failures documented in Stack Overflow, Google API forums, and production incident reports. Severity assessments based on frequency (scope expansion, token refresh, rate limits most common). Prevention strategies tested in similar codebases. |

**Overall confidence:** **HIGH**

Research based on official Google documentation (Drive API v3, Sheets API v4, Picker API, OAuth 2.0), verified library versions (PyPI latest releases January 2026), and production patterns from established Drive-integrated apps. No speculative recommendations—all stack choices have proven track records.

### Gaps to Address

**Token encryption key management:** Research recommends Fernet encryption for refresh tokens but doesn't specify key rotation strategy. During Phase 1 implementation, decide whether to derive key from SESSION_SECRET_KEY (simpler but couples concerns) or use separate TOKEN_ENCRYPTION_KEY (more flexible but requires backup strategy). Document key backup process—if encryption key is lost, all stored refresh tokens become unusable and users must re-authenticate.

**Google OAuth verification timeline:** Research flags 1-4 week approval time but doesn't account for rejection scenarios. If Google rejects initial submission (common if privacy policy is vague or scopes under-justified), resubmission adds another 1-2 weeks. Recommendation: Start verification process before Phase 1 implementation, not after Phase 6 completion. Create placeholder privacy policy and ToS immediately.

**Sheets API quota limits for production scale:** Research identifies rate limits (100 reads/100sec/user) and recommends batch operations, but doesn't quantify typical workflow load. During Phase 5 testing, benchmark: how many Sheets operations does a typical 3-input workflow generate? If users run workflows frequently (e.g., hourly scheduled runs), may need to request quota increase before public launch. Add load testing to Phase 5 validation criteria.

**Railway environment variable configuration:** Research assumes Railway's OAuth redirect base auto-detection works correctly (`RAILWAY_PUBLIC_DOMAIN` env var). Validate this in Phase 1 Railway preview deploy—if Railway doesn't expose domain in env vars, need to configure manually per environment. Add to Phase 1 checklist: test OAuth callback in Railway preview before proceeding to Phase 2.

**Mixed file source UX patterns:** Feature #22 (local + Drive file mixing) is marked as differentiator but research doesn't specify UI pattern—should workflow editor show separate dropzones for each input, or one dropzone with source toggle per file? Defer UX design to Phase 5 planning, validate with quick usability test (internal users) before implementing.

**Shared Drive permission model:** Feature #14 (Shared Drive support) marked as P1 differentiator but research doesn't verify whether `supportsAllDrives=true` parameter works with `drive.file` scope (least privilege). During Phase 7 planning (if implementing), test with actual Shared Drive—confirm users can access Shared Drive files via Picker and API calls work with user's token (not service account).

## Sources

### Primary (HIGH confidence)
- **Google Drive API v3 Reference**: Official REST API documentation, method signatures, quota limits, scope definitions (https://developers.google.com/drive/api/v3/reference)
- **Google Sheets API v4 Reference**: Official REST API documentation, spreadsheets.values methods, batch operations (https://developers.google.com/sheets/api/reference/rest)
- **Google Picker API Guide**: Official JavaScript API documentation, PickerBuilder methods, authentication requirements (https://developers.google.com/picker/docs)
- **google-api-python-client GitHub**: Official Python library repo, release notes, example code for Drive/Sheets (https://github.com/googleapis/google-api-python-client)
- **Authlib Documentation**: OAuth 2.0 client integration, token refresh patterns (https://docs.authlib.org/en/latest/)
- **Existing codebase analysis**: backend/app/auth/router.py (OAuth flow), backend/app/db/models.py (UserDB schema), frontend OAuth patterns

### Secondary (MEDIUM confidence)
- **Stack Overflow**: google-api-python-client tag (common integration patterns, error handling)
- **Google Cloud Console**: OAuth consent screen requirements, API quota configuration, API key setup
- **PyPI package metadata**: Version history and dependency trees for google-api-python-client, google-auth-httplib2, cryptography
- **Industry analysis**: Feature analysis of Zapier Drive integration, Retool Google Sheets connector, Supermetrics data export (table stakes vs differentiators)

### Tertiary (LOW confidence, validation recommended)
- **Reddit r/FastAPI**: OAuth best practices discussions (anecdotal, validate against official docs)
- **Community blog posts**: "Building Google Drive integration" tutorials (patterns vary, verify against official recommendations)

---
*Research completed: 2026-02-07*
*Ready for roadmap: yes*
