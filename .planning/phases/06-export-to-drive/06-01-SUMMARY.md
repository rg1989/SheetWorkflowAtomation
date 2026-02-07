---
phase: "06"
plan: "01"
subsystem: "drive-integration"
tags: ["google-sheets", "drive-api", "export", "rest-api"]

requires:
  - "02-01 (Drive service foundation)"
  - "02-02 (Sheets API read operations)"
  - "03-01 (REST API endpoints for Drive/Sheets)"

provides:
  - "Google Sheets write operations (create, update)"
  - "Export REST endpoints for pushing workflow results to Drive"
  - "Completed Drive roundtrip (read from Drive, write back to Drive)"

affects:
  - "Phase 04 (Frontend needs export UI for create/update buttons)"
  - "Phase 06 (Export completes Drive integration feature set)"

tech-stack:
  added: []
  patterns:
    - "Reuse drive_retry decorator for write operations"
    - "DataFrame to Sheets values conversion with NaN handling"
    - "Run ownership validation before export"
    - "USER_ENTERED valueInputOption for type parsing"

key-files:
  created:
    - "None (extended existing files)"
  modified:
    - "backend/app/services/sheets.py"
    - "backend/app/api/drive.py"

decisions:
  - slug: "use-user-entered-value-input"
    title: "Use USER_ENTERED valueInputOption (not RAW)"
    rationale: "USER_ENTERED parses dates/numbers correctly, RAW treats everything as strings"
  - slug: "return-spreadsheet-url-in-response"
    title: "Include spreadsheet_url in ExportResponse"
    rationale: "Frontend needs URL for 'View in Google Sheets' link"
  - slug: "validate-run-completion-before-export"
    title: "Validate run status is COMPLETED before exporting"
    rationale: "Prevent exporting incomplete or failed workflow results"
  - slug: "preserve-download-endpoint"
    title: "Keep existing /download endpoint in runs.py untouched"
    rationale: "Users still need local download option alongside Drive export"

metrics:
  duration: "2 min"
  completed: "2026-02-07"
---

# Phase 06 Plan 01: Export to Drive Summary

**One-liner:** Google Sheets write operations (create/update) with REST endpoints for exporting workflow results to Drive

## What Was Built

### Service Layer (sheets.py)
Added three new functions to handle Google Sheets write operations:

1. **dataframe_to_sheets_values()**
   - Converts pandas DataFrame to Google Sheets values format (list of lists)
   - First row contains column headers
   - Replaces NaN values with None for JSON serialization
   - Mirrors existing _sanitize_sample_rows pattern for consistency

2. **create_spreadsheet()**
   - Creates new Google Sheet with DataFrame contents
   - Uses Sheets API v4 spreadsheets().create() endpoint
   - Returns spreadsheet ID and URL for frontend "View in Sheets" link
   - Delegates to update_sheet_values() to populate initial data
   - Decorated with @drive_retry for rate limit handling
   - Uses asyncio.to_thread() for FastAPI compatibility

3. **update_sheet_values()**
   - Updates existing Google Sheet with DataFrame contents
   - Uses Sheets API v4 spreadsheets().values().update() endpoint
   - valueInputOption="USER_ENTERED" for correct date/number parsing
   - Range defaults to "Sheet1!A1" but can be customized
   - Returns API result with updatedCells count
   - Decorated with @drive_retry for rate limit handling
   - Error handling via _handle_drive_error() for 403/404/429

### API Layer (drive.py)
Added two new REST endpoints for exporting workflow results:

1. **POST /export/create**
   - Creates new Google Sheet from workflow run output
   - Request: ExportCreateRequest(run_id, title)
   - Response: ExportResponse(success, spreadsheet_id, spreadsheet_url, updated_cells)
   - Validates run ownership (run.user_id == current_user.id)
   - Validates run completion (status == COMPLETED)
   - Validates output file exists (run.output_path)
   - Reads output Excel file to DataFrame
   - Calls create_spreadsheet() service function
   - Returns 401 if Drive not connected, 403 if permission denied, 404 if run/file not found

2. **POST /export/update**
   - Updates existing Google Sheet with workflow run output
   - Request: ExportUpdateRequest(run_id, spreadsheet_id)
   - Response: ExportResponse(success, spreadsheet_id, spreadsheet_url, updated_cells)
   - Same validation flow as /export/create
   - Calls update_sheet_values() service function
   - Fetches spreadsheet metadata from Drive to get webViewLink
   - Returns 401 if Drive not connected, 403 if read-only sheet, 404 if run/file/sheet not found

### Existing Functionality Preserved
- Existing /download endpoint in runs.py remains completely untouched
- Users can still download Excel files locally (not forced to use Drive)
- Existing Drive read operations (/download, /read) continue to work

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add Sheets write operations to service layer | 1d26db6 | backend/app/services/sheets.py |
| 2 | Add export REST endpoints to API layer | cdd8abb | backend/app/api/drive.py |

## Decisions Made

### 1. Use USER_ENTERED valueInputOption (not RAW)
**Context:** Google Sheets API supports RAW (treats everything as string) or USER_ENTERED (parses types).

**Decision:** Use USER_ENTERED for all write operations.

**Rationale:**
- USER_ENTERED correctly parses dates (e.g., "2024-01-01" becomes a date cell)
- USER_ENTERED correctly parses numbers (e.g., "123" becomes numeric, not string)
- RAW would require all cells to be pre-formatted, adding complexity
- Matches user expectation when manually pasting data into Sheets

**Impact:** Export output matches manual entry behavior.

### 2. Return spreadsheet_url in ExportResponse
**Context:** Frontend needs to show "View in Google Sheets" link after export.

**Decision:** Include spreadsheet_url field in ExportResponse.

**Rationale:**
- Create operation gets URL directly from spreadsheets().create() response
- Update operation fetches URL via get_drive_file_metadata()
- Single API call returns both success confirmation and view link
- Avoids frontend making separate metadata request

**Impact:** Frontend can render link immediately after export completes.

### 3. Validate run completion before export
**Context:** Runs can be in preview, completed, or failed state.

**Decision:** Return 400 error if run status != COMPLETED.

**Rationale:**
- Preview runs haven't executed workflow yet (no output)
- Failed runs may have partial/corrupt output
- Only completed runs have valid, final results
- Clear error message prevents user confusion

**Impact:** Users cannot accidentally export incomplete results.

### 4. Preserve existing download endpoint
**Context:** Adding Drive export could replace local download feature.

**Decision:** Keep /download endpoint in runs.py completely untouched.

**Rationale:**
- Some users may not have Drive connected
- Some users may prefer local files (offline work, audit trails)
- Drive export is an ADDITION, not a REPLACEMENT
- Aligns with OUTPUT-03 requirement in must_haves

**Impact:** No breaking changes, backward compatible.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification checks passed:

1. **Import check:** All new functions and models import successfully
   ```
   create_spreadsheet, update_sheet_values, dataframe_to_sheets_values
   ExportCreateRequest, ExportUpdateRequest, ExportResponse
   ```

2. **DataFrame conversion:** Correctly converts DataFrame to Sheets values format
   - Headers become first row
   - NaN values replaced with None
   - Data integrity preserved

3. **Endpoint registration:** Both export endpoints registered in router
   ```
   ['/download', '/read', '/export/create', '/export/update']
   ```

4. **Existing endpoints preserved:** Download endpoint still present in runs.py
   ```
   ['/{run_id}/download/{file_type}']
   ```

## Technical Notes

### Error Handling Strategy
All write operations delegate to existing error handling infrastructure:
- **drive_retry decorator:** 5 attempts with exponential backoff for 429/5xx
- **_handle_drive_error():** Maps 403 → permission denied, 404 → not found, 429 → rate limit
- **HTTPException propagation:** Service layer exceptions pass through to API layer
- **ValueError → 401:** Indicates Drive not connected (missing/expired tokens)

### NaN Handling
DataFrame NaN values are explicitly converted to None:
```python
if pd.isna(cell):
    row_values.append(None)
```

This prevents JSON serialization errors when returning data to frontend.

### Async Patterns
All Google API calls wrapped in `asyncio.to_thread()`:
```python
result = await asyncio.to_thread(
    lambda: sheets_service.spreadsheets().create(...).execute()
)
```

This matches existing pattern from read operations (02-02).

## Next Phase Readiness

### Phase 04 (Frontend Picker UI)
**Ready:** Backend export API is complete and documented.

**Frontend requirements:**
- Add "Export to Drive" button in run results UI
- Show modal with "Create New Sheet" vs "Update Existing Sheet" options
- For create: text input for sheet title
- For update: Drive Picker to select target sheet
- Call /export/create or /export/update endpoint
- Display spreadsheet_url as "View in Google Sheets" link

**Frontend error handling:**
- 401: Show "Reconnect Drive" prompt
- 403: Show "Permission denied - sheet may be read-only"
- 404: Show "Run output not found - try re-running workflow"
- 400: Show "Workflow not completed yet"

### Integration Points
- Frontend uses existing get_valid_access_token() from 03-01 for Picker
- Picker returns spreadsheet_id → passes to /export/update endpoint
- Export response includes spreadsheet_url → frontend renders link
- Error responses align with existing Drive connection error handling

### Testing Recommendations
- **Create operation:** Export sample workflow to new sheet, verify data matches Excel output
- **Update operation:** Export to existing sheet, verify old data completely replaced
- **Permission errors:** Try exporting to read-only sheet (shared with "Viewer" permission)
- **Rate limiting:** Rapid-fire exports should retry automatically via @drive_retry
- **Offline mode:** Disconnect Drive, verify 401 error with reconnect prompt

## Success Criteria

- [x] sheets.py has three new exports: create_spreadsheet, update_sheet_values, dataframe_to_sheets_values
- [x] drive.py API has two new POST endpoints: /export/create and /export/update
- [x] Both endpoints validate run ownership and completion status before exporting
- [x] ExportResponse includes spreadsheet_url for "View in Google Sheets" link
- [x] All write operations use drive_retry decorator for rate limit handling
- [x] All write operations delegate to _handle_drive_error for 403/404 errors
- [x] Existing /download endpoint in runs.py is completely untouched
- [x] All verification commands pass without errors

## Self-Check: PASSED

All key files exist:
- backend/app/services/sheets.py (modified, not created)
- backend/app/api/drive.py (modified, not created)

All commits exist:
- 1d26db6 ✓
- cdd8abb ✓
