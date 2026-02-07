# Requirements

## v1 Requirements

### OAuth & Authentication
- [x] **AUTH-01**: User's Google Drive is automatically accessible after OAuth login with expanded scopes (drive.file + spreadsheets)
- [x] **AUTH-02**: Access tokens automatically refresh when expired (1-hour lifetime) without user re-authentication
- [x] **AUTH-03**: Refresh tokens stored encrypted in database using Fernet encryption

### File Selection
- [ ] **SELECT-01**: User can browse and select files from Drive via Google Picker popup widget
- [x] **SELECT-02**: App stores and displays Drive file metadata (name, owner, last modified timestamp, webViewLink)
- [ ] **SELECT-03**: User can select files from Shared Drives (Team Drives) in addition to My Drive
- [ ] **SELECT-04**: User can mix Drive files and local uploads as workflow inputs (some from Drive, some uploaded)

### Input from Drive
- [x] **INPUT-01**: App reads Google Sheets natively via Sheets API and converts to DataFrame for processing
- [x] **INPUT-02**: App reads Excel (.xlsx) files stored in Drive by downloading and parsing with existing parser
- [x] **INPUT-03**: App reads CSV files stored in Drive by downloading and parsing
- [ ] **INPUT-04**: User sees warning if Drive file hasn't changed since last workflow run (version history awareness)
- [ ] **INPUT-05**: User can choose which tab/sheet to read from multi-tab Google Sheets (both as input and when selecting write target)
- [ ] **INPUT-06**: User sees preview of first 10 rows of data after selecting Drive file (before running workflow)

### Output to Drive
- [x] **OUTPUT-01**: User can create new Google Sheet in Drive with workflow results
- [x] **OUTPUT-02**: User can update existing Google Sheet by overwriting contents with workflow results
- [x] **OUTPUT-03**: Download option remains available alongside Drive push options (always provide local fallback)

### Error Handling
- [x] **ERROR-01**: App handles API rate limit errors (HTTP 429) with exponential backoff and user-friendly messages
- [x] **ERROR-02**: App handles permission errors (HTTP 403) with clear messages explaining access issues

## v2 Requirements

### Workflow Persistence
- [ ] **PERSIST-01**: User can optionally remember Drive file references in workflow config for recurring runs (checkbox per workflow)
- [ ] **PERSIST-02**: Workflows with remembered Drive sources automatically fetch latest data on re-run

### Output Polish
- [ ] **OUTPUT-04**: After creating/updating Sheet, user sees "View in Google Sheets" link that opens result in new tab
- [ ] **OUTPUT-05**: Before writing to existing Sheet, app verifies user has edit permissions and shows error if read-only

### Audit
- [ ] **AUDIT-01**: All Drive file reads and writes logged to audit trail with user, file ID, file name, operation, and timestamp

## Out of Scope

- **In-app editing** — Users edit source documents in Google Sheets directly, not through this app
- **Google Docs as input** — App processes tabular data (spreadsheets/CSV) only, not text documents
- **Automatic folder sync** — Workflows are manually triggered only, no automatic re-runs on Drive changes
- **Workflow sharing** — Per-user isolation maintained, no sharing workflows between users
- **Drive folder creation** — Output files go to user's Drive root or existing folders, app doesn't create folder structure
- **Custom Drive browser** — Use Google Picker instead of building custom file navigation UI
- **Offline mode** — Drive integration requires network; use download feature for offline needs
- **Drive permissions management** — Users manage file sharing in Google Drive UI, not in app
- **Drive trash/delete operations** — App is read-only on source files, no destructive operations
- **Multi-account access** — Single OAuth session per user, no account switching

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| SELECT-01 | Phase 4 | Pending |
| SELECT-02 | Phase 3 | Complete |
| SELECT-03 | Phase 4 | Pending |
| SELECT-04 | Phase 4 | Pending |
| INPUT-01 | Phase 2 | Complete |
| INPUT-02 | Phase 2 | Complete |
| INPUT-03 | Phase 2 | Complete |
| INPUT-04 | Phase 5 | Pending |
| INPUT-05 | Phase 5 | Pending |
| INPUT-06 | Phase 5 | Pending |
| OUTPUT-01 | Phase 6 | Complete |
| OUTPUT-02 | Phase 6 | Complete |
| OUTPUT-03 | Phase 6 | Complete |
| ERROR-01 | Phase 2 | Complete |
| ERROR-02 | Phase 2 | Complete |

**Coverage:** 17/17 v1 requirements mapped (100%)

---
*Last updated: 2026-02-07*
