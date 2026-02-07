---
phase: quick-001
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/lib/api.ts
  - frontend/src/pages/RunWorkflowPage.tsx
  - frontend/src/pages/HistoryPage.tsx
autonomous: true

must_haves:
  truths:
    - "After a successful workflow run, user sees an 'Export to Drive' button alongside the existing 'Download Result' button"
    - "Clicking 'Export to Drive' creates a new Google Sheet with the workflow results and shows a link to open it"
    - "Export to Drive button only appears when user has Drive connected"
    - "In run history, completed runs show an 'Export to Drive' button alongside the existing 'Excel' download button"
    - "Loading and error states are shown during the export process"
  artifacts:
    - path: "frontend/src/lib/api.ts"
      provides: "driveApi.exportCreate and driveApi.exportUpdate methods"
      contains: "exportCreate"
    - path: "frontend/src/pages/RunWorkflowPage.tsx"
      provides: "Export to Drive button in result section"
      contains: "Export to Drive"
    - path: "frontend/src/pages/HistoryPage.tsx"
      provides: "Export to Drive button per completed run"
      contains: "Export to Drive"
  key_links:
    - from: "frontend/src/pages/RunWorkflowPage.tsx"
      to: "/api/drive/export/create"
      via: "driveApi.exportCreate"
      pattern: "driveApi\\.exportCreate"
    - from: "frontend/src/pages/HistoryPage.tsx"
      to: "/api/drive/export/create"
      via: "driveApi.exportCreate"
      pattern: "driveApi\\.exportCreate"
---

<objective>
Add "Export to Drive" functionality to the workflow results UI and run history page.

Purpose: The backend already has `POST /drive/export/create` and `POST /drive/export/update` endpoints (from Phase 6). This plan wires up the frontend to call these endpoints, giving users a one-click way to push workflow results to Google Sheets instead of downloading locally.

Output: Users see an "Export to Drive" button next to "Download Result" after running a workflow, and next to "Excel" in the history page. Clicking it creates a new Google Sheet and shows a link to view it.
</objective>

<execution_context>
@/Users/rgv250cc/.claude/get-shit-done/workflows/execute-plan.md
@/Users/rgv250cc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/lib/api.ts
@frontend/src/pages/RunWorkflowPage.tsx
@frontend/src/pages/HistoryPage.tsx
@frontend/src/types/index.ts
@backend/app/api/drive.py (lines 64-82 for ExportCreateRequest/ExportResponse models)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Drive export API client methods</name>
  <files>frontend/src/lib/api.ts, frontend/src/types/index.ts</files>
  <action>
Add an `ExportResponse` type to `frontend/src/types/index.ts` in the Google Drive Types section:

```ts
export interface ExportResponse {
  success: boolean
  spreadsheet_id: string
  spreadsheet_url: string
  updated_cells: number
}
```

Add two methods to the `driveApi` object in `frontend/src/lib/api.ts`:

1. `exportCreate(runId: string, title: string)` - calls `POST /drive/export/create` with `{ run_id: runId, title }`, returns `ExportResponse`
2. `exportUpdate(runId: string, spreadsheetId: string)` - calls `POST /drive/export/update` with `{ run_id: runId, spreadsheet_id: spreadsheetId }`, returns `ExportResponse`

Both use the existing `fetchJSON` helper. Import `ExportResponse` from types.
  </action>
  <verify>TypeScript compiles: `cd frontend && npx tsc --noEmit`</verify>
  <done>driveApi.exportCreate and driveApi.exportUpdate are available and typed</done>
</task>

<task type="auto">
  <name>Task 2: Add Export to Drive button on RunWorkflowPage result section</name>
  <files>frontend/src/pages/RunWorkflowPage.tsx</files>
  <action>
In the result success card (around line 863-872 where the "Download Result" anchor tag is), add an "Export to Drive" button next to it. Implementation details:

1. Add state for export: `const [isExporting, setIsExporting] = useState(false)` and `const [exportResult, setExportResult] = useState<{ url: string; id: string } | null>(null)`
2. Import `driveApi` (already imported) and the `Cloud` icon (already imported). Import `ExternalLink` from lucide-react for the "View in Sheets" link.
3. Create a `handleExportToDrive` async function that:
   - Sets `isExporting` to true
   - Calls `driveApi.exportCreate(result.runId, workflow.name + ' - Results')`
   - On success, sets `exportResult` with `{ url: response.spreadsheet_url, id: response.spreadsheet_id }`
   - On error, shows error via a simple alert or inline error text
   - Sets `isExporting` to false in finally
4. Render the button ONLY when `driveConnected` is true (already available from `useAuth()`):
   - Before export: Show button with Cloud icon + "Export to Drive" text, disabled while `isExporting`, show Spinner when loading
   - After export: Show a green "View in Google Sheets" link (`<a>` tag with ExternalLink icon, href={exportResult.url}, target="_blank") that replaces the export button
5. Layout: Wrap the Download and Export buttons in a `flex items-center gap-2` container
6. Reset `exportResult` to null when a new workflow run starts (in `handleRun`, alongside `setResult(null)`)
  </action>
  <verify>TypeScript compiles: `cd frontend && npx tsc --noEmit`</verify>
  <done>After a successful workflow run, "Export to Drive" button appears next to "Download Result" (only when Drive connected). Clicking it exports and shows a "View in Google Sheets" link.</done>
</task>

<task type="auto">
  <name>Task 3: Add Export to Drive button on HistoryPage</name>
  <files>frontend/src/pages/HistoryPage.tsx</files>
  <action>
In the HistoryPage, add an "Export to Drive" button next to the existing "Excel" download button for completed runs. Implementation details:

1. Import `Cloud` from lucide-react (add to existing import). Import `driveApi` from `../lib/api` (add to existing import). Import `useAuth` from `../context/AuthContext`.
2. Get `driveConnected` from `useAuth()` hook at the top of the component.
3. Add state to track which run is currently exporting and which have been exported:
   - `const [exportingRunId, setExportingRunId] = useState<string | null>(null)`
   - `const [exportedRuns, setExportedRuns] = useState<Record<string, string>>({})` (maps runId -> spreadsheet URL)
4. Create `handleExportToDrive` async function that:
   - Takes `runId: string` and `workflowName: string`
   - Sets `exportingRunId` to runId
   - Calls `driveApi.exportCreate(runId, workflowName + ' - Results')`
   - On success, adds to `exportedRuns` map: `{ ...prev, [runId]: response.spreadsheet_url }`
   - On error, alerts the error message
   - Sets `exportingRunId` to null in finally
5. In the run card actions area (around line 136-145), after the existing Excel download button and before the delete button, conditionally render:
   - If `exportedRuns[run.id]` exists: show a small green "Sheets" link (`<a>` tag, href to the URL, target="_blank")
   - Else if `driveConnected` and `run.status === 'completed'`: show "Export to Drive" Button (variant="secondary", size="sm") with Cloud icon, disabled when `exportingRunId === run.id`, show Spinner when exporting
  </action>
  <verify>TypeScript compiles: `cd frontend && npx tsc --noEmit`</verify>
  <done>Completed runs in history show "Export to Drive" button (when Drive connected). After export, button changes to "Sheets" link opening the Google Sheet.</done>
</task>

</tasks>

<verification>
1. `cd frontend && npx tsc --noEmit` passes with no errors
2. Manual verification: Run a workflow, confirm "Export to Drive" button appears next to "Download Result" when Drive is connected
3. Manual verification: Click "Export to Drive", confirm it creates a Google Sheet and shows "View in Google Sheets" link
4. Manual verification: Visit History page, confirm "Export to Drive" button appears for completed runs
5. Manual verification: When Drive is NOT connected, the export buttons do not appear
</verification>

<success_criteria>
- driveApi.exportCreate and driveApi.exportUpdate are typed and functional in api.ts
- RunWorkflowPage shows "Export to Drive" button in result card (Drive connected only)
- HistoryPage shows "Export to Drive" button per completed run (Drive connected only)
- Export creates Google Sheet and displays link to view it
- TypeScript compiles with no errors
</success_criteria>

<output>
After completion, create `.planning/quick/001-upload-workflow-results-to-drive/001-SUMMARY.md`
</output>
