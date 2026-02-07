# Phase 5: Workflow Integration - Research

**Researched:** 2026-02-07
**Domain:** Workflow execution with mixed file sources (Drive + local), file version tracking, Google Sheets tab selection, data preview
**Confidence:** HIGH

## Summary

This phase implements the final integration piece that allows workflows to execute with Drive files as inputs alongside traditional local uploads. The research covers three distinct technical challenges: (1) detecting when Drive files have changed since last run using timestamp comparison, (2) allowing users to select specific tabs from multi-sheet Google Sheets, and (3) providing data preview before workflow execution.

The architecture builds on existing foundations from Phases 2-4. Drive file metadata (including `modifiedTime`) is already captured during file selection (Phase 4) and can be compared against stored values to warn users of stale data. Google Sheets API provides `spreadsheets.get()` to list all sheet tabs with their titles and IDs. The backend `/api/drive/download` endpoint already returns first 5 rows as `sample_data`, which can be displayed as a preview in the frontend before workflow execution.

The key integration point is the workflow run endpoint (`POST /api/workflows/{id}/run`), which currently accepts only local file uploads via `multipart/form-data`. This needs to be extended to accept a mix of local uploads and Drive file references, routing to different parsing paths based on file source type while maintaining the same DataFrame output contract for the workflow engine.

**Primary recommendation:** Extend the workflow run endpoint to accept a JSON payload indicating file sources (local vs. Drive), download Drive files on-demand during execution, implement timestamp comparison logic in frontend to show warnings, add sheet tab selector UI when user picks a Google Sheets file, and display preview data immediately after file selection using existing `/api/drive/download` response.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pandas | 2.x | DataFrame operations and preview | Already in use, `head()` is standard for preview |
| Google Drive API v3 | latest | File metadata with modifiedTime | Google's official API, used in Phase 2 |
| Google Sheets API v4 | latest | List sheet tabs and read specific tabs | Native Sheets integration from Phase 2 |
| FastAPI | 0.104+ | Backend API with mixed request types | Already in use, Form() handles mixed inputs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-dateutil | 2.8.x | Timestamp parsing and comparison | ISO 8601 parsing for modifiedTime strings |
| React Query | 5.x | Cache Drive file metadata | Already in project, use for preview data |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Timestamp comparison | Google Drive Changes API | Changes API is complex overkill for simple version tracking |
| Direct sheet tab selection | Auto-detect with heuristics | Explicit selection is more reliable, user controls intent |
| Separate endpoint for Drive files | Unified run endpoint | Unified is simpler but requires conditional routing |

**Installation:**
No new dependencies required - all libraries already installed.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── api/
│   └── workflows.py              # UPDATE: run endpoint accepts Drive file refs
├── services/
│   ├── drive.py                  # Already has download_drive_file_to_df
│   └── sheets.py                 # UPDATE: add range_name parameter support
├── models/
│   └── workflow.py               # FileDefinition already has driveFileId field
frontend/src/
├── components/
│   ├── WorkflowWizard/
│   │   └── FileCard.tsx          # UPDATE: Add sheet tab selector dropdown
│   └── RunWorkflow/
│       ├── DriveFilePreview.tsx  # NEW: Show preview data for Drive files
│       └── VersionWarning.tsx    # NEW: Warning badge for unchanged files
└── pages/
    └── RunWorkflowPage.tsx       # UPDATE: Handle Drive files at runtime
```

### Pattern 1: Mixed File Source Workflow Execution
**What:** Backend accepts both local uploads and Drive file references in same request
**When to use:** When workflow has mix of local and Drive files (requirement INPUT-06)
**Example:**
```python
# Source: FastAPI Form() + UploadFile patterns
from fastapi import Form, UploadFile, File
from typing import List, Optional
import json

@router.post("/{workflow_id}/run")
async def run_workflow(
    workflow_id: str,
    files: List[UploadFile] = File(default=[]),  # Optional local uploads
    file_configs: str = Form(...),  # JSON string with file source info
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Run workflow with mixed file sources.

    file_configs format:
    {
      "file1": {
        "source": "local",
        "sheetName": "Sheet1",
        "headerRow": 1
      },
      "file2": {
        "source": "drive",
        "driveFileId": "1ABC...",
        "driveMimeType": "application/vnd.google-apps.spreadsheet",
        "sheetName": "Sales Data",
        "headerRow": 1
      }
    }
    """
    configs = json.loads(file_configs)
    dataframes: Dict[str, pd.DataFrame] = {}

    local_file_index = 0
    for expected_file in workflow.config["files"]:
        file_id = expected_file["id"]
        config = configs[file_id]

        if config["source"] == "local":
            # Parse uploaded file
            uploaded = files[local_file_index]
            local_file_index += 1
            # ... existing local file parsing logic
        else:  # source == "drive"
            # Download from Drive
            drive_service = await build_drive_service(current_user, db)
            sheets_service = await build_sheets_service(current_user, db)

            # Build range_name if sheetName specified
            range_name = config.get("sheetName") or ""

            # Download and parse
            df = await download_drive_file_to_df(
                drive_service,
                config["driveFileId"],
                mime_type=config.get("driveMimeType"),
                sheets_service=sheets_service,
                range_name=range_name  # NEW parameter
            )
            dataframes[file_id] = df

    # Execute workflow engine (same as before)
    engine = WorkflowEngine(workflow.config)
    output_df, warnings = engine.execute(dataframes)
    # ... rest of execution
```

### Pattern 2: Google Sheets Tab Selection
**What:** Allow user to select which sheet tab to read from multi-tab spreadsheet
**When to use:** When user selects a Google Sheets file with multiple tabs (requirement INPUT-05)
**Example:**
```typescript
// Frontend: Get tabs list when user selects Drive file
const fetchSheetTabs = async (spreadsheetId: string) => {
  const response = await fetch(`/api/drive/sheets/tabs?spreadsheet_id=${spreadsheetId}`, {
    credentials: 'include',
  })
  const data = await response.json()
  return data.tabs // [{ title, index, sheetId }]
}

// Backend: New endpoint to list tabs
@router.get("/sheets/tabs")
async def get_sheet_tabs(
    spreadsheet_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of sheet tabs in a Google Sheets spreadsheet."""
    sheets_service = await build_sheets_service(current_user, db)
    tabs = await get_sheet_tabs(sheets_service, spreadsheet_id)
    return {"tabs": tabs}

# Backend: Update download to accept range_name
async def download_drive_file_to_df(
    service,
    file_id: str,
    mime_type: Optional[str] = None,
    sheets_service=None,
    range_name: str = ""  # NEW: A1 notation or sheet name
) -> pd.DataFrame:
    # ... existing code
    if mime_type == MIME_GOOGLE_SHEET and sheets_service:
        return await read_sheet_to_df(
            sheets_service,
            file_id,
            range_name=range_name  # Pass through to Sheets API
        )
```

### Pattern 3: File Version Change Detection
**What:** Compare stored Drive file modifiedTime with current metadata to detect changes
**When to use:** When workflow is re-run with remembered Drive file references (requirement INPUT-04)
**Example:**
```typescript
// Source: ISO 8601 timestamp comparison patterns
interface VersionCheckResult {
  hasChanged: boolean
  lastModified: string
  storedModified?: string
}

const checkFileVersion = async (
  driveFileId: string,
  storedModifiedTime?: string
): Promise<VersionCheckResult> => {
  // Fetch current metadata
  const response = await driveApi.getMetadata(driveFileId)
  const currentModified = response.file_metadata.modified_time

  // No stored time = first run, always "changed"
  if (!storedModifiedTime) {
    return {
      hasChanged: true,
      lastModified: currentModified,
    }
  }

  // Compare timestamps
  const current = new Date(currentModified)
  const stored = new Date(storedModifiedTime)

  return {
    hasChanged: current > stored,
    lastModified: currentModified,
    storedModified: storedModifiedTime,
  }
}

// UI Component
function VersionWarning({ fileId, storedTime }: Props) {
  const { data: versionCheck } = useQuery({
    queryKey: ['file-version', fileId],
    queryFn: () => checkFileVersion(fileId, storedTime),
  })

  if (!versionCheck?.hasChanged) {
    return (
      <Badge variant="warning">
        File unchanged since last run
      </Badge>
    )
  }
  return null
}
```

### Pattern 4: Data Preview Before Execution
**What:** Show first 10 rows of Drive file after selection, before running workflow
**When to use:** When user selects Drive file in workflow wizard (requirement INPUT-06)
**Example:**
```typescript
// Source: Existing /api/drive/download response structure
interface DriveFileResponse {
  success: boolean
  file_metadata: { /* ... */ }
  row_count: number
  columns: string[]
  sample_data: Record<string, unknown>[]  // First 5 rows
}

// Frontend: Show preview after file selection
const DriveFilePreview = ({ fileId, mimeType }: Props) => {
  const { data, isLoading } = useQuery({
    queryKey: ['drive-preview', fileId],
    queryFn: async () => {
      const response = await fetch('/api/drive/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId }),
        credentials: 'include',
      })
      return response.json()
    },
  })

  if (isLoading) return <Spinner />

  return (
    <div className="preview-card">
      <h4>Preview: {data.file_metadata.name}</h4>
      <p>{data.row_count} rows, {data.columns.length} columns</p>
      <table>
        <thead>
          <tr>
            {data.columns.map(col => <th key={col}>{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.sample_data.slice(0, 10).map((row, i) => (
            <tr key={i}>
              {data.columns.map(col => <td key={col}>{row[col]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Downloading Drive files during workflow creation:** Download only at execution time to get latest data
- **Storing full DataFrames in workflow config:** Store file references only, not data
- **Requiring all files be same source type:** Allow mixing local and Drive within same workflow
- **Blocking workflow execution on unchanged files:** Show warning but allow user to proceed

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ISO 8601 timestamp parsing | Custom date string parser | Python's `datetime.fromisoformat()` or `dateutil.parser` | Google returns RFC 3339/ISO 8601, native parsing handles timezones |
| DataFrame preview pagination | Custom chunking logic | pandas `df.head(n)` | Already optimized, returns first N rows efficiently |
| File MIME type detection | Pattern matching on extension | Use MIME type from Drive API | Drive API provides authoritative MIME type |
| Multipart form encoding | Manual boundary parsing | FastAPI Form() + UploadFile | Framework handles encoding/decoding correctly |

**Key insight:** Version tracking via timestamp comparison is sufficient for this use case. The full Google Drive Changes API is designed for syncing applications and is overkill when you just need to detect if a single file has been modified since last access.

## Common Pitfalls

### Pitfall 1: Mixing JSON Body with Multipart Form Data
**What goes wrong:** FastAPI endpoint tries to accept both Body(application/json) and UploadFile(multipart/form-data) in same request, causing 422 Unprocessable Entity errors
**Why it happens:** HTTP protocol limitation - request can have ONE content-type
**How to avoid:** Serialize JSON data as Form field string, parse with json.loads() in backend
**Warning signs:** 422 errors when posting to run endpoint, "Expected UploadFile, received JSON" errors

### Pitfall 2: Forgetting Sheet Tab Selection for Google Sheets
**What goes wrong:** User selects multi-tab Google Sheet, app reads wrong tab or defaults to first tab with unexpected data
**Why it happens:** Google Sheets API defaults to first sheet when no range specified
**How to avoid:**
- Always call `get_sheet_tabs()` when user selects Google Sheets MIME type
- Show dropdown selector if `tabs.length > 1`
- Pass selected sheet name as `range_name` parameter to `read_sheet_to_df()`
**Warning signs:** "Missing columns" validation errors, data doesn't match preview

### Pitfall 3: Stale OAuth Token During Long Workflow Runs
**What goes wrong:** Workflow starts with valid token, but Drive API call fails 30+ minutes into execution because token expired (1-hour lifetime)
**Why it happens:** Long-running workflows with many files can exceed token lifetime
**How to avoid:** Call `get_valid_access_token()` before each Drive API operation to trigger automatic refresh
**Warning signs:** HTTP 401 errors mid-workflow, "invalid_grant" OAuth errors

### Pitfall 4: Comparing Timestamps as Strings
**What goes wrong:** Version check incorrectly reports files as "unchanged" when timestamps differ only in milliseconds or timezone
**Why it happens:** String comparison doesn't understand datetime semantics
**How to avoid:** Parse to Date objects before comparing: `new Date(time1) > new Date(time2)`
**Warning signs:** Files report as "unchanged" even after editing, inconsistent version detection

### Pitfall 5: Not Handling Drive File Permission Changes
**What goes wrong:** User selects Drive file, it works, but on workflow re-run the file is inaccessible (HTTP 403)
**Why it happens:** File owner changed permissions, revoked sharing, or user's token lost scope
**How to avoid:**
- Catch HTTP 403 errors during workflow execution
- Show user-friendly error: "Access denied to file X. Please re-select file or check Drive permissions"
- Don't fail entire workflow - let user substitute file
**Warning signs:** HTTP 403 "insufficientFilePermissions", files work in wizard but fail at runtime

## Code Examples

Verified patterns from official sources:

### Timestamp Comparison (Python Backend)
```python
# Source: Python datetime module + Google Drive API response format
from datetime import datetime

def has_file_changed(stored_modified_time: str, current_modified_time: str) -> bool:
    """
    Compare two ISO 8601 timestamps to detect file changes.

    Args:
        stored_modified_time: Previously stored modifiedTime from Drive API
        current_modified_time: Current modifiedTime from Drive API

    Returns:
        True if current is newer than stored, False otherwise
    """
    if not stored_modified_time:
        return True  # First run, consider changed

    stored = datetime.fromisoformat(stored_modified_time.replace('Z', '+00:00'))
    current = datetime.fromisoformat(current_modified_time.replace('Z', '+00:00'))

    return current > stored
```

### DataFrame Preview (Backend)
```python
# Source: pandas.DataFrame.head() documentation
def get_dataframe_preview(df: pd.DataFrame, n: int = 10) -> list[dict]:
    """
    Get first N rows of DataFrame as list of dicts for JSON response.

    Args:
        df: pandas DataFrame
        n: Number of rows to return (default: 10)

    Returns:
        List of dicts with NaN values replaced by None
    """
    preview = df.head(n).to_dict('records')

    # Sanitize NaN values for JSON serialization
    for row in preview:
        for key, value in row.items():
            if isinstance(value, float) and math.isnan(value):
                row[key] = None

    return preview
```

### Sheet Tab Selector (Frontend)
```typescript
// Source: Google Sheets API spreadsheets.get response
interface SheetTab {
  title: string
  index: number
  sheetId: number
}

const SheetTabSelector = ({ spreadsheetId, onSelect }: Props) => {
  const { data: tabs } = useQuery({
    queryKey: ['sheet-tabs', spreadsheetId],
    queryFn: async () => {
      const response = await fetch(
        `/api/drive/sheets/tabs?spreadsheet_id=${spreadsheetId}`,
        { credentials: 'include' }
      )
      return response.json()
    },
  })

  if (!tabs || tabs.length <= 1) return null

  return (
    <select onChange={e => onSelect(e.target.value)}>
      {tabs.map(tab => (
        <option key={tab.sheetId} value={tab.title}>
          {tab.title}
        </option>
      ))}
    </select>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Upload all files locally | Mix Drive and local files | 2026 (this milestone) | Users can skip download step for Drive-native workflows |
| Re-upload for each run | Remember Drive file refs | 2026 (Phase 5) | Faster workflow re-runs, always uses latest data |
| Manual version checking | Automatic timestamp comparison | 2026 (Phase 5) | Users see warnings for stale data |
| Single-sheet only | Multi-tab Google Sheets support | 2026 (Phase 5) | Complex spreadsheets with multiple tabs now usable |

**Deprecated/outdated:**
- **Local-only workflow execution:** Phase 5 extends to support Drive files as first-class inputs
- **Fixed file sources in workflow config:** Now supports dynamic file selection at runtime

## Open Questions

Things that couldn't be fully resolved:

1. **Should version warnings block workflow execution or just warn?**
   - What we know: UX could go either way - warning vs. hard block
   - What's unclear: User preference for "fail safe" vs. "let me proceed anyway"
   - Recommendation: Show warning banner but allow execution (success criterion says "sees warning", not "prevents execution")

2. **How to handle workflows with 10+ files (some Drive, some local)?**
   - What we know: MultipartFormData has size limits, many Drive files = many API calls
   - What's unclear: Performance impact of sequential Drive downloads
   - Recommendation: Start with sequential approach, add parallel download optimization if needed

3. **Should we cache Drive file data after first download?**
   - What we know: Caching would speed up reruns but could show stale data
   - What's unclear: Cache invalidation strategy (TTL vs. explicit refresh)
   - Recommendation: No caching for MVP - always fetch fresh data at workflow execution

## Sources

### Primary (HIGH confidence)
- [Google Drive API - Track Changes](https://developers.google.com/drive/api/guides/manage-changes) - File version tracking and modifiedTime documentation
- [Google Sheets API - spreadsheets.get](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/get) - Sheet tabs enumeration
- [Pandas DataFrame.head()](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.head.html) - Data preview best practices
- [FastAPI Request Forms and Files](https://fastapi.tiangolo.com/tutorial/request-forms-and-files/) - Mixed multipart/form-data handling

### Secondary (MEDIUM confidence)
- [How to Compare Timestamps in Python Pandas](https://blog.finxter.com/5-best-ways-to-compare-timestamps-in-python-pandas/) - Timestamp comparison patterns verified with Python datetime docs
- [Incremental Data Loading with Pandas: 2026 Best Practices](https://copyprogramming.com/howto/incremental-data-load-using-pandas) - Timestamp-based change detection patterns

### Tertiary (LOW confidence)
- None - all critical findings verified with official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Building on proven Phase 2-4 foundations
- Pitfalls: HIGH - Based on FastAPI/Drive API limitations and common patterns

**Research date:** 2026-02-07
**Valid until:** 2026-04-07 (60 days - stable APIs, no fast-moving dependencies)
