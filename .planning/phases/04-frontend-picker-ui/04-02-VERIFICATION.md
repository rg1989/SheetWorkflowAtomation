# Phase 04 Plan 02 - Verification Guide

## Issue Resolved

**Problem:** Users with legacy `drive.file` OAuth scope couldn't access Drive files through the picker, getting "File not found" errors.

**Root Cause:** The `drive.file` scope only grants access to files created or opened by the app, not arbitrary files the user selects.

**Solution:**
1. Changed OAuth scope from `drive.file` to `drive.readonly` (commit 3fae07d)
2. Added scope validation and reconnect flow for users with old tokens
3. Enhanced error messages to guide users toward reconnection

## What Was Built

### Backend Changes

1. **Scope Debugging** (commit c1db898)
   - Added logging to show user's current Drive scopes during file operations
   - Enhanced error handler to detect `insufficientPermissions` errors
   - Provide clear guidance when scope is insufficient

2. **Disconnect Endpoint** (commit e5bc774)
   - New `/auth/disconnect-drive` endpoint clears OAuth tokens
   - Allows users to reconnect with updated scopes without logging out
   - Updated `/auth/drive-status` to include `needsReconnect` flag

### Frontend Changes

3. **Reconnect UI** (commit b73b383)
   - Check Drive status on FilesStep mount
   - Display warning banner when user has legacy `drive.file` scope
   - "Reconnect Google Drive" button disconnects and redirects to OAuth
   - Clear messaging about why reconnection is needed

## How to Verify

### Prerequisites
- Backend running: `cd backend && ../venv/bin/uvicorn app.main:app --reload`
- Frontend running: `cd frontend && npm run dev`
- User logged in via Google OAuth

### Test Scenario 1: User with Legacy Scope

**If you have a user with `drive.file` scope:**

1. Navigate to workflow creation wizard
2. Go to Files step
3. **Expected:** You should see an amber warning banner at the top:
   - "Drive Permissions Update Required"
   - Explanation about updating permissions
   - "Reconnect Google Drive" button

4. Click "Reconnect Google Drive"
   - **Expected:** Redirects to Google OAuth consent screen
   - Shows updated scope request (drive.readonly)
   - After granting, returns to app
   - Banner disappears

5. Try selecting a Drive file
   - **Expected:** File picker opens successfully
   - Can browse and select files
   - Selected file downloads and appears as card

### Test Scenario 2: Fresh User (No Legacy Scope)

**If you're a new user or already have `drive.readonly`:**

1. Navigate to workflow creation wizard
2. Go to Files step
3. **Expected:** NO warning banner appears
4. Click "Select from Google Drive"
   - **Expected:** Picker opens normally
   - File selection works without issues

### Test Scenario 3: Error Message Improvements

**To test enhanced error messages:**

1. In backend logs (`uvicorn` output), look for scope logging:
   ```
   INFO: Downloading Drive file <id> for user <id> with scopes: <scopes>
   ```

2. If you get a 403/404 error when downloading, check the error message:
   - Should mention "insufficient permissions"
   - Should suggest disconnecting and reconnecting
   - Should reference `drive.readonly` scope

### Verification Commands

**Check Drive status:**
```bash
curl -X GET http://localhost:8000/api/auth/drive-status \
  --cookie "session=<your-session>" | jq
```

Expected response:
```json
{
  "connected": true,
  "scopes": ["openid", "email", "profile", "https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/spreadsheets"],
  "hasLegacyScope": false,
  "needsReconnect": false
}
```

**Disconnect Drive:**
```bash
curl -X POST http://localhost:8000/api/auth/disconnect-drive \
  --cookie "session=<your-session>" | jq
```

Expected response:
```json
{
  "success": true,
  "message": "Google Drive disconnected"
}
```

## Manual Database Check (Optional)

**To check user's current scope in database:**

```bash
cd backend
sqlite3 app.db "SELECT id, email, drive_scopes FROM users;"
```

Look for scope string containing either:
- `https://www.googleapis.com/auth/drive.file` (legacy - needs reconnect)
- `https://www.googleapis.com/auth/drive.readonly` (new - no reconnect needed)

## Success Criteria

- [ ] Users with legacy scope see reconnect banner
- [ ] Reconnect button disconnects and redirects to OAuth
- [ ] After reconnecting, banner disappears
- [ ] Drive file picker works with new scope
- [ ] Error messages guide users to reconnect
- [ ] Backend logs show current scopes for debugging
- [ ] `/auth/drive-status` returns `needsReconnect` flag correctly

## Next Steps

After verification:
1. User tests the reconnect flow
2. If successful, continue to Task 3 completion
3. Create SUMMARY.md for plan 04-02
4. Update STATE.md
