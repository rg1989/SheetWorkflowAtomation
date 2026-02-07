# Phase 2: Backend Drive Service - Research

**Researched:** 2026-02-07
**Domain:** Google Drive API v3, Google Sheets API v4, Python integration
**Confidence:** HIGH

## Summary

Phase 2 integrates Google Drive and Sheets APIs into the existing FastAPI backend to enable reading files from Drive (Excel, CSV, Google Sheets) and converting them to pandas DataFrames for workflow processing. The standard approach uses `google-api-python-client` with OAuth2 credentials from Phase 1's token storage, implementing proper error handling for rate limits (HTTP 429) and permission errors (HTTP 403).

The research confirms that:
1. **google-api-python-client** is the official, well-maintained library for Drive/Sheets integration
2. Excel/CSV files download via Drive API and parse in-memory with pandas (no disk writes needed)
3. Google Sheets read natively via Sheets API and convert to DataFrames with simple list comprehension
4. Error handling requires catching `HttpError` and implementing exponential backoff for 429s
5. Existing codebase already has OAuth tokens encrypted and stored; Phase 2 just needs to use them

**Primary recommendation:** Use google-api-python-client with google-auth for OAuth2, download Drive files to BytesIO for in-memory parsing, read Sheets via spreadsheets.values.get, and implement retry logic with exponential backoff for rate limit handling.

## Standard Stack

The established libraries/tools for Google API integration in Python:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google-api-python-client | 2.189.0+ | Official Google API client with Drive v3 and Sheets v4 support | Maintained by Google, includes discovery-based API with cached documents, supports all Google APIs |
| google-auth | 2.47.0+ | OAuth2 credential management | Official Google auth library, handles token refresh, required by google-api-python-client |
| google-auth-oauthlib | 1.2.0+ | OAuth2 flow integration | Official library for OAuth flows (replaces deprecated oauth2client) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tenacity | 9.0.0+ | Retry logic with exponential backoff | HTTP 429 rate limit handling, transient failures |
| pandas | 2.1.4+ (already in project) | DataFrame operations | Parse Excel/CSV to DataFrames (already used in codebase) |
| openpyxl | 3.1.2+ (already in project) | Excel parsing engine | Read .xlsx files from BytesIO (already used in parser.py) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| google-api-python-client | PyDrive2, gspread | PyDrive2 is unmaintained fork of PyDrive; gspread is Sheets-only. Official client supports all APIs and gets Google updates first |
| tenacity | Manual retry loops | Tenacity provides tested exponential backoff with jitter, handles edge cases. Manual loops are error-prone |
| Direct Sheets API | gspread-pandas, gsheets wrappers | Wrappers add dependency overhead. Direct API gives full control and matches Drive API pattern |

**Installation:**
```bash
pip install google-api-python-client google-auth google-auth-oauthlib tenacity
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── services/
│   ├── __init__.py
│   ├── drive.py          # Drive file download, exports
│   ├── sheets.py         # Sheets data reading
│   └── google_auth.py    # Build credentials from stored tokens
├── api/
│   └── files.py          # Extend with Drive picker results
├── auth/
│   └── token_refresh.py  # Already exists, use get_valid_access_token()
```

### Pattern 1: Build Service with Stored Tokens
**What:** Convert encrypted tokens from database to Credentials object, build API service
**When to use:** Every Drive/Sheets API call (create once per request or cache)
**Example:**
```python
# Source: google-auth documentation + Phase 1 implementation
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from app.auth.token_refresh import get_valid_access_token
from app.auth.encryption import decrypt_token

async def build_drive_service(user: UserDB, db: AsyncSession):
    """Build Drive API service with user's OAuth tokens."""
    # Get valid access token (auto-refreshes if expired)
    access_token = await get_valid_access_token(user, db)

    # Build credentials object
    creds = Credentials(
        token=access_token,
        refresh_token=decrypt_token(user.google_refresh_token),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
        scopes=user.drive_scopes.split()
    )

    # Build service
    service = build("drive", "v3", credentials=creds)
    return service
```

### Pattern 2: Download Drive File to BytesIO (Excel/CSV)
**What:** Download binary Drive file to memory, parse with pandas
**When to use:** Excel (.xlsx) and CSV files stored in Drive
**Example:**
```python
# Source: googleapis.github.io/google-api-python-client MediaIoBaseDownload docs
from googleapiclient.http import MediaIoBaseDownload
import io
import pandas as pd

async def download_drive_file_to_df(service, file_id: str, mime_type: str) -> pd.DataFrame:
    """Download Drive file and parse to DataFrame."""
    # Get file metadata to check MIME type
    file_meta = service.files().get(fileId=file_id, fields="mimeType,name").execute()

    # Download file content to BytesIO
    request = service.files().get_media(fileId=file_id)
    file_buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(file_buffer, request)

    done = False
    while not done:
        status, done = downloader.next_chunk()

    file_buffer.seek(0)

    # Parse to DataFrame based on type
    if mime_type == "text/csv":
        df = pd.read_csv(file_buffer)
    elif mime_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        df = pd.read_excel(file_buffer, engine="openpyxl")
    else:
        raise ValueError(f"Unsupported MIME type: {mime_type}")

    return df
```

### Pattern 3: Export Google Sheets to Excel Format
**What:** Export native Sheets file as .xlsx, download, parse
**When to use:** Google Sheets files (mime: application/vnd.google-apps.spreadsheet)
**Example:**
```python
# Source: developers.google.com/workspace/drive/api/guides/ref-export-formats
async def export_sheet_to_df(service, file_id: str) -> pd.DataFrame:
    """Export Google Sheet as Excel and parse to DataFrame."""
    request = service.files().export_media(
        fileId=file_id,
        mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

    file_buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(file_buffer, request)

    done = False
    while not done:
        status, done = downloader.next_chunk()

    file_buffer.seek(0)
    df = pd.read_excel(file_buffer, engine="openpyxl")
    return df
```

### Pattern 4: Read Google Sheets Natively (Preferred for Sheets)
**What:** Use Sheets API to get cell values directly, convert to DataFrame
**When to use:** Google Sheets files (more efficient than export for large sheets)
**Example:**
```python
# Source: developers.google.com/sheets/api/quickstart/python
from googleapiclient.discovery import build

async def read_sheet_to_df(user: UserDB, db: AsyncSession, spreadsheet_id: str, range_name: str = "Sheet1") -> pd.DataFrame:
    """Read Google Sheet natively via Sheets API."""
    sheets_service = build("sheets", "v4", credentials=creds)

    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=range_name
    ).execute()

    values = result.get("values", [])
    if not values:
        return pd.DataFrame()

    # First row as column headers
    df = pd.DataFrame(values[1:], columns=values[0])
    return df
```

### Pattern 5: Error Handling with Exponential Backoff
**What:** Catch HttpError, retry on 429 with exponential backoff, fail fast on 403
**When to use:** All Drive/Sheets API calls
**Example:**
```python
# Source: tenacity library docs + Google API best practices
from googleapiclient.errors import HttpError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import json

def is_retryable_error(exception):
    """Check if HttpError is retryable (429, 5xx)."""
    if isinstance(exception, HttpError):
        return exception.resp.status in [429, 500, 502, 503, 504]
    return False

@retry(
    retry=retry_if_exception_type(HttpError),
    wait=wait_exponential(multiplier=1, min=4, max=60),
    stop=stop_after_attempt(5),
    reraise=True
)
async def download_with_retry(service, file_id: str):
    """Download file with automatic retry on rate limits."""
    try:
        return service.files().get_media(fileId=file_id).execute()
    except HttpError as e:
        error_details = json.loads(e.content.decode("utf-8"))

        if e.resp.status == 403:
            # Permission error - don't retry
            raise HTTPException(
                status_code=403,
                detail=f"Access denied to file: {error_details.get('error', {}).get('message', 'Permission denied')}"
            )
        elif e.resp.status == 429:
            # Rate limit - will retry via decorator
            raise
        else:
            # Other error
            raise HTTPException(
                status_code=e.resp.status,
                detail=error_details.get("error", {}).get("message", "Drive API error")
            )
```

### Anti-Patterns to Avoid
- **Saving Drive files to disk:** Use BytesIO to keep files in memory. Disk I/O is slow and requires cleanup
- **Building service objects on import:** Build per-request with user credentials. Import-time init uses wrong tokens
- **Ignoring MIME types:** Check file.mimeType before download. Google Sheets require export(), not get_media()
- **Manual retry loops:** Use tenacity library. Custom loops often lack jitter, max attempts, or proper backoff
- **Catching all exceptions:** Catch HttpError specifically. 403 should fail fast, not retry forever

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth credential management | Manual token refresh, credential building | google-auth Credentials class | Handles expiry, refresh, scope validation. Integrates with google-api-client |
| Exponential backoff retry | time.sleep() loops with counters | tenacity @retry decorator | Handles jitter (prevents thundering herd), max attempts, exception filtering. Battle-tested |
| Drive file download with progress | Raw HTTP requests with chunking | MediaIoBaseDownload | Handles partial downloads, resumption, progress tracking. Part of official client |
| Sheets range parsing | String manipulation for A1 notation | Sheets API with full range string | API validates ranges, handles named ranges, multi-sheet refs. Error messages are clear |
| MIME type detection | File extension guessing | Drive API files.get with fields="mimeType" | Google stores authoritative MIME type. Extensions can lie (renamed files) |

**Key insight:** Google APIs have complex edge cases (quota limits, token expiry mid-request, partial failures in batch). Official libraries handle these. Custom HTTP clients miss rate limit headers, retry-after signals, and service-specific quirks.

## Common Pitfalls

### Pitfall 1: Forgetting to Check MIME Type Before Download
**What goes wrong:** Code calls `get_media()` on Google Sheets file → API returns 403 "Export only"
**Why it happens:** Google Workspace docs (Sheets, Docs, Slides) don't have binary content. They're stored as structured data
**How to avoid:** Check `mimeType` field first. If `application/vnd.google-apps.spreadsheet`, use `export_media()` or Sheets API
**Warning signs:** HttpError 403 with message "This file cannot be downloaded, use export instead"

### Pitfall 2: Not Implementing Exponential Backoff for 429s
**What goes wrong:** Rate limit hit → immediate retry → another 429 → banned for longer
**Why it happens:** Google enforces 20,000 calls/100sec/user quota. Linear retry exhausts quota faster
**How to avoid:** Use exponential backoff with jitter (tenacity library). Wait 2^n seconds between retries
**Warning signs:** Repeated 429 errors, "Rate Limit Exceeded" messages in logs

### Pitfall 3: Building Service on Every API Call
**What goes wrong:** Performance degrades, excessive credential validation overhead
**Why it happens:** `build()` performs discovery document fetch and validation
**How to avoid:** Build service once per request (dependency injection) or cache with context manager
**Warning signs:** Slow API responses (>500ms for simple file metadata fetch)

### Pitfall 4: Ignoring Token Expiry Mid-Request
**What goes wrong:** Long-running download fails halfway through with 401 Unauthorized
**Why it happens:** Access tokens expire after 1 hour. Large files or batches exceed this
**How to avoid:** Phase 1's `get_valid_access_token()` checks expiry before API call. Refresh proactively with 5-min buffer
**Warning signs:** Intermittent 401 errors on long operations, errors ~1 hour after workflow start

### Pitfall 5: Assuming File ID Equals Sheet ID
**What goes wrong:** Pass Drive file ID to Sheets API → 404 "Spreadsheet not found"
**Why it happens:** Sheets API expects spreadsheet ID (same as file ID), but range syntax is different
**How to avoid:** Drive file ID = Sheets spreadsheet ID, but use Sheets API for reading data (not Drive export for large sheets)
**Warning signs:** 404 errors when Sheets API called with valid Drive file ID, missing range parameter

### Pitfall 6: Not Handling Empty Sheets
**What goes wrong:** Sheets API returns `{"values": []}` → code assumes headers exist → IndexError
**Why it happens:** Empty sheets or sheets with only formatting have no `values` key or empty array
**How to avoid:** Check `if not values:` before accessing `values[0]` as headers. Return empty DataFrame
**Warning signs:** IndexError: list index out of range on `values[0]`

## Code Examples

Verified patterns from official sources:

### Building Credentials from Database Tokens
```python
# Source: google-auth docs + Phase 1 token_refresh.py
from google.oauth2.credentials import Credentials
from app.auth.token_refresh import get_valid_access_token

async def get_user_credentials(user: UserDB, db: AsyncSession) -> Credentials:
    """Get valid OAuth2 credentials from user's stored tokens."""
    access_token = await get_valid_access_token(user, db)  # Auto-refreshes

    creds = Credentials(
        token=access_token,
        refresh_token=decrypt_token(user.google_refresh_token),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
        scopes=user.drive_scopes.split()
    )
    return creds
```

### Download Excel from Drive to DataFrame
```python
# Source: googleapis.github.io/google-api-python-client
from googleapiclient.http import MediaIoBaseDownload
import io
import pandas as pd

async def get_drive_excel_as_df(service, file_id: str) -> pd.DataFrame:
    """Download Excel file from Drive and parse to DataFrame."""
    request = service.files().get_media(fileId=file_id)
    file_buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(file_buffer, request)

    done = False
    while not done:
        status, done = downloader.next_chunk()

    file_buffer.seek(0)
    df = pd.read_excel(file_buffer, engine="openpyxl")
    return df
```

### Read Google Sheet to DataFrame
```python
# Source: developers.google.com/sheets/api/quickstart/python
async def get_sheet_as_df(sheets_service, spreadsheet_id: str) -> pd.DataFrame:
    """Read Google Sheet values and convert to DataFrame."""
    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range="Sheet1"  # Can be dynamic
    ).execute()

    values = result.get("values", [])
    if not values or len(values) < 2:
        return pd.DataFrame()  # Empty or header-only sheet

    df = pd.DataFrame(values[1:], columns=values[0])
    return df
```

### Error Handling with User-Friendly Messages
```python
# Source: developers.google.com/workspace/drive/api/guides/handle-errors
from googleapiclient.errors import HttpError
from fastapi import HTTPException
import json

async def handle_drive_error(e: HttpError, file_id: str):
    """Convert Drive API errors to user-friendly messages."""
    error_body = json.loads(e.content.decode("utf-8"))
    error_msg = error_body.get("error", {}).get("message", "Unknown error")

    if e.resp.status == 403:
        if "storage quota" in error_msg.lower():
            raise HTTPException(
                status_code=403,
                detail="Google Drive storage quota exceeded. Free up space or upgrade storage."
            )
        else:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied to file {file_id}. Ensure the file is shared with you."
            )

    elif e.resp.status == 404:
        raise HTTPException(
            status_code=404,
            detail=f"File {file_id} not found. It may have been deleted or you don't have access."
        )

    elif e.resp.status == 429:
        raise HTTPException(
            status_code=429,
            detail="Google Drive rate limit exceeded. Please wait a moment and try again."
        )

    else:
        raise HTTPException(
            status_code=e.resp.status,
            detail=f"Drive API error: {error_msg}"
        )
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| oauth2client library | google-auth + google-auth-oauthlib | 2017-2020 | oauth2client deprecated. New libraries required for Python 3.7+ |
| Save Drive files to disk | Download to BytesIO | 2018+ | Faster (no disk I/O), more secure (no temp file cleanup bugs), works in containers |
| Export Sheets as CSV/Excel | Read via Sheets API directly | 2016+ (Sheets v4) | Preserves formatting, handles large sheets (export limited to 10MB), more efficient |
| Manual retry with time.sleep() | tenacity library | 2016+ | Jitter prevents thundering herd, declarative retry policies, better testing |
| Discovery doc fetch on build() | Cached discovery docs in library | google-api-python-client 2.0 (2020) | 10-100x faster service creation, works offline in tests |

**Deprecated/outdated:**
- **oauth2client**: Deprecated since 2017, removed from PyPI. Use google-auth
- **PyDrive**: Unmaintained since 2020. PyDrive2 is fork but use official google-api-python-client for Drive v3 features
- **files.get() with alt=media in URL**: Still works but MediaIoBaseDownload is more robust (handles chunking, resumption)

## Open Questions

Things that couldn't be fully resolved:

1. **Should we cache service objects per-user session?**
   - What we know: Building service is ~50-200ms overhead per request. Caching could improve performance.
   - What's unclear: FastAPI lifecycle for caching user-specific objects. Thread safety of service objects.
   - Recommendation: Start with build-per-request (simpler, safer). Profile in Phase 3 if performance issues arise. Use `lru_cache` with user_id key if needed.

2. **How to handle very large sheets (>100k rows)?**
   - What we know: Sheets API has no explicit row limit but responses can be slow. Export has 10MB limit.
   - What's unclear: At what size should we paginate or warn users?
   - Recommendation: Start with full sheet fetch (most workflows are <10k rows). Add pagination in future phase if users report timeouts.

3. **Should we support Google Docs/Slides export?**
   - What we know: Phase 2 requirements only specify Sheets, Excel, CSV. Docs/Slides can export as PDF/text.
   - What's unclear: User demand for Docs/Slides processing.
   - Recommendation: Out of scope for Phase 2. Add in future phase if requested.

## Sources

### Primary (HIGH confidence)
- [google-api-python-client Official Docs](https://googleapis.github.io/google-api-python-client/docs/) - Getting started, OAuth patterns
- [Drive API v3 files() Reference](https://googleapis.github.io/google-api-python-client/docs/dyn/drive_v3.files.html) - Download methods, export vs get_media
- [Sheets API v4 Quickstart Python](https://developers.google.com/sheets/api/quickstart/python) - Building service, reading values
- [google-auth Credentials Module](https://googleapis.dev/python/google-auth/latest/reference/google.oauth2.credentials.html) - Credentials constructor, parameters
- [Drive API Error Handling Guide](https://developers.google.com/workspace/drive/api/guides/handle-errors) - HTTP status codes, retry strategies
- [Export MIME Types for Google Workspace](https://developers.google.com/workspace/drive/api/guides/ref-export-formats) - Sheets export formats (.xlsx, .csv, .pdf)
- [MediaIoBaseDownload Class Reference](https://googleapis.github.io/google-api-python-client/docs/epy/googleapiclient.http.MediaIoBaseDownload-class.html) - Chunked download pattern
- [tenacity Documentation](https://tenacity.readthedocs.io/) - Exponential backoff decorators
- [pandas read_excel Documentation](https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html) - BytesIO support, engine parameter

### Secondary (MEDIUM confidence)
- [Google API Python HTTP 429 Rate Limit Patterns](https://cloud.google.com/blog/products/ai-machine-learning/learn-how-to-handle-429-resource-exhaustion-errors-in-your-llms) - Exponential backoff formula
- [Drive API Common Quota Errors](https://developers.google.com/workspace/drive/api/guides/handle-errors) - 20,000 calls/100sec limit, sharing limits
- [HttpError Exception Handling](https://googleapis.github.io/google-api-python-client/docs/epy/googleapiclient.errors.HttpError-class.html) - resp.status, content attributes

### Tertiary (LOW confidence)
- Community blog posts on Drive API integration - Use as patterns only, verify with official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Google libraries, widely used in production
- Architecture: HIGH - Patterns from official quickstarts and API docs
- Pitfalls: MEDIUM-HIGH - Mix of official error docs and community experience (verified where possible)

**Research date:** 2026-02-07
**Valid until:** 90 days (Google APIs are stable; major changes announced 12+ months ahead)
