# Roadmap: Sheet Workflow Automation - Google Drive Integration

## Overview

This milestone adds Google Drive integration to an existing workflow automation app. Users will authenticate via expanded OAuth scopes, browse and select Drive files (Sheets, Excel, CSV) as workflow inputs using Google Picker, and push results back to Drive as new or updated Google Sheets. The integration builds incrementally from token management foundation through backend services, frontend UI, and bidirectional Drive access—eliminating the download/upload cycle entirely for Drive-centric workflows.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Token Management Foundation** - OAuth scope expansion with secure token storage and automatic refresh
- [x] **Phase 2: Backend Drive Service** - Server-side Drive/Sheets API integration with error handling
- [x] **Phase 3: Backend Drive Endpoints** - REST API exposing Drive operations
- [ ] **Phase 4: Frontend Picker UI** - Google Picker integration for Drive file selection
- [ ] **Phase 5: Workflow Integration** - Drive files as workflow inputs with mixed sources
- [ ] **Phase 6: Export to Drive** - Push workflow results back to Drive as Google Sheets

## Phase Details

### Phase 1: Token Management Foundation
**Goal**: Secure OAuth tokens persist and refresh automatically for Drive/Sheets API access
**Depends on**: Nothing (foundation)
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. Existing users see "Connect Google Drive" prompt and can grant expanded scopes
  2. New users authenticating get Drive/Sheets access tokens stored encrypted in database
  3. Access tokens refresh automatically when expired without user re-authentication
  4. Token expiry (1-hour) does not break Drive operations during workflows
  5. Backend endpoint exposes scope status so frontend can detect if Drive features are available
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Database token columns, Fernet encryption module, migration
- [x] 01-02-PLAN.md -- OAuth flow extension with Drive scopes, token refresh, drive-status endpoint

### Phase 2: Backend Drive Service
**Goal**: Backend can read Drive files (Sheets, Excel, CSV) and handle API errors gracefully
**Depends on**: Phase 1 (needs valid tokens)
**Requirements**: INPUT-01, INPUT-02, INPUT-03, ERROR-01, ERROR-02
**Success Criteria** (what must be TRUE):
  1. Backend can download Excel files from Drive by file ID and parse to DataFrame
  2. Backend can download CSV files from Drive by file ID and parse to DataFrame
  3. Backend can read Google Sheets natively via Sheets API and convert to DataFrame
  4. API rate limit errors (HTTP 429) trigger exponential backoff and return user-friendly messages
  5. Permission errors (HTTP 403) return clear messages explaining access issues
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Credential builder, Drive file download (Excel/CSV/Sheets export), error handling with retry
- [x] 02-02-PLAN.md -- Native Sheets API read, Drive routing update for Google Sheets

### Phase 3: Backend Drive Endpoints
**Goal**: REST API exposes Drive file operations to frontend
**Depends on**: Phase 2 (needs service layer)
**Requirements**: SELECT-02
**Success Criteria** (what must be TRUE):
  1. Frontend can request Drive file download via POST /api/drive/download with file ID
  2. Frontend can request Sheets read via POST /api/sheets/read with spreadsheet ID
  3. Frontend can retrieve OAuth access token via GET /api/auth/token for Picker authentication
  4. Drive file metadata (name, owner, last modified, webViewLink) is stored and returned with file operations
  5. Error responses map to user-friendly messages (not raw Google API errors)
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md -- Drive/Sheets REST endpoints with Pydantic models + Picker token endpoint

### Phase 4: Frontend Picker UI
**Goal**: Users can browse and select files from Drive via Google Picker
**Depends on**: Phase 1 (scope detection), Phase 3 (token endpoint)
**Requirements**: SELECT-01, SELECT-03, SELECT-04
**Success Criteria** (what must be TRUE):
  1. User can open Google Picker popup and browse their Drive files
  2. User can select files from Shared Drives (Team Drives) in addition to My Drive
  3. User can select Drive file OR upload local file for each workflow input (mix sources)
  4. Selected Drive files return metadata (ID, name, MIME type) to workflow editor
  5. Users without Drive scopes see "Connect Google Drive" button that redirects to OAuth
**Plans**: TBD

Plans:
- [ ] 04-01: TBD during planning

### Phase 5: Workflow Integration
**Goal**: Workflows accept Drive files as inputs and execute with mixed sources
**Depends on**: Phase 2 (service), Phase 3 (endpoints), Phase 4 (Picker)
**Requirements**: INPUT-04, INPUT-05, INPUT-06
**Success Criteria** (what must be TRUE):
  1. User sees warning if Drive file hasn't changed since last workflow run (version awareness)
  2. User can select which tab/sheet to read from multi-tab Google Sheets
  3. User sees preview of first 10 rows after selecting Drive file (before running workflow)
  4. Workflow with Drive file as input executes successfully and produces results
  5. Workflow with mixed sources (some Drive, some local upload) executes successfully
**Plans**: TBD

Plans:
- [ ] 05-01: TBD during planning

### Phase 6: Export to Drive
**Goal**: Users can push workflow results back to Drive as Google Sheets
**Depends on**: Phase 2 (service), Phase 3 (endpoints)
**Requirements**: OUTPUT-01, OUTPUT-02, OUTPUT-03
**Success Criteria** (what must be TRUE):
  1. User can create new Google Sheet in Drive with workflow results
  2. User can update existing Google Sheet by overwriting contents with workflow results
  3. Download option remains available alongside Drive push options (local fallback always works)
  4. After creating/updating Sheet, user sees success message with link to view in Google Sheets
  5. Export operations handle rate limits and permission errors gracefully
**Plans**: TBD

Plans:
- [ ] 06-01: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Token Management Foundation | 2/2 | Complete | 2026-02-07 |
| 2. Backend Drive Service | 2/2 | Complete | 2026-02-07 |
| 3. Backend Drive Endpoints | 1/1 | Complete | 2026-02-07 |
| 4. Frontend Picker UI | 0/TBD | Not started | - |
| 5. Workflow Integration | 0/TBD | Not started | - |
| 6. Export to Drive | 0/TBD | Not started | - |
