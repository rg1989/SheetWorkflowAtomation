---
phase: quick
plan: 002
type: execute
subsystem: ui-ux
tags: [google-drive, picker, design-system, tailwind, ui-polish]

requires:
  - "04-02: Drive file selection integrated into workflow wizard"
  - "App design system with primary-* color palette"

provides:
  - "Drive picker filtered to Google Sheets only"
  - "Drive UI components using app design tokens"

affects:
  - "Future Drive-related UI components should use primary-* palette"

tech-stack:
  added: []
  patterns:
    - "react-google-drive-picker viewId configuration for file type filtering"
    - "Consistent design token usage (primary-* colors) across Drive UI"

key-files:
  created: []
  modified:
    - path: "frontend/src/hooks/useDriveFilePicker.ts"
      role: "Drive picker hook with SPREADSHEETS viewId"
    - path: "frontend/src/components/WorkflowWizard/DriveFilePicker.tsx"
      role: "Styled Drive file selection button"
    - path: "frontend/src/components/WorkflowWizard/steps/FilesStep.tsx"
      role: "Connect Drive button with design system colors"

decisions:
  - id: "QUICK-002-01"
    what: "Use SPREADSHEETS viewId (not DOCS) in Google Picker"
    why: "App only processes spreadsheet data, showing all document types adds confusion"
    date: "2026-02-07"
  - id: "QUICK-002-02"
    what: "Replace hardcoded blue-* colors with primary-* palette variables"
    why: "Drive UI should feel native to app, not bolted-on with different color scheme"
    date: "2026-02-07"
  - id: "QUICK-002-03"
    what: "Update description to 'Browse Google Sheets from Drive'"
    why: "Text should reflect the filtered view, not suggest all file types are visible"
    date: "2026-02-07"

metrics:
  duration: "1 min"
  completed: "2026-02-07"
---

# Quick Task 002: Limit Visible Files in Drive Picker + Design System Alignment

**One-liner:** Drive picker now shows only Google Sheets with UI styled using app's primary color palette

## Objective

Filter the Google Drive file picker to show only Google Sheets (not all file types) and update Drive selection UI components to match the app's design system (Inter font, primary-600 colors, rounded-xl corners, consistent button styling).

**Why this matters:** Users should only see Sheets in the picker since the app processes spreadsheet data, and the Drive UI should feel native to the app rather than looking like a separate bolted-on feature.

## What Was Built

### 1. Picker File Type Filter
Changed `viewId` configuration in `useDriveFilePicker` hook from `'DOCS'` (shows all file types) to `'SPREADSHEETS'` (shows only Google Sheets). This is a one-line config change that leverages the `react-google-drive-picker` library's built-in view filtering.

**File:** `frontend/src/hooks/useDriveFilePicker.ts`
- Changed: `viewId: 'DOCS'` → `viewId: 'SPREADSHEETS'`
- Added comment explaining the filter

### 2. Description Text Update
Updated the Drive picker button description from "Browse My Drive and Shared Drives" to "Browse Google Sheets from Drive" to accurately reflect the filtered view.

**File:** `frontend/src/components/WorkflowWizard/DriveFilePicker.tsx`
- Updated subtitle text to reflect Sheets-only filtering

### 3. Design System Color Alignment
Replaced hardcoded `blue-*` colors with the app's `primary-*` palette variables across Drive UI components:

**DriveFilePicker.tsx:**
- Border: `border-slate-300` → `border-slate-200` (matches Card component)
- Hover: `hover:border-blue-500 hover:bg-blue-50` → `hover:border-primary-500 hover:bg-primary-50`
- Icon colors: `text-blue-600` → `text-primary-600`

**FilesStep.tsx (Connect Google Drive button):**
- Hover: `hover:border-blue-500 hover:bg-blue-50` → `hover:border-primary-500 hover:bg-primary-50`
- Icon color: `text-slate-400` → `text-primary-400`

The `rounded-xl` corners and Inter font were already present and correct.

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Filter Drive picker to Sheets only | 90e375f | useDriveFilePicker.ts, DriveFilePicker.tsx |
| 2 | Style Drive UI to match design system | 883ac89 | DriveFilePicker.tsx, FilesStep.tsx |

## Verification Results

All verification criteria passed:

1. ✅ `grep "SPREADSHEETS"` confirms viewId updated in hook
2. ✅ No remaining hardcoded `blue-500` or `blue-600` in Drive UI components
3. ✅ `npx tsc --noEmit` passes with no TypeScript errors
4. ✅ Description text updated to reflect Sheets-only filter

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **SPREADSHEETS viewId filter (QUICK-002-01)**
   - Used Google Picker's built-in `SPREADSHEETS` view to filter visible files
   - Alternative considered: Client-side filtering after picker opens
   - Chose built-in filter for better UX (users never see irrelevant files)

2. **primary-* color palette alignment (QUICK-002-02)**
   - Replaced all hardcoded blue colors with primary-* design tokens
   - Ensures Drive UI feels native to app, not like third-party integration
   - Makes future color scheme changes easier (single source of truth)

3. **Description text update (QUICK-002-03)**
   - Changed "Browse My Drive and Shared Drives" → "Browse Google Sheets from Drive"
   - Text now accurately describes what users will see
   - Sets correct expectations before opening picker

## Known Limitations

1. **Google Picker styling:** The actual picker popup UI (after clicking the button) is Google's own interface and cannot be styled with our design tokens. Only the trigger button in our app uses the app design system.

2. **Excel/CSV files:** This filter removes Excel (.xlsx) and CSV files from the picker. Users must now upload these files locally instead of from Drive. This is intentional - the app will convert Drive-side using Sheets API, so Excel files should be uploaded locally for proper parsing.

## Next Phase Readiness

**Status:** Ready ✅

**Delivered:**
- Drive picker shows only relevant file types (Sheets)
- Drive UI visually cohesive with rest of app
- No TypeScript errors or build issues

**Unblocks:** Any future Drive-related UI features should follow the primary-* palette pattern established here.

**No blockers or concerns.**

## Testing Notes

Manual testing steps to verify:
1. Open workflow wizard and go to Files step
2. Click "Connect Google Drive" (if not connected) or "Select from Google Drive" (if connected)
3. Observe picker opens showing ONLY Google Sheets files (no Docs, PDFs, Excel files visible)
4. Observe Drive selection buttons use same sky-blue colors as other primary actions in app
5. Verify hover states use primary-50 background and primary-500 border
6. Confirm rounded corners are consistent with other cards in the app

## Implementation Quality

- ✅ Clean, minimal changes (4 files, ~10 lines)
- ✅ Leveraged existing library capabilities (viewId config)
- ✅ Consistent with app design patterns
- ✅ No hardcoded values in styling
- ✅ Self-documenting code with inline comments
- ✅ No TypeScript errors
- ✅ Backward compatible (no breaking changes)

## Self-Check: PASSED

Verified all files and commits exist:
- ✅ frontend/src/hooks/useDriveFilePicker.ts modified
- ✅ frontend/src/components/WorkflowWizard/DriveFilePicker.tsx modified
- ✅ frontend/src/components/WorkflowWizard/steps/FilesStep.tsx modified
- ✅ Commit 90e375f exists
- ✅ Commit 883ac89 exists
