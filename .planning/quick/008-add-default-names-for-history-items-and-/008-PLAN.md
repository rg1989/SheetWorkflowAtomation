---
phase: quick-008
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/pages/HistoryPage.tsx
  - frontend/src/components/WorkflowCard.tsx
autonomous: true

must_haves:
  truths:
    - "Clicking Download Excel on HistoryPage opens FileNamingModal with default name before downloading"
    - "Clicking Export to Drive on HistoryPage opens FileNamingModal with default name before exporting"
    - "Clicking download icon in WorkflowCard collapsible history opens FileNamingModal with default name before downloading"
    - "Default name format is consistent: '{WorkflowName} - {relative timestamp}'"
  artifacts:
    - path: "frontend/src/pages/HistoryPage.tsx"
      provides: "FileNamingModal integration for download and Drive export"
      contains: "FileNamingModal"
    - path: "frontend/src/components/WorkflowCard.tsx"
      provides: "FileNamingModal integration for collapsible history downloads"
      contains: "FileNamingModal"
  key_links:
    - from: "frontend/src/pages/HistoryPage.tsx"
      to: "frontend/src/components/FileNamingModal.tsx"
      via: "import and render"
      pattern: "import.*FileNamingModal"
    - from: "frontend/src/components/WorkflowCard.tsx"
      to: "frontend/src/components/FileNamingModal.tsx"
      via: "import and render"
      pattern: "import.*FileNamingModal"
---

<objective>
Add FileNamingModal to HistoryPage and WorkflowCard collapsible history so users can name their files before downloading or exporting to Drive -- matching the existing UX in RunWorkflowPage.

Purpose: Currently, HistoryPage downloads use a raw URL popup and exports use a hardcoded name. WorkflowCard collapsible history downloads also use a raw URL popup with no naming option. This makes the naming experience inconsistent across the app.

Output: Both HistoryPage and WorkflowCard will open the FileNamingModal before download/export, with a sensible default name of "{WorkflowName} - {relative timestamp}".
</objective>

<execution_context>
@/Users/rgv250cc/.claude/get-shit-done/workflows/execute-plan.md
@/Users/rgv250cc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/pages/HistoryPage.tsx
@frontend/src/components/WorkflowCard.tsx
@frontend/src/components/FileNamingModal.tsx
@frontend/src/pages/RunWorkflowPage.tsx (reference for existing FileNamingModal usage pattern)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add FileNamingModal to HistoryPage for downloads and Drive exports</name>
  <files>frontend/src/pages/HistoryPage.tsx</files>
  <action>
    Add FileNamingModal integration to HistoryPage, following the same pattern used in RunWorkflowPage.

    1. Import FileNamingModal from '../components/FileNamingModal'
    2. Add state for the naming modal:
       - `namingModal: { isOpen: boolean; action: 'download' | 'drive'; runId: string; workflowName: string }`
       - `fileName: string`
    3. Create a `getDefaultFileName(workflowName: string, createdAt: string)` function that generates:
       `"{WorkflowName} - {formatRelativeTime(createdAt)}"` (e.g., "Invoice Processor - 2 hours ago")
    4. Modify `handleDownload` to open the modal instead of directly opening window:
       - Set namingModal state with action='download', the runId, and workflowName
       - Set fileName to getDefaultFileName(workflowName, run.createdAt)
    5. Modify `handleExportToDrive` to open the modal instead of directly exporting:
       - Set namingModal state with action='drive', the runId, and workflowName
       - Set fileName to getDefaultFileName(workflowName, run.createdAt)
    6. Create `handleNamingConfirm(confirmedName: string)` callback:
       - For 'download': Fetch the download URL via `fetch(runApi.downloadUrl(runId, 'excel'))`, create a blob, create anchor element with `a.download = confirmedName.endsWith('.xlsx') ? confirmedName : confirmedName + '.xlsx'`, click it, revoke URL. Close modal.
       - For 'drive': Call `driveApi.exportCreate(runId, confirmedName)`, set exportedRuns state with the spreadsheet_url, close modal. Keep existing try/catch/finally pattern with exportingRunId spinner.
    7. Render FileNamingModal at bottom of component (before closing div), passing:
       - isOpen, onClose, onConfirm=handleNamingConfirm, defaultName=fileName
       - actionLabel based on namingModal.action ('Download' or 'Export to Drive')
       - isLoading: exportingRunId for drive action, false for download
    8. Update the Excel download button onClick to call the new modal-opening handler (pass run.id, run.createdAt, workflowName)
    9. Update the Export to Drive button onClick to call the new modal-opening handler (pass run.id, workflowName)
  </action>
  <verify>
    Run `cd /Users/rgv250cc/Documents/Projects/SheetWorkflowAtomation/frontend && npx tsc --noEmit` to verify no TypeScript errors.
    Visually confirm FileNamingModal import is present and rendered.
  </verify>
  <done>
    HistoryPage shows FileNamingModal when clicking Download Excel or Export to Drive. Default name is "{WorkflowName} - {relative time}". Download produces a named .xlsx file. Export creates a named Google Sheet.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add FileNamingModal to WorkflowCard collapsible history downloads</name>
  <files>frontend/src/components/WorkflowCard.tsx</files>
  <action>
    Add FileNamingModal to WorkflowCard's collapsible run history section. Since WorkflowCard already has access to workflow.name and run.createdAt, the default name can be generated easily.

    1. Import FileNamingModal from './FileNamingModal'
    2. Add state:
       - `namingModal: { isOpen: boolean; runId: string }` (only download, no Drive export here)
       - `fileName: string`
    3. Create `getDefaultFileName(createdAt: string)` that returns:
       `"{workflow.name} - {formatRelativeTime(createdAt)}"` (workflow.name available from props)
    4. Modify `handleDownload` to open the modal instead of directly opening window:
       - Accept both runId and createdAt as parameters
       - Set namingModal state with runId
       - Set fileName to getDefaultFileName(createdAt)
    5. Create `handleNamingConfirm(confirmedName: string)` callback:
       - Fetch via `fetch(runApi.downloadUrl(namingModal.runId, 'excel'))` with `{ credentials: 'include' }`
       - Create blob, create anchor with `a.download = confirmedName.endsWith('.xlsx') ? confirmedName : confirmedName + '.xlsx'`
       - Click, cleanup, close modal
    6. Update the Download button onClick in the collapsed history section to pass `run.id` and `run.createdAt`
    7. Render FileNamingModal at bottom of the component (before final closing div), with:
       - isOpen={namingModal.isOpen}
       - onClose to reset namingModal
       - onConfirm={handleNamingConfirm}
       - defaultName={fileName}
       - actionLabel="Download"
  </action>
  <verify>
    Run `cd /Users/rgv250cc/Documents/Projects/SheetWorkflowAtomation/frontend && npx tsc --noEmit` to verify no TypeScript errors.
    Visually confirm FileNamingModal import is present and rendered in WorkflowCard.
  </verify>
  <done>
    WorkflowCard collapsible history download button opens FileNamingModal with default name "{WorkflowName} - {relative time}". Confirmed download produces a named .xlsx file via blob download.
  </done>
</task>

</tasks>

<verification>
1. `cd /Users/rgv250cc/Documents/Projects/SheetWorkflowAtomation/frontend && npx tsc --noEmit` passes
2. `FileNamingModal` is imported and rendered in both HistoryPage.tsx and WorkflowCard.tsx
3. No direct `window.open` download calls remain in HistoryPage or WorkflowCard (all go through modal)
4. HistoryPage Export to Drive goes through modal (no direct `driveApi.exportCreate` without modal)
</verification>

<success_criteria>
- All download/export actions across HistoryPage and WorkflowCard open FileNamingModal first
- Default file names follow pattern "{WorkflowName} - {relative timestamp}"
- TypeScript compiles without errors
- Existing RunWorkflowPage naming modal behavior unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/008-add-default-names-for-history-items-and-/008-SUMMARY.md`
</output>
