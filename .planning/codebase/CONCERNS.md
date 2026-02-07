# Codebase Concerns

**Analysis Date:** 2026-02-07

## Tech Debt

**Silent Exception Handling in Cleanup:**
- Issue: Bare `except:` or `except Exception: pass` statements silently swallow errors without logging
- Files: `backend/app/api/workflows.py:385` (bare except in finally block)
- Impact: File cleanup failures go undetected; temp files accumulate on disk; difficult to debug issues
- Fix approach: Replace with specific exception types and add logging; at minimum log warnings with logger

**Broad Exception Catching:**
- Issue: Generic `except Exception as e` catches all errors, masks actual problems (e.g., authentication, database, file system)
- Files: `backend/app/api/workflows.py:360`, `backend/app/api/files.py:90-91`, `backend/app/api/files.py:164-165`
- Impact: Prevents proper error handling and recovery; treats transient network errors same as data corruption
- Fix approach: Catch specific exceptions (JSONDecodeError, IOError, ValueError) and handle separately; unexpected errors should be re-raised

**Unvalidated File Path Access:**
- Issue: File paths from database are passed directly to FileResponse without validation
- Files: `backend/app/api/runs.py:100-107`, `backend/app/api/workflows.py:415-430`
- Impact: Path traversal vulnerability possible if output_path gets corrupted; could expose arbitrary files
- Fix approach: Validate that output_path is within expected OUTPUTS_DIR before serving; use secure path joining

**Nullable user_id in Database Schema:**
- Issue: WorkflowDB and RunDB have `user_id` marked nullable in migration, allows creating workflows without owner
- Files: `backend/app/db/models.py:25, 40`, `backend/app/db/database.py:59`
- Impact: Orphaned workflows; potential privacy issues; unclear data ownership in queries
- Fix approach: Make user_id NOT NULL; handle migration to populate existing null values before enforcing constraint

**Column Name Whitespace Handling Inconsistent:**
- Issue: Some places strip column names (parser.py:33), others assume exact match (engine.py:352)
- Files: `backend/app/core/parser.py:33`, `backend/app/core/engine.py:352-357`, `backend/app/core/engine.py:436-452`
- Impact: Data loss when column names have trailing spaces; matches fail silently
- Fix approach: Normalize all column names during parsing, document in CONVENTIONS.md that column names are trimmed

## Known Bugs

**Math Operation Division by Zero Handling:**
- Symptoms: Division by zero returns None instead of error message visible to user
- Files: `backend/app/core/engine.py:479-481`
- Trigger: Create math column with divide operation when divisor column contains zeros
- Workaround: User must manually avoid zeros in divisor columns; no validation warning

**File Count Mismatch Error is Obscure:**
- Symptoms: If user uploads wrong number of files, gets HTTP 400 with message "Expected X files, got Y"
- Files: `backend/app/api/workflows.py:256-260`
- Trigger: Uploading fewer files than workflow expects
- Workaround: Frontend should validate before submission; backend error unclear to non-technical users

**Unmatched Keys Silently Produce Empty Cells:**
- Symptoms: When a key exists in one file but not another, the join silently produces empty cells
- Files: `backend/app/core/engine.py:268-276`
- Trigger: Run workflow with partial key matches across files
- Workaround: User must check output warnings; no visual indicator in preview

## Security Considerations

**Session Secret Key Storage:**
- Risk: SESSION_SECRET_KEY is read from environment but not validated for strength
- Files: `backend/app/auth/config.py`, `backend/app/main.py:94`
- Current mitigation: Environment variable configuration allows hardening in production
- Recommendations: Add validation that SESSION_SECRET_KEY is at least 32 bytes; document requirement in README

**OAuth Credentials Logged in Debug:**
- Risk: OAuth client_id/secret presence status is logged to stdout on startup
- Files: `backend/app/auth/router.py:54-58` (logs "set" vs "MISSING" for credentials)
- Current mitigation: Doesn't log actual values, only presence status
- Recommendations: Still avoid logging credential status to stdout; use proper logging framework with appropriate levels

**File Upload Size Limit Not Enforced:**
- Risk: No file size validation on upload endpoints
- Files: `backend/app/api/files.py:37-40`, `backend/app/api/workflows.py:281-284`
- Current mitigation: Flask/FastAPI may have defaults, but not explicit in code
- Recommendations: Add explicit max file size checks before writing to disk; return 413 Payload Too Large; document limits

**Output Files Stored with Predictable Names:**
- Risk: Run IDs are UUIDs but filenames contain first 8 chars `workflow_result_{run_id[:8]}.xlsx`
- Files: `backend/app/api/workflows.py:428`, `backend/app/api/runs.py:106`
- Current mitigation: Files stored in user-specific directory; auth checks before download
- Recommendations: Use full UUID or random token in filename; document that output filenames don't need to be secret

**No Rate Limiting on Upload Endpoint:**
- Risk: Workflow execution endpoint allows unlimited concurrent runs per user
- Files: `backend/app/api/workflows.py:214-387`
- Current mitigation: Database and disk I/O naturally throttle, but no explicit rate limits
- Recommendations: Add request rate limiting using FastAPI middleware or dependency injection

## Performance Bottlenecks

**Full DataFrame Comparison in Differ:**
- Problem: Entire datasets compared row-by-row in memory without streaming
- Files: `backend/app/core/differ.py`
- Cause: loads full DataFrames into memory before comparison
- Improvement path: Stream processing for large files; chunked comparison; consider async processing

**No Result File Cleanup / Garbage Collection:**
- Problem: Output Excel files accumulate indefinitely in `data/outputs/`
- Files: `backend/app/api/runs.py:131-135` (manual cleanup only on delete)
- Cause: No scheduled cleanup; files kept until explicitly deleted
- Improvement path: Add background job to clean files older than 30 days; vacuum old runs periodically

**Unmatched Key Tracking Limited to 10 Items:**
- Problem: Warning collection truncated at 10 items per file for performance, but indicates O(n) issue
- Files: `backend/app/core/engine.py:275` (hardcoded limit)
- Cause: Collecting all unmatched keys could be expensive with large datasets
- Improvement path: Use set-based tracking or sampling; avoid string concatenation in loops

**Frontend Re-Query on Every Column Change:**
- Problem: RunWorkflowPage parses the same file multiple times as user changes sheets/headers
- Files: `frontend/src/pages/RunWorkflowPage.tsx:139-150` (handleSheetChange calls parseColumns)
- Cause: No caching of parse results; stateless approach
- Improvement path: Cache parse results keyed by {file, sheet, headerRow}; memoize expensive computations

## Fragile Areas

**Workflow Configuration Structure (Deeply Nested JSON):**
- Files: `backend/app/api/workflows.py:73-80`, `backend/app/core/engine.py:32-36`
- Why fragile: Config is stored as arbitrary JSON dict; easy to miss required fields; no schema validation at runtime
- Safe modification: Add Pydantic models for config validation; use discriminated unions for ColumnSource types
- Test coverage: No validation tests for malformed configs; would fail at execution time only

**Column Source Type Dispatch:**
- Files: `backend/app/core/engine.py:314-334`
- Why fragile: String-based dispatch on source_type; adding new type requires changes in multiple places
- Safe modification: Use enum for source types; consider factory pattern or visitor pattern
- Test coverage: No tests for unknown source types; defaults to custom/empty value

**Key Column Matching with Whitespace Normalization:**
- Files: `backend/app/core/engine.py:268-276`, `backend/app/core/engine.py:439-450`
- Why fragile: Both strict matching and flexible whitespace matching exist; inconsistent application
- Safe modification: Decide on one strategy (always trim) or document when each applies; add comprehensive tests
- Test coverage: No tests for keys with leading/trailing spaces; would silently fail to match

**Database Migration in create_tables():**
- Files: `backend/app/db/database.py:49-62`
- Why fragile: Manual SQL executed in try/except block; assumes table structure without checking current state
- Safe modification: Use proper migration tool (Alembic); validate schema before attempting add column
- Test coverage: Not tested; would silently fail if table doesn't exist or column already exists

**Frontend AuthContext State Management:**
- Files: `frontend/src/context/AuthContext.tsx` (not examined in detail)
- Why fragile: Global auth state via React Context; no persistence mechanism shown
- Safe modification: Add localStorage or sessionStorage for auth state recovery; centralize auth logic
- Test coverage: Context-level testing likely minimal; auth edge cases (session expiry, refresh) unclear

## Scaling Limits

**SQLite Database Single-Writer Limitation:**
- Current capacity: Single writer; multiple readers can block each other
- Limit: Concurrent workflow executions will lock database during write; fails at ~5-10 concurrent users
- Scaling path: Migrate to PostgreSQL or MySQL; use connection pooling

**Output File Directory Flat Structure:**
- Current capacity: All outputs in `data/outputs/{user_id}/` without organization
- Limit: Directory listing becomes slow at 10k+ files; no cleanup mechanism
- Scaling path: Implement hierarchical storage (by date or workflow); add automatic cleanup

**In-Memory DataFrame Processing:**
- Current capacity: Entire files loaded into memory; practical limit ~1GB files
- Limit: Large Excel files (>1GB) cause OOM errors
- Scaling path: Implement chunked reading; use Polars for out-of-core processing

**Session Storage in Memory:**
- Current capacity: All user sessions stored in Starlette middleware default (memory)
- Limit: Restarting app loses all sessions; multi-instance deployments don't share sessions
- Scaling path: Migrate to persistent session storage (Redis); use JWT tokens for distributed systems

## Dependencies at Risk

**openpyxl Fixed Version:**
- Risk: `openpyxl` used for workbook loading but no version constraint in requirements
- Impact: Breaking changes in new versions could silently break file parsing
- Migration plan: Pin openpyxl to known-good version (e.g., openpyxl>=3.9.0,<3.11); test major upgrades before deploying

**pandas API Stability:**
- Risk: Heavy reliance on pandas API for data manipulation; DataFrame API evolves frequently
- Impact: Future pandas versions may deprecate used APIs (e.g., .ix accessor, deprecated in recent versions)
- Migration plan: Regularly test against latest pandas; use stable APIs; consider polars as alternative for new code

**FastAPI and Starlette Versions Not Pinned:**
- Risk: No version pinning visible; async API changes between versions
- Impact: Major version upgrades could break OAuth flow or session handling
- Migration plan: Add version constraints to requirements; test upgrades in CI before deploying

## Test Coverage Gaps

**Math Engine Operations Not Tested:**
- What's not tested: Division by zero edge case; subtract with negative results; multiply with zeros
- Files: `backend/app/core/engine.py:393-488`
- Risk: Silent failures producing incorrect calculations; user wouldn't notice wrong results
- Priority: High

**Join Type Logic Not Tested:**
- What's not tested: Full join with missing keys; right join vs left join behavior differences
- Files: `backend/app/core/engine.py:41-85`, `backend/app/core/engine.py:187-312`
- Risk: Wrong data matched across files; incorrect row counts; silent data loss
- Priority: High

**File Path Traversal and Security:**
- What's not tested: Malformed output_path values; paths outside data directory
- Files: `backend/app/api/runs.py:100-107`, `backend/app/api/workflows.py:415-430`
- Risk: Could expose sensitive files to unauthorized download
- Priority: High

**Exception Handling in Cleanup:**
- What's not tested: Scenarios where temp file deletion fails; what happens if directory is read-only
- Files: `backend/app/api/workflows.py:381-386`
- Risk: Resource leaks; server disk fills with temp files
- Priority: Medium

**Frontend Form Validation Edge Cases:**
- What's not tested: Extremely long workflow names; special characters in column names; unicode in headers
- Files: `frontend/src/pages/WorkflowEditorPage.tsx`, `frontend/src/components/WorkflowWizard/`
- Risk: UI crashes or data corruption on edge inputs
- Priority: Medium

**Database Concurrent Access:**
- What's not tested: Multiple simultaneous workflow runs; concurrent edits to same workflow
- Files: `backend/app/api/workflows.py`, `backend/app/db/database.py`
- Risk: Data corruption; lost updates; constraint violations
- Priority: Medium

---

*Concerns audit: 2026-02-07*
