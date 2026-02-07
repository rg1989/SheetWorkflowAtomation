# Phase 3: Backend Drive Endpoints - Research

**Researched:** 2026-02-07
**Domain:** FastAPI REST API design with Google Drive/Sheets integration
**Confidence:** HIGH

## Summary

This research investigated how to implement REST API endpoints that expose Phase 2's Drive/Sheets service layer to the frontend. The core challenge is designing clean FastAPI endpoints that handle file operations (download, read) and metadata retrieval while maintaining proper error handling, request/response validation, and async patterns.

The standard approach uses FastAPI's dependency injection for auth, Pydantic models for request/response validation, and follows RESTful resource-based endpoint design. Google Picker authentication requires exposing the access token via a GET endpoint. File metadata must be captured and returned according to SELECT-02 requirements.

**Primary recommendation:** Create three POST endpoints under `/api/drive` and `/api/sheets` namespaces following existing project patterns (APIRouter with auth dependencies, Pydantic models, HTTPException for errors). Add GET `/api/auth/token` for Picker authentication. Store file metadata in workflow config JSON to avoid new database columns.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.109.0+ | REST API framework | Already in project, native async support, automatic OpenAPI docs |
| Pydantic | 2.5.3+ | Request/response validation | FastAPI's built-in validation layer, type-safe models |
| google-api-python-client | 2.100.0+ | Google API interactions | Official Google library, already used in Phase 2 |
| tenacity | 8.2.0+ | Retry logic | Already used in Phase 2 for Drive/Sheets API calls |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| asyncio | stdlib | Async/await support | Required for FastAPI async endpoints |
| logging | stdlib | Request/response logging | Standard for production debugging |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pydantic v2 | Pydantic v1 | v2 has better performance and is 2026 standard |
| POST for operations | GET with query params | POST better for complex payloads, avoids URL length limits |
| HTTPException | Custom exception classes | HTTPException is FastAPI standard, sufficient for this use case |

**Installation:**
No new dependencies required - all packages already in `backend/requirements.txt` from Phase 1 and 2.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/api/
├── drive.py         # NEW: Drive file operations endpoints
└── ...              # Existing: workflows.py, runs.py, files.py
```

### Pattern 1: Dependency Injection for Auth and Services
**What:** Use FastAPI's `Depends()` to inject current user, database session, and API services into endpoint functions.

**When to use:** Every endpoint that requires authentication or Google API access.

**Example:**
```python
# Source: Existing patterns from backend/app/api/workflows.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import UserDB

router = APIRouter()

@router.post("/drive/download")
async def download_drive_file(
    request: DownloadRequest,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Build Drive service from user's stored tokens
    drive_service = await build_drive_service(current_user, db)
    sheets_service = await build_sheets_service(current_user, db)

    # Call service layer
    df = await download_drive_file_to_df(
        drive_service,
        request.file_id,
        sheets_service=sheets_service
    )
    # ... return response
```

### Pattern 2: Request/Response Pydantic Models
**What:** Define explicit Pydantic models for all request bodies and responses with clear field names and types.

**When to use:** Every endpoint - never use raw dicts or dynamic schemas.

**Example:**
```python
# Source: FastAPI best practices 2026
from pydantic import BaseModel, Field
from typing import Optional

class DownloadRequest(BaseModel):
    file_id: str = Field(..., description="Google Drive file ID")
    mime_type: Optional[str] = Field(None, description="MIME type if known")

class FileMetadata(BaseModel):
    id: str
    name: str
    mime_type: str
    modified_time: str
    owner: str
    web_view_link: str
    size: Optional[int] = None

class DownloadResponse(BaseModel):
    success: bool
    file_metadata: FileMetadata
    row_count: int
    columns: list[str]
```

### Pattern 3: Service Layer Separation
**What:** Endpoints delegate business logic to service functions; endpoints only handle HTTP concerns (request/response, auth, status codes).

**When to use:** Always - follows existing project pattern from Phase 2.

**Example:**
```python
# Endpoint (handles HTTP)
@router.post("/drive/download")
async def download_endpoint(request: DownloadRequest, ...):
    try:
        # Delegate to service layer
        df = await download_drive_file_to_df(drive_service, request.file_id)
        metadata = await get_drive_file_metadata(drive_service, request.file_id)

        # Return HTTP response
        return DownloadResponse(
            success=True,
            file_metadata=FileMetadata(**metadata),
            row_count=len(df),
            columns=df.columns.tolist()
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

### Pattern 4: Async Endpoints with Blocking Operations
**What:** Use `async def` for endpoints, wrap Google API blocking calls with `asyncio.to_thread()` in service layer (already done in Phase 2).

**When to use:** All FastAPI endpoints that call Google API services.

**Example:**
```python
# Already implemented in backend/app/services/drive.py
@drive_retry
async def get_drive_file_metadata(service, file_id: str) -> dict:
    try:
        metadata = await asyncio.to_thread(
            lambda: service.files().get(
                fileId=file_id,
                fields="id,name,mimeType,modifiedTime,owners,webViewLink,size"
            ).execute()
        )
        return metadata
    except HttpError as e:
        _handle_drive_error(e, file_id)
```

**Rationale:** Google API Python client is synchronous/blocking. Calling blocking operations in `async def` without `asyncio.to_thread()` blocks the entire event loop, causing all requests to wait. Phase 2 already implements this correctly - endpoints simply call these async service functions.

### Pattern 5: Error Mapping with HTTPException
**What:** Map Google API errors to user-friendly HTTPException responses with appropriate status codes.

**When to use:** All Google API calls - catch `HttpError` and convert to `HTTPException`.

**Example:**
```python
# Already implemented in backend/app/services/drive.py
from fastapi import HTTPException
from googleapiclient.errors import HttpError

def _handle_drive_error(e: HttpError, file_id: str):
    status_code = e.resp.status

    if status_code == 403:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied to file {file_id}. Ensure file is shared with you."
        )
    elif status_code == 404:
        raise HTTPException(
            status_code=404,
            detail="File not found or you don't have access."
        )
    # ... more mappings
```

**Rationale:** Raw Google API errors expose internal implementation details. User-friendly messages improve UX and match existing pattern from Phase 2.

### Anti-Patterns to Avoid
- **Using `def` instead of `async def`:** FastAPI runs sync functions in thread pool, but this phase's endpoints call async service functions - must use `async def`
- **Returning raw DataFrames:** Convert to serializable format (dict, list) before returning from endpoint
- **Catching all exceptions:** Be specific - catch `HttpError` for API errors, `ValueError` for validation, let unexpected errors propagate for proper error handling
- **Using fields="*" in Drive API calls:** Over-fetches data, slower responses; specify exact fields needed per SELECT-02 requirements

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request validation | Manual type checking, if/else chains | Pydantic models | FastAPI auto-validates against model, generates docs, provides type hints |
| OAuth token management | Custom token refresh logic | Existing Phase 1 `get_valid_access_token()` | Already implemented, tested, handles refresh and encryption |
| Drive API retry logic | Custom retry loops | Existing Phase 2 `@drive_retry` decorator | Already configured with exponential backoff, 5 retries, handles 429/5xx |
| Error responses | Custom error format classes | FastAPI `HTTPException` | Standard FastAPI pattern, auto-generates error docs, works with exception handlers |
| API service building | Direct Credentials() construction | Existing Phase 2 `build_drive_service()` | Handles token refresh, decryption, scope validation |

**Key insight:** Phase 1 and 2 already built robust foundations for token management, service construction, and error handling. This phase is a thin HTTP layer over existing services - don't rebuild what exists.

## Common Pitfalls

### Pitfall 1: Blocking the Event Loop with Google API Calls
**What goes wrong:** Calling `service.files().get().execute()` directly in an `async def` endpoint blocks the event loop, causing all concurrent requests to wait.

**Why it happens:** Google API Python client is synchronous - `.execute()` is a blocking I/O call.

**How to avoid:** Always wrap Google API calls with `asyncio.to_thread()` (already done in Phase 2 services). Endpoints just call the async service functions.

**Warning signs:**
- Slow API responses when multiple users access simultaneously
- `uvicorn` logs showing long request times
- If you see `service.files().get().execute()` without `asyncio.to_thread()` in an `async def` function

### Pitfall 2: Not Validating File Access Before Operations
**What goes wrong:** Attempting operations on files user doesn't have access to, resulting in 403 errors during operations instead of early validation.

**Why it happens:** Skipping metadata fetch to "save an API call".

**How to avoid:**
- For download endpoint: metadata fetch is required anyway (SELECT-02), so fetch first and handle errors early
- Phase 2's `download_drive_file_to_df()` fetches metadata if mime_type not provided - rely on this
- Let Phase 2's error handling (`_handle_drive_error`) convert API errors to user-friendly messages

**Warning signs:**
- Users see errors mid-operation instead of immediately
- Partial operations that need rollback

### Pitfall 3: Returning Non-Serializable Data in Responses
**What goes wrong:** FastAPI can't serialize pandas DataFrames, datetime objects, or NaN values to JSON - endpoint raises 500 errors.

**Why it happens:** Assuming FastAPI auto-serializes everything.

**How to avoid:**
- Convert DataFrame to dict/list: `df.to_dict('records')` or `df.columns.tolist()`
- For NaN values: `math.isnan()` check and convert to None (see existing `backend/app/api/files.py` pattern)
- Pydantic models handle datetime serialization if typed correctly

**Warning signs:**
- 500 errors with "Object of type X is not JSON serializable"
- Works in development but fails in production

### Pitfall 4: Exposing Internal Errors to Frontend
**What goes wrong:** Showing raw Google API error messages or stack traces to users, exposing internal implementation details.

**Why it happens:** Not catching specific exceptions, letting them propagate as 500 errors.

**How to avoid:**
- Phase 2's `_handle_drive_error()` already maps common errors - rely on this
- Catch `ValueError` for validation errors, convert to 400 with user-friendly message
- Let HTTPException propagate (FastAPI handles these correctly)
- Never expose stack traces in production

**Warning signs:**
- Error messages mention "HttpError", "googleapis.com", internal paths
- Users confused by technical jargon

### Pitfall 5: Not Handling Token Expiry/Refresh Failures
**What goes wrong:** User's refresh token is invalid/expired, API calls fail with 401, but endpoint doesn't communicate this clearly.

**Why it happens:** Assuming tokens are always valid.

**How to avoid:**
- Phase 1's `get_valid_access_token()` already handles refresh, raises 401 with 'drive_reconnect_required' on failure
- Catch 401 from `build_drive_service()` / `build_sheets_service()` and let it propagate - frontend handles this
- Don't try/except around service building unless you have specific handling logic

**Warning signs:**
- Generic "Unauthorized" errors without context
- Users stuck in error state without clear next action

## Code Examples

Verified patterns from existing codebase and FastAPI best practices:

### Example 1: Drive Download Endpoint
```python
# Source: Combining patterns from backend/app/api/files.py and Phase 2 services
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import UserDB
from app.services.google_auth import build_drive_service, build_sheets_service
from app.services.drive import download_drive_file_to_df, get_drive_file_metadata

router = APIRouter()

class DownloadRequest(BaseModel):
    file_id: str = Field(..., description="Google Drive file ID")

class FileMetadata(BaseModel):
    id: str
    name: str
    mime_type: str
    modified_time: str
    owner: str
    web_view_link: str
    size: Optional[int] = None

class DownloadResponse(BaseModel):
    success: bool
    file_metadata: FileMetadata
    row_count: int
    columns: list[str]
    sample_data: list[dict]

@router.post("/download", response_model=DownloadResponse)
async def download_drive_file(
    request: DownloadRequest,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Download a file from Google Drive and return metadata + preview.

    Supports Google Sheets, Excel (.xlsx), and CSV files.
    """
    try:
        # Build API services
        drive_service = await build_drive_service(current_user, db)
        sheets_service = await build_sheets_service(current_user, db)

        # Get metadata (required by SELECT-02)
        metadata = await get_drive_file_metadata(drive_service, request.file_id)

        # Download and parse
        df = await download_drive_file_to_df(
            drive_service,
            request.file_id,
            mime_type=metadata["mimeType"],
            sheets_service=sheets_service,
        )

        # Convert to serializable format
        sample_rows = df.head(5).to_dict('records')
        for row in sample_rows:
            for key, value in row.items():
                if isinstance(value, float) and math.isnan(value):
                    row[key] = None

        # Extract owner info
        owner_email = metadata.get("owners", [{}])[0].get("emailAddress", "Unknown")

        return DownloadResponse(
            success=True,
            file_metadata=FileMetadata(
                id=metadata["id"],
                name=metadata["name"],
                mime_type=metadata["mimeType"],
                modified_time=metadata["modifiedTime"],
                owner=owner_email,
                web_view_link=metadata["webViewLink"],
                size=metadata.get("size"),
            ),
            row_count=len(df),
            columns=df.columns.tolist(),
            sample_data=sample_rows,
        )

    except ValueError as e:
        # Unsupported file type from download_drive_file_to_df
        raise HTTPException(status_code=400, detail=str(e))
    # HttpError is already caught and converted to HTTPException by Phase 2 services
```

### Example 2: Sheets Read Endpoint
```python
# Similar pattern for reading specific sheet/range
class SheetsReadRequest(BaseModel):
    spreadsheet_id: str = Field(..., description="Google Sheets spreadsheet ID")
    range_name: Optional[str] = Field(None, description="A1 notation range (e.g. 'Sheet1!A1:D10')")

@router.post("/read", response_model=DownloadResponse)
async def read_google_sheet(
    request: SheetsReadRequest,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Read a Google Sheet and return metadata + preview.

    If range_name not provided, reads the first sheet.
    """
    try:
        sheets_service = await build_sheets_service(current_user, db)
        drive_service = await build_drive_service(current_user, db)

        # Get metadata from Drive API
        metadata = await get_drive_file_metadata(drive_service, request.spreadsheet_id)

        # Read sheet data
        df = await read_sheet_to_df(
            sheets_service,
            request.spreadsheet_id,
            range_name=request.range_name or "",
        )

        # Convert to serializable format (same as download endpoint)
        sample_rows = df.head(5).to_dict('records')
        # ... NaN handling ...

        owner_email = metadata.get("owners", [{}])[0].get("emailAddress", "Unknown")

        return DownloadResponse(
            success=True,
            file_metadata=FileMetadata(
                id=metadata["id"],
                name=metadata["name"],
                mime_type=metadata["mimeType"],
                modified_time=metadata["modifiedTime"],
                owner=owner_email,
                web_view_link=metadata["webViewLink"],
                size=metadata.get("size"),
            ),
            row_count=len(df),
            columns=df.columns.tolist(),
            sample_data=sample_rows,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

### Example 3: Token Endpoint for Picker Authentication
```python
# Source: Google Picker API documentation
# Add to backend/app/auth/router.py

@router.get("/token")
async def get_access_token(current_user: UserDB = Depends(get_current_user)):
    """
    Return current user's Google access token for Picker API authentication.

    Frontend needs this to initialize Google Picker widget.
    Token is already kept fresh by Phase 1's token refresh middleware.
    """
    if not current_user.google_access_token:
        raise HTTPException(
            status_code=401,
            detail="No Google access token available. Please reconnect Drive."
        )

    # Decrypt token
    from app.auth.encryption import decrypt_token
    access_token = decrypt_token(current_user.google_access_token)

    return {
        "access_token": access_token,
        "expires_at": current_user.token_expiry.isoformat() if current_user.token_expiry else None,
    }
```

### Example 4: Router Registration in main.py
```python
# Add to backend/app/main.py
from app.api import workflows, runs, files
from app.api import drive  # NEW

# Include API routers
app.include_router(auth_router, prefix="/api")
app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(drive.router, prefix="/api/drive", tags=["drive"])  # NEW
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pydantic v1 | Pydantic v2 | 2023 | Better performance, cleaner syntax; project already uses v2.5.3 |
| `response_model` parameter | Return type annotations | FastAPI 0.100+ | Both work, type annotations are more Pythonic; use either |
| Blocking Google API calls | `asyncio.to_thread()` wrapper | 2026 best practice | Prevents event loop blocking; Phase 2 already implements this |
| Global exception handlers | Specific HTTPException raising | Current standard | More explicit, easier to debug; project uses this pattern |

**Deprecated/outdated:**
- **FastAPI `response_model_exclude_unset=True` everywhere:** Pydantic v2 makes this less necessary with better default behavior
- **Manual JSON encoding:** FastAPI + Pydantic v2 handle most serialization automatically
- **Sync database sessions:** Project uses `AsyncSession` throughout (Phase 1)

## Open Questions

Things that couldn't be fully resolved:

1. **Should we store file metadata in database or return ad-hoc?**
   - What we know: SELECT-02 requires storing metadata (name, owner, modified, webViewLink). Workflow config is JSON - can store there.
   - What's unclear: Best location - add to FileDefinition model or create separate DriveFileDefinition?
   - Recommendation: Extend existing FileDefinition Pydantic model with optional Drive fields. Store in workflow config JSON (avoid new database columns). This keeps Drive fields optional for backward compatibility with local file uploads.

2. **Should Sheets read endpoint be separate or combined with Drive download?**
   - What we know: Phase 2's `download_drive_file_to_df()` already routes Sheets to native Sheets API. Both endpoints would call the same service function.
   - What's unclear: REST best practice - one generic endpoint or two specific ones?
   - Recommendation: Start with single `/api/drive/download` endpoint that handles all file types (Sheets, Excel, CSV). Matches Phase 2's unified service function. Add separate `/api/sheets/read` later if frontend needs range-specific reading without Drive metadata.

3. **How should we handle large file downloads?**
   - What we know: Loading entire DataFrame into memory works for typical spreadsheet sizes. Phase 2 already downloads to memory.
   - What's unclear: Size limits, memory constraints in Railway deployment
   - Recommendation: Start without size limits (matches current local file upload behavior). Monitor in production. If needed, add size check via metadata.size field before download and reject files >50MB with clear error message.

## Sources

### Primary (HIGH confidence)
- **Existing codebase:** `backend/app/api/files.py`, `backend/app/api/workflows.py` - Established patterns for FastAPI endpoints, Pydantic models, auth dependencies
- **Existing codebase:** `backend/app/services/drive.py`, `backend/app/services/sheets.py` - Phase 2 service layer with async wrappers, retry logic, error handling
- **Existing codebase:** `backend/app/auth/router.py`, `backend/app/auth/deps.py` - OAuth token management, user authentication patterns
- **FastAPI Official Documentation:** https://fastapi.tiangolo.com/tutorial/handling-errors/ - HTTPException patterns, error handling
- **FastAPI Official Documentation:** https://fastapi.tiangolo.com/async/ - Async/await best practices, when to use async def
- **Google Drive API Documentation:** https://developers.google.com/workspace/drive/api/guides/file-metadata - File metadata fields and usage
- **Google Picker API Documentation:** https://developers.google.com/workspace/drive/picker/guides/overview - OAuth token requirements for Picker

### Secondary (MEDIUM confidence)
- [FastAPI Best Practices GitHub](https://github.com/zhanymkanov/fastapi-best-practices) - Community-vetted patterns for production FastAPI apps
- [Better Stack: FastAPI Error Handling](https://betterstack.com/community/guides/scaling-python/error-handling-fastapi/) - HTTPException patterns and global handlers
- [FastAPI Best Practices Production 2026](https://fastlaunchapi.dev/blog/fastapi-best-practices-production-2026) - Async patterns, dependency injection, production deployment
- [TheLinuxCode: FastAPI Response Models 2026](https://thelinuxcode.com/fastapi-response-models-in-2026-typed-responses-safer-apis-better-docs/) - Pydantic v2 patterns, response model best practices
- [Medium: Async APIs with FastAPI](https://shiladityamajumder.medium.com/async-apis-with-fastapi-patterns-pitfalls-best-practices-2d72b2b66f25) - Blocking operations pitfalls, asyncio.to_thread usage

### Tertiary (LOW confidence)
- None - all findings verified against official docs or existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies already in project, verified in requirements.txt
- Architecture: HIGH - Patterns extracted from existing codebase (files.py, workflows.py, Phase 2 services)
- Pitfalls: HIGH - Based on FastAPI official docs + existing project patterns for async/blocking operations
- Code examples: HIGH - Adapted from working code in existing project files

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (30 days - stable ecosystem, FastAPI 0.109 is current, Pydantic v2 is established)
