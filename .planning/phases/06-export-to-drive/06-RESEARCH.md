# Phase 6: Export to Drive - Research

**Researched:** 2026-02-07
**Domain:** Google Sheets API v4 write operations, DataFrame to Google Sheets export
**Confidence:** HIGH

## Summary

Phase 6 enables users to push workflow results back to Google Drive as Google Sheets, completing the roundtrip Drive integration. The standard approach uses Google Sheets API v4's `spreadsheets.create` to create new spreadsheets and `spreadsheets.values.update` to overwrite existing sheet data. The write path mirrors Phase 2's read architecture, reusing existing service builders, retry decorators, and error handling patterns.

The research confirms that:
1. **spreadsheets.create** returns spreadsheetId and spreadsheetUrl needed for OUTPUT-04 (view link)
2. **spreadsheets.values.update** with USER_ENTERED valueInputOption writes DataFrames cleanly
3. Converting pandas DataFrame to list of lists format: `[df.columns.tolist()] + df.values.tolist()`
4. Reuse existing `drive_retry` decorator and `_handle_drive_error` from drive.py for consistency
5. No need to clear sheets before update—`values.update` overwrites the specified range completely
6. Download option remains untouched (workflows.py already has download endpoint)

**Primary recommendation:** Add write operations to sheets.py (create_spreadsheet, update_sheet_values) mirroring read_sheet_to_df pattern, expose via new endpoints in drive.py, and modify workflows.py to offer Drive export alongside download.

## Standard Stack

The established libraries/tools for Google Sheets write operations:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google-api-python-client | 2.189.0+ (already in project) | Sheets API v4 write methods (create, values.update) | Same library used for read; write is just different methods |
| pandas | 2.1.4+ (already in project) | DataFrame to list conversion via .values.tolist() | Already used throughout project; natural fit |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tenacity | 9.0.0+ (already in project) | Reuse drive_retry decorator for write operations | Consistent error handling with read path |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct Sheets API | gspread, gspread-dataframe | Wrappers add dependency; we already use google-api-python-client for reads |
| Drive API file creation | Sheets API spreadsheets.create | Drive API creates empty sheet; Sheets API creates with initial data/properties |
| Clear then update | Update only | Clearing is unnecessary; update overwrites range completely |

**Installation:**
No new dependencies needed—all libraries already in project (Phase 2).

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── services/
│   ├── drive.py          # Already exists: download, metadata
│   ├── sheets.py         # EXTEND: Add create_spreadsheet(), update_sheet_values()
│   └── google_auth.py    # Already exists: build_sheets_service()
├── api/
│   ├── drive.py          # EXTEND: Add /export/create, /export/update endpoints
│   └── workflows.py      # MODIFY: Add optional export_to_drive parameter to /run
```

### Pattern 1: Create New Spreadsheet with DataFrame
**What:** Convert DataFrame to Google Sheets format, create spreadsheet, return URL
**When to use:** OUTPUT-01 (user creates new sheet with workflow results)
**Example:**
```python
# Source: developers.google.com/sheets/api/guides/create + Phase 2 patterns
from googleapiclient.discovery import build
import asyncio
import pandas as pd

@drive_retry
async def create_spreadsheet(sheets_service, title: str, df: pd.DataFrame) -> dict:
    """
    Create new Google Sheet with DataFrame contents.

    Args:
        sheets_service: Google Sheets API service object
        title: Spreadsheet title
        df: DataFrame to write

    Returns:
        dict: {spreadsheetId, spreadsheetUrl}
    """
    # Convert DataFrame to list of lists (headers + rows)
    values = [df.columns.tolist()] + df.values.tolist()

    # Create spreadsheet with initial data
    spreadsheet_body = {
        "properties": {"title": title},
        "sheets": [{
            "data": [{
                "startRow": 0,
                "startColumn": 0,
                "rowData": [
                    {"values": [{"userEnteredValue": {"stringValue": str(cell)}} for cell in row]}
                    for row in values
                ]
            }]
        }]
    }

    try:
        result = await asyncio.to_thread(
            lambda: sheets_service.spreadsheets().create(
                body=spreadsheet_body,
                fields="spreadsheetId,spreadsheetUrl"
            ).execute()
        )

        return {
            "spreadsheetId": result["spreadsheetId"],
            "spreadsheetUrl": result["spreadsheetUrl"]
        }
    except HttpError as e:
        _handle_drive_error(e, "new_spreadsheet")
```

**Simpler alternative (create then update):**
```python
@drive_retry
async def create_spreadsheet(sheets_service, title: str, df: pd.DataFrame) -> dict:
    """Create new Google Sheet and populate with DataFrame."""
    # Step 1: Create empty spreadsheet
    spreadsheet_body = {"properties": {"title": title}}

    result = await asyncio.to_thread(
        lambda: sheets_service.spreadsheets().create(
            body=spreadsheet_body,
            fields="spreadsheetId,spreadsheetUrl"
        ).execute()
    )

    spreadsheet_id = result["spreadsheetId"]

    # Step 2: Write data to first sheet
    await update_sheet_values(sheets_service, spreadsheet_id, df)

    return result
```

### Pattern 2: Update Existing Sheet with DataFrame
**What:** Overwrite sheet range with DataFrame contents (headers + data)
**When to use:** OUTPUT-02 (user updates existing sheet with workflow results)
**Example:**
```python
# Source: developers.google.com/sheets/api/samples/writing + Phase 2 patterns
@drive_retry
async def update_sheet_values(
    sheets_service,
    spreadsheet_id: str,
    df: pd.DataFrame,
    range_name: str = "Sheet1!A1"
) -> dict:
    """
    Update Google Sheet with DataFrame contents, overwriting existing data.

    Args:
        sheets_service: Google Sheets API service object
        spreadsheet_id: Target spreadsheet ID
        df: DataFrame to write
        range_name: A1 notation range (default: Sheet1!A1)

    Returns:
        dict: Update response with totalUpdatedCells, totalUpdatedRows
    """
    # Convert DataFrame to list of lists (headers + rows)
    values = [df.columns.tolist()] + df.values.tolist()

    body = {
        "values": values
    }

    try:
        result = await asyncio.to_thread(
            lambda: sheets_service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=range_name,
                valueInputOption="USER_ENTERED",  # Parse dates, formulas, etc.
                body=body
            ).execute()
        )

        logger.info(
            "Updated %d cells in spreadsheet %s",
            result.get("updatedCells", 0),
            spreadsheet_id
        )
        return result

    except HttpError as e:
        _handle_drive_error(e, spreadsheet_id)
```

### Pattern 3: Convert DataFrame to Sheets Format
**What:** Convert pandas DataFrame to list of lists (Google Sheets values format)
**When to use:** All write operations (both create and update)
**Example:**
```python
# Source: Community best practices + pandas documentation
def dataframe_to_sheets_values(df: pd.DataFrame) -> list[list]:
    """
    Convert DataFrame to Google Sheets values format.

    Includes column headers as first row.
    Converts NaN to None for JSON serialization.

    Args:
        df: pandas DataFrame

    Returns:
        list[list]: Headers + rows as nested lists
    """
    # Headers as first row
    values = [df.columns.tolist()]

    # Data rows: use .values.tolist() and handle NaN
    for row in df.values.tolist():
        clean_row = [
            None if (isinstance(cell, float) and pd.isna(cell)) else cell
            for cell in row
        ]
        values.append(clean_row)

    return values
```

### Pattern 4: Export Endpoint in API Layer
**What:** REST endpoint that writes workflow result to Drive
**When to use:** Frontend calls after workflow execution completes
**Example:**
```python
# Source: Existing drive.py patterns + workflows.py structure
from pydantic import BaseModel

class ExportToSheetsRequest(BaseModel):
    """Request to export workflow result to Google Sheets."""
    run_id: str
    title: str
    spreadsheet_id: Optional[str] = None  # If updating existing, provide ID

class ExportToSheetsResponse(BaseModel):
    """Response from export operation."""
    success: bool
    spreadsheet_id: str
    spreadsheet_url: str
    updated_cells: int

@router.post("/export", response_model=ExportToSheetsResponse)
async def export_to_sheets(
    request: ExportToSheetsRequest,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Export workflow result to Google Sheets (create new or update existing).

    Creates new spreadsheet if spreadsheet_id not provided.
    Updates existing spreadsheet if spreadsheet_id provided.
    """
    # Get run and load result DataFrame
    run = await get_run(db, request.run_id, current_user.id)
    df = pd.read_excel(run.output_path, engine="openpyxl")

    # Build Sheets service
    sheets_service = await build_sheets_service(current_user, db)

    if request.spreadsheet_id:
        # Update existing sheet
        result = await update_sheet_values(
            sheets_service,
            request.spreadsheet_id,
            df
        )
        # Get URL via Drive metadata
        drive_service = await build_drive_service(current_user, db)
        metadata = await get_drive_file_metadata(drive_service, request.spreadsheet_id)
        spreadsheet_url = metadata["webViewLink"]
        updated_cells = result.get("updatedCells", 0)

        return ExportToSheetsResponse(
            success=True,
            spreadsheet_id=request.spreadsheet_id,
            spreadsheet_url=spreadsheet_url,
            updated_cells=updated_cells
        )
    else:
        # Create new sheet
        result = await create_spreadsheet(sheets_service, request.title, df)

        return ExportToSheetsResponse(
            success=True,
            spreadsheet_id=result["spreadsheetId"],
            spreadsheet_url=result["spreadsheetUrl"],
            updated_cells=len(df) * len(df.columns)
        )
```

### Anti-Patterns to Avoid
- **Clearing sheet before update:** `spreadsheets.values.update` overwrites the range; clearing is redundant API call
- **Using RAW valueInputOption:** USER_ENTERED parses dates/numbers correctly; RAW stores everything as strings
- **Creating with Drive API:** Drive's files.create makes empty sheet; Sheets API's spreadsheets.create is more efficient
- **Not reusing retry decorator:** Write operations need same retry logic as reads; don't hand-roll new backoff
- **Forgetting to check permissions:** User might have view-only access; check before attempting write (OUTPUT-05)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry logic for write operations | Separate retry decorator for writes | Reuse drive_retry from drive.py | Same retryable errors (429, 5xx) apply to writes; consistent behavior |
| Error mapping for write errors | New error handler for Sheets writes | Reuse _handle_drive_error from drive.py | 403/404/429 errors map identically; user-friendly messages already exist |
| DataFrame serialization for Sheets | Custom cell-by-cell loop | df.columns.tolist() + df.values.tolist() | Pandas built-in; handles types correctly; one-liner |
| NaN handling for JSON | Custom recursive sanitizer | List comprehension with pd.isna() check | Simple, explicit, matches existing _sanitize_sample_rows pattern |
| Permission verification | Parse Drive permissions API response | Try write, catch 403, surface error | Simpler; LBYL vs EAFP—Sheets API returns clear 403 if read-only |

**Key insight:** Phase 6 is symmetrical to Phase 2 (read). Almost all infrastructure exists—service builders, retry logic, error handling. Write operations are just different method calls on the same Sheets service. Don't reinvent patterns; extend existing modules.

## Common Pitfalls

### Pitfall 1: Not Handling Large DataFrames
**What goes wrong:** Workflow produces 50k row result → Sheets API times out or hits cell limit
**Why it happens:** Google Sheets has 10 million cell limit per spreadsheet (e.g., 200 columns × 50k rows = 10M cells)
**How to avoid:** Check DataFrame size before export. Warn if exceeding practical limits (~100k rows). Suggest filtering or pagination.
**Warning signs:** Timeout errors on large exports, "Request exceeds quota" messages

### Pitfall 2: Forgetting spreadsheetUrl in Create Response
**What goes wrong:** OUTPUT-04 requires "View in Google Sheets" link, but code only returns spreadsheetId
**Why it happens:** spreadsheets.create returns spreadsheetId by default; must request spreadsheetUrl via fields parameter
**How to avoid:** Always specify `fields="spreadsheetId,spreadsheetUrl"` in create call
**Warning signs:** Frontend can't construct view link, users asked "where is my sheet?"

### Pitfall 3: Using Wrong ValueInputOption
**What goes wrong:** Date column "2024-01-15" stored as string, not date; formulas stored literally
**Why it happens:** RAW valueInputOption treats all input as strings; USER_ENTERED parses intelligently
**How to avoid:** Always use `valueInputOption="USER_ENTERED"` for DataFrame exports (matches UI entry behavior)
**Warning signs:** Dates not sortable, numbers stored as text, formulas not calculating

### Pitfall 4: Not Preserving Download Option (OUTPUT-03)
**What goes wrong:** Replace download endpoint with Drive export → users lose local fallback
**Why it happens:** Misreading requirement as "replace" instead of "add alongside"
**How to avoid:** Keep existing `/download/{run_id}` endpoint untouched. Add new `/export` endpoint as separate option.
**Warning signs:** Users complain about needing Drive access for offline work

### Pitfall 5: Ignoring Write Permission Errors
**What goes wrong:** User has view-only access to shared sheet → 403 error on update → generic error shown
**Why it happens:** Not checking permissions before write; 403 could be storage quota or read-only access
**How to avoid:** Parse 403 error details. Check for "readOnly" or "permission" in error reason. Surface user-friendly message.
**Warning signs:** "Access denied" errors on sheets user can view but not edit

### Pitfall 6: Forgetting asyncio.to_thread Wrapper
**What goes wrong:** Sheets API blocking calls freeze FastAPI async event loop
**Why it happens:** google-api-python-client is synchronous; must wrap in asyncio.to_thread like Phase 2 reads
**How to avoid:** Wrap all `.execute()` calls in `await asyncio.to_thread(lambda: service.method().execute())`
**Warning signs:** API slow under load, concurrent requests blocked, timeouts

## Code Examples

Verified patterns from official sources:

### Create Spreadsheet with Title
```python
# Source: developers.google.com/sheets/api/guides/create
async def create_spreadsheet(sheets_service, title: str) -> dict:
    """Create new Google Sheet with specified title."""
    spreadsheet_body = {
        "properties": {
            "title": title
        }
    }

    result = await asyncio.to_thread(
        lambda: sheets_service.spreadsheets().create(
            body=spreadsheet_body,
            fields="spreadsheetId,spreadsheetUrl"
        ).execute()
    )

    return result  # Contains spreadsheetId and spreadsheetUrl
```

### Update Sheet Range with Values
```python
# Source: developers.google.com/sheets/api/samples/writing
async def update_values(sheets_service, spreadsheet_id: str, values: list[list]):
    """Update Sheet1 starting at A1 with provided values."""
    body = {"values": values}

    result = await asyncio.to_thread(
        lambda: sheets_service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range="Sheet1!A1",
            valueInputOption="USER_ENTERED",
            body=body
        ).execute()
    )

    return result.get("updatedCells", 0)
```

### DataFrame to List of Lists
```python
# Source: Community patterns + pandas docs
def df_to_sheets_format(df: pd.DataFrame) -> list[list]:
    """Convert DataFrame to Google Sheets values format (headers + rows)."""
    return [df.columns.tolist()] + df.values.tolist()

# Usage:
values = df_to_sheets_format(output_df)
await update_values(sheets_service, spreadsheet_id, values)
```

### Batch Update Multiple Ranges
```python
# Source: github.com/googleworkspace/python-samples
async def batch_update_values(sheets_service, spreadsheet_id: str, data: list[dict]):
    """
    Update multiple ranges in one API call.

    Args:
        data: List of {"range": "Sheet1!A1", "values": [[...]]} dicts
    """
    body = {
        "valueInputOption": "USER_ENTERED",
        "data": data
    }

    result = await asyncio.to_thread(
        lambda: sheets_service.spreadsheets().values().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body=body
        ).execute()
    )

    return result.get("totalUpdatedCells", 0)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gspread library wrappers | Direct google-api-python-client | 2020+ | More control, fewer dependencies, same library for read/write |
| Clear then update pattern | Update overwrites range | Always | One API call instead of two; simpler code |
| Drive API for Sheet creation | Sheets API spreadsheets.create | Sheets v4 (2016+) | Returns spreadsheetUrl directly, supports initial data/properties |
| Convert DataFrame via CSV | .values.tolist() method | pandas 0.20+ (2017) | Simpler, faster, no string parsing edge cases |
| Separate retry logic for writes | Same tenacity decorator | Always | Consistent behavior; writes have same retryable errors as reads |

**Deprecated/outdated:**
- **gspread-dataframe set_with_dataframe:** Convenient but adds dependency; direct API call is 10 lines
- **spreadsheets.values.clear before update:** Unnecessary; update overwrites specified range completely
- **Constructing view URLs manually:** spreadsheets.create returns spreadsheetUrl; don't build from ID

## Open Questions

Things that couldn't be fully resolved:

1. **Should we support writing to specific sheet tabs (not just Sheet1)?**
   - What we know: Sheets API supports range like "TabName!A1"; user might want to update specific tab
   - What's unclear: Requirements only mention "update existing Google Sheet" without specifying tab selection
   - Recommendation: Default to "Sheet1!A1" for Phase 6. Add tab selection in Phase 5 (INPUT-05 for reads) and extend to writes in v2.

2. **How to handle OUTPUT-05 (verify edit permissions before write)?**
   - What we know: Drive API has permissions endpoint; could check before write. Or try write and catch 403.
   - What's unclear: Whether proactive check (LBYL) or reactive catch (EAFP) is better UX
   - Recommendation: EAFP approach—try write, catch 403, parse error for "read-only" reason. Simpler, no extra API call.

3. **Should export auto-delete local result file after successful Drive push?**
   - What we know: OUTPUT-03 requires download option remains available (local fallback)
   - What's unclear: Whether both options should persist indefinitely or Drive export replaces local
   - Recommendation: Keep local file after Drive export. User might want both. Add cleanup task in future phase if storage becomes issue.

## Sources

### Primary (HIGH confidence)
- [Create spreadsheets - Google Sheets API](https://developers.google.com/workspace/sheets/api/guides/create) - spreadsheets.create method, request structure
- [Basic writing - Google Sheets API](https://developers.google.com/sheets/api/samples/writing) - spreadsheets.values.update patterns
- [Method: spreadsheets.values.update Reference](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/update) - Parameters, valueInputOption enum
- [ValueInputOption Documentation](https://developers.google.com/workspace/sheets/api/reference/rest/v4/ValueInputOption) - RAW vs USER_ENTERED behavior
- [Google Sheets API Usage Limits](https://developers.google.com/workspace/sheets/api/limits) - Per-minute quotas, timeout limits
- [Python Samples - sheets_batch_update_values.py](https://github.com/googleworkspace/python-samples/blob/main/sheets/snippets/sheets_batch_update_values.py) - Official batch update example
- [Method: spreadsheets.values.batchUpdate Reference](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/batchUpdate) - Multiple range updates

### Secondary (MEDIUM confidence)
- [pandas DataFrame to list conversion patterns](https://docs.kanaries.net/topics/Pandas/dataframe-to-list) - Community best practices for .values.tolist()
- [gspread examples for context](https://docs.gspread.org/en/latest/user-guide.html) - Alternative approach comparison
- Community articles on DataFrame to Google Sheets - Verified patterns with official docs

### Tertiary (LOW confidence)
- Stack Overflow discussions on permission errors - Use as warning signs only, not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Reusing existing libraries from Phase 2, official Google samples verified
- Architecture: HIGH - Patterns mirror proven Phase 2 read architecture, official API docs
- Pitfalls: MEDIUM-HIGH - Mix of official error docs and project-specific considerations

**Research date:** 2026-02-07
**Valid until:** 90 days (Sheets API v4 is stable; no deprecations announced)
