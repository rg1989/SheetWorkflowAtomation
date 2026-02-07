---
phase: quick-003
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/api/workflows.py
  - frontend/src/pages/RunWorkflowPage.tsx
  - frontend/src/components/ResultsPreview.tsx
  - frontend/src/components/FileNamingModal.tsx
  - frontend/src/lib/api.ts
  - frontend/src/types/index.ts
autonomous: true

must_haves:
  truths:
    - "User sees full scrollable result table after workflow run (all rows, all columns)"
    - "User can search/filter preview data to verify specific rows"
    - "User sees a file naming modal before download or Drive export"
    - "Default file name is workflow name + date timestamp"
    - "Export action only proceeds after user confirms name"
  artifacts:
    - path: "frontend/src/components/FileNamingModal.tsx"
      provides: "Modal dialog for naming export files"
    - path: "frontend/src/components/ResultsPreview.tsx"
      provides: "Full scrollable table with search"
    - path: "backend/app/api/workflows.py"
      provides: "Endpoint returning all result rows as JSON"
  key_links:
    - from: "frontend/src/pages/RunWorkflowPage.tsx"
      to: "frontend/src/components/FileNamingModal.tsx"
      via: "state-driven modal open"
      pattern: "FileNamingModal"
    - from: "frontend/src/pages/RunWorkflowPage.tsx"
      to: "frontend/src/components/ResultsPreview.tsx"
      via: "render with full data"
      pattern: "ResultsPreview"
    - from: "frontend/src/pages/RunWorkflowPage.tsx"
      to: "/api/workflows/{id}/results/{runId}"
      via: "fetch full data after run completes"
      pattern: "fetchJSON.*results"
---

<objective>
Add a file naming modal before export, replace the limited 20-row preview with a full scrollable table showing ALL result data, and add search functionality for verifying rows before download.

Purpose: Users currently see only 20 rows and cannot verify their data is correct before exporting. They also cannot name their output file. This makes the export experience feel unfinished.

Output: FileNamingModal component, ResultsPreview component with search, backend endpoint for full result data, updated RunWorkflowPage integrating all three.
</objective>

<execution_context>
@/Users/rgv250cc/.claude/get-shit-done/workflows/execute-plan.md
@/Users/rgv250cc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@frontend/src/pages/RunWorkflowPage.tsx
@frontend/src/components/ui/Card.tsx
@frontend/src/components/ui/Button.tsx
@frontend/src/components/ui/Input.tsx
@frontend/src/lib/api.ts
@frontend/src/types/index.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add backend endpoint for full result data + FileNamingModal + ResultsPreview components</name>
  <files>
    backend/app/api/workflows.py
    frontend/src/lib/api.ts
    frontend/src/types/index.ts
    frontend/src/components/FileNamingModal.tsx
    frontend/src/components/ResultsPreview.tsx
  </files>
  <action>
**Backend: Add GET endpoint for full result data**

In `backend/app/api/workflows.py`, add a new endpoint AFTER the existing `download_workflow_result` endpoint:

```python
@router.get("/{workflow_id}/results/{run_id}")
async def get_workflow_result_data(
    workflow_id: str,
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
```

This endpoint:
- Verifies run exists, belongs to workflow and user (same pattern as download endpoint)
- Reads the output .xlsx file from `run.output_path` using pandas
- Converts the FULL DataFrame to JSON records (not just head(20))
- Sanitizes NaN -> None and datetime -> isoformat (same pattern as run endpoint lines 431-437)
- Returns `{ "columns": [...], "data": [...records...], "rowCount": N }`

**Frontend types: Add to `frontend/src/types/index.ts`**

Add interface:
```typescript
export interface FullResultData {
  columns: string[]
  data: Record<string, unknown>[]
  rowCount: number
}
```

**Frontend API: Add to `frontend/src/lib/api.ts`**

Add to `workflowApi`:
```typescript
getResultData: (workflowId: string, runId: string) =>
  fetchJSON<FullResultData>(`/workflows/${workflowId}/results/${runId}`),
```

**FileNamingModal component: Create `frontend/src/components/FileNamingModal.tsx`**

A modal overlay component with these props:
```typescript
interface FileNamingModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (fileName: string) => void
  defaultName: string
  actionLabel: string  // "Download" or "Export to Drive"
  isLoading?: boolean
}
```

Implementation details:
- Full-screen backdrop with `bg-black/50` and `fixed inset-0 z-50 flex items-center justify-center`
- Use AnimatePresence + motion.div for fade in/out (consistent with existing framer-motion usage in the app)
- White card container (rounded-xl, shadow-lg, max-w-md w-full mx-4, p-6) matching app Card aesthetic
- Title: "Name your file" (text-lg font-semibold text-slate-900)
- Input field using the existing `<Input>` component from `ui/Input.tsx` with the defaultName pre-filled and auto-selected on mount (use useRef + useEffect to call input.select())
- Show file extension hint below input: ".xlsx" for download, "Google Sheet" for Drive export (text-xs text-slate-500)
- Two buttons at bottom right: "Cancel" (variant="secondary") and actionLabel (variant="primary")
- Close on Escape key (useEffect with keydown listener)
- Close on backdrop click
- Prevent empty file names (disable confirm button if trimmed input is empty)
- When isLoading is true, show Spinner in the confirm button and disable both buttons

**ResultsPreview component: Create `frontend/src/components/ResultsPreview.tsx`**

A full-data scrollable table with search. Props:
```typescript
interface ResultsPreviewProps {
  columns: string[]
  data: Record<string, unknown>[]
  rowCount: number
  isLoading?: boolean
}
```

Implementation details:
- Wrap in a Card component (no extra padding - padding="none")
- CardHeader with CardTitle showing FileSpreadsheet icon + "Results" and a count badge (e.g., "847 rows x 12 columns")
- **Search bar** above the table: Use `<Input>` with a Search icon (from lucide-react) as visual hint via placeholder "Search results...". Position it in the card header area, right side. Use useState for search query. Filter rows where ANY cell value contains the search string (case-insensitive). Show match count next to search field (e.g., "23 of 847 rows" in text-xs text-slate-500).
- **Scrollable viewport**: The table container should have:
  - `overflow-auto` for both horizontal AND vertical scrolling
  - Width: `w-full` (same as current preview table width - fills the card)
  - Height: Use `max-h-[70vh]` to give it a tall vertical feel (resembling A4 proportions where height > width). On the 4xl max-width container (~896px), 70vh will typically be taller than the container width, giving the vertical A4 feel.
  - Sticky header: `<thead>` with `sticky top-0 z-10 bg-slate-50` so column headers stay visible while scrolling vertically
- **Table styling**: Match existing preview table pattern in RunWorkflowPage (lines 1054-1089):
  - Header: `bg-slate-50`, `border-b border-slate-200`, `px-3 py-2 text-left font-medium text-slate-700 whitespace-nowrap`
  - Rows: alternating `bg-white` / `bg-slate-50/50`, `border-b border-slate-100`
  - Cells: `px-3 py-2 text-slate-600 whitespace-nowrap max-w-[200px] truncate` with title attribute for full value on hover
  - Render null/undefined as em-dash character
- **Row numbers**: Add a fixed first column showing row number (1-indexed) with `text-slate-400 text-xs font-mono` styling and `sticky left-0 bg-inherit z-[5]` so it stays visible during horizontal scroll. Give it a right border `border-r border-slate-200`.
- **Loading state**: When isLoading is true, show a Spinner centered in the viewport area
- **Empty search state**: When search has no matches, show "No rows match your search" centered in the table area
- **Performance**: For very large datasets (1000+ rows), this should still be fine since we're using native DOM scrolling (no virtualization needed for typical workflow outputs of a few hundred to a few thousand rows). If the dataset is exceptionally large, the browser handles this natively.
  </action>
  <verify>
- `cd /Users/rgv250cc/Documents/Projects/SheetWorkflowAtomation/backend && python -c "from app.api.workflows import router; print('Backend endpoint compiled OK')"`
- `cd /Users/rgv250cc/Documents/Projects/SheetWorkflowAtomation/frontend && npx tsc --noEmit` passes without errors
- FileNamingModal.tsx exists and exports FileNamingModal
- ResultsPreview.tsx exists and exports ResultsPreview
  </verify>
  <done>
- Backend endpoint GET /workflows/{id}/results/{runId} exists and returns full JSON data
- FileNamingModal component handles open/close, name editing, confirm/cancel, escape key, loading state
- ResultsPreview component shows all columns, all rows, search field with filtering, sticky headers, row numbers, scrollable viewport with vertical A4-like proportions
  </done>
</task>

<task type="auto">
  <name>Task 2: Integrate FileNamingModal and ResultsPreview into RunWorkflowPage</name>
  <files>
    frontend/src/pages/RunWorkflowPage.tsx
  </files>
  <action>
**Modify RunWorkflowPage.tsx to use the new components.**

1. **Add imports** at the top:
   - `import { FileNamingModal } from '../components/FileNamingModal'`
   - `import { ResultsPreview } from '../components/ResultsPreview'`
   - `import type { FullResultData } from '../types'`

2. **Add state** in the RunWorkflowPage component (near the existing state declarations around line 383-398):
   ```typescript
   // Full result data for preview
   const [fullResultData, setFullResultData] = useState<FullResultData | null>(null)
   const [isLoadingFullData, setIsLoadingFullData] = useState(false)

   // File naming modal state
   const [namingModal, setNamingModal] = useState<{
     isOpen: boolean
     action: 'download' | 'drive'
   }>({ isOpen: false, action: 'download' })
   const [fileName, setFileName] = useState('')
   ```

3. **Fetch full data after successful run**: After the existing `handleRun` sets a successful result (line 814-822), add a follow-up fetch for full data. The cleanest approach: add a `useEffect` that watches `result` and when `result?.success && result?.runId` is truthy, fetches full data:
   ```typescript
   useEffect(() => {
     if (result?.success && result?.runId && id) {
       setIsLoadingFullData(true)
       workflowApi.getResultData(id, result.runId)
         .then(setFullResultData)
         .catch(() => {
           // Fallback: use the 20-row preview data from the run result
           setFullResultData(null)
         })
         .finally(() => setIsLoadingFullData(false))
     }
   }, [result?.success, result?.runId, id])
   ```

4. **Generate default file name**: Create a helper function:
   ```typescript
   const getDefaultFileName = () => {
     const now = new Date()
     const timestamp = now.toISOString().slice(0, 16).replace('T', ' ').replace(':', '-')
     return `${workflow?.name ?? 'Result'} - ${timestamp}`
   }
   ```

5. **Modify Download button** (around line 988-995): Instead of a direct `<a>` download link, change to a `<button>` that opens the naming modal:
   ```tsx
   <button
     onClick={() => {
       setFileName(getDefaultFileName())
       setNamingModal({ isOpen: true, action: 'download' })
     }}
     className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
   >
     <Download className="w-4 h-4" />
     Download Result
   </button>
   ```

6. **Modify Export to Drive button** (around line 996-1014): Instead of calling `handleExportToDrive` directly, open the naming modal:
   ```tsx
   <Button
     variant="secondary"
     size="sm"
     onClick={() => {
       setFileName(getDefaultFileName())
       setNamingModal({ isOpen: true, action: 'drive' })
     }}
   >
     <Cloud className="w-4 h-4" />
     Export to Drive
   </Button>
   ```

7. **Handle modal confirm**: Create a handler:
   ```typescript
   const handleNamingConfirm = useCallback(async (confirmedName: string) => {
     if (namingModal.action === 'download') {
       // Trigger download with custom name
       // Create a temporary anchor to download with the chosen filename
       const downloadUrl = workflowApi.downloadUrl(id!, result!.runId!)
       const response = await fetch(downloadUrl, { credentials: 'include' })
       const blob = await response.blob()
       const url = URL.createObjectURL(blob)
       const a = document.createElement('a')
       a.href = url
       a.download = confirmedName.endsWith('.xlsx') ? confirmedName : `${confirmedName}.xlsx`
       document.body.appendChild(a)
       a.click()
       document.body.removeChild(a)
       URL.revokeObjectURL(url)
       setNamingModal({ isOpen: false, action: 'download' })
     } else {
       // Export to Drive with custom name
       setIsExporting(true)
       try {
         const exportResponse = await driveApi.exportCreate(result!.runId!, confirmedName)
         setExportResult({
           url: exportResponse.spreadsheet_url,
           id: exportResponse.spreadsheet_id,
         })
         setNamingModal({ isOpen: false, action: 'download' })
       } catch (err) {
         alert(err instanceof Error ? err.message : 'Failed to export to Drive')
       } finally {
         setIsExporting(false)
       }
     }
   }, [namingModal.action, id, result])
   ```

8. **Replace the old preview table** (lines 1044-1096, the Card with "Preview (X of Y rows)" heading): Replace the entire Card block with:
   ```tsx
   {fullResultData ? (
     <ResultsPreview
       columns={fullResultData.columns}
       data={fullResultData.data}
       rowCount={fullResultData.rowCount}
       isLoading={isLoadingFullData}
     />
   ) : result.previewData && result.columns ? (
     <ResultsPreview
       columns={result.columns}
       data={result.previewData}
       rowCount={result.rowCount ?? result.previewData.length}
       isLoading={isLoadingFullData}
     />
   ) : null}
   ```
   This shows full data when available, falls back to the 20-row preview if the full data fetch fails.

9. **Add FileNamingModal** at the end of the return JSX (just before the closing `</div>` of the page):
   ```tsx
   <FileNamingModal
     isOpen={namingModal.isOpen}
     onClose={() => setNamingModal({ isOpen: false, action: 'download' })}
     onConfirm={handleNamingConfirm}
     defaultName={fileName}
     actionLabel={namingModal.action === 'download' ? 'Download' : 'Export to Drive'}
     isLoading={namingModal.action === 'drive' ? isExporting : false}
   />
   ```

10. **Remove the old `handleExportToDrive` callback** (lines 833-848) since it's now replaced by the naming modal flow in `handleNamingConfirm`.

11. **Add `useEffect` import** if not already present (it is - line 1 already imports it via `useState, useCallback` but need to add `useEffect`).

12. **Reset fullResultData on new run**: In the `handleRun` callback, after `setResult(null)` (line 770), add `setFullResultData(null)`.
  </action>
  <verify>
- `cd /Users/rgv250cc/Documents/Projects/SheetWorkflowAtomation/frontend && npx tsc --noEmit` passes
- `cd /Users/rgv250cc/Documents/Projects/SheetWorkflowAtomation/frontend && npm run build` succeeds
- Manual verification: Run a workflow, confirm full table appears with search, confirm naming modal appears before download/export
  </verify>
  <done>
- RunWorkflowPage shows full scrollable result table with search after workflow run
- Download button opens naming modal with default name (workflow name + timestamp)
- Export to Drive button opens naming modal with default name
- After confirming name, download proceeds with chosen filename or Drive export uses chosen title
- Old 20-row limited preview is replaced with full data view (with fallback to 20-row preview if full data fetch fails)
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>File naming modal, full scrollable table preview with search, and integrated export flow in RunWorkflowPage</what-built>
  <how-to-verify>
    1. Navigate to a workflow and run it with test files
    2. After run completes, verify the results table shows ALL rows (not just 20), with both horizontal and vertical scrolling
    3. Verify the table has sticky column headers that stay visible while scrolling vertically
    4. Verify row numbers appear in the leftmost column and stay sticky during horizontal scroll
    5. Type in the search field above the table - verify rows filter in real-time and match count updates
    6. Click "Download Result" - verify a naming modal appears with default name like "WorkflowName - 2026-02-07 14-30"
    7. Edit the name, confirm, verify the .xlsx downloads with the chosen filename
    8. Click "Export to Drive" - verify naming modal appears, confirm, verify Google Sheet is created with the chosen name
    9. Check the overall visual design matches the app's existing aesthetic (rounded corners, slate colors, consistent spacing)
  </how-to-verify>
  <resume-signal>Type "approved" or describe any issues to fix</resume-signal>
</task>

</tasks>

<verification>
- Backend: GET /workflows/{id}/results/{runId} returns full JSON data for a completed run
- Frontend: Full table renders all rows and columns with scrolling
- Frontend: Search filters rows across all columns, case-insensitive
- Frontend: FileNamingModal appears before both download and Drive export
- Frontend: Default name follows pattern "WorkflowName - YYYY-MM-DD HH-MM"
- Frontend: Export only proceeds after user confirms name
- TypeScript compilation passes with no errors
- Production build succeeds
</verification>

<success_criteria>
- User sees ALL result rows in a scrollable table (not limited to 20)
- User can search within results to verify specific data
- User is prompted to name the file before any export action
- Both download and Drive export respect the chosen filename
- Visual design is consistent with existing app patterns
</success_criteria>

<output>
After completion, create `.planning/quick/003-add-file-naming-modal-full-table-preview/003-SUMMARY.md`
</output>
