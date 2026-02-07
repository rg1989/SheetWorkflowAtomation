---
phase: quick
plan: 002
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/hooks/useDriveFilePicker.ts
  - frontend/src/components/WorkflowWizard/DriveFilePicker.tsx
  - frontend/src/components/WorkflowWizard/steps/FilesStep.tsx
autonomous: true

must_haves:
  truths:
    - "Google Drive picker only shows Google Sheets files (not Docs, PDFs, etc.)"
    - "Drive file selection button matches app design system (Inter font, primary colors, rounded-xl corners)"
    - "Connect Google Drive button in FilesStep matches same styling"
  artifacts:
    - path: "frontend/src/hooks/useDriveFilePicker.ts"
      provides: "Picker configured with SPREADSHEETS viewId"
      contains: "viewId: 'SPREADSHEETS'"
    - path: "frontend/src/components/WorkflowWizard/DriveFilePicker.tsx"
      provides: "Styled picker trigger matching app design"
    - path: "frontend/src/components/WorkflowWizard/steps/FilesStep.tsx"
      provides: "Connect Drive button with consistent styling"
  key_links:
    - from: "useDriveFilePicker.ts"
      to: "Google Picker API"
      via: "viewId config"
      pattern: "viewId.*SPREADSHEETS"
---

<objective>
Filter the Google Drive file picker to show only Google Sheets (not all file types) and update the Drive selection UI components to match the app's design system (Inter font, primary-600 colors, rounded-xl corners, consistent button styling).

Purpose: Users should only see Sheets in the picker since the app processes spreadsheet data, and the Drive UI should feel native to the app rather than looking like a separate bolted-on feature.
Output: Updated picker config and styled Drive selection components.
</objective>

<execution_context>
@/Users/rgv250cc/.claude/get-shit-done/workflows/execute-plan.md
@/Users/rgv250cc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/hooks/useDriveFilePicker.ts
@frontend/src/components/WorkflowWizard/DriveFilePicker.tsx
@frontend/src/components/WorkflowWizard/steps/FilesStep.tsx
@frontend/src/components/ui/Button.tsx
@frontend/src/components/ui/Card.tsx
@frontend/tailwind.config.js
@frontend/src/index.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Filter Drive picker to Sheets only</name>
  <files>frontend/src/hooks/useDriveFilePicker.ts</files>
  <action>
In `useDriveFilePicker.ts`, change the `viewId` from `'DOCS'` (shows all file types) to `'SPREADSHEETS'` (shows only Google Sheets). This is a one-line change on line 25.

The `react-google-drive-picker` library supports `viewId: 'SPREADSHEETS'` which maps to Google Picker's `google.picker.ViewId.SPREADSHEETS` and filters the picker to only show Google Sheets files.

Update the comment on line 26 to reflect this change (currently says SELECT-03 about shared drives, which is on the `supportDrives` line below it - the viewId line has no comment but previously used 'DOCS' to show all file types including Sheets, Excel, CSV).

Also update the description text in DriveFilePicker.tsx (line 89) from "Browse My Drive and Shared Drives" to "Browse Google Sheets from Drive" to reflect the filtered view.
  </action>
  <verify>
Run `grep -n "viewId" frontend/src/hooks/useDriveFilePicker.ts` and confirm it shows `SPREADSHEETS`.
Run `grep -n "Browse" frontend/src/components/WorkflowWizard/DriveFilePicker.tsx` and confirm updated text.
  </verify>
  <done>Drive picker opens showing only Google Sheets files, not all document types. Description text reflects the Sheets-only filter.</done>
</task>

<task type="auto">
  <name>Task 2: Style Drive selection UI to match app design system</name>
  <files>
    frontend/src/components/WorkflowWizard/DriveFilePicker.tsx
    frontend/src/components/WorkflowWizard/steps/FilesStep.tsx
  </files>
  <action>
The app uses a consistent design system: Inter font (via tailwind config), primary-600 sky blue color palette, rounded-xl corners, slate-based neutrals, and consistent button styling from Button.tsx. The Drive-related UI currently uses hardcoded blue-500/blue-600 colors instead of the app's primary-* palette, and some elements lack rounded-xl corners.

**DriveFilePicker.tsx** - Update the trigger button styling:
- Change `border-slate-300` to `border-slate-200` (matches Card component border)
- Change `hover:border-blue-500 hover:bg-blue-50` to `hover:border-primary-500 hover:bg-primary-50` (use app's primary color, not hardcoded blue)
- Keep `rounded-xl` (already present - good)
- Change the icon circle `bg-slate-100` to stay but update icon colors from `text-blue-600` to `text-primary-600`
- Change the text styling: "Select from Google Drive" should use `text-slate-900` (already correct) and the subtitle should use `text-slate-500` (already correct)
- Overall the component should feel like the "Upload from Computer" card beside it in FilesStep

**FilesStep.tsx** - Update the "Connect Google Drive" fallback button (lines 381-394):
- Change `hover:border-blue-500 hover:bg-blue-50` to `hover:border-primary-500 hover:bg-primary-50` (match primary palette)
- Keep `rounded-xl` (already present)
- Change the Cloud icon color from `text-slate-400` to `text-primary-400` for visual consistency with the connected state

These are small class name changes that bring the Drive UI in line with the rest of the app's design tokens. The actual Google Picker popup is Google's own UI and cannot be styled.
  </action>
  <verify>
Run the dev server (`cd frontend && npm run dev`) and visually inspect the FilesStep page.
Grep for any remaining hardcoded `blue-500` or `blue-600` in DriveFilePicker.tsx and FilesStep.tsx (related to Drive button styling) - there should be none in the Drive selection buttons (note: other parts of the app may still use blue legitimately).
Run `npx tsc --noEmit` to confirm no TypeScript errors.
  </verify>
  <done>
Drive file picker button and Connect Google Drive button use primary-* color palette instead of hardcoded blue-*, matching the app's design system. Rounded-xl corners are consistent. Font inherits Inter from tailwind config. The Drive selection cards look visually cohesive with the local upload card beside them.
  </done>
</task>

</tasks>

<verification>
- `grep "SPREADSHEETS" frontend/src/hooks/useDriveFilePicker.ts` returns the viewId line
- `grep "blue-500\|blue-600" frontend/src/components/WorkflowWizard/DriveFilePicker.tsx` returns no matches (all converted to primary-*)
- `npx tsc --noEmit` passes with no errors
- Dev server runs without errors
</verification>

<success_criteria>
1. Google Drive picker opens and shows ONLY Google Sheets (no PDFs, Docs, or other file types visible)
2. The "Select from Google Drive" and "Connect Google Drive" buttons use the app's primary-* color palette with rounded-xl corners
3. No TypeScript or build errors introduced
</success_criteria>

<output>
After completion, create `.planning/quick/002-limit-visible-files-we-can-select-in-dri/002-SUMMARY.md`
</output>
