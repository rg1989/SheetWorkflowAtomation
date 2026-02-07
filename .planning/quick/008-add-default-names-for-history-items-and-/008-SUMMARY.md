---
phase: quick-008
plan: 01
subsystem: ui
tags: [react, typescript, file-naming, user-experience]

# Dependency graph
requires:
  - phase: quick-001
    provides: FileNamingModal component for consistent file naming UX
provides:
  - Consistent FileNamingModal UX across all download/export locations (HistoryPage, WorkflowCard, RunWorkflowPage)
  - Default file names with "{WorkflowName} - {relative timestamp}" format
affects: [future file download/export features]

# Tech tracking
tech-stack:
  added: []
  patterns: [FileNamingModal integration pattern for downloads and exports]

key-files:
  created: []
  modified:
    - frontend/src/pages/HistoryPage.tsx
    - frontend/src/components/WorkflowCard.tsx

key-decisions:
  - "Use formatRelativeTime for timestamps in default names (e.g., '2 hours ago') for human-friendly naming"
  - "Download action uses blob creation with custom filename to avoid browser-generated names"
  - "Export to Drive action shows loading spinner in modal during export"

patterns-established:
  - "FileNamingModal pattern: Generate default name, open modal before action, execute action with confirmed name"
  - "Default file name format: '{WorkflowName} - {relative timestamp}' for consistency across app"

# Metrics
duration: 2min
completed: 2026-02-07
---

# Quick Task 008: Add Default Names for History Items Summary

**Unified file naming experience across HistoryPage and WorkflowCard with sensible default names based on workflow name and relative timestamps**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-07T20:02:14Z
- **Completed:** 2026-02-07T20:04:36Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added FileNamingModal to HistoryPage for both Excel downloads and Drive exports
- Added FileNamingModal to WorkflowCard collapsible history downloads
- Consistent default naming: "{WorkflowName} - {relative timestamp}" (e.g., "Invoice Processor - 2 hours ago")
- All download/export actions now prompt for filename before executing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add FileNamingModal to HistoryPage for downloads and Drive exports** - `0905532` (feat)
2. **Task 2: Add FileNamingModal to WorkflowCard collapsible history downloads** - `750679a` (feat)

## Files Created/Modified
- `frontend/src/pages/HistoryPage.tsx` - Added FileNamingModal for Excel downloads and Drive exports with default name generation
- `frontend/src/components/WorkflowCard.tsx` - Added FileNamingModal for collapsible history downloads with default name generation

## Decisions Made

**Use formatRelativeTime for human-friendly default names:**
- Default file names use relative timestamps (e.g., "2 hours ago", "3 days ago") instead of ISO timestamps
- Provides more intuitive default names that users can easily understand
- Format: "{WorkflowName} - {formatRelativeTime(createdAt)}"

**Blob download approach for custom filenames:**
- HistoryPage and WorkflowCard both use fetch + blob + createObjectURL + anchor.download pattern
- Ensures user-specified filename is respected (not browser-generated)
- Automatically appends .xlsx extension if not present

**Modal loading state during Drive export:**
- Export to Drive shows spinner in modal during async operation
- Download action doesn't need loading state (synchronous blob creation)
- Consistent with RunWorkflowPage export UX

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- File naming UX is now consistent across all download/export locations in the app
- Pattern is established for any future file operations requiring user-provided names
- No known issues or blockers

## Self-Check: PASSED

---
*Phase: quick-008*
*Completed: 2026-02-07*
