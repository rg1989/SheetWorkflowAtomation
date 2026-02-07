# Google Drive/Sheets Integration — Features Research

**Research Date:** 2026-02-07
**Project:** Sheet Workflow Automation
**Milestone:** Google Drive integration for seamless file access and push-back

## Executive Summary

This document categorizes features for Google Drive/Sheets integration into three tiers:
- **Table Stakes**: Essential features required for a usable Drive integration (must-have)
- **Differentiators**: Features that enhance UX or provide competitive advantage (nice-to-have)
- **Anti-Features**: Capabilities to deliberately NOT build (out of scope)

Analysis is based on existing app architecture (FastAPI + React, Google OAuth, Excel workflow engine) and industry standards for Drive-integrated web apps.

---

## Table Stakes Features

These features are essential for a minimally viable Google Drive integration. Users expect these capabilities from any app that claims "Google Drive integration."

### 1. OAuth Scope Expansion
**What:** Extend existing Google OAuth to include Drive and Sheets API access
**Why:** Required to read/write files; users already authenticate via Google
**Complexity:** Low (modify existing authlib config)
**Dependencies:** None
**Implementation Notes:**
- Expand scopes in `backend/app/auth/router.py` OAuth registration:
  - `https://www.googleapis.com/auth/drive.file` (access to user-selected files only)
  - `https://www.googleapis.com/auth/spreadsheets` (read/write Google Sheets)
- Store OAuth tokens with refresh token in session or database
- Handle token refresh automatically (authlib supports this)

**Industry Standard:** All Drive-integrated apps request these scopes at login or just-in-time.

---

### 2. Google Picker Integration
**What:** Popup UI for browsing and selecting files from Google Drive
**Why:** Familiar UX; avoids building custom file browser; handles auth automatically
**Complexity:** Medium (frontend integration + backend token handling)
**Dependencies:** Feature #1 (OAuth scopes)
**Implementation Notes:**
- Load Google Picker API in React frontend
- Use OAuth access token from backend to initialize Picker
- Filter file types: Google Sheets, Excel (.xlsx), CSV
- Support multi-select for workflows with multiple input files
- Return file ID + metadata (name, mimeType, webViewLink) to workflow config

**Industry Standard:** Google Picker is the de facto UI for Drive file selection in web apps (Slack, Asana, Notion all use it).

---

### 3. Read Google Sheets Natively
**What:** Fetch and parse Google Sheets directly via Sheets API
**Why:** Users store data in native Sheets; converting to Excel first is friction
**Complexity:** Medium (API client + conversion to pandas DataFrame)
**Dependencies:** Feature #1 (OAuth scopes), Feature #2 (Picker returns Sheet file IDs)
**Implementation Notes:**
- Use Google Sheets API v4 to read sheet values
- Endpoint: `spreadsheets.values.get` (range: e.g., "Sheet1!A1:Z1000")
- Convert API response (list of lists) to pandas DataFrame
- Handle multiple sheets: let user select which sheet to use (similar to Excel multi-sheet support)
- Infer column types same as current `ExcelParser.parse()`

**Industry Standard:** Apps reading Sheets always support native format (not just exports).

---

### 4. Read Excel/CSV from Drive
**What:** Download Excel (.xlsx) and CSV files from Drive, parse with existing logic
**Why:** Users store non-Sheet files in Drive; workflows should support them
**Complexity:** Low (Drive API download + reuse existing parser)
**Dependencies:** Feature #1 (OAuth scopes), Feature #2 (Picker returns file IDs)
**Implementation Notes:**
- Use Drive API v3 `files.get` with `alt=media` to download file bytes
- Save to temp file or memory buffer
- Pass to existing `ExcelParser.parse()` or pandas `read_csv()`
- Clean up temp files after processing

**Industry Standard:** Drive integrations support both native formats (Sheets/Docs) and uploaded Office files.

---

### 5. Create New Google Sheet (Output)
**What:** Push workflow results to Drive as a new Google Sheet
**Why:** Core value prop — eliminate download/re-upload cycle
**Complexity:** Medium (Sheets API write + Drive permissions)
**Dependencies:** Feature #1 (OAuth scopes)
**Implementation Notes:**
- Convert result DataFrame to list of lists (rows)
- Use Sheets API v4 `spreadsheets.create` to create new Sheet
- Write data via `spreadsheets.values.update` (range: "Sheet1!A1")
- Set file name to workflow name + timestamp (e.g., "Inventory Update - 2026-02-07 10:30")
- Return webViewLink for user to open new Sheet in browser

**Industry Standard:** Apps like Zapier, Airtable, and Retool all support "create new Sheet" as primary output option.

---

### 6. Update Existing Google Sheet (Output)
**What:** Overwrite an existing Sheet with workflow results
**Why:** Users want recurring workflows to update the same output file
**Complexity:** Medium (Sheets API clear + write, plus UI to select target Sheet)
**Dependencies:** Feature #1 (OAuth scopes), Feature #2 (Picker for selecting target)
**Implementation Notes:**
- User selects target Sheet via Google Picker (filter: Sheets only)
- Clear existing data: `spreadsheets.values.clear` (range: "Sheet1!A:Z")
- Write new data: `spreadsheets.values.update` (same range)
- Preserve file ID, name, and permissions (no new file created)
- Warn if target Sheet has multiple sheets: ask which sheet tab to update

**Industry Standard:** Apps with recurring workflows (Google Data Studio, Supermetrics) always support "update existing" mode.

---

### 7. Fallback to Download (Always Available)
**What:** Keep existing Excel download option alongside Drive push
**Why:** User may want local copy; Drive push might fail; flexibility builds trust
**Complexity:** None (already implemented)
**Dependencies:** None
**Implementation Notes:**
- No changes to existing download flow
- UI shows both options: "Download Excel" and "Push to Drive" (if Drive enabled)
- User can do both (download AND push)

**Industry Standard:** Apps never force cloud-only workflows; download is always an escape hatch.

---

### 8. Handle Drive File Metadata
**What:** Display file name, owner, last modified date in workflow UI
**Why:** Users need context to verify they selected correct file
**Complexity:** Low (Drive API `files.get` with fields parameter)
**Dependencies:** Feature #2 (Picker returns file ID)
**Implementation Notes:**
- Fetch metadata: `files.get?fields=name,owners,modifiedTime,webViewLink`
- Display in workflow config UI: "Sales Data.xlsx (last edited 2026-02-05, owned by you)"
- Store webViewLink in workflow config so user can click to open source file

**Industry Standard:** File metadata display is ubiquitous in Drive-integrated apps for transparency.

---

### 9. Error Handling: API Rate Limits
**What:** Gracefully handle Google API quota/rate limit errors
**Why:** Google APIs have per-user and per-project quotas; hitting limits is inevitable
**Complexity:** Medium (retry logic + user-facing error messages)
**Dependencies:** All API-calling features
**Implementation Notes:**
- Detect HTTP 429 (rate limit) or 403 (quota exceeded) responses
- Show user-friendly error: "Google Drive is temporarily unavailable. Please try again in a few minutes."
- Implement exponential backoff for transient errors (network issues)
- Log quota errors for monitoring (if quotas are consistently hit, request increase)

**Industry Standard:** Apps with Drive integration must handle quotas; silent failures erode trust.

---

### 10. Error Handling: Permission Errors
**What:** Handle cases where app lacks permission to access a file
**Why:** User might select file they don't own or that's restricted
**Complexity:** Low (detect 403 errors, show clear message)
**Dependencies:** All read/write features
**Implementation Notes:**
- Detect HTTP 403 with "insufficientPermissions" reason
- Show message: "You don't have access to this file. Please select a file you own or have edit access to."
- On write: check if file is read-only, show error before attempting write

**Industry Standard:** Permission errors are common; apps must surface them clearly.

---

### 11. Token Refresh Mechanism
**What:** Automatically refresh OAuth access token when expired
**Why:** Access tokens expire after 1 hour; workflows may take longer or run later
**Complexity:** Low (authlib handles refresh if refresh_token stored)
**Dependencies:** Feature #1 (OAuth with offline access scope)
**Implementation Notes:**
- Request `access_type=offline` in OAuth flow to get refresh token
- Store refresh token securely (in session or encrypted in database)
- Use authlib's token refresh logic before each API call
- If refresh fails (user revoked access), redirect to re-auth

**Industry Standard:** All long-lived integrations use refresh tokens; hard requirement for recurring workflows.

---

## Differentiator Features

These features enhance UX, provide competitive advantage, or enable advanced workflows. They're not essential for launch but significantly improve user experience.

### 12. Remember Drive File References (Recurring Workflows)
**What:** Optionally store Drive file IDs in workflow config for re-runs
**Why:** Enables "run this workflow on latest data" without re-selecting files
**Complexity:** Medium (UI checkbox + backend logic to fetch latest data)
**Dependencies:** Feature #3, #4 (read from Drive)
**Implementation Notes:**
- Add checkbox in workflow wizard: "Remember source files for future runs"
- Store Drive file IDs (not file names) in workflow config JSON
- On re-run: fetch latest data from stored file IDs
- Show warning if file was deleted or access lost since last run
- User can always override and pick new files

**Differentiation:** Most simple Drive integrations require re-selecting files each time. This enables true recurring workflows.

**Industry Comparison:** Tools like Zapier and Supermetrics support this; basic integrations (e.g., simple export tools) do not.

---

### 13. File Version History Awareness
**What:** Show last modified timestamp of Drive files; warn if file unchanged since last run
**Why:** Helps users avoid re-running workflows on stale data
**Complexity:** Low (Drive API metadata includes modifiedTime)
**Dependencies:** Feature #8 (file metadata)
**Implementation Notes:**
- Display "Last modified: 2 hours ago" in file selection UI
- On re-run with remembered files: compare modifiedTime to previous run's timestamp
- Warn: "Sales Data.xlsx hasn't changed since your last run (2026-02-05). Continue anyway?"
- User can dismiss warning and proceed

**Differentiation:** Prevents wasted runs; shows attention to workflow efficiency.

**Industry Comparison:** Advanced workflow tools (Retool, n8n) show this; basic integrations do not.

---

### 14. Shared Drive (Team Drive) Support
**What:** Allow selecting files from Shared Drives, not just "My Drive"
**Why:** Many orgs use Shared Drives for team data; excluding them limits adoption
**Complexity:** Medium (Drive API v3 with `supportsAllDrives=true` parameter)
**Dependencies:** Feature #2 (Picker), Feature #1 (OAuth scopes)
**Implementation Notes:**
- Enable `supportsAllDrives=true` in all Drive API calls
- Google Picker supports Shared Drives by default if user has access
- No extra scopes needed (drive.file scope works for Shared Drives too)
- Test: ensure file metadata and read/write work for Shared Drive files

**Differentiation:** Org-wide adoption depends on this; missing it limits to individual users.

**Industry Comparison:** Enterprise-grade tools (Google Data Studio, Supermetrics) support Shared Drives; consumer tools often skip it.

---

### 15. Folder Context in Picker
**What:** Show file's parent folder path in Picker results
**Why:** Users often have multiple files with same name in different folders
**Complexity:** Low (Picker API returns parent folder IDs; Drive API can fetch folder names)
**Dependencies:** Feature #2 (Picker)
**Implementation Notes:**
- Picker returns `parents` field (array of folder IDs)
- Optionally fetch parent folder name via Drive API to show breadcrumb: "Sales / 2026 / Q1 / data.xlsx"
- Only show if ambiguous (multiple files with same name in search results)

**Differentiation:** Reduces selection mistakes; feels polished.

**Industry Comparison:** Google's own apps (Gmail attachment picker) show folder context; third-party apps vary.

---

### 16. File Type Icons in UI
**What:** Display Drive file icons (Sheets, Excel, CSV) in workflow UI
**Why:** Visual cues improve scannability; matches Google's own UIs
**Complexity:** Low (use Google's icon URLs or embed icons)
**Dependencies:** Feature #2 (Picker), Feature #8 (file metadata)
**Implementation Notes:**
- Google Picker returns `iconUrl` for each file
- Display icon next to file name in workflow config
- Fallback: hardcoded icons based on mimeType (Sheets, Excel, CSV)

**Differentiation:** Small polish detail; builds familiarity with Drive UX.

**Industry Comparison:** Common in polished apps (Slack, Asana); missing in scrappy MVPs.

---

### 17. Inline Preview of Selected Files
**What:** Show first few rows of data after file selection (before running workflow)
**Why:** Confirms user selected correct file; catches schema mismatches early
**Complexity:** Medium (fetch data on selection, render table in UI)
**Dependencies:** Feature #3, #4 (read from Drive)
**Implementation Notes:**
- After Picker selection, fetch first 10 rows via Sheets/Drive API
- Display as read-only table in workflow wizard
- Same preview used for local file uploads (parallel UX)
- Cache preview data to avoid redundant API calls

**Differentiation:** Builds confidence; reduces "oops, wrong file" errors.

**Industry Comparison:** Data tools (Tableau, Airtable) show previews; simple integrations do not.

---

### 18. Drive Permissions Check Before Write
**What:** Verify user has write access to target Sheet before executing workflow
**Why:** Avoids workflow execution failure at last step; better error UX
**Complexity:** Low (Drive API `files.get` with `capabilities` field)
**Dependencies:** Feature #6 (update existing Sheet)
**Implementation Notes:**
- When user selects target Sheet, call `files.get?fields=capabilities`
- Check `capabilities.canEdit` is true
- Show error immediately: "This file is read-only. Choose a different file or request edit access."

**Differentiation:** Fail-fast validation saves user time.

**Industry Comparison:** Advanced tools validate upfront; basic tools fail silently at runtime.

---

### 19. Sheet Tab Selection (Multi-Tab Sheets)
**What:** Let user choose which tab/sheet to read from or write to
**Why:** Google Sheets often have multiple tabs; reading wrong tab breaks workflows
**Complexity:** Medium (Sheets API metadata + UI dropdown)
**Dependencies:** Feature #3 (read Sheets), Feature #6 (update Sheet)
**Implementation Notes:**
- Fetch sheet metadata: `spreadsheets.get?fields=sheets.properties`
- Show dropdown of sheet names (tabs) in workflow config
- Default to first sheet (like Excel behavior)
- On write: allow user to select target tab or create new tab

**Differentiation:** Handles real-world Sheets structure; basic integrations ignore multi-tab complexity.

**Industry Comparison:** Zapier, Supermetrics, and Google Data Studio all support tab selection; export-only tools skip it.

---

### 20. Link to View Output in Drive
**What:** After creating/updating Sheet, show "View in Google Sheets" link
**Why:** Users want to verify results immediately; reduces "where did it go?" friction
**Complexity:** Low (Sheets API create/update returns file metadata with webViewLink)
**Dependencies:** Feature #5 (create Sheet), Feature #6 (update Sheet)
**Implementation Notes:**
- After successful write, extract `spreadsheetUrl` from API response
- Show success message: "Workflow complete! View results in Google Sheets"
- Open in new tab when clicked (target="_blank")

**Differentiation:** Seamless handoff to Google Sheets; feels integrated, not bolted-on.

**Industry Comparison:** Standard in good Drive integrations; omission feels unfinished.

---

### 21. Batch File Selection (Multiple Inputs at Once)
**What:** Allow selecting all workflow input files in one Picker session
**Why:** Workflows often have 2-3 input files; opening Picker 3 times is tedious
**Complexity:** Medium (Picker supports multi-select, but UI must map files to roles)
**Dependencies:** Feature #2 (Picker)
**Implementation Notes:**
- Open Picker with `multiselect: true`
- User selects all files at once
- UI shows: "Assign files to workflow inputs" with dropdowns
- Or: sequential assignment (first file → sales input, second → inventory input)

**Differentiation:** Reduces clicks; feels efficient.

**Industry Comparison:** Advanced workflow builders (n8n, Integromat) support this; simpler tools make user pick files one-by-one.

---

### 22. Local File + Drive File Mixing
**What:** Allow workflows with some inputs from Drive and some from local upload
**Why:** Users may have one file in Drive, one on desktop; flexibility wins
**Complexity:** Medium (UI supports both modes, backend handles both sources)
**Dependencies:** Feature #2 (Picker), existing upload flow
**Implementation Notes:**
- Workflow config stores file sources: `{source: "drive", fileId: "..."}` or `{source: "upload"}`
- On run, fetch Drive files and accept uploaded files in same request
- UI shows: "Sales data from Drive, Inventory from local upload"

**Differentiation:** Rare; most integrations force all-Drive or all-local.

**Industry Comparison:** Very few tools support this (maybe Zapier with mixed triggers); strong differentiator for hybrid users.

---

### 23. Drive Activity Log (Audit Trail)
**What:** Log all Drive file reads/writes to existing audit log system
**Why:** Compliance; visibility into which files were accessed when
**Complexity:** Low (extend existing `AuditLogDB` to include Drive file IDs)
**Dependencies:** Feature #3, #4, #5, #6 (all Drive read/write operations)
**Implementation Notes:**
- Log events: `drive_file_read`, `drive_sheet_created`, `drive_sheet_updated`
- Store: user_id, file_id, file_name, operation, timestamp
- Display in UI: "Run history" shows Drive file links instead of local file paths

**Differentiation:** Enterprise users need audit trails; consumer tools skip this.

**Industry Comparison:** Tools targeting compliance-heavy industries (finance, healthcare) provide this.

---

## Anti-Features

These capabilities are deliberately out of scope. Either they add complexity without proportional value, conflict with project constraints, or encourage bad patterns.

### A1. In-App Spreadsheet Editor
**What:** Edit Google Sheets data directly in the app (like Google Sheets embed)
**Why Out of Scope:**
- Google Sheets already provides world-class editor
- Duplicating it is high complexity, low value
- Users expect to edit in Sheets, process in workflow app
- Constraint from PROJECT.md: "In-app editing of source documents — users edit in Google Sheets directly"

**Industry Comparison:** Tools stay in their lane; Zapier/Retool don't embed Sheets editors.

---

### A2. Google Docs as Input
**What:** Read text from Google Docs as workflow input
**Why Out of Scope:**
- App processes tabular data (spreadsheets), not text documents
- No workflow logic for text (no joins, no output columns)
- Constraint from PROJECT.md: "Google Docs text documents as inputs — spreadsheet/CSV data only"

**Industry Comparison:** Data tools focus on structured data; text processing is separate category.

---

### A3. Automatic Folder Sync
**What:** Automatically re-run workflow when Drive files change
**Why Out of Scope:**
- Requires Drive API push notifications (complex webhook setup)
- Polling is inefficient and hits rate limits
- Users may not want instant re-runs (need to review changes first)
- Constraint from PROJECT.md: "Folder sync or automatic re-runs on Drive changes — manual trigger only"

**Better Alternative:** Feature #13 (version history awareness) alerts users to stale data; they trigger runs manually.

**Industry Comparison:** Real-time sync is rare in workflow tools (requires dedicated infrastructure); most are manual-trigger.

---

### A4. Sharing Workflows Between Users
**What:** Let users share workflow definitions with teammates
**Why Out of Scope:**
- Constraint from PROJECT.md: "Sharing workflows between users — per-user isolation stays"
- Adds complexity: permissions, versioning, conflict resolution
- Current architecture: workflows tied to single user_id

**Better Alternative:** Users can export workflow config as JSON, share manually, then import.

**Industry Comparison:** Team features require multi-tenancy architecture; v1 apps are single-user.

---

### A5. Drive Folder Creation/Organization
**What:** Create folders in Drive, organize output files into folder hierarchy
**Why Out of Scope:**
- Users already have folder structures; imposing app's structure is opinionated
- Adds UI complexity (folder picker, permissions)
- Constraint from PROJECT.MD: "Google Drive folder creation/organization — files go to user's root or existing folders"

**Better Alternative:** Created Sheets appear in user's Drive root; user organizes them manually (as they would with any Drive file).

**Industry Comparison:** Apps create files in root; users move them (Google Photos, email attachments work this way).

---

### A6. Full Drive File Browser
**What:** Build custom Drive file browser instead of using Google Picker
**Why Out of Scope:**
- Google Picker is free, maintained, and familiar to users
- Custom browser requires replicating Drive UI: search, filters, thumbnails, folder nav
- High effort, low differentiation (Picker is table stakes)

**Better Alternative:** Use Google Picker (Feature #2).

**Industry Comparison:** No modern app builds custom Drive browsers; Picker is universal.

---

### A7. Offline Mode for Drive Files
**What:** Cache Drive files locally for offline workflow execution
**Why Out of Scope:**
- Drive API requires network; workflows can't run offline anyway
- Caching adds data sync complexity (stale cache issues)
- Security risk: cached OAuth tokens could be leaked

**Better Alternative:** Download files locally if offline access needed (existing download feature).

**Industry Comparison:** Drive integrations are inherently online; offline is a different product (Google Drive desktop app).

---

### A8. Custom Drive Permissions Management
**What:** Let app set file sharing permissions (make files public, share with specific users)
**Why Out of Scope:**
- Requires `drive` scope (full Drive access), violates least-privilege principle
- Users manage permissions in Google Drive UI (proper place for it)
- Risk: app could accidentally leak private data

**Better Alternative:** Created Sheets inherit default permissions (private to user); user shares via Drive UI if needed.

**Industry Comparison:** Apps avoid touching permissions; Google's own sharing UI is trusted.

---

### A9. Drive Trash/Delete Operations
**What:** Move files to trash or permanently delete Drive files
**Why Out of Scope:**
- Destructive operations; high risk if buggy
- No workflow use case for deleting source files (read-only inputs)
- Clutters UI with dangerous options

**Better Alternative:** Users manage file lifecycle in Drive.

**Industry Comparison:** Data processing tools are read-only on sources; deletion is manual in Drive UI.

---

### A10. Multi-Account Drive Access
**What:** Let user connect multiple Google accounts, access files from all
**Why Out of Scope:**
- App uses single OAuth session (one user = one account)
- Multi-account requires account switcher UI (high complexity)
- Current auth flow (Feature #1) assumes single account

**Better Alternative:** User logs in with primary account; uses Drive's file sharing to access files from other accounts.

**Industry Comparison:** Multi-account is rare; even Google's own apps (Gmail, Drive) keep accounts separate.

---

## Feature Dependency Map

```
OAuth Scope Expansion (#1)
├── Google Picker Integration (#2)
│   ├── Read Google Sheets Natively (#3)
│   │   └── Sheet Tab Selection (#19)
│   ├── Read Excel/CSV from Drive (#4)
│   ├── Handle Drive File Metadata (#8)
│   │   ├── File Version History Awareness (#13)
│   │   └── File Type Icons in UI (#16)
│   ├── Remember Drive File References (#12)
│   ├── Shared Drive Support (#14)
│   ├── Folder Context in Picker (#15)
│   └── Batch File Selection (#21)
├── Create New Google Sheet (#5)
│   └── Link to View Output in Drive (#20)
├── Update Existing Google Sheet (#6)
│   ├── Drive Permissions Check Before Write (#18)
│   ├── Sheet Tab Selection (#19)
│   └── Link to View Output in Drive (#20)
├── Token Refresh Mechanism (#11)
├── Error Handling: API Rate Limits (#9)
├── Error Handling: Permission Errors (#10)
└── Drive Activity Log (#23)

Fallback to Download (#7) — independent, no dependencies
Local File + Drive File Mixing (#22) — depends on existing upload + Picker (#2)
Inline Preview of Selected Files (#17) — depends on read features (#3, #4)
```

---

## Feature Complexity & Effort Estimates

| Feature | Complexity | Effort | Priority |
|---------|-----------|---------|----------|
| #1 OAuth Scope Expansion | Low | 2 hours | P0 (blocker) |
| #2 Google Picker Integration | Medium | 8 hours | P0 (blocker) |
| #3 Read Google Sheets Natively | Medium | 6 hours | P0 (blocker) |
| #4 Read Excel/CSV from Drive | Low | 3 hours | P0 (blocker) |
| #5 Create New Google Sheet | Medium | 6 hours | P0 (blocker) |
| #6 Update Existing Google Sheet | Medium | 5 hours | P0 (blocker) |
| #7 Fallback to Download | None | 0 hours | P0 (already done) |
| #8 Handle Drive File Metadata | Low | 2 hours | P0 (blocker) |
| #9 Error Handling: API Rate Limits | Medium | 4 hours | P0 (blocker) |
| #10 Error Handling: Permission Errors | Low | 2 hours | P0 (blocker) |
| #11 Token Refresh Mechanism | Low | 3 hours | P0 (blocker) |
| **Total Table Stakes** | — | **41 hours** | — |
| #12 Remember Drive File References | Medium | 5 hours | P1 |
| #13 File Version History Awareness | Low | 2 hours | P2 |
| #14 Shared Drive Support | Medium | 4 hours | P1 |
| #15 Folder Context in Picker | Low | 3 hours | P3 |
| #16 File Type Icons in UI | Low | 1 hour | P3 |
| #17 Inline Preview of Selected Files | Medium | 6 hours | P2 |
| #18 Drive Permissions Check | Low | 2 hours | P2 |
| #19 Sheet Tab Selection | Medium | 5 hours | P1 |
| #20 Link to View Output in Drive | Low | 1 hour | P1 |
| #21 Batch File Selection | Medium | 6 hours | P3 |
| #22 Local File + Drive File Mixing | Medium | 8 hours | P2 |
| #23 Drive Activity Log | Low | 3 hours | P2 |
| **Total Differentiators** | — | **46 hours** | — |

**Recommended MVP:** All Table Stakes (41 hours) + P1 Differentiators (#12, #14, #19, #20) = **56 hours** (~7 dev days)

---

## Quality Gate Checklist

- [x] Categories are clear (table stakes vs differentiators vs anti-features)
- [x] Complexity noted for each feature
- [x] Dependencies between features identified (see dependency map)
- [x] Industry comparison provided for context
- [x] Effort estimates included
- [x] Anti-features justify exclusion with constraints from PROJECT.md

---

## Recommendations for Requirements Definition

1. **Phase 1 (MVP)**: Implement all 11 Table Stakes features. This delivers a usable Drive integration that meets user expectations.

2. **Phase 2 (Polish)**: Add P1 differentiators (#12, #14, #19, #20). These are high-value, medium-effort features that significantly improve UX.

3. **Phase 3 (Optional)**: Consider P2/P3 differentiators based on user feedback. Features like #17 (inline preview) and #22 (mixed sources) are "wow" features but not essential.

4. **Never Implement**: All anti-features (A1-A10). These are explicitly out of scope per project constraints or add complexity without value.

5. **Key Risk**: Feature #9 (rate limit handling) is critical but often underestimated. Budget extra time for testing edge cases.

6. **Quick Win**: Features #16 and #20 are low-effort, high-polish items that make integration feel complete.

---

**Document Prepared By:** Claude (Project Researcher Agent)
**Sources:** Existing codebase analysis, PROJECT.md constraints, industry knowledge of Google Drive/Sheets integrations (Google Picker API, Drive API v3, Sheets API v4 best practices)
