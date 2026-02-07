# Google Drive/Sheets Integration Architecture

## Executive Summary

This document describes how Google Drive, Sheets, and Picker APIs integrate into the existing FastAPI + React + authlib OAuth architecture. The integration extends the current authentication system to support Drive/Sheets scopes, adds token management for API access, and introduces new data flows for reading from and writing to Google Drive.

**Key Principles:**
- Extend existing OAuth flow without breaking current authentication
- Separate concerns: frontend handles file picking, backend handles API access
- Store refresh tokens securely for server-side API calls
- Maintain backward compatibility with existing local file workflows

---

## Current Architecture (Baseline)

### Authentication Flow
```
Frontend (React) → /api/auth/login
                 ↓
    Google OAuth Consent Screen
                 ↓
    /api/auth/callback → authlib validates token
                 ↓
    Create/update UserDB (id, email, name, avatar_url)
                 ↓
    Set session cookie (user_id)
                 ↓
    Redirect to frontend
```

### Components
1. **Frontend**: React SPA with AuthContext, session-based authentication
2. **Backend**: FastAPI with authlib OAuth, SessionMiddleware
3. **Storage**: SQLite + SQLAlchemy (UserDB, WorkflowDB, RunDB)
4. **Current Scopes**: `openid email profile` (identity only)

### Data Flow (Current)
```
User uploads Excel → FormData POST → Backend parses (openpyxl/pandas)
                                   ↓
                              Workflow execution
                                   ↓
                              Output file saved locally
                                   ↓
                              Download link returned
```

---

## Extended Architecture (Google Drive Integration)

### 1. Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  • Google Picker UI (load gapi.js + picker SDK)                │
│  • File selection dialog                                        │
│  • Send file IDs to backend                                     │
│  • Display Drive files alongside local uploads                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ File IDs
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND API PROXY (FastAPI)                  │
├─────────────────────────────────────────────────────────────────┤
│  • Drive API endpoints (download, upload, list)                 │
│  • Token retrieval from database                                │
│  • File download/upload using google-api-python-client          │
│  • Sheets API read/write operations                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Store tokens
┌─────────────────────────────────────────────────────────────────┐
│                  TOKEN STORAGE (SQLAlchemy)                     │
├─────────────────────────────────────────────────────────────────┤
│  • UserDB.google_access_token (encrypted)                       │
│  • UserDB.google_refresh_token (encrypted)                      │
│  • UserDB.token_expiry (timestamp)                              │
│  • Automatic refresh when expired                               │
└─────────────────────────────────────────────────────────────────┘
```

### 2. New Components

#### A. Frontend: Google Picker Integration
**Location**: `/frontend/src/components/GooglePicker/`

**Responsibilities:**
- Load Google Picker API via `gapi.js`
- Display file/folder picker dialog
- Return selected file metadata (id, name, mimeType) to parent component
- Handle picker errors and user cancellation

**Component Interface:**
```typescript
interface GooglePickerProps {
  onSelect: (files: GoogleFile[]) => void;
  mimeTypes?: string[]; // e.g., ['application/vnd.google-apps.spreadsheet']
  multiSelect?: boolean;
}

interface GoogleFile {
  id: string;
  name: string;
  mimeType: string;
  iconUrl: string;
}
```

**Dependencies:**
- Google Picker API: Loaded from `https://apis.google.com/js/api.js`
- Requires Google API Key (public, client-side) and OAuth client ID
- No access token storage in frontend (Picker uses OAuth popup)

#### B. Backend: Drive API Service
**Location**: `/backend/app/services/google_drive.py`

**Responsibilities:**
- Download files from Google Drive using file ID
- Upload files to Google Drive
- Read/write Google Sheets data
- Handle token refresh automatically
- Retry logic for rate limits

**Service Interface:**
```python
class GoogleDriveService:
    def __init__(self, user_id: str, db: AsyncSession):
        """Initialize with user ID to fetch tokens from DB"""

    async def download_file(self, file_id: str) -> bytes:
        """Download file content by ID"""

    async def upload_file(self, filename: str, content: bytes,
                          mime_type: str, parent_folder_id: str = None) -> str:
        """Upload file, return new file ID"""

    async def read_sheet(self, spreadsheet_id: str,
                         range: str) -> list[list[str]]:
        """Read data from Google Sheets"""

    async def write_sheet(self, spreadsheet_id: str, range: str,
                          values: list[list[str]]) -> None:
        """Write data to Google Sheets"""

    async def _get_credentials(self) -> Credentials:
        """Fetch and refresh tokens from database"""
```

#### C. Backend: Drive API Endpoints
**Location**: `/backend/app/api/drive.py`

**New Endpoints:**
```
POST   /api/drive/download        # Download file by ID
POST   /api/drive/upload          # Upload file to Drive
GET    /api/drive/files           # List user's Drive files (optional)
POST   /api/sheets/read           # Read Sheets range
POST   /api/sheets/write          # Write to Sheets
```

**Example Endpoint:**
```python
@router.post("/drive/download")
async def download_drive_file(
    file_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Download a file from Google Drive."""
    service = GoogleDriveService(current_user.id, db)
    content = await service.download_file(file_id)
    # Return file or save temporarily for processing
    return Response(content=content, media_type="application/octet-stream")
```

#### D. Token Management
**Location**: `/backend/app/db/models.py` (extend UserDB)

**Schema Changes:**
```python
class UserDB(Base):
    __tablename__ = "users"

    # Existing fields
    id = Column(String, primary_key=True)
    email = Column(String, nullable=False)
    name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    # NEW: Token storage
    google_access_token = Column(String, nullable=True)   # Encrypted
    google_refresh_token = Column(String, nullable=True)  # Encrypted
    token_expiry = Column(DateTime, nullable=True)
    drive_scopes = Column(JSON, nullable=True)            # Track granted scopes
```

**Encryption Strategy:**
- Use `cryptography.fernet` to encrypt tokens at rest
- Encryption key derived from `SESSION_SECRET_KEY` or separate `TOKEN_ENCRYPTION_KEY`
- Decrypt on read, encrypt on write

**Location**: `/backend/app/auth/encryption.py`
```python
from cryptography.fernet import Fernet

def encrypt_token(token: str) -> str:
    """Encrypt token for database storage"""

def decrypt_token(encrypted: str) -> str:
    """Decrypt token from database"""
```

---

## 3. Data Flows

### Flow A: OAuth with Drive Scopes (First-Time or Scope Upgrade)

```
User clicks "Connect Google Drive"
            ↓
Frontend → /api/auth/login?scopes=drive.file,drive.readonly,spreadsheets
            ↓
Backend modifies authlib scope request:
  - OLD: "openid email profile"
  - NEW: "openid email profile https://www.googleapis.com/auth/drive.file
          https://www.googleapis.com/auth/spreadsheets"
            ↓
Google OAuth consent screen (user approves extended scopes)
            ↓
/api/auth/callback receives authorization code
            ↓
authlib exchanges code for tokens:
  {
    "access_token": "ya29...",
    "refresh_token": "1//...",
    "expires_in": 3600,
    "scope": "openid email profile drive.file spreadsheets",
    "token_type": "Bearer"
  }
            ↓
Backend encrypts and stores tokens in UserDB:
  - google_access_token (encrypted)
  - google_refresh_token (encrypted)
  - token_expiry (now + expires_in)
  - drive_scopes (JSON array of granted scopes)
            ↓
Set session cookie (user_id)
            ↓
Redirect to frontend
```

### Flow B: Pick File from Drive (User Action)

```
User opens file picker in workflow editor
            ↓
Frontend loads Google Picker:
  - Load gapi.js
  - Initialize with API key + OAuth client ID
  - Show picker dialog (Drive files, Sheets, etc.)
            ↓
User selects file(s)
            ↓
Picker returns metadata:
  {
    "id": "1aBc123XyZ",
    "name": "Q1 Sales Data.xlsx",
    "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }
            ↓
Frontend sends file ID to workflow:
  - Store as { type: 'drive', fileId: '1aBc123XyZ', name: 'Q1 Sales Data.xlsx' }
  - Display in UI alongside local files
```

### Flow C: Execute Workflow with Drive File

```
User runs workflow with Drive file as input
            ↓
Frontend → POST /api/workflows/{id}/run
  Body: {
    "files": [
      { "type": "drive", "fileId": "1aBc123XyZ" },
      { "type": "local", "file": <File object> }
    ]
  }
            ↓
Backend receives request:
  1. For Drive files:
     a. Get user_id from session
     b. Initialize GoogleDriveService(user_id, db)
     c. service.download_file(fileId) → bytes
     d. Save temporarily to /tmp or process in-memory
  2. For local files:
     a. Read from FormData as before
            ↓
Parse files (openpyxl/pandas) - same as before
            ↓
Execute workflow logic (join, transform, etc.)
            ↓
Generate output file
            ↓
Save output:
  - Option A: Local file (current behavior)
  - Option B: Upload to Drive via service.upload_file()
            ↓
Return result to frontend
```

### Flow D: Export to Google Drive

```
User clicks "Export to Google Drive" on result
            ↓
Frontend → POST /api/drive/upload
  Body: {
    "runId": "run-123",
    "filename": "Output.xlsx",
    "parentFolderId": "folder-abc" (optional)
  }
            ↓
Backend:
  1. Retrieve output file from local storage (DATA_DIR/outputs/run-123.xlsx)
  2. Initialize GoogleDriveService(user_id, db)
  3. service.upload_file(filename, content, mime_type, parent_folder_id)
  4. Google Drive returns new file ID
            ↓
Return to frontend:
  {
    "fileId": "1XyZ456",
    "webViewLink": "https://drive.google.com/file/d/1XyZ456/view"
  }
            ↓
Frontend displays success message with link to view in Drive
```

### Flow E: Token Refresh (Automatic)

```
Backend receives API request requiring Drive access
            ↓
GoogleDriveService._get_credentials():
  1. Fetch UserDB record
  2. Decrypt google_access_token
  3. Check token_expiry < now()
            ↓
If expired:
  1. Use google_refresh_token to request new access token:
     POST https://oauth2.googleapis.com/token
     {
       "client_id": "...",
       "client_secret": "...",
       "refresh_token": "1//...",
       "grant_type": "refresh_token"
     }
  2. Receive new access token (refresh token unchanged)
  3. Encrypt and update UserDB:
     - google_access_token = new_token
     - token_expiry = now + expires_in
  4. Return Credentials object
            ↓
Use credentials to make Drive API call
```

---

## 4. Component Boundaries & Responsibilities

| Component | Boundary | Responsibilities | Does NOT Handle |
|-----------|----------|------------------|-----------------|
| **Frontend Picker** | UI only | • Display picker dialog<br>• Return file metadata<br>• Handle user cancellation | • File download<br>• Token storage<br>• API calls to Drive |
| **Frontend AuthContext** | Session management | • Check if user authenticated<br>• Initiate OAuth flow<br>• Display user info | • Token refresh<br>• Drive API calls |
| **Backend Auth Router** | OAuth flow | • Redirect to Google<br>• Handle callback<br>• Store tokens in DB<br>• Manage scope requests | • File operations<br>• Token usage |
| **Backend Drive Service** | Drive API proxy | • Download/upload files<br>• Read/write Sheets<br>• Refresh tokens<br>• Handle rate limits | • UI logic<br>• Session management<br>• Workflow execution |
| **Backend Drive Router** | HTTP endpoints | • Validate requests<br>• Call Drive service<br>• Return responses | • Token management<br>• File parsing |
| **Database (UserDB)** | Token storage | • Store encrypted tokens<br>• Track token expiry<br>• Store granted scopes | • Token refresh logic<br>• Encryption keys |

---

## 5. Extending OAuth Without Breaking Current Flow

### Strategy: Incremental Consent

**Approach:**
1. Keep existing `/api/auth/login` as-is (no Drive scopes by default)
2. Add new endpoint `/api/auth/login/drive` with extended scopes
3. Frontend detects if user has Drive scopes via `/api/auth/me`
4. Show "Connect Google Drive" button if scopes not granted

**Implementation:**

```python
# /backend/app/auth/router.py

BASIC_SCOPES = "openid email profile"
DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets"

@router.get("/login")
async def login(request: Request, scope: str = "basic"):
    """Redirect to Google with requested scopes."""
    if scope == "drive":
        requested_scopes = f"{BASIC_SCOPES} {DRIVE_SCOPES}"
    else:
        requested_scopes = BASIC_SCOPES

    # Register OAuth client dynamically with requested scopes
    oauth = get_oauth(scopes=requested_scopes)
    redirect_uri = f"{base_url}/api/auth/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)

@router.get("/callback")
async def callback(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle callback, store tokens if Drive scopes granted."""
    oauth = get_oauth()
    token = await oauth.google.authorize_access_token(request)

    # Extract tokens
    access_token = token.get("access_token")
    refresh_token = token.get("refresh_token")
    expires_in = token.get("expires_in", 3600)
    granted_scopes = token.get("scope", "").split()

    # Update user record
    user = await get_or_create_user(db, token["userinfo"])

    # If Drive scopes granted, store tokens
    if any("drive" in s or "spreadsheets" in s for s in granted_scopes):
        from app.auth.encryption import encrypt_token
        user.google_access_token = encrypt_token(access_token)
        if refresh_token:  # Only provided on first consent
            user.google_refresh_token = encrypt_token(refresh_token)
        user.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in)
        user.drive_scopes = granted_scopes

    await db.commit()
    # ... rest of callback logic
```

**Frontend Flow:**

```typescript
// /frontend/src/hooks/useDriveAuth.ts

export function useDriveAuth() {
  const { user } = useAuth();
  const [hasDriveAccess, setHasDriveAccess] = useState(false);

  useEffect(() => {
    // Check if user has Drive scopes
    fetch('/api/auth/drive-status')
      .then(r => r.json())
      .then(data => setHasDriveAccess(data.hasDriveScopes));
  }, [user]);

  const connectDrive = () => {
    window.location.href = '/api/auth/login?scope=drive';
  };

  return { hasDriveAccess, connectDrive };
}
```

### Handling Scope Upgrades

**Scenario**: User already logged in with basic scopes, now needs Drive access.

**Solution**: Incremental authorization
- User clicks "Connect Google Drive"
- Frontend redirects to `/api/auth/login?scope=drive&prompt=consent`
- `prompt=consent` forces Google to show consent screen again
- User approves Drive scopes
- Backend receives refresh token on this second consent (if not already stored)
- Update UserDB with new tokens and scopes

**Backward Compatibility:**
- Users without Drive scopes can still use local file uploads
- All existing API endpoints work as before
- Drive features are opt-in, not required

---

## 6. Suggested Build Order

### Phase 1: Token Management Foundation
**Goal**: Store and refresh tokens without breaking current auth.

1. **Database Migration**: Add token columns to UserDB
2. **Encryption Module**: Implement token encryption/decryption
3. **Auth Router Update**: Store tokens in callback, add Drive scope endpoint
4. **Testing**: Verify existing login still works, tokens stored correctly

**Dependencies**: None (extends current system)

**Validation**:
- Existing users can log in
- New users see tokens in database (encrypted)
- Token refresh logic works in isolation

---

### Phase 2: Backend Drive Service
**Goal**: Enable backend to interact with Drive/Sheets APIs.

1. **Install Dependencies**: `google-api-python-client`, `google-auth`
2. **Drive Service Class**: Implement `GoogleDriveService` with download/upload
3. **Token Refresh Logic**: Automatic refresh when expired
4. **Unit Tests**: Mock Drive API, test token refresh

**Dependencies**: Phase 1 (tokens must be stored)

**Validation**:
- Download file by ID returns correct content
- Upload file returns file ID
- Token refresh updates database

---

### Phase 3: Backend Drive Endpoints
**Goal**: Expose Drive operations via REST API.

1. **Drive Router**: Create `/api/drive/*` endpoints
2. **Request Validation**: Pydantic models for file IDs, upload metadata
3. **Error Handling**: Handle Drive API errors (not found, permission denied)
4. **Integration Tests**: Test endpoints with real Drive API (dev account)

**Dependencies**: Phase 2 (Drive service must exist)

**Validation**:
- POST /api/drive/download with file ID returns file content
- POST /api/drive/upload creates file in Drive
- Error responses are clear and actionable

---

### Phase 4: Frontend Picker UI
**Goal**: Let users select files from Drive.

1. **Load Picker SDK**: Component to load `gapi.js` dynamically
2. **Picker Component**: Display Drive picker, return selected files
3. **File Source Selection**: UI to choose between local upload and Drive picker
4. **Drive Auth Check**: Show "Connect Drive" button if scopes not granted

**Dependencies**: Phase 1 (user must have way to grant scopes)

**Validation**:
- Picker loads and displays user's Drive files
- Selected files return correct metadata (id, name, mimeType)
- "Connect Drive" button redirects to OAuth with Drive scopes

---

### Phase 5: Workflow Integration
**Goal**: Support Drive files in workflow execution.

1. **File Input Abstraction**: Update workflow API to accept `{type: 'drive', fileId}` or `{type: 'local', file}`
2. **Backend Workflow Update**: Download Drive files before processing
3. **Frontend Workflow Editor**: Display Drive files alongside local uploads
4. **Mixed File Sources**: Support workflows with both Drive and local files

**Dependencies**: Phase 2, 3, 4 (all components must exist)

**Validation**:
- Workflow with Drive file as input executes successfully
- Workflow with mix of Drive and local files works
- Error handling for Drive API failures during workflow run

---

### Phase 6: Export to Drive
**Goal**: Upload workflow results back to Drive.

1. **Export Endpoint**: POST /api/drive/export-result
2. **Frontend Export UI**: "Export to Drive" button on result page
3. **Folder Selection**: Optional picker to choose destination folder
4. **Success Feedback**: Display Drive link after upload

**Dependencies**: Phase 2, 3 (Drive service and endpoints)

**Validation**:
- Export result creates file in Drive
- File is accessible and correct
- User receives shareable link

---

### Phase 7: Sheets-Specific Features (Optional)
**Goal**: Direct Sheets read/write without file download.

1. **Sheets Service Methods**: `read_sheet()`, `write_sheet()`
2. **Sheets Endpoints**: `/api/sheets/read`, `/api/sheets/write`
3. **Frontend Sheets Picker**: Filter picker to only show Sheets
4. **Range Selection UI**: Input for Sheet range (e.g., "Sheet1!A1:D10")

**Dependencies**: Phase 2 (Drive service as foundation)

**Validation**:
- Read Sheets range returns data
- Write to Sheets updates correctly
- Range validation prevents errors

---

## 7. Dependencies & Libraries

### Backend (Python)
```txt
# Add to requirements.txt

# Google API client
google-api-python-client>=2.110.0
google-auth>=2.25.0
google-auth-httplib2>=0.2.0
google-auth-oauthlib>=1.2.0

# Token encryption
cryptography>=41.0.7
```

### Frontend (React)
```json
// No new npm packages needed - use CDN for Picker

// Load in index.html:
<script src="https://apis.google.com/js/api.js"></script>
```

**Picker API Key**:
- Create in Google Cloud Console (API & Services > Credentials)
- Restrict to your domain in production
- Different from OAuth client ID (both needed)

---

## 8. Security Considerations

### Token Storage
- **Never store tokens in frontend** (localStorage, sessionStorage, cookies accessible to JS)
- **Encrypt tokens at rest** in database using Fernet (symmetric encryption)
- **Rotate encryption key** periodically (requires re-encrypting all tokens)
- **Use refresh tokens** to minimize exposure window of access tokens

### API Key Exposure
- **Picker API Key** is public (safe to expose in frontend)
- **OAuth Client Secret** must never be in frontend (stays in backend only)
- **Restrict API Key** to specific domains in Google Cloud Console

### Scope Management
- **Request minimum scopes** needed:
  - `drive.file`: Access only files created by app (recommended)
  - `drive.readonly`: Read-only access (if no uploads needed)
  - `spreadsheets`: Full Sheets access
- **Avoid `drive` scope**: Full Drive access (too broad, harder to get approved)

### Session Security
- **HTTPS only** in production (already enforced via `https_only=_is_production`)
- **SameSite=Lax** for session cookies (already set)
- **Validate user_id** in all Drive endpoints (use `get_current_user` dependency)

### Error Handling
- **Don't expose token errors** to frontend (log internally, return generic message)
- **Handle revoked tokens**: If refresh fails, clear tokens and prompt re-auth
- **Rate limit handling**: Exponential backoff for Drive API rate limits

---

## 9. Testing Strategy

### Unit Tests
- **Token encryption/decryption**: Verify round-trip, handle invalid input
- **Token refresh logic**: Mock Google API, test expiry check
- **Drive service methods**: Mock API responses, test error cases

### Integration Tests
- **OAuth flow with Drive scopes**: Test callback stores tokens
- **Drive file download**: Test with real file ID (dev account)
- **Drive file upload**: Verify file appears in Drive
- **Token refresh**: Force expiry, verify automatic refresh

### End-to-End Tests
- **Workflow with Drive file**: Select file via picker, run workflow, verify output
- **Export to Drive**: Run workflow, export result, verify in Drive
- **Scope upgrade**: Log in with basic scopes, connect Drive, verify tokens updated

---

## 10. Migration Path (Rollout Plan)

### Stage 1: Dark Launch (Internal Testing)
- Deploy Phase 1-3 (token storage, Drive service, endpoints)
- Test with internal Google accounts
- No UI changes visible to users

### Stage 2: Opt-In Beta
- Deploy Phase 4-5 (Picker UI, workflow integration)
- Add feature flag: `ENABLE_DRIVE_INTEGRATION=true`
- Invite beta users to test
- Collect feedback on UX, performance, errors

### Stage 3: General Availability
- Deploy Phase 6 (export to Drive)
- Enable for all users
- Add onboarding tooltip: "New! Connect Google Drive to access your files"

### Stage 4: Sheets Enhancements (Future)
- Deploy Phase 7 (Sheets-specific features)
- Market as separate feature

### Rollback Plan
- If critical bug found: Disable Drive features via feature flag
- Database rollback: Tokens are nullable, can be cleared without breaking users
- Frontend rollback: Remove Drive UI, fall back to local uploads only

---

## 11. Performance Considerations

### Frontend
- **Lazy load Picker SDK**: Only load `gapi.js` when user clicks "Connect Drive"
- **Cache file metadata**: Store picked file info in component state (avoid re-picking)

### Backend
- **Stream large files**: Don't load entire Drive file into memory
  ```python
  # Use MediaIoBaseDownload for streaming
  request = drive_service.files().get_media(fileId=file_id)
  fh = io.BytesIO()
  downloader = MediaIoBaseDownload(fh, request)
  done = False
  while not done:
      status, done = downloader.next_chunk()
  ```
- **Cache credentials**: Store Credentials object in memory per request (don't fetch from DB multiple times)
- **Connection pooling**: Reuse HTTP connections for Google API calls (handled by `google-api-python-client`)

### Database
- **Index token_expiry**: Speed up expiry checks
  ```python
  Index('ix_users_token_expiry', UserDB.token_expiry)
  ```
- **Async token refresh**: Refresh in background, don't block request
  ```python
  # If token expires in < 5 minutes, refresh proactively
  if token_expiry - datetime.utcnow() < timedelta(minutes=5):
      asyncio.create_task(refresh_token(user_id))
  ```

---

## 12. Monitoring & Observability

### Metrics to Track
- **OAuth success rate**: % of users who complete Drive consent flow
- **Token refresh rate**: How often tokens are refreshed
- **Drive API latency**: P50, P95, P99 for download/upload
- **Drive API errors**: Rate of 403 (permission), 404 (not found), 429 (rate limit)
- **Workflow execution time**: Compare Drive vs local file workflows

### Logging
```python
# Key events to log:
logger.info("User %s granted Drive scopes: %s", user_id, granted_scopes)
logger.info("Token refreshed for user %s", user_id)
logger.warning("Drive API rate limit hit for user %s", user_id)
logger.error("Drive API error for file %s: %s", file_id, error)
```

### Alerts
- **Token refresh failures**: Alert if > 5% of refreshes fail (may indicate OAuth issue)
- **Drive API error rate**: Alert if > 1% of requests fail
- **Latency spikes**: Alert if P95 > 10 seconds

---

## Summary: Key Architectural Decisions

| Decision | Rationale | Alternative Considered |
|----------|-----------|------------------------|
| **Store tokens in backend** | Security (never expose tokens to frontend), automatic refresh | Store in frontend → Rejected (security risk) |
| **Encrypt tokens at rest** | Compliance (protect refresh tokens), defense in depth | Plain text → Rejected (security risk) |
| **Backend proxy for Drive API** | Token management, rate limiting, error handling | Frontend calls Drive directly → Rejected (can't hide client secret) |
| **Incremental consent** | Backward compatibility, user control | Require Drive scopes for all users → Rejected (forces consent) |
| **Picker for file selection** | Official Google UI, familiar to users, handles auth popup | Custom file browser → Rejected (reinventing wheel) |
| **Mixed file sources** | Flexibility (users can upload local files OR pick from Drive) | Drive-only → Rejected (limits use cases) |
| **Async token refresh** | Don't block requests waiting for refresh | Synchronous refresh → Rejected (poor UX) |

---

## Appendix: Required Google Cloud Configuration

### Google Cloud Console Setup

1. **Create OAuth 2.0 Client ID** (if not exists):
   - APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:5173`, `https://your-domain.com`
   - Authorized redirect URIs: `http://localhost:8000/api/auth/callback`, `https://your-domain.com/api/auth/callback`

2. **Create API Key** (for Picker):
   - APIs & Services > Credentials > Create Credentials > API Key
   - Restrict key: HTTP referrers, add your domain
   - Restrict to APIs: Google Picker API

3. **Enable APIs**:
   - Google Drive API
   - Google Sheets API
   - Google Picker API

4. **OAuth Consent Screen**:
   - Add scopes: `drive.file`, `spreadsheets`, `openid`, `email`, `profile`
   - Add test users (if app in testing mode)
   - Submit for verification (if requesting sensitive scopes)

### Environment Variables

```bash
# .env (backend)

# Existing
SESSION_SECRET_KEY=your-session-secret
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123...

# New for Drive integration
TOKEN_ENCRYPTION_KEY=your-encryption-key  # 32-byte key for Fernet
GOOGLE_API_KEY=AIzaSyAbc123...           # For Picker (public key)
DRIVE_API_QUOTA_USER=your-app-name       # For quota tracking
```

```typescript
// Frontend .env

VITE_GOOGLE_API_KEY=AIzaSyAbc123...      // Same as backend GOOGLE_API_KEY
VITE_GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
```

---

## Appendix: Google API Scopes Reference

| Scope | Access Level | Use Case |
|-------|--------------|----------|
| `https://www.googleapis.com/auth/drive.file` | App-created files only | **Recommended**: Upload outputs, download inputs picked by user |
| `https://www.googleapis.com/auth/drive.readonly` | Read-only, all files | Download files only (no uploads) |
| `https://www.googleapis.com/auth/drive` | Full access | **Not recommended**: Too broad, harder to get approved |
| `https://www.googleapis.com/auth/spreadsheets` | Read/write Sheets | Direct Sheets API access (Phase 7) |
| `https://www.googleapis.com/auth/spreadsheets.readonly` | Read Sheets only | If no Sheets writing needed |

**Scope Strategy for This App:**
- **Phase 1-6**: `drive.file` + `spreadsheets` (read/write both)
- **If read-only workflow**: `drive.readonly` + `spreadsheets.readonly`

---

## Appendix: Common Pitfalls & Solutions

| Pitfall | Impact | Solution |
|---------|--------|----------|
| **Tokens not refreshed** | API calls fail after 1 hour | Implement automatic refresh in `_get_credentials()` |
| **Client secret in frontend** | Security breach | Always proxy Drive API calls through backend |
| **No error handling for revoked tokens** | Users stuck in error state | Catch 401, clear tokens, prompt re-auth |
| **Picker API key not restricted** | Quota abuse, security risk | Restrict to your domain in Google Cloud Console |
| **Rate limits hit** | API calls fail intermittently | Implement exponential backoff, cache results |
| **Scope mismatch** | OAuth errors | Ensure requested scopes match what's registered in Cloud Console |
| **Token encryption key lost** | All tokens unusable | Back up encryption key, document recovery process |
| **Session cookie not set** | User not authenticated | Check `credentials: 'include'` in fetch, CORS allows credentials |

---

**Document Version**: 1.0
**Last Updated**: 2026-02-07
**Author**: Project Research (GSD Agent)
**Status**: Ready for Roadmap Planning
