# Google Drive/Sheets Integration Pitfalls

**Research Date:** 2026-02-07
**Context:** Adding Google Drive/Sheets/Picker to existing authlib OAuth login

This document catalogs common mistakes and gotchas when integrating Google Drive API, Sheets API, and Google Picker into a web app with existing Google OAuth authentication.

---

## 1. OAuth Scope Expansion Breaking Existing Users

### The Problem
When you expand OAuth scopes from `openid email profile` to include `drive.file` and `spreadsheets`, **existing users with active sessions will not automatically get the new scopes**. Their stored tokens remain valid but lack Drive permissions, causing API calls to fail with 403 Forbidden.

### Warning Signs
- API calls to Drive/Sheets return 403 "Insufficient Permission" errors
- `token.get('scope')` doesn't include the new scopes for existing users
- New users can access Drive, but existing users cannot
- Error logs show "Request had insufficient authentication scopes"

### Prevention Strategy
**Incremental Authorization with Forced Re-consent:**

1. **Detect Missing Scopes:** Before making Drive API calls, verify the stored token contains required scopes
   ```python
   required_scopes = {'drive.file', 'spreadsheets'}
   token_scopes = set(token.get('scope', '').split())
   if not required_scopes.issubset(token_scopes):
       # Trigger re-authorization
   ```

2. **Force Re-authorization:** Add `prompt=consent` or `access_type=offline` to OAuth flow when scopes are missing
   ```python
   # In authlib OAuth registration
   client_kwargs={
       "scope": "openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets",
       "prompt": "consent"  # Forces re-consent even if previously authorized
   }
   ```

3. **Store Token Metadata:** Save which scopes each user has authorized in UserDB
   ```python
   # In callback handler after token exchange
   user.authorized_scopes = token.get('scope', '')
   await db.commit()
   ```

4. **Graceful Degradation:** UI should detect missing scopes and show "Connect Google Drive" button that triggers re-auth
   ```python
   # Endpoint to check Drive access
   @router.get("/drive/status")
   async def drive_status(user: UserDB = Depends(get_current_user)):
       if 'drive.file' not in user.authorized_scopes:
           return {"connected": False}
       return {"connected": True}
   ```

### Which Phase
**Phase 1 (OAuth Scope Expansion):** Implement scope detection and re-consent flow before building any Drive features. Otherwise, you'll need to migrate existing users later.

---

## 2. Google Picker Requires Both API Key AND OAuth Token

### The Problem
Google Picker API has a **dual authentication requirement** that's not obvious from the docs:
- **OAuth access token** for user identity and Drive access
- **Separate API key** (browser API key) for Picker UI itself

Missing either causes the Picker to fail silently or show "Authentication error."

### Warning Signs
- Picker widget shows blank screen or "Unable to load picker"
- Console error: "API key not set" or "Invalid API key"
- Picker loads but shows "You need permission" despite valid OAuth token
- Different behavior between localhost and production (CORS/referer restrictions)

### Prevention Strategy
**Set Up Both Credentials Correctly:**

1. **Create Browser API Key** in Google Cloud Console:
   - Navigate to APIs & Services > Credentials
   - Create API Key (NOT OAuth client)
   - Restrict to "Google Picker API" only
   - Add HTTP referrers (both localhost and production domain)
   ```
   http://localhost:5173/*
   https://your-app.railway.app/*
   ```

2. **Pass Both to Picker:**
   ```javascript
   // Frontend (React)
   const picker = new google.picker.PickerBuilder()
     .setOAuthToken(accessToken)      // From OAuth flow
     .setDeveloperKey(apiKey)         // Browser API key from env
     .addView(google.picker.ViewId.SPREADSHEETS)
     .setCallback(pickerCallback)
     .build();
   picker.setVisible(true);
   ```

3. **Don't Expose API Key as Secret:** Browser API keys are meant to be public (referer-restricted). Don't treat them like OAuth client secrets.

4. **Environment Variables:**
   ```env
   # Backend (OAuth)
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...  # SECRET - server-only

   # Frontend (Picker)
   VITE_GOOGLE_API_KEY=...   # PUBLIC - browser API key with referer restrictions
   ```

### Which Phase
**Phase 2 (Google Picker Integration):** Set up API key immediately when implementing Picker. Don't wait until testing to discover this requirement.

---

## 3. Token Refresh Not Implemented for Long-Running Operations

### The Problem
OAuth access tokens expire after **1 hour**. If a user's workflow run takes more than an hour, or if they leave the app open and return later, Drive/Sheets API calls will fail with 401 Unauthorized. Authlib's default OAuth integration doesn't automatically refresh tokens for API calls (only for login flow).

### Warning Signs
- API calls succeed initially, then fail with 401 after ~60 minutes
- Error: "Token has been expired or revoked"
- Users report "it worked yesterday but not today"
- Batch operations on large spreadsheets fail partway through

### Prevention Strategy
**Implement Token Refresh Middleware:**

1. **Request Refresh Token:** Add `access_type=offline` to OAuth flow
   ```python
   # In OAuth registration
   client_kwargs={
       "scope": "...",
       "access_type": "offline",  # Gets refresh token
       "prompt": "consent"        # Required for refresh token on first auth
   }
   ```

2. **Store Refresh Token Securely:** Save in database encrypted or use secure session storage
   ```python
   # In callback handler
   user.access_token = token['access_token']
   user.refresh_token = token.get('refresh_token')  # Only on first auth
   user.token_expiry = datetime.now() + timedelta(seconds=token['expires_in'])
   await db.commit()
   ```

3. **Auto-Refresh Before API Calls:** Create a helper that checks expiry and refreshes if needed
   ```python
   async def get_valid_drive_token(user: UserDB) -> str:
       if datetime.now() >= user.token_expiry:
           # Refresh token
           oauth = get_oauth()
           token = await oauth.google.fetch_access_token(
               refresh_token=user.refresh_token
           )
           user.access_token = token['access_token']
           user.token_expiry = datetime.now() + timedelta(seconds=token['expires_in'])
           await db.commit()
       return user.access_token
   ```

4. **Handle Refresh Token Expiry:** Refresh tokens can also be revoked. Catch exceptions and trigger re-auth:
   ```python
   try:
       token = await oauth.google.fetch_access_token(refresh_token=...)
   except OAuthError:
       # Refresh token invalid - user must re-authenticate
       raise HTTPException(401, detail="drive_reconnect_required")
   ```

### Which Phase
**Phase 1 (OAuth Scope Expansion):** Build token refresh infrastructure before implementing Drive features. Retrofit is painful because you need to force all users to re-auth to get refresh tokens.

---

## 4. Google Sheets API Has Different Quotas Than Drive API

### The Problem
Google APIs have **separate quota buckets** for Drive API and Sheets API, with different rate limits:
- **Drive API:** 1,000 queries per 100 seconds per user
- **Sheets API:** 100 queries per 100 seconds per user (10x stricter)
- **Sheets API (write):** 60 requests per 60 seconds per user

Naively reading/writing Sheets in a loop will hit quota limits quickly, especially for batch operations.

### Warning Signs
- Error 429: "Quota exceeded for quota metric 'Read requests' and limit 'Read requests per user per 100 seconds'"
- Error 429: "Quota exceeded for quota metric 'Write requests per user'"
- Workflows succeed for small files but fail for large batches
- Users report inconsistent failures ("works sometimes, not others")

### Prevention Strategy
**Batch Operations and Exponential Backoff:**

1. **Use Batch Requests:** Sheets API supports batching multiple operations
   ```python
   # Bad: One API call per cell range
   for sheet_id in sheet_ids:
       result = service.spreadsheets().values().get(
           spreadsheetId=sheet_id, range='A1:Z1000'
       ).execute()

   # Good: Batch read multiple ranges
   batch = service.new_batch_http_request()
   for sheet_id in sheet_ids:
       batch.add(service.spreadsheets().values().get(
           spreadsheetId=sheet_id, range='A1:Z1000'
       ))
   batch.execute()
   ```

2. **Implement Exponential Backoff:** Retry 429 errors with increasing delays
   ```python
   import time
   from googleapiclient.errors import HttpError

   def execute_with_backoff(request, max_retries=5):
       for retry in range(max_retries):
           try:
               return request.execute()
           except HttpError as e:
               if e.resp.status == 429:
                   wait = 2 ** retry  # Exponential backoff: 1s, 2s, 4s, 8s, 16s
                   time.sleep(wait)
               else:
                   raise
       raise Exception("Max retries exceeded")
   ```

3. **Cache Metadata Reads:** Don't repeatedly fetch spreadsheet metadata
   ```python
   # Bad: Fetch metadata on every workflow run
   sheet_meta = service.spreadsheets().get(spreadsheetId=id).execute()

   # Good: Cache in database with TTL
   if not cached_meta or cache_expired:
       sheet_meta = service.spreadsheets().get(spreadsheetId=id).execute()
       cache.set(f"sheet_meta:{id}", sheet_meta, ttl=3600)
   ```

4. **Request Quota Increase:** For production apps, request higher quotas in Google Cloud Console (usually approved quickly)

### Which Phase
**Phase 3 (Sheets Read/Write):** Implement batching and backoff when building Sheets integration. Test with realistic workload (multiple workflows, multiple files) before production.

---

## 5. drive.file Scope Only Accesses Created/Opened Files

### The Problem
The `https://www.googleapis.com/auth/drive.file` scope follows **principle of least privilege** but has a non-obvious limitation: the app can ONLY access files that:
- The user opened via Picker
- The app created
- The user explicitly shared with the app

It **cannot** list all files in the user's Drive or access arbitrary files. This breaks if you try to implement a "browse all files" feature.

### Warning Signs
- Picker shows files, but API calls to list files return empty results
- Error: "File not found" for files that exist and are visible in Picker
- `drive.files.list()` returns 0 results despite user having files
- Users expect to see all their files but see only app-created files

### Prevention Strategy
**Design Around Scope Limitations:**

1. **Always Use Picker for File Selection:** Don't build a custom file browser
   ```javascript
   // Picker handles the authorization implicitly
   const picker = new google.picker.PickerBuilder()
     .addView(google.picker.ViewId.SPREADSHEETS)  // Only Sheets
     .addView(new google.picker.DocsView()        // Or all Drive files
       .setIncludeFolders(true))
     .setCallback(handlePickerResult)
     .build();
   ```

2. **Store File IDs Explicitly:** Save file IDs returned by Picker in database
   ```python
   # After user picks file
   workflow.drive_file_id = picked_file_id
   workflow.drive_file_name = picked_file_name
   await db.commit()
   ```

3. **Document Scope Limitations to Users:** UI should explain that only "connected" files are accessible
   ```jsx
   <InfoBox>
     This app can only access files you explicitly select via the file picker.
     To access a file, use the "Browse Drive" button to grant permission.
   </InfoBox>
   ```

4. **Consider Full Drive Scope for Admin Features:** If you need to list all files (e.g., file backup feature), use `drive.readonly` or `drive` scope, but:
   - Triggers scarier consent screen ("See, edit, create, and delete all of your Google Drive files")
   - Requires Google OAuth verification (stricter app review)
   - Most apps should stick with `drive.file`

### Which Phase
**Phase 0 (Design):** Choose scope before implementation. Changing scopes later requires user re-consent and potentially new OAuth verification.

---

## 6. Google OAuth Consent Screen Verification Delay

### The Problem
Apps requesting **sensitive scopes** (drive.file, spreadsheets) require **Google OAuth verification** before going public. Unverified apps show scary warnings ("This app isn't verified") and are limited to 100 test users. The verification process takes **1-4 weeks** and requires:
- Privacy policy URL
- Terms of service URL
- Screencasts demonstrating OAuth flow
- Justification for each scope

### Warning Signs
- Consent screen shows "Google hasn't verified this app" warning
- Users see "This app is not verified by Google" and may not trust it
- OAuth screen says "unverified app" during development
- Can't add more than 100 test users in Google Cloud Console

### Prevention Strategy
**Start Verification Early:**

1. **Add Test Users During Development:** In Google Cloud Console > OAuth consent screen > Test users
   - Add your own email and any beta testers
   - Test users bypass verification warnings

2. **Create Required Legal Pages Before Launch:**
   ```markdown
   # Required pages:
   - Privacy Policy (must explain Drive data usage)
   - Terms of Service
   - Support email

   # Host at:
   https://your-app.railway.app/privacy
   https://your-app.railway.app/terms
   ```

3. **Prepare Verification Materials:**
   - **Screencast:** Record video showing login flow, Drive file selection, and data usage
   - **Scope Justification:** Explain why each scope is needed (e.g., "drive.file allows users to import spreadsheets")
   - **Homepage:** Public URL explaining what the app does

4. **Submit Verification 2-4 Weeks Before Launch:**
   - Google Cloud Console > OAuth consent screen > Prepare for verification
   - Expect 1-4 weeks review time, longer if rejected and resubmitted

5. **Use Internal Consent Screen for Early Development:**
   ```
   Consent screen type: Internal (Google Workspace only)
   - OR -
   Consent screen type: External + Testing status
   ```

### Which Phase
**Phase 0 (Pre-Planning):** Create privacy policy and terms before writing code. Submit verification as soon as you have a working prototype (even if UI is ugly).

---

## 7. Picker API Loads Asynchronously and Requires CORS Headers

### The Problem
Google Picker loads via `gapi.load()` which is **asynchronous**, and the Picker script must be loaded from Google's CDN with specific CORS headers. Common mistakes:
- Trying to show Picker before `gapi.load()` completes (shows blank screen)
- Not setting `Content-Security-Policy` headers correctly (Picker blocked)
- Picker script loaded multiple times (duplicate Picker instances)

### Warning Signs
- Console error: "gapi is not defined"
- Console error: "google.picker.PickerBuilder is not a constructor"
- Blank Picker window appears and immediately closes
- CSP violation errors in console
- Picker works in development but not production (CSP headers differ)

### Prevention Strategy
**Proper Async Loading and CSP Configuration:**

1. **Load Picker Script in index.html:**
   ```html
   <!-- frontend/index.html -->
   <script src="https://apis.google.com/js/api.js"></script>
   ```

2. **Wait for GAPI Before Showing Picker:**
   ```javascript
   // Custom hook to load Picker
   const usePicker = () => {
     const [isLoaded, setIsLoaded] = useState(false);

     useEffect(() => {
       if (window.gapi) {
         window.gapi.load('picker', {
           callback: () => setIsLoaded(true),
         });
       }
     }, []);

     const showPicker = (accessToken, apiKey, callback) => {
       if (!isLoaded) {
         console.error('Picker not loaded yet');
         return;
       }
       const picker = new google.picker.PickerBuilder()
         .setOAuthToken(accessToken)
         .setDeveloperKey(apiKey)
         .addView(google.picker.ViewId.SPREADSHEETS)
         .setCallback(callback)
         .build();
       picker.setVisible(true);
     };

     return { showPicker, isLoaded };
   };
   ```

3. **Configure CSP Headers (FastAPI):**
   ```python
   # backend/app/main.py
   from fastapi.middleware.cors import CORSMiddleware
   from starlette.middleware.trustedhost import TrustedHostMiddleware

   # Add CSP headers for Picker
   @app.middleware("http")
   async def add_security_headers(request: Request, call_next):
       response = await call_next(request)
       response.headers["Content-Security-Policy"] = (
           "default-src 'self'; "
           "script-src 'self' 'unsafe-inline' https://apis.google.com; "
           "frame-src https://docs.google.com; "  # Picker iframe
           "connect-src 'self' https://www.googleapis.com"
       )
       return response
   ```

4. **Handle Picker Cancellation:**
   ```javascript
   const pickerCallback = (data) => {
     if (data.action === google.picker.Action.PICKED) {
       const fileId = data.docs[0].id;
       // Handle file selection
     } else if (data.action === google.picker.Action.CANCEL) {
       // User closed picker without selecting
       console.log('Picker cancelled');
     }
   };
   ```

### Which Phase
**Phase 2 (Picker Integration):** Set up CSP headers and async loading infrastructure before building Picker UI. Test in production-like environment (Railway preview deploy) early.

---

## 8. Google Sheets API Doesn't Validate Cell Formats

### The Problem
When writing to Google Sheets via API, the `values.update()` endpoint **interprets values as text by default** unless you specify `valueInputOption`. This causes:
- Numbers stored as text (breaks formulas, sorting)
- Dates stored as text strings (not recognized as dates)
- Formulas written as literal text (not evaluated)

### Warning Signs
- Numbers appear left-aligned in Sheets (indicating text format)
- Sorting doesn't work correctly (1, 10, 2 instead of 1, 2, 10)
- DATE formulas return errors
- Users complain exported data "doesn't look right" in Sheets

### Prevention Strategy
**Specify Value Input Option Correctly:**

1. **Use USER_ENTERED for Interpreted Values:**
   ```python
   # Good: Numbers parsed as numbers, dates as dates, formulas evaluated
   service.spreadsheets().values().update(
       spreadsheetId=sheet_id,
       range='Sheet1!A1:Z1000',
       valueInputOption='USER_ENTERED',  # Interpret like user typing
       body={'values': data}
   ).execute()
   ```

2. **Use RAW for Literal Text:**
   ```python
   # When you want to preserve exact text (e.g., IDs that look like numbers)
   service.spreadsheets().values().update(
       spreadsheetId=sheet_id,
       range='Sheet1!A1',
       valueInputOption='RAW',  # Store exactly as provided
       body={'values': [['001234']]}  # Keeps leading zeros
   ).execute()
   ```

3. **Format Dates Explicitly:**
   ```python
   # Bad: ISO string stored as text
   date_value = datetime.now().isoformat()  # "2026-02-07T14:30:00"

   # Good: Format as Sheets serial number or use USER_ENTERED with locale format
   date_value = datetime.now().strftime('%Y-%m-%d')  # "2026-02-07"
   # With USER_ENTERED, Sheets interprets as date
   ```

4. **Test Data Types in Actual Sheets:** Don't just check API response—open the Sheet and verify:
   - Numbers are right-aligned
   - Dates show as dates (not "2026-02-07" text)
   - Formulas show calculated values

### Which Phase
**Phase 3 (Sheets Write):** Implement and test when building export-to-Sheets feature. Include manual QA by opening exported Sheets and checking cell formats.

---

## 9. Railway Deployment OAuth Redirect URI Mismatch

### The Problem
Railway assigns **random subdomains** on first deploy, then allows custom domains. OAuth redirect URIs must **exactly match** what's registered in Google Cloud Console. Common issues:
- Redirect URI uses `http://` in production (should be `https://`)
- Railway domain changed but Google Console not updated
- Local dev uses `localhost:5173` but not registered in Google Console
- Mixed HTTP/HTTPS in session cookies breaks OAuth flow

### Warning Signs
- Error: "redirect_uri_mismatch" during OAuth callback
- OAuth flow works locally but fails in Railway
- Users redirected to Google consent screen but callback fails
- Error: "The redirect URI in the request did not match a registered redirect URI"

### Prevention Strategy
**Configure All Redirect URIs Upfront:**

1. **Register All Environments in Google Console:**
   ```
   Authorized redirect URIs:
   http://localhost:8000/api/auth/callback       (backend dev)
   http://localhost:5173/api/auth/callback       (frontend dev with proxy)
   https://<railway-app>.railway.app/api/auth/callback
   https://yourdomain.com/api/auth/callback      (custom domain)
   ```

2. **Auto-Detect Redirect Base in Code:**
   ```python
   # backend/app/auth/router.py (already implemented well)
   def _get_credentials():
       redirect_base = os.environ.get("OAUTH_REDIRECT_BASE", "")
       if not redirect_base and os.environ.get("RAILWAY_PUBLIC_DOMAIN"):
           redirect_base = f"https://{os.environ['RAILWAY_PUBLIC_DOMAIN']}"
       return client_id, client_secret, redirect_base
   ```

3. **Enforce HTTPS in Production:**
   ```python
   # backend/app/main.py
   is_production = bool(os.environ.get("RAILWAY_ENVIRONMENT_NAME"))
   app.add_middleware(
       SessionMiddleware,
       secret_key=SESSION_SECRET_KEY,
       https_only=is_production,  # Prevent HTTPS/HTTP mismatch
       same_site="lax"
   )
   ```

4. **Test OAuth Flow in Railway Preview Deploys:**
   - Don't wait until production to test OAuth
   - Railway preview deploys get unique URLs—add them to Google Console during testing
   - Use Railway environment variables for per-deploy config

### Which Phase
**Phase 1 (OAuth Scope Expansion):** Configure all redirect URIs before testing in Railway. Add a checklist in deployment docs.

---

## 10. Per-User Data Isolation with Shared Drive Files

### The Problem
Google Drive allows **file sharing**. If User A shares a file with User B, both can access it via Picker. But your app might store `drive_file_id` in a workflow owned by User A. When User B selects the same file, you might:
- Overwrite User A's workflow config
- Show User A's workflow to User B (data leak)
- Confuse user_id checks because the file is "owned" by User A

This violates per-user isolation.

### Warning Signs
- User B sees User A's workflows after selecting a shared file
- Database constraint violations (duplicate file_id)
- Users report seeing other users' data
- Audit logs show user accessing another user's workflows

### Prevention Strategy
**Always Scope by User, Not Just File:**

1. **Workflow Ownership is User-Scoped:**
   ```python
   # Good: Workflow belongs to user, file ID is just metadata
   @router.get("/workflows")
   async def list_workflows(
       db: AsyncSession = Depends(get_db),
       user: UserDB = Depends(get_current_user)
   ):
       # Always filter by current user
       result = await db.execute(
           select(WorkflowDB).where(WorkflowDB.user_id == user.id)
       )
       return result.scalars().all()
   ```

2. **File Access is Per-User Token:**
   ```python
   # Each user's OAuth token is used for Drive API calls
   # User A's token can't access User B's private files (unless explicitly shared)
   async def read_drive_file(file_id: str, user: UserDB):
       token = await get_valid_drive_token(user)  # User's token
       # Drive API call uses user's token, not shared service account
   ```

3. **Don't Store Shared File Ownership:**
   ```python
   # Bad: Track which user "owns" a Drive file
   drive_files = Table('drive_files', metadata,
       Column('file_id', String, primary_key=True),
       Column('owner_user_id', String)  # Wrong: Drive file can be shared
   )

   # Good: Track which workflow uses which file
   workflow = Table('workflows', metadata,
       Column('user_id', String),  # Workflow owner
       Column('config', JSON)       # Contains drive_file_id as metadata
   )
   ```

4. **Audit Access Patterns:**
   ```python
   # Log when users access Drive files via workflows
   await db.execute(
       insert(AuditLogDB).values(
           user_id=user.id,
           action='drive_file_access',
           resource_id=file_id,
           metadata={'workflow_id': workflow.id}
       )
   )
   ```

### Which Phase
**Phase 3 (Sheets Read/Write):** Design data model carefully when implementing Drive file references. Review access control logic during code review.

---

## Summary: Critical Path to Avoid Pitfalls

### Phase 0: Pre-Implementation (Design)
- [ ] **Pitfall #5:** Choose OAuth scope (drive.file vs drive) based on feature requirements
- [ ] **Pitfall #6:** Create privacy policy and ToS pages, plan for OAuth verification timeline

### Phase 1: OAuth Scope Expansion
- [ ] **Pitfall #1:** Implement scope detection and re-consent flow for existing users
- [ ] **Pitfall #3:** Add `access_type=offline` and implement token refresh infrastructure
- [ ] **Pitfall #9:** Register all redirect URIs (localhost, Railway, custom domain) in Google Console

### Phase 2: Google Picker Integration
- [ ] **Pitfall #2:** Set up browser API key with referer restrictions, pass both key and token to Picker
- [ ] **Pitfall #7:** Load Picker asynchronously, configure CSP headers for Picker iframe

### Phase 3: Drive/Sheets Read/Write
- [ ] **Pitfall #4:** Implement batching and exponential backoff for API calls
- [ ] **Pitfall #8:** Use `valueInputOption='USER_ENTERED'` when writing to Sheets
- [ ] **Pitfall #10:** Review data isolation logic—scope by user_id, not file_id

### Testing & Launch
- [ ] **All Pitfalls:** Test in Railway preview deploy before production
- [ ] **Pitfall #6:** Submit OAuth verification 2-4 weeks before public launch
- [ ] **Pitfall #4:** Load test with realistic workload to verify quota limits

---

*Research completed: 2026-02-07*
