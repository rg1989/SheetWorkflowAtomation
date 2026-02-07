# Sheet Workflow Automation

## What This Is

A web app that lets users join, transform, and export Excel/spreadsheet data through configurable workflows. Users upload Excel files, define how to join them by key columns, compute output columns (direct copy, concat, math), preview results, and download output files. Deployed on Railway with Google OAuth authentication.

This milestone adds Google Drive integration — users can browse and select files directly from their Drive as workflow inputs, and push results back to Drive as new or updated Google Sheets, in addition to the existing download option.

## Core Value

Users can connect their Google Drive and seamlessly use Drive files as workflow inputs and push results back — eliminating the download/upload cycle entirely.

## Requirements

### Validated

- ✓ User can sign up/login via Google OAuth — existing
- ✓ User can create workflows with multiple Excel file inputs — existing
- ✓ User can define join strategy (inner, left, right, full) by key columns — existing
- ✓ User can define output columns (direct, concat, math, custom) — existing
- ✓ User can preview workflow results before executing — existing
- ✓ User can execute workflows and download output as Excel — existing
- ✓ User can view run history with past results — existing
- ✓ Workflows persist per-user with full config stored as JSON — existing
- ✓ App deploys as single Docker container on Railway — existing

### Active

- [ ] User's Google Drive is automatically accessible after OAuth login (expanded scopes)
- [ ] User can browse and select Drive files via Google Picker as workflow inputs
- [ ] App reads Google Sheets natively (converts to DataFrame for processing)
- [ ] App reads Excel (.xlsx) files stored in Drive (downloads and parses)
- [ ] App reads CSV files stored in Drive (downloads and parses)
- [ ] User can choose per-workflow to remember Drive file references or pick fresh each run
- [ ] Re-running a workflow with remembered Drive sources pulls latest data automatically
- [ ] After workflow execution, user can choose: download, create new Google Sheet, or update existing Sheet
- [ ] "Create new Sheet" generates a new Google Sheet in user's Drive with results
- [ ] "Update existing Sheet" replaces contents of a selected Google Sheet with results
- [ ] Download option remains available regardless of Drive push choice
- [ ] Google Picker UI integrates into the existing workflow creation wizard
- [ ] Drive file selection works alongside local file upload (user can mix sources)

### Out of Scope

- In-app editing of source documents — users edit in Google Sheets directly
- Google Docs text documents as inputs — spreadsheet/CSV data only
- Folder sync or automatic re-runs on Drive changes — manual trigger only
- Sharing workflows between users — per-user isolation stays
- Google Drive folder creation/organization — files go to user's root or existing folders

## Context

- Google OAuth already implemented via authlib; expanding scopes for Drive/Sheets access is the natural path
- Current flow: upload Excel → parse with openpyxl/pandas → join → export. Drive integration adds a new input source and output destination without changing the core engine
- Google Picker API provides a familiar Drive file selection UI as a popup widget
- Google Sheets API allows read/write of native Sheets; Drive API handles file metadata, download, and upload
- Existing session stores Google OAuth tokens — these need to be extended to include Drive/Sheets scopes and handle token refresh

## Constraints

- **Tech stack**: Must extend existing FastAPI + React architecture, no new frameworks
- **Auth**: Leverage existing Google OAuth flow, expand scopes (drive.file, spreadsheets)
- **Deployment**: Single Docker container on Railway must continue working
- **Data isolation**: All Drive access scoped to authenticated user's own account
- **API quotas**: Google APIs have rate limits; must handle gracefully

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Google Picker (not custom file browser) | Familiar UX, handles auth, less code to maintain | — Pending |
| Expand existing OAuth scopes (not separate Drive auth) | User already logs in with Google; one auth flow is simpler | — Pending |
| Use drive.file scope (not full drive access) | Principle of least privilege; only access files user explicitly selects | — Pending |
| Remember Drive refs as optional per-workflow checkbox | Flexible — some workflows are one-off, some are recurring | — Pending |

---
*Last updated: 2026-02-07 after initialization*
