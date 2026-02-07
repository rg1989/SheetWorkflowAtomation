---
phase: quick-005
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/api/drive.py
  - frontend/src/components/WorkflowWizard/DriveFilePicker.tsx
autonomous: true

must_haves:
  truths:
    - "User can select a sheet/tab when picking an Excel (.xlsx) file from Google Drive"
    - "Existing Google Sheets tab selection continues to work unchanged"
    - "CSV files from Drive show no tab selector (single-sheet format)"
  artifacts:
    - path: "backend/app/api/drive.py"
      provides: "Unified tabs endpoint supporting both Google Sheets and Excel files"
      contains: "get_drive_excel_sheets"
    - path: "frontend/src/components/WorkflowWizard/DriveFilePicker.tsx"
      provides: "Tab fetching for Excel files from Drive"
  key_links:
    - from: "frontend/src/components/WorkflowWizard/DriveFilePicker.tsx"
      to: "/drive/sheets/tabs"
      via: "driveApi.getSheetTabs for both Google Sheets AND Excel mimeTypes"
      pattern: "getSheetTabs"
    - from: "backend/app/api/drive.py"
      to: "backend/app/services/drive.py"
      via: "get_drive_excel_sheets call for Excel mimeType"
      pattern: "get_drive_excel_sheets"
---

<objective>
Enable sheet/tab selection for Excel (.xlsx) files stored in Google Drive.

Purpose: Currently only Google Sheets files show a tab selector when picked from Drive. Excel files in Drive default to the first sheet with no way to choose. This creates an inconsistency since local Excel files already support tab selection.

Output: Users can select which sheet/tab to use for both Google Sheets AND Excel files from Drive.
</objective>

<execution_context>
@/Users/rgv250cc/.claude/get-shit-done/workflows/execute-plan.md
@/Users/rgv250cc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@backend/app/api/drive.py
@backend/app/services/drive.py
@frontend/src/components/WorkflowWizard/DriveFilePicker.tsx
@frontend/src/lib/api.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend backend /drive/sheets/tabs endpoint to support Excel files</name>
  <files>backend/app/api/drive.py</files>
  <action>
Modify the existing `list_sheet_tabs` endpoint (`GET /drive/sheets/tabs`) to also accept a `mime_type` query parameter (optional, defaults to Google Sheets behavior).

When `mime_type` is provided:
- If `mime_type == "application/vnd.google-apps.spreadsheet"` (or mime_type is not provided): Use existing `get_sheet_tabs(sheets_service, spreadsheet_id)` -- current behavior, no changes.
- If `mime_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"` (Excel): Build drive_service and call `get_drive_excel_sheets(drive_service, file_id, mime_type)` from `app.services.drive`. Return the result in the same shape: `{"tabs": [{"title": name, "index": i, "sheetId": i}, ...]}` -- map the plain list of sheet name strings into the same object format that Google Sheets tabs use.
- If `mime_type == "text/csv"`: Return `{"tabs": []}` immediately (CSV has no sheets).

Add the import: `from app.services.drive import download_drive_file_to_df, get_drive_file_metadata, get_drive_excel_sheets`

Rename the parameter from `spreadsheet_id` to `file_id` for clarity (since it now handles non-Sheets files too). Keep backward compatibility by accepting `spreadsheet_id` as an alias -- check for `file_id` first, fall back to `spreadsheet_id` query param.

The updated endpoint signature:
```python
@router.get("/sheets/tabs")
async def list_sheet_tabs(
    file_id: Optional[str] = None,
    spreadsheet_id: Optional[str] = None,
    mime_type: Optional[str] = None,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
```

Use `resolved_id = file_id or spreadsheet_id`. Raise 400 if neither provided.

For the Excel branch, build the drive_service via `build_drive_service(current_user, db)`.
  </action>
  <verify>
Backend server starts without import errors. Manually testable via:
- `curl /api/drive/sheets/tabs?file_id=EXCEL_ID&mime_type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` returns tab list
- `curl /api/drive/sheets/tabs?spreadsheet_id=SHEET_ID` still works (backward compat)
  </verify>
  <done>
The /drive/sheets/tabs endpoint returns sheet names for both Google Sheets (via Sheets API) and Excel files (via openpyxl download), in the same response shape.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update DriveFilePicker to fetch tabs for Excel files</name>
  <files>frontend/src/components/WorkflowWizard/DriveFilePicker.tsx</files>
  <action>
In `DriveFilePicker.tsx`, modify the `handleFileSelected` callback (around line 48-59).

Current code only fetches tabs for Google Sheets:
```typescript
if (pickerFile.mimeType === 'application/vnd.google-apps.spreadsheet') {
```

Change this to also include Excel mimeType:
```typescript
const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const SHEETS_MIME = 'application/vnd.google-apps.spreadsheet'

if (pickerFile.mimeType === SHEETS_MIME || pickerFile.mimeType === EXCEL_MIME) {
```

Update the `driveApi.getSheetTabs` call to pass the mimeType so the backend knows which code path to use. Change:
```typescript
const tabsResult = await driveApi.getSheetTabs(pickerFile.id)
```
to:
```typescript
const tabsResult = await driveApi.getSheetTabs(pickerFile.id, pickerFile.mimeType)
```

Then update the `driveApi.getSheetTabs` function in `frontend/src/lib/api.ts` to accept and pass the optional `mimeType` parameter:
```typescript
getSheetTabs: (fileId: string, mimeType?: string) =>
  fetchJSON<{ tabs: Array<{ title: string; index: number; sheetId: number }> }>(
    `/drive/sheets/tabs?file_id=${encodeURIComponent(fileId)}${mimeType ? `&mime_type=${encodeURIComponent(mimeType)}` : ''}`
  ),
```

This uses the new `file_id` query param name and adds `mime_type` when provided. The backend falls back to `spreadsheet_id` so existing callers still work.

Also check if `driveApi.getSheetTabs` is called anywhere else in the codebase. If so, those calls can remain unchanged since the `mimeType` param is optional and the backend falls back to the `spreadsheet_id` alias.
  </action>
  <verify>
Run `npx tsc --noEmit` in the frontend directory to verify no TypeScript errors. Verify the DriveFilePicker correctly calls the tabs endpoint for both Google Sheets and Excel files by inspecting the code.
  </verify>
  <done>
When a user picks an Excel file from Google Drive, the DriveFilePicker fetches available sheet tabs and passes them to onFileReady as `availableSheets`, enabling the tab selector dropdown in the FileCard component.
  </done>
</task>

</tasks>

<verification>
1. Pick a Google Sheet from Drive -- tab selector appears and works (regression check)
2. Pick an Excel (.xlsx) file with multiple sheets from Drive -- tab selector appears with correct sheet names
3. Pick a CSV file from Drive -- no tab selector appears (correct, single-sheet)
4. Selecting a different tab re-parses the file with the correct sheet
</verification>

<success_criteria>
- Excel files from Google Drive show a sheet/tab selector dropdown when they have multiple sheets
- Google Sheets tab selection continues to work as before
- CSV files show no tab selector
- All three file types (Google Sheets, Excel, CSV) work end-to-end from Drive picker to workflow execution
</success_criteria>

<output>
After completion, create `.planning/quick/005-add-sheet-tab-selection-for-excel-files-/005-SUMMARY.md`
</output>
