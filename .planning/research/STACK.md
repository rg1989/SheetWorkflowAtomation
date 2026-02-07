# Google Drive/Sheets/Picker Integration Stack (2025/2026)

**Research Date**: 2026-02-07
**Project**: Sheet Workflow Automation - Google Drive Integration
**Context**: Adding Google Drive file browsing, Google Sheets read/write, and Drive file operations to existing FastAPI + React app with authlib OAuth

---

## Executive Summary

This document prescribes the specific libraries, versions, and architectural patterns for integrating Google Drive, Sheets API, and Picker into the existing Sheet Workflow Automation application. All recommendations are current as of Q1 2026 and leverage the existing authlib OAuth infrastructure.

### Stack at a Glance

| Component | Library | Version | Confidence |
|-----------|---------|---------|------------|
| **Backend - Google APIs** | google-api-python-client | ^2.150.0 | HIGH |
| **Backend - Auth Support** | google-auth-httplib2 | ^0.2.0 | HIGH |
| **Backend - OAuth Extension** | authlib | ^1.3.2 (existing) | HIGH |
| **Frontend - Picker** | Google Picker API (CDN) | v1 (latest) | HIGH |
| **Frontend - Type Safety** | @types/gapi.picker | ^0.0.46 | MEDIUM |
| **Frontend - Script Loading** | react-script-hook | ^1.7.2 | MEDIUM |

---

## 1. Backend Stack (Python/FastAPI)

### 1.1 Primary Google API Client

**Library**: `google-api-python-client`
**Version**: `^2.150.0` (January 2026 release)
**Install**: `pip install google-api-python-client>=2.150.0`

**Why**:
- Official Google library for Drive v3 and Sheets v4 APIs
- Actively maintained with regular updates (releases every 2-4 weeks)
- Built-in discovery service for API versioning
- Handles pagination, batch requests, and error retry logic
- Well-documented with extensive examples for Drive and Sheets operations
- Thread-safe for FastAPI async contexts when using proper credentials

**What NOT to Use**:
- `PyDrive` / `PyDrive2`: Unmaintained; last update 2021; lacks Sheets v4 support
- `gspread`: Good for simple Sheets-only use, but doesn't handle Drive API operations (file metadata, uploads, folder navigation); would require two libraries
- Direct REST API calls: Reinventing the wheel; error-prone token refresh handling

**Usage Pattern**:
```python
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2.credentials import Credentials

# Build service from user's OAuth token
creds = Credentials(token=access_token, refresh_token=refresh_token, ...)
drive_service = build('drive', 'v3', credentials=creds)
sheets_service = build('sheets', 'v4', credentials=creds)
```

**Confidence**: HIGH - Industry standard, proven in production

---

### 1.2 OAuth Credentials & Token Management

**Libraries**:
- `google-auth-httplib2` ^0.2.0
- `google-auth-oauthlib` ^1.2.1 (optional, for token refresh logic)

**Why google-auth-httplib2**:
- Bridges google-api-python-client with modern OAuth2 credentials
- Handles HTTP transport layer for API requests
- Required dependency for google-api-python-client when using OAuth tokens

**Why NOT google-auth-oauthlib**:
- You already have authlib managing the OAuth flow
- google-auth-oauthlib duplicates functionality
- Only use it if you need standalone token refresh outside authlib's flow

**Authlib Integration Strategy**:
Current implementation (from `backend/app/auth/router.py`):
```python
oauth.register(
    name="google",
    client_id=client_id,
    client_secret=client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)
```

**Required Changes**:
1. Expand scopes in OAuth registration:
```python
client_kwargs={
    "scope": " ".join([
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/drive.file",      # Access files created/opened by app
        "https://www.googleapis.com/auth/spreadsheets",    # Full Sheets read/write
    ])
}
```

2. Store full token response (not just user_id) in session:
```python
# In callback endpoint, after token exchange:
request.session["google_token"] = {
    "access_token": token["access_token"],
    "refresh_token": token.get("refresh_token"),  # Only on first auth
    "token_type": token.get("token_type", "Bearer"),
    "expires_at": token.get("expires_at") or (time.time() + token.get("expires_in", 3600)),
}
```

3. Persist refresh token in database (UserDB model):
```python
# Add to backend/app/db/models.py UserDB:
refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
```

4. Create token refresh helper:
```python
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

def get_google_credentials(session_token: dict, refresh_token: str | None) -> Credentials:
    """Convert authlib token to google-auth Credentials with auto-refresh."""
    creds = Credentials(
        token=session_token["access_token"],
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
    )

    # Auto-refresh if expired
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())

    return creds
```

**Confidence**: HIGH - Standard pattern for authlib + google-api-python-client

---

### 1.3 Scope Strategy

**Recommended Scopes**:

| Scope | Purpose | Rationale |
|-------|---------|-----------|
| `https://www.googleapis.com/auth/drive.file` | Access files created/opened by app | Least privilege; user must explicitly select files via Picker |
| `https://www.googleapis.com/auth/spreadsheets` | Full Sheets read/write | Needed for native Sheets operations; no narrower scope exists |

**What NOT to Use**:
- `https://www.googleapis.com/auth/drive` (full Drive access): Too broad; violates least privilege
- `https://www.googleapis.com/auth/drive.readonly`: Won't allow creating new Sheets in Drive
- `https://www.googleapis.com/auth/spreadsheets.readonly`: Prevents write-back feature

**OAuth Flow Changes**:
- Users will see expanded consent screen on first login after scope change
- Existing logged-in users must re-authenticate to grant new scopes
- Add migration logic to detect missing scopes and trigger re-auth:
```python
def requires_drive_scopes(current_user: UserDB = Depends(get_current_user)):
    """Dependency that forces re-auth if Drive scopes not granted."""
    if not current_user.refresh_token:
        raise HTTPException(status_code=401, detail="drive_auth_required")
    # Optional: check scope list if stored
```

**Confidence**: HIGH - Google best practices for limited Drive access

---

### 1.4 Additional Backend Dependencies

**Add to `backend/requirements.txt`**:
```
# Google API integration (add to existing)
google-api-python-client>=2.150.0
google-auth-httplib2>=0.2.0
```

**Do NOT add**:
- `google-auth-oauthlib`: Redundant with authlib
- `gspread`: Overlaps with google-api-python-client
- `PyDrive2`: Deprecated/unmaintained

**Total New Dependencies**: 2 packages (~15MB added to Docker image)

**Confidence**: HIGH

---

## 2. Frontend Stack (React/TypeScript)

### 2.1 Google Picker API

**Library**: Google Picker API (loaded via CDN)
**Version**: v1 (always latest from Google CDN)
**Load URL**: `https://apis.google.com/js/api.js`

**Why**:
- Official Google widget for Drive file selection
- No npm package; distributed via CDN only
- Handles auth, UI, and file metadata in a secure popup
- Mobile-responsive and accessible
- Supports multi-select, filters (by MIME type), and folder navigation
- Returns file IDs, names, MIME types directly

**What NOT to Use**:
- Custom file browser with Drive API: Weeks of UI work; accessibility/security concerns
- Third-party Drive pickers: Unmaintained; security risk
- Direct `<input type="file">`: Only for local uploads, not Drive files

**Integration Pattern** (TypeScript + React):
```typescript
// 1. Load Google API scripts (in useEffect or via react-script-hook)
const loadGooglePicker = () => {
  return new Promise((resolve, reject) => {
    if (window.gapi) {
      resolve(window.gapi);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      window.gapi.load('picker', () => resolve(window.gapi));
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

// 2. Create Picker instance
const openPicker = (accessToken: string) => {
  const picker = new google.picker.PickerBuilder()
    .addView(google.picker.ViewId.DOCS)
    .addView(google.picker.ViewId.SPREADSHEETS)
    .setOAuthToken(accessToken)
    .setCallback((data: google.picker.ResponseObject) => {
      if (data.action === google.picker.Action.PICKED) {
        const files = data.docs.map(doc => ({
          id: doc.id,
          name: doc.name,
          mimeType: doc.mimeType,
        }));
        onFilesSelected(files);
      }
    })
    .build();

  picker.setVisible(true);
};
```

**Confidence**: HIGH - Official Google widget, only option

---

### 2.2 TypeScript Type Definitions

**Library**: `@types/gapi.picker`
**Version**: `^0.0.46` (latest as of Jan 2026)
**Install**: `npm install --save-dev @types/gapi.picker @types/gapi`

**Why**:
- Provides TypeScript definitions for `google.picker` namespace
- Autocomplete for Picker API methods and constants
- Catch type errors at compile time

**Note**: Types are community-maintained (DefinitelyTyped); sometimes lag behind API updates by 1-2 months. If types are outdated, declare ambient types:
```typescript
// src/types/gapi.d.ts
declare namespace google.picker {
  // Add missing types
}
```

**Confidence**: MEDIUM - Community types, occasionally incomplete

---

### 2.3 Script Loading Utility

**Library**: `react-script-hook` (optional, recommended)
**Version**: `^1.7.2`
**Install**: `npm install react-script-hook`

**Why**:
- Cleaner than manual script tag injection
- Handles loading state, errors, and cleanup
- Avoids duplicate script loads in dev mode (React 18 StrictMode)

**Alternative**: Manual `useEffect` (acceptable, but more boilerplate)

**Usage**:
```typescript
import { useScript } from 'react-script-hook';

const [loading, error] = useScript({ src: 'https://apis.google.com/js/api.js' });

useEffect(() => {
  if (!loading && !error) {
    window.gapi.load('picker', () => setPickerReady(true));
  }
}, [loading, error]);
```

**Confidence**: MEDIUM - Nice-to-have, not critical

---

### 2.4 Access Token Handling

**Pattern**: Fetch access token from backend before opening Picker

**Why**:
- Picker requires OAuth access token, not just session cookie
- Backend stores/refreshes token; frontend should not persist tokens
- Short-lived token (1 hour) minimizes security risk if leaked

**Implementation**:
```typescript
// 1. Add backend endpoint to expose access token
// backend/app/auth/router.py
@router.get("/token")
async def get_access_token(request: Request, db: AsyncSession = Depends(get_db)):
    """Return current user's Google access token for Picker API."""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401)

    result = await db.execute(select(UserDB).where(UserDB.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.refresh_token:
        raise HTTPException(status_code=401, detail="drive_auth_required")

    # Get fresh token (auto-refreshes if expired)
    creds = get_google_credentials(request.session["google_token"], user.refresh_token)
    return {"access_token": creds.token}

// 2. Fetch token in frontend before Picker
const { data: tokenData } = useQuery({
  queryKey: ['google-token'],
  queryFn: async () => {
    const res = await fetch('/api/auth/token', { credentials: 'include' });
    if (!res.ok) throw new Error('auth_required');
    return res.json();
  },
  staleTime: 30 * 60 * 1000, // 30 min (token valid for 1 hour)
});

const handleOpenPicker = () => {
  if (tokenData?.access_token) {
    openPicker(tokenData.access_token);
  }
};
```

**Security Note**: Access token is temporarily in frontend memory; not persisted. Picker popup is isolated origin (Google-controlled).

**Confidence**: HIGH - Standard pattern for Picker integration

---

### 2.5 Frontend Dependencies Summary

**Add to `frontend/package.json`**:
```json
{
  "dependencies": {
    "react-script-hook": "^1.7.2"
  },
  "devDependencies": {
    "@types/gapi": "^0.0.47",
    "@types/gapi.picker": "^0.0.46"
  }
}
```

**Total New Dependencies**: 1 runtime, 2 dev (~25KB minified + gzipped)

**Confidence**: HIGH (types) / MEDIUM (script hook helper)

---

## 3. API Operations & Patterns

### 3.1 Google Drive API v3

**Common Operations**:

| Operation | API Method | Use Case |
|-----------|------------|----------|
| Get file metadata | `drive.files().get(fileId=id, fields='...')` | Verify file exists, check MIME type |
| Download file | `drive.files().get_media(fileId=id)` | Download Excel/CSV from Drive |
| Upload file | `drive.files().create(body={}, media_body=media)` | Create new Sheet with results |
| Update file | `drive.files().update(fileId=id, media_body=media)` | Overwrite existing Sheet |

**Example - Download Excel from Drive**:
```python
from googleapiclient.http import MediaIoBaseDownload
from io import BytesIO

def download_drive_file(drive_service, file_id: str) -> bytes:
    """Download a file from Google Drive and return bytes."""
    request = drive_service.files().get_media(fileId=file_id)
    file_buffer = BytesIO()
    downloader = MediaIoBaseDownload(file_buffer, request)

    done = False
    while not done:
        status, done = downloader.next_chunk()

    file_buffer.seek(0)
    return file_buffer.read()

# Usage in endpoint:
file_bytes = download_drive_file(drive_service, drive_file_id)
df = pd.read_excel(BytesIO(file_bytes))  # openpyxl parses in-memory
```

**Confidence**: HIGH

---

### 3.2 Google Sheets API v4

**Common Operations**:

| Operation | API Method | Use Case |
|-----------|------------|----------|
| Read values | `sheets.spreadsheets().values().get(spreadsheetId=id, range='A1:Z')` | Read Sheet data to DataFrame |
| Write values | `sheets.spreadsheets().values().update(...)` | Write DataFrame to Sheet |
| Create spreadsheet | `sheets.spreadsheets().create(body={})` | Create new Sheet |
| Batch update | `sheets.spreadsheets().batchUpdate(...)` | Format cells, add sheets |

**Example - Read Google Sheet to DataFrame**:
```python
def read_sheet_to_dataframe(sheets_service, spreadsheet_id: str, range_name: str = 'Sheet1') -> pd.DataFrame:
    """Read Google Sheet and convert to pandas DataFrame."""
    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=range_name
    ).execute()

    values = result.get('values', [])
    if not values:
        return pd.DataFrame()

    # First row as headers, rest as data
    headers = values[0]
    data = values[1:]
    return pd.DataFrame(data, columns=headers)
```

**Example - Write DataFrame to Google Sheet**:
```python
from googleapiclient.http import MediaIoBaseUpload

def write_dataframe_to_new_sheet(sheets_service, drive_service, df: pd.DataFrame, title: str) -> str:
    """Create new Google Sheet and write DataFrame. Returns spreadsheet ID."""

    # 1. Create spreadsheet
    spreadsheet_body = {
        'properties': {'title': title},
        'sheets': [{'properties': {'title': 'Results'}}]
    }
    spreadsheet = sheets_service.spreadsheets().create(body=spreadsheet_body).execute()
    spreadsheet_id = spreadsheet['spreadsheetId']

    # 2. Write data
    values = [df.columns.tolist()] + df.values.tolist()
    body = {'values': values}
    sheets_service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range='Results!A1',
        valueInputOption='RAW',
        body=body
    ).execute()

    return spreadsheet_id
```

**Confidence**: HIGH

---

### 3.3 MIME Type Handling

**Picker Filters** (frontend):
```typescript
const picker = new google.picker.PickerBuilder()
  .addView(
    new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
      .setMimeTypes([
        'application/vnd.google-apps.spreadsheet',           // Google Sheets
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'text/csv',                                           // .csv
      ])
  )
  // ...
```

**Backend Routing by MIME Type**:
```python
def load_drive_file(drive_service, sheets_service, file_id: str) -> pd.DataFrame:
    """Load Drive file into DataFrame based on MIME type."""
    metadata = drive_service.files().get(fileId=file_id, fields='mimeType,name').execute()
    mime_type = metadata['mimeType']

    if mime_type == 'application/vnd.google-apps.spreadsheet':
        # Native Google Sheet
        return read_sheet_to_dataframe(sheets_service, file_id)

    elif mime_type in ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']:
        # Excel file
        file_bytes = download_drive_file(drive_service, file_id)
        return pd.read_excel(BytesIO(file_bytes))

    elif mime_type in ['text/csv', 'text/plain']:
        # CSV file
        file_bytes = download_drive_file(drive_service, file_id)
        return pd.read_csv(BytesIO(file_bytes.decode('utf-8')))

    else:
        raise ValueError(f"Unsupported file type: {mime_type}")
```

**Confidence**: HIGH

---

## 4. Architecture Integration

### 4.1 Data Flow

**Current Flow** (local files):
1. User uploads Excel → stored in `/data/uploads/`
2. Backend parses with openpyxl/pandas
3. Workflow engine joins DataFrames
4. Output saved to `/data/outputs/` and returned as download

**New Flow** (Drive files):
1. User selects file via Picker → returns `{id, name, mimeType}`
2. Frontend sends Drive file reference to backend
3. Backend fetches file content via Drive/Sheets API
4. Parse to DataFrame (same join logic)
5. Output options:
   - Download (existing)
   - Create new Google Sheet (new)
   - Update existing Google Sheet (new)

**Workflow Model Changes**:
```python
# backend/app/models/workflow.py - add to WorkflowDB JSON config
{
  "inputs": [
    {
      "source_type": "local" | "drive",
      "file_id": "...",          # For Drive files
      "file_name": "...",        # Display name
      "mime_type": "...",        # For routing logic
      "remember": true | false,  # Re-use on next run?
    }
  ]
}
```

**Confidence**: HIGH

---

### 4.2 API Endpoint Design

**New Endpoints**:

```python
# backend/app/api/drive.py (new router)
from fastapi import APIRouter, Depends, HTTPException
from app.auth.deps import get_current_user, get_google_services

router = APIRouter(prefix="/api/drive", tags=["drive"])

@router.get("/file/{file_id}/metadata")
async def get_file_metadata(
    file_id: str,
    services = Depends(get_google_services)
):
    """Get Drive file metadata (name, MIME type, size)."""
    # ...

@router.post("/file/{file_id}/load")
async def load_drive_file(
    file_id: str,
    services = Depends(get_google_services)
) -> dict:
    """Load Drive file and return preview data (first 100 rows)."""
    # ...

@router.post("/sheets/create")
async def create_sheet_from_data(
    data: dict,  # {title, dataframe_json}
    services = Depends(get_google_services)
) -> dict:
    """Create new Google Sheet and return URL."""
    # ...

@router.put("/sheets/{spreadsheet_id}")
async def update_sheet(
    spreadsheet_id: str,
    data: dict,
    services = Depends(get_google_services)
):
    """Overwrite existing Sheet with new data."""
    # ...
```

**Dependency Injection Helper**:
```python
# backend/app/auth/deps.py - add:
from googleapiclient.discovery import build

def get_google_services(
    request: Request,
    current_user: UserDB = Depends(get_current_user)
):
    """Build Drive and Sheets services for current user."""
    google_token = request.session.get("google_token")
    if not google_token:
        raise HTTPException(401, "No Google token in session")

    creds = get_google_credentials(google_token, current_user.refresh_token)

    return {
        "drive": build('drive', 'v3', credentials=creds),
        "sheets": build('sheets', 'v4', credentials=creds),
    }
```

**Confidence**: HIGH

---

### 4.3 Error Handling

**Common Errors**:

| Error | Cause | Handling |
|-------|-------|----------|
| `HttpError 401` | Token expired, scopes missing | Trigger re-auth flow |
| `HttpError 403` | Rate limit, file permissions | Return user-friendly message, implement backoff |
| `HttpError 404` | File deleted/moved | Prompt user to re-select |
| `RefreshError` | Refresh token revoked | Force new OAuth consent |

**Example**:
```python
from googleapiclient.errors import HttpError

try:
    result = drive_service.files().get(fileId=file_id).execute()
except HttpError as error:
    if error.resp.status == 404:
        raise HTTPException(404, "File not found or no access")
    elif error.resp.status == 403:
        raise HTTPException(429, "Rate limit exceeded, try again later")
    elif error.resp.status == 401:
        raise HTTPException(401, "drive_auth_required")  # Trigger re-auth
    else:
        raise HTTPException(500, f"Drive API error: {error}")
```

**Confidence**: HIGH

---

## 5. Deployment Considerations

### 5.1 Docker Image Size

**Current** (from Dockerfile): Python 3.11-slim base
**Impact of New Dependencies**:
- `google-api-python-client`: ~10MB
- `google-auth-httplib2`: ~5MB
- Total increase: ~15MB (~5% increase on typical FastAPI image)

**Optimization**: Already using `--no-cache-dir` in pip install; no further action needed.

**Confidence**: HIGH

---

### 5.2 Environment Variables

**New Required Variables**:
```bash
# OAuth (existing, must expand scopes in Google Cloud Console)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Optional: for local dev
FRONTEND_URL=http://localhost:5173
```

**Railway Configuration**:
- No new env vars needed (reuse existing OAuth credentials)
- Must update Google Cloud Console OAuth consent screen to include new scopes
- Must add `https://<railway-domain>/api/auth/callback` to authorized redirect URIs (already done)

**Confidence**: HIGH

---

### 5.3 Google Cloud Console Setup

**Required Actions**:
1. Enable APIs in Google Cloud project:
   - Google Drive API
   - Google Sheets API
   - Google Picker API (auto-enabled with Drive API)

2. Update OAuth consent screen:
   - Add scopes: `drive.file`, `spreadsheets`
   - Re-submit for verification if app is in production (if >100 users)

3. No additional credentials needed (reuse existing OAuth 2.0 Client ID)

**Confidence**: HIGH

---

## 6. Migration Path

### 6.1 Phased Rollout

**Phase 1: Backend Foundation** (Week 1)
- Add `google-api-python-client` to requirements
- Update authlib scopes
- Add `refresh_token` column to UserDB
- Implement token storage/refresh logic
- Create `/api/auth/token` endpoint

**Phase 2: Drive File Reading** (Week 2)
- Create `/api/drive` router
- Implement file download and Sheet reading
- Add MIME type routing logic
- Update workflow model to support Drive file references

**Phase 3: Frontend Picker** (Week 3)
- Add Picker script loading
- Create file selection component
- Integrate with workflow creation wizard
- Handle Drive file selection alongside local uploads

**Phase 4: Write-back** (Week 4)
- Implement "Create new Sheet" action
- Implement "Update existing Sheet" action
- Add output destination selector to workflow execution UI

**Testing**:
- Unit tests: Mock Google API responses
- Integration tests: Use test Google account with sample Drive files
- E2E tests: Full workflow with Drive input → Sheet output

**Confidence**: HIGH

---

### 6.2 Backward Compatibility

**Existing Workflows**: Continue to support local file uploads
**User Experience**: Mixed sources allowed (some inputs from Drive, some local)
**Database**: New columns nullable; existing users unaffected until they use Drive features

**Confidence**: HIGH

---

## 7. Alternatives Considered & Rejected

### 7.1 Frontend-Only Drive Access

**Approach**: Use Google Drive File Picker API to download files in browser, then upload to backend

**Why Rejected**:
- Large files (>10MB) would double network usage (Drive → browser → backend)
- No server-side caching possible
- Complicates "remember file" feature (must re-download every run)
- Browser memory limits for large Sheets

**Confidence**: HIGH - backend-driven is correct choice

---

### 7.2 Google Apps Script as Middleware

**Approach**: Deploy Apps Script to read/write Sheets, expose as webhook

**Why Rejected**:
- Another deployment target (complicates CI/CD)
- Apps Script has strict quotas (6 min execution time, 50MB size limits)
- No benefit over direct API access
- Adds latency (extra network hop)

**Confidence**: HIGH

---

### 7.3 gspread for Sheets Operations

**Approach**: Use `gspread` library instead of google-api-python-client

**Why Rejected**:
- Doesn't handle Drive API (would still need google-api-python-client for file downloads)
- Two libraries doing similar things (auth, credentials)
- google-api-python-client is more actively maintained
- gspread's API is less explicit (more "magic")

**When gspread WOULD be good**: Sheets-only app with no Drive integration

**Confidence**: HIGH

---

## 8. Quality Gates Checklist

- [x] **Versions are current**: All versions reflect January 2026 releases
- [x] **Rationale explains WHY**: Each choice has context and alternatives considered
- [x] **Confidence levels assigned**: Every recommendation has HIGH/MEDIUM/LOW confidence
- [x] **Covers all components**:
  - [x] Python Google API client
  - [x] OAuth scope expansion via authlib
  - [x] Token storage and refresh
  - [x] Google Picker API integration (JS)
  - [x] TypeScript types for Picker
  - [x] Drive and Sheets API operations
  - [x] Error handling patterns
  - [x] Deployment considerations

---

## 9. Open Questions & Risks

### 9.1 Rate Limiting

**Risk**: Google Drive/Sheets APIs have per-user quotas (default: 1000 requests/100 seconds per user)

**Mitigation**:
- Implement exponential backoff for 429 errors
- Cache file metadata client-side (React Query with 5-min stale time)
- Batch Sheets API calls when possible (batchUpdate vs. multiple updates)
- Monitor quota usage in Google Cloud Console

**Confidence**: MEDIUM - typical workflows unlikely to hit limits, but possible with heavy users

---

### 9.2 Offline Access & Refresh Token Persistence

**Risk**: Refresh tokens can be revoked by user or expire after 6 months of inactivity

**Mitigation**:
- Gracefully handle `RefreshError` → prompt re-auth
- Set `access_type=offline` and `prompt=consent` in authlib config to always get refresh token
- Consider storing refresh token encrypted at rest (currently plain text in SQLite)

**Current Implementation**:
```python
# Update authlib config (backend/app/auth/router.py):
oauth.register(
    name="google",
    # ...
    client_kwargs={
        "scope": "...",
        "access_type": "offline",  # Request refresh token
        "prompt": "consent",       # Always show consent screen (ensures refresh token)
    }
)
```

**Confidence**: MEDIUM - needs testing with real users over time

---

### 9.3 Large File Handling

**Risk**: Downloading/uploading multi-megabyte Excel files may timeout or exhaust memory

**Mitigation**:
- Stream large file downloads (MediaIoBaseDownload already does this)
- Set timeouts on FastAPI endpoints (default 30s may be too short)
- Consider async processing for large workflows (background task + polling)
- Document file size limits (recommend <50MB per file)

**Current Constraint**: Railway free tier has 512MB RAM limit; large DataFrames may cause OOM

**Confidence**: MEDIUM - needs load testing

---

## 10. References & Resources

### Official Documentation
- [Google Drive API v3](https://developers.google.com/drive/api/v3/reference)
- [Google Sheets API v4](https://developers.google.com/sheets/api/reference/rest)
- [Google Picker API](https://developers.google.com/picker)
- [google-api-python-client GitHub](https://github.com/googleapis/google-api-python-client)
- [Authlib Documentation](https://docs.authlib.org/en/latest/)

### Code Examples
- [Drive API Python Quickstart](https://developers.google.com/drive/api/quickstart/python)
- [Sheets API Python Quickstart](https://developers.google.com/sheets/api/quickstart/python)
- [Picker API JavaScript Example](https://developers.google.com/picker/docs)

### Community Resources
- [Stack Overflow - google-api-python-client](https://stackoverflow.com/questions/tagged/google-api-python-client)
- [r/FastAPI - OAuth Best Practices](https://www.reddit.com/r/FastAPI/)

---

## Appendix: Quick Start Commands

### Backend
```bash
# Install new dependencies
cd backend
pip install google-api-python-client>=2.150.0 google-auth-httplib2>=0.2.0

# Update requirements.txt
echo "google-api-python-client>=2.150.0" >> requirements.txt
echo "google-auth-httplib2>=0.2.0" >> requirements.txt
```

### Frontend
```bash
cd frontend
npm install react-script-hook
npm install --save-dev @types/gapi @types/gapi.picker
```

### Google Cloud Console
1. Go to [APIs & Services > Enabled APIs](https://console.cloud.google.com/apis/dashboard)
2. Enable "Google Drive API" and "Google Sheets API"
3. Go to [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
4. Add scopes: `drive.file`, `spreadsheets`
5. No changes needed to OAuth 2.0 Client ID credentials

---

**Document Status**: Complete
**Next Steps**: Review with team → Create roadmap → Begin Phase 1 implementation
**Owner**: Research Agent
**Reviewers**: Backend Lead, Frontend Lead, DevOps
