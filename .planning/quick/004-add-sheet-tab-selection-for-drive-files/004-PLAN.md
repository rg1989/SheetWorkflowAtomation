---
phase: quick-004
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/WorkflowWizard/DriveFilePicker.tsx
  - frontend/src/components/WorkflowWizard/WorkflowWizard.tsx
  - frontend/src/components/WorkflowWizard/steps/FilesStep.tsx
autonomous: true

must_haves:
  truths:
    - "Drive files (Google Sheets) show a sheet/tab selector dropdown in FileCard when the spreadsheet has multiple tabs"
    - "Selecting a different tab re-fetches columns and sample data for that tab"
    - "The selected tab name persists in the FileDefinition for workflow execution"
  artifacts:
    - path: "frontend/src/components/WorkflowWizard/DriveFilePicker.tsx"
      provides: "Fetches sheet tabs on Google Sheet selection, passes availableSheets and sheetName to onFileReady"
    - path: "frontend/src/components/WorkflowWizard/WorkflowWizard.tsx"
      provides: "handleAddDriveFile accepts and stores availableSheets and sheetName"
  key_links:
    - from: "DriveFilePicker.tsx"
      to: "driveApi.getSheetTabs"
      via: "fetch after downloadFile for Google Sheets"
      pattern: "getSheetTabs"
    - from: "WorkflowWizard.tsx handleAddDriveFile"
      to: "FileDefinition"
      via: "availableSheets and sheetName fields"
      pattern: "availableSheets"
---

<objective>
Add sheet/tab selection for Google Drive files in the workflow wizard, achieving parity with local file behavior.

Purpose: When a user selects a Google Sheet from Drive, they currently cannot choose which tab to use -- it defaults to the first tab silently. Local Excel files show a tab dropdown. This creates confusion when the desired data is on a non-first tab.

Output: Drive files will fetch available sheet tabs at selection time and populate `availableSheets`/`sheetName` on the FileDefinition, enabling the existing FileCard sheet selector dropdown to appear.
</objective>

<execution_context>
@/Users/rgv250cc/.claude/get-shit-done/workflows/execute-plan.md
@/Users/rgv250cc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@frontend/src/components/WorkflowWizard/DriveFilePicker.tsx
@frontend/src/components/WorkflowWizard/WorkflowWizard.tsx
@frontend/src/components/WorkflowWizard/steps/FilesStep.tsx
@frontend/src/components/WorkflowWizard/FileCard.tsx
@frontend/src/lib/api.ts
@frontend/src/types/index.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fetch sheet tabs in DriveFilePicker and wire through to FileDefinition</name>
  <files>
    frontend/src/components/WorkflowWizard/DriveFilePicker.tsx
    frontend/src/components/WorkflowWizard/WorkflowWizard.tsx
    frontend/src/components/WorkflowWizard/steps/FilesStep.tsx
  </files>
  <action>
    The root cause: DriveFilePicker.tsx calls `driveApi.downloadFile()` but never fetches sheet tabs. The `onFileReady` callback and `onAddDriveFile` handler don't accept `availableSheets` or `sheetName`, so `FileDefinition` for Drive files always has `availableSheets: undefined`. Since `FileCard.tsx` only shows the sheet selector when `file.availableSheets?.length > 1`, Drive files never get the dropdown. All the backend infrastructure exists (`/drive/sheets/tabs` endpoint, `driveApi.getSheetTabs()` frontend method, `handleChangeSheet` in FilesStep already handles Drive files). The only gap is at initial file addition time.

    Changes needed:

    1. **DriveFilePicker.tsx** -- In `handleFileSelected`, after the `driveApi.downloadFile()` call succeeds:
       - Check if the picked file's mimeType is `'application/vnd.google-apps.spreadsheet'`
       - If yes, call `const tabsResult = await driveApi.getSheetTabs(pickerFile.id)` to fetch available tabs
       - Extract tab titles: `const availableSheets = tabsResult.tabs.map(t => t.title)`
       - Set `sheetName` to `availableSheets[0]` (the first/default tab)
       - Pass `availableSheets` and `sheetName` to the `onFileReady` callback
       - If not a Google Sheet (Excel/CSV on Drive), do NOT fetch tabs -- these files only have one "sheet" from the backend's perspective
       - Update the `onFileReady` prop type in the `DriveFilePickerProps` interface to include optional `availableSheets?: string[]` and `sheetName?: string` fields in the params object

    2. **FilesStep.tsx** -- Update the `onAddDriveFile` prop type in `FilesStepProps` to include `availableSheets?: string[]` and `sheetName?: string` in the params object. This matches what DriveFilePicker now provides.

    3. **WorkflowWizard.tsx** -- In `handleAddDriveFile`:
       - Add `availableSheets` and `sheetName` to the destructured params type
       - Set `availableSheets: params.availableSheets` and `sheetName: params.sheetName` on the new `FileDefinition` object (currently these are omitted, so they default to undefined)

    Important: Do NOT change FileCard.tsx or the backend -- the sheet selector UI and change-sheet handler already work correctly for Drive files. The only missing piece is populating `availableSheets` and `sheetName` at file addition time.

    Note: The `handleChangeSheet` in FilesStep.tsx already correctly handles Drive files (checks `file.source === 'drive'` and uses `driveApi.readSheet`), so tab switching after initial load requires no changes.
  </action>
  <verify>
    1. `cd /Users/rgv250cc/Documents/Projects/SheetWorkflowAtomation/frontend && npx tsc --noEmit` -- TypeScript compiles without errors
    2. Verify DriveFilePicker.tsx calls `driveApi.getSheetTabs` for Google Sheets mime type
    3. Verify WorkflowWizard.tsx `handleAddDriveFile` sets `availableSheets` and `sheetName` on the FileDefinition
    4. Verify the prop types are consistent across DriveFilePicker -> FilesStep -> WorkflowWizard chain
  </verify>
  <done>
    - Google Sheets selected from Drive have `availableSheets` populated with tab names from the Sheets API
    - Google Sheets selected from Drive have `sheetName` set to the first tab's title
    - FileCard renders the sheet/tab selector dropdown for Drive Google Sheets with multiple tabs (existing UI, now receiving data)
    - Selecting a different tab triggers the existing `handleChangeSheet` flow which re-fetches data for that tab
    - TypeScript compiles clean with no type errors
  </done>
</task>

</tasks>

<verification>
- TypeScript compilation passes (`npx tsc --noEmit`)
- DriveFilePicker fetches tabs for Google Sheets and passes them through
- WorkflowWizard stores availableSheets and sheetName on Drive FileDefinitions
- FileCard shows sheet dropdown for multi-tab Google Sheets from Drive (same as local Excel files)
</verification>

<success_criteria>
Drive files from Google Sheets show a sheet/tab selector in the FileCard header, matching the behavior local Excel files already have. Selecting a different tab re-parses the file with the new tab's data.
</success_criteria>

<output>
After completion, create `.planning/quick/004-add-sheet-tab-selection-for-drive-files/004-SUMMARY.md`
</output>
