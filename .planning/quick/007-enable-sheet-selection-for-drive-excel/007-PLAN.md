---
phase: quick-007
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/api/drive.py
  - frontend/src/lib/api.ts
  - frontend/src/components/WorkflowWizard/steps/FilesStep.tsx
autonomous: true

must_haves:
  truths:
    - "User can change sheets on a Drive Excel file in the workflow template editor"
    - "Selecting a different sheet re-downloads the Excel file with that sheet and updates columns/preview"
    - "Sheet selection works for both Google Sheets and Drive Excel files identically from the user perspective"
  artifacts:
    - path: "backend/app/api/drive.py"
      provides: "DownloadRequest with sheet_name field, passed to download_drive_file_to_df"
      contains: "sheet_name"
    - path: "frontend/src/lib/api.ts"
      provides: "driveApi.downloadFile accepts optional sheetName parameter"
      contains: "sheet_name"
    - path: "frontend/src/components/WorkflowWizard/steps/FilesStep.tsx"
      provides: "handleChangeSheet supports Excel files via driveApi.downloadFile with sheetName"
  key_links:
    - from: "frontend/src/components/WorkflowWizard/steps/FilesStep.tsx"
      to: "frontend/src/lib/api.ts"
      via: "driveApi.downloadFile(fileId, headerRow, sheetName)"
      pattern: "driveApi\\.downloadFile"
    - from: "frontend/src/lib/api.ts"
      to: "backend/app/api/drive.py"
      via: "POST /drive/download with sheet_name in body"
      pattern: "sheet_name"
    - from: "backend/app/api/drive.py"
      to: "backend/app/services/drive.py"
      via: "download_drive_file_to_df(..., sheet_name=request.sheet_name)"
      pattern: "sheet_name=request\\.sheet_name"
---

<objective>
Enable sheet selection for Drive Excel files in the workflow template editor.

Purpose: Currently, changing sheets on a Drive Excel file shows "Sheet selection only available for Google Sheets" even though the backend `download_drive_file_to_df` function already supports a `sheet_name` parameter. This fix threads `sheet_name` through the full stack: backend endpoint -> API client -> frontend handler.

Output: Users can select any sheet from a Drive Excel file and the preview updates with the correct data.
</objective>

<execution_context>
@/Users/rgv250cc/.claude/get-shit-done/workflows/execute-plan.md
@/Users/rgv250cc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@backend/app/api/drive.py
@backend/app/services/drive.py (download_drive_file_to_df signature at line 360 - already accepts sheet_name)
@frontend/src/lib/api.ts
@frontend/src/components/WorkflowWizard/steps/FilesStep.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add sheet_name to backend DownloadRequest and pass through</name>
  <files>backend/app/api/drive.py</files>
  <action>
    1. Add `sheet_name: Optional[str] = Field(None, description="Sheet name to read (for multi-sheet Excel files)")` to the `DownloadRequest` model (line ~36, after header_row field).

    2. In `download_drive_file` endpoint (line ~154), pass `sheet_name=request.sheet_name` to the `download_drive_file_to_df` call. The updated call should be:
       ```python
       df = await download_drive_file_to_df(
           drive_service,
           request.file_id,
           mime_type=metadata["mimeType"],
           sheets_service=sheets_service,
           sheet_name=request.sheet_name,
           header_row=header_row_param
       )
       ```

    No other changes needed - `download_drive_file_to_df` already accepts and handles `sheet_name`.
  </action>
  <verify>
    Run: `cd /Users/rgv250cc/Documents/Projects/SheetWorkflowAtomation/backend && python -c "from app.api.drive import DownloadRequest; r = DownloadRequest(file_id='test', sheet_name='Sheet2'); print(r.sheet_name)"`
    Expected output: `Sheet2`
  </verify>
  <done>DownloadRequest model has sheet_name field; download_drive_file endpoint passes sheet_name to download_drive_file_to_df</done>
</task>

<task type="auto">
  <name>Task 2: Update frontend API client and FilesStep sheet change handler</name>
  <files>
    frontend/src/lib/api.ts
    frontend/src/components/WorkflowWizard/steps/FilesStep.tsx
  </files>
  <action>
    **In `frontend/src/lib/api.ts`:**

    1. Update `driveApi.downloadFile` (line ~225) to accept an optional `sheetName` parameter and include it in the request body:
       ```typescript
       downloadFile: (fileId: string, headerRow?: number, sheetName?: string) =>
         fetchJSON<DriveFileResponse>('/drive/download', {
           method: 'POST',
           body: JSON.stringify({
             file_id: fileId,
             header_row: headerRow,
             ...(sheetName && { sheet_name: sheetName }),
           }),
         }),
       ```

    **In `frontend/src/components/WorkflowWizard/steps/FilesStep.tsx`:**

    2. In `handleChangeSheet` (line ~108), replace the `else` block at lines 130-134 that shows "Sheet selection only available for Google Sheets" with a branch that calls `driveApi.downloadFile` with the sheet name. The Excel/CSV Drive file case should be:
       ```typescript
       } else {
         // For Excel/CSV Drive files, use downloadFile with sheet_name
         const downloadResult = await driveApi.downloadFile(file.driveFileId, currentHeaderRow, sheetName)
         result = {
           columns: downloadResult.columns.map(col => ({
             name: col,
             type: 'text' as const,
             sampleValues: [],
           })),
           sampleData: downloadResult.sample_data,
           sheetName,
         }
       }
       ```
       This mirrors the pattern already used in `handleChangeHeaderRow` (lines 181-193) for non-Sheets Drive files, but adds the `sheetName` parameter.

    3. Also update the existing `handleChangeHeaderRow` call to `driveApi.downloadFile` (line ~183) to pass the current `sheetName` so header row changes preserve the selected sheet:
       ```typescript
       const downloadResult = await driveApi.downloadFile(file.driveFileId, headerRow, sheetName)
       ```
  </action>
  <verify>
    Run: `cd /Users/rgv250cc/Documents/Projects/SheetWorkflowAtomation/frontend && npx tsc --noEmit`
    Expected: No type errors.
  </verify>
  <done>
    - driveApi.downloadFile accepts optional sheetName parameter
    - handleChangeSheet supports Drive Excel files (no more "Sheet selection only available" error)
    - handleChangeHeaderRow preserves selected sheet name when changing header row
  </done>
</task>

</tasks>

<verification>
1. TypeScript compiles: `cd frontend && npx tsc --noEmit` passes
2. Backend model validates: `DownloadRequest(file_id='x', sheet_name='Sheet2')` works
3. No regressions: Google Sheets sheet selection still works (uses readSheet path, untouched)
4. No regressions: Local file sheet selection still works (uses fileApi.parseColumns path, untouched)
</verification>

<success_criteria>
- Backend /drive/download endpoint accepts sheet_name and passes it to download_drive_file_to_df
- Frontend driveApi.downloadFile sends sheet_name in request body
- FilesStep handleChangeSheet works for Drive Excel files (calls downloadFile with sheetName)
- FilesStep handleChangeHeaderRow preserves current sheet name
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/007-enable-sheet-selection-for-drive-excel/007-SUMMARY.md`
</output>
