---
phase: quick-006
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/services/drive.py
autonomous: true

must_haves:
  truths:
    - "Drive Excel files with NaN/float/int column names parse without validation error"
    - "Drive Excel column names are normalized to strings identically to local ExcelParser"
    - "Google Sheet export column names are normalized the same way"
  artifacts:
    - path: "backend/app/services/drive.py"
      provides: "Column name normalization in _download_binary_to_df and _export_google_sheet_to_df"
      contains: "str(col)"
  key_links:
    - from: "backend/app/services/drive.py"
      to: "backend/app/core/parser.py"
      via: "Same normalization logic"
      pattern: "isinstance.*str|str\\(col\\)"
---

<objective>
Fix Drive Excel file column name validation error by normalizing column names to strings.

Purpose: Drive Excel files with non-string column headers (NaN, int, float) cause a Pydantic validation error "columns.3 Input should be a valid string [type=string_type, input_value=nan, input_type=float]" because drive.py uses `df.columns.str.strip()` which only works on string columns. Local file upload works fine because ExcelParser explicitly converts all column names to strings.

Output: Updated drive.py with robust column name normalization matching ExcelParser behavior.
</objective>

<execution_context>
@/Users/rgv250cc/.claude/get-shit-done/workflows/execute-plan.md
@/Users/rgv250cc/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@backend/app/services/drive.py
@backend/app/core/parser.py (lines 32-41 — the normalization logic to replicate)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Normalize column names in Drive file processing functions</name>
  <files>backend/app/services/drive.py</files>
  <action>
Replace the column name stripping logic in TWO functions in drive.py:

1. `_download_binary_to_df` (currently line 209):
   Replace:
   ```python
   df.columns = df.columns.str.strip()
   ```
   With the same normalization from ExcelParser (parser.py lines 32-41):
   ```python
   new_columns = []
   for col in df.columns:
       if isinstance(col, str):
           new_columns.append(col.strip())
       else:
           new_columns.append(str(col).strip())
   df.columns = new_columns
   ```

2. `_export_google_sheet_to_df` (currently line 269):
   Apply the exact same replacement as above.

Do NOT extract a shared helper function — keep the logic inline in each function to match the existing ExcelParser pattern and avoid unnecessary refactoring. The duplication is minimal (4 lines) and keeps each function self-contained.

Do NOT modify any other functions. The `read_sheet_to_df` in sheets.py already correctly uses `str(col).strip()` so it does not need changes.
  </action>
  <verify>
    1. `cd /Users/rgv250cc/Documents/Projects/SheetWorkflowAtomation && grep -A 5 "new_columns" backend/app/services/drive.py` — should show the normalization loop in both functions
    2. `grep "df.columns.str.strip" backend/app/services/drive.py` — should return NO matches (old pattern fully replaced)
    3. `cd /Users/rgv250cc/Documents/Projects/SheetWorkflowAtomation && python -c "import backend.app.services.drive"` — module imports without error
  </verify>
  <done>
    Both _download_binary_to_df and _export_google_sheet_to_df normalize all column names to strings using isinstance check + str() conversion, matching ExcelParser behavior. The validation error "columns.3 Input should be a valid string [type=string_type, input_value=nan, input_type=float]" no longer occurs for Drive Excel files with non-string column headers.
  </done>
</task>

</tasks>

<verification>
1. No remaining `df.columns.str.strip()` calls in drive.py
2. Both functions use `isinstance(col, str)` check with `str(col).strip()` fallback
3. Module imports successfully
4. Manual test (if possible): Open an Excel file from Drive that has empty column headers — should parse without validation error
</verification>

<success_criteria>
- Drive Excel files with NaN/float/int column names parse identically to local file upload
- No regressions in Drive CSV or Google Sheets file processing
- Column names are always strings after normalization
</success_criteria>

<output>
After completion, create `.planning/quick/006-normalize-drive-excel-column-names-to-st/006-SUMMARY.md`
</output>
