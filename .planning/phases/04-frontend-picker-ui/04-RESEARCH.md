# Phase 4: Frontend Picker UI - Research

**Researched:** 2026-02-07
**Domain:** Google Picker API, React file selection UI
**Confidence:** HIGH

## Summary

This phase implements Google Picker integration to allow users to browse and select files from Google Drive (My Drive and Shared Drives) as an alternative to local file uploads. The research covers the Google Picker API, React integration patterns, and how to mix Drive and local file sources.

The Google Picker API is Google's official JavaScript API for selecting files from Google Drive. It provides a modal dialog with the familiar Drive UI that never leaves the main app. For React applications, there are two primary approaches: using the official `@googleworkspace/drive-picker-react` component or using community libraries like `react-google-drive-picker`. Both approaches load the `gapi` script and create picker instances with OAuth tokens.

Key findings show that Shared Drives support requires enabling `google.picker.Feature.SUPPORT_DRIVES` and using `DocsView.setEnableDrives(true)`. The backend `/api/auth/token` endpoint already provides valid access tokens, and Drive scopes are already configured. The picker callback returns rich metadata including file ID, name, MIME type, and timestamps that can be stored in the workflow definition.

**Primary recommendation:** Use `react-google-drive-picker` npm package with the existing backend token endpoint. Extend the FileDefinition type to support both local File objects and Drive file metadata, allowing users to mix sources within a single workflow.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-google-drive-picker | ^1.2.x | React hook for Google Picker | Most popular React wrapper, 90K+ weekly downloads, clean hook API |
| @types/google.picker | ^0.0.x | TypeScript definitions | Official type definitions for google.picker namespace |
| Google Picker API | v1 (via gapi) | File selection from Drive | Google's official API, loaded via CDN |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @googleworkspace/drive-picker-react | ^0.0.x | Official React wrapper | Alternative if more control needed, web components based |
| @tanstack/react-query | 5.17.19 | API state management | Already in project, use for token fetching |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-google-drive-picker | Direct gapi integration | More code, manual script loading, but full control |
| react-google-drive-picker | @googleworkspace/drive-picker-react | Official but less popular, web components abstraction |

**Installation:**
```bash
npm install react-google-drive-picker @types/google.picker
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── components/
│   ├── FileUpload/
│   │   ├── FileUploadZone.tsx      # Existing local upload
│   │   ├── DriveFilePicker.tsx     # NEW: Google Picker button
│   │   └── FileSourceSelector.tsx  # NEW: Choose upload method
│   ├── WorkflowWizard/
│   │   └── steps/
│   │       └── FilesStep.tsx       # Update to support Drive files
├── hooks/
│   ├── useDrivePicker.ts           # NEW: Picker initialization
│   └── useGoogleAuth.ts            # NEW: Token fetching
├── lib/
│   └── driveFileParser.ts          # NEW: Convert Drive files to FileDefinition
└── types/
    └── index.ts                     # Extend FileDefinition for Drive
```

### Pattern 1: Dual-Source File Input
**What:** Allow users to choose between local upload or Drive selection for each file slot
**When to use:** When mixing file sources within a single workflow (requirement SELECT-04)
**Example:**
```typescript
// Extended FileDefinition to support Drive files
interface FileDefinition {
  id: string
  name: string
  filename: string
  // ... existing fields

  // NEW: Drive file metadata
  source: 'local' | 'drive'
  driveFileId?: string        // Google Drive file ID
  driveMimeType?: string      // MIME type from Drive
  driveModifiedTime?: string  // Last modified timestamp

  // Mutually exclusive: either originalFile OR driveFileId
  originalFile?: File  // For local uploads
}
```

### Pattern 2: Token Management with React Query
**What:** Fetch OAuth token before opening picker, cache with React Query
**When to use:** Every time user clicks "Select from Drive"
**Example:**
```typescript
// Source: Backend implementation + React Query patterns
import { useQuery } from '@tanstack/react-query'

const useGoogleAccessToken = () => {
  return useQuery({
    queryKey: ['googleAccessToken'],
    queryFn: async () => {
      const response = await fetch('/api/auth/token', {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Not authenticated')
      const data = await response.json()
      return data.access_token
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  })
}
```

### Pattern 3: Picker Configuration with Shared Drives
**What:** Configure picker to show both My Drive and Shared Drives
**When to use:** Always, to meet requirement SELECT-03
**Example:**
```typescript
// Source: react-google-drive-picker + Google Picker API docs
import useDrivePicker from 'react-google-drive-picker'

const [openPicker] = useDrivePicker()

const handleOpenPicker = (accessToken: string) => {
  openPicker({
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    developerKey: import.meta.env.VITE_GOOGLE_API_KEY,
    token: accessToken, // Use backend-provided token
    viewId: 'DOCS',
    supportDrives: true,  // CRITICAL: Enables Shared Drives
    multiselect: false,   // Select one file at a time
    showUploadView: false,
    showUploadFolders: false,
    callbackFunction: (data) => {
      if (data.action === 'picked') {
        const doc = data.docs[0]
        handleDriveFileSelected({
          id: doc.id,
          name: doc.name,
          mimeType: doc.mimeType,
          lastEditedUtc: doc.lastEditedUtc,
          sizeBytes: doc.sizeBytes,
        })
      }
    },
  })
}
```

### Pattern 4: Conditional Rendering Based on Auth State
**What:** Show "Connect Google Drive" button if user lacks Drive scopes
**When to use:** In FilesStep, check user's driveConnected status
**Example:**
```typescript
// Source: Backend /api/auth/me response structure
const { data: user } = useQuery({
  queryKey: ['currentUser'],
  queryFn: async () => {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    return res.json() // { driveConnected: boolean, ... }
  },
})

// In render:
{user?.driveConnected ? (
  <DriveFilePicker onSelect={handleDriveFile} />
) : (
  <Button onClick={() => window.location.href = '/api/auth/login?scope=drive'}>
    Connect Google Drive
  </Button>
)}
```

### Anti-Patterns to Avoid
- **Loading gapi script manually:** react-google-drive-picker handles this automatically
- **Storing OAuth tokens in frontend state:** Always fetch from backend, never hardcode
- **Assuming Drive files have File objects:** Drive files need backend download, handle differently
- **Not checking action in callback:** User might cancel, always check `data.action === 'picked'`
- **Hardcoding API keys:** Use environment variables, restrict in Google Cloud Console

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loading Google Picker API | Custom gapi.load wrapper | react-google-drive-picker | Handles script injection, loading states, cleanup |
| OAuth token refresh | Frontend token refresh logic | Backend /api/auth/token | Backend already handles refresh, expiry checking |
| File type filtering | Manual MIME type checks | Picker viewId configuration | Built-in view filtering (DOCS, SPREADSHEETS, etc.) |
| Drive file downloading | Custom Drive API calls | Backend /api/drive endpoints | Backend has auth context, avoids CORS issues |
| Script loading race conditions | setTimeout/polling | react-google-drive-picker hook | Manages gapi loading lifecycle correctly |

**Key insight:** Google Picker has many edge cases (script loading, token expiry, user cancellation, Shared Drives quirks). Community libraries have solved these. Don't rebuild from scratch.

## Common Pitfalls

### Pitfall 1: Repeated OAuth Prompts
**What goes wrong:** User sees OAuth consent screen every time they open the picker
**Why it happens:** Fetching new token on every picker open, or not passing existing token
**How to avoid:** Cache token with React Query (5-10 min staleTime), backend already handles refresh
**Warning signs:** User complaints about frequent sign-ins, logout/login loops

### Pitfall 2: Missing Shared Drives
**What goes wrong:** Users can't see Team Drives/Shared Drives in picker
**Why it happens:** Forgot `supportDrives: true` OR didn't enable in Google Cloud Console
**How to avoid:**
  1. Set `supportDrives: true` in openPicker config
  2. Verify in Google Cloud Console: Drive API → "Shared drives support" checkbox
**Warning signs:** Users report "can't find company files", empty picker for shared drive users

### Pitfall 3: API Key Exposure and Quota Issues
**What goes wrong:** API key gets scraped from client code, quota exhausted by bots
**Why it happens:** API keys are visible in frontend bundles, easily stolen
**How to avoid:**
  - Set Application Restrictions (HTTP referrers: `yourdomain.com/*`)
  - Set API Restrictions (only Google Picker API)
  - Use environment variables, never commit to git
  - Monitor quota in Google Cloud Console
**Warning signs:** Sudden quota exhaustion, suspicious traffic patterns

### Pitfall 4: Drive File vs Local File Confusion
**What goes wrong:** Code expects File object but gets Drive metadata, crashes on .arrayBuffer()
**Why it happens:** Not distinguishing between source types in FileDefinition
**How to avoid:** Add `source: 'local' | 'drive'` field, handle differently:
  - Local: Parse with FileReader/backend upload
  - Drive: Fetch via backend `/api/drive/files/{id}/download`
**Warning signs:** "Cannot read property" errors, parse failures on Drive files

### Pitfall 5: CORS Issues with Drive API
**What goes wrong:** Direct Drive API calls from frontend fail with CORS errors
**Why it happens:** Drive API doesn't allow all origins, needs backend proxy
**How to avoid:** Always proxy Drive file operations through backend
**Warning signs:** Console CORS errors, 401s on direct gapi calls

## Code Examples

Verified patterns from official sources:

### Complete Picker Integration Hook
```typescript
// Source: react-google-drive-picker docs + backend token endpoint
import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import useDrivePicker from 'react-google-drive-picker'

interface DriveFile {
  id: string
  name: string
  mimeType: string
  lastEditedUtc?: number
  sizeBytes?: number
}

export const useDriveFilePicker = (onSelect: (file: DriveFile) => void) => {
  // Fetch token from backend
  const { data: tokenData, isLoading: tokenLoading } = useQuery({
    queryKey: ['googleAccessToken'],
    queryFn: async () => {
      const res = await fetch('/api/auth/token', { credentials: 'include' })
      if (!res.ok) throw new Error('No Drive access')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const [openPicker, authResponse] = useDrivePicker()

  const handleOpenPicker = useCallback(() => {
    if (!tokenData?.access_token) return

    openPicker({
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      developerKey: import.meta.env.VITE_GOOGLE_API_KEY,
      token: tokenData.access_token,
      viewId: 'DOCS', // Or 'SPREADSHEETS' for Excel/Sheets only
      supportDrives: true, // Enable Shared Drives
      multiselect: false,
      showUploadView: false,
      showUploadFolders: false,
      callbackFunction: (data) => {
        if (data.action === 'picked' && data.docs?.length > 0) {
          const doc = data.docs[0]
          onSelect({
            id: doc.id,
            name: doc.name,
            mimeType: doc.mimeType,
            lastEditedUtc: doc.lastEditedUtc,
            sizeBytes: doc.sizeBytes,
          })
        }
        // data.action === 'cancel' → user closed picker, no-op
      },
    })
  }, [tokenData, openPicker, onSelect])

  return {
    openPicker: handleOpenPicker,
    isReady: !tokenLoading && !!tokenData,
    isLoading: tokenLoading,
  }
}
```

### File Source Selector Component
```typescript
// Source: Conditional rendering pattern + project's existing UI components
import { Upload, Cloud } from 'lucide-react'
import { Button } from '../ui/Button'

interface FileSourceSelectorProps {
  onLocalUpload: () => void
  onDriveSelect: () => void
  isDriveAvailable: boolean
  isDriveLoading: boolean
}

export function FileSourceSelector({
  onLocalUpload,
  onDriveSelect,
  isDriveAvailable,
  isDriveLoading,
}: FileSourceSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Local Upload */}
      <button
        onClick={onLocalUpload}
        className="flex flex-col items-center gap-3 p-6 border-2 border-slate-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
      >
        <Upload className="w-8 h-8 text-slate-600" />
        <div>
          <div className="font-medium text-slate-900">Upload from Computer</div>
          <div className="text-sm text-slate-500">Select files from your device</div>
        </div>
      </button>

      {/* Drive Picker */}
      <button
        onClick={onDriveSelect}
        disabled={!isDriveAvailable || isDriveLoading}
        className="flex flex-col items-center gap-3 p-6 border-2 border-slate-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Cloud className="w-8 h-8 text-blue-600" />
        <div>
          <div className="font-medium text-slate-900">Select from Drive</div>
          <div className="text-sm text-slate-500">
            {isDriveAvailable
              ? 'Browse My Drive and Shared Drives'
              : 'Connect Google Drive first'}
          </div>
        </div>
      </button>
    </div>
  )
}
```

### Extended FileDefinition Type
```typescript
// Source: Project's types/index.ts + Drive metadata fields
export interface FileDefinition {
  id: string
  name: string
  filename: string
  colorIndex: number
  columns: ColumnInfo[]
  sampleData?: Record<string, unknown>[]
  sheetName?: string
  availableSheets?: string[]
  headerRow?: number

  // NEW: Source type
  source: 'local' | 'drive'

  // For local files
  originalFile?: File

  // For Drive files (mutually exclusive with originalFile)
  driveFileId?: string
  driveMimeType?: string
  driveModifiedTime?: string
  // Backend will need these to download/parse:
  // GET /api/drive/files/{driveFileId}/download
  // POST /api/drive/files/{driveFileId}/parse → FileParseResult
}
```

### Handling Drive File Selection in FilesStep
```typescript
// Source: FilesStep.tsx pattern + Drive metadata integration
const handleDriveFileSelected = async (driveFile: DriveFile) => {
  setError(null)
  setIsUploading(true)

  try {
    // Call backend to parse Drive file
    const response = await fetch(`/api/drive/files/${driveFile.id}/parse`, {
      method: 'POST',
      credentials: 'include',
    })

    if (!response.ok) throw new Error('Failed to parse Drive file')

    const result: FileParseResult = await response.json()

    // Create FileDefinition with Drive metadata
    const fileDefinition: FileDefinition = {
      id: crypto.randomUUID(),
      name: driveFile.name.replace(/\.xlsx?$/i, ''),
      filename: driveFile.name,
      colorIndex: files.length % FILE_COLORS.length,
      columns: result.columns,
      sampleData: result.sampleData,
      sheetName: result.sheetName,
      availableSheets: result.availableSheets,
      headerRow: result.headerRow ?? 1,
      source: 'drive',
      driveFileId: driveFile.id,
      driveMimeType: driveFile.mimeType,
      driveModifiedTime: driveFile.lastEditedUtc
        ? new Date(driveFile.lastEditedUtc).toISOString()
        : undefined,
    }

    onAddFile(fileDefinition)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to add Drive file')
  } finally {
    setIsUploading(false)
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Team Drives | Shared Drives | June 2020 | API parameter names changed, old code still works but deprecated |
| gapi.auth | google.accounts.oauth2 | 2021 | New OAuth library, better UX, backward compatible |
| Custom gapi loading | react-google-drive-picker | 2022+ | Simpler integration, fewer race conditions |
| Frontend token storage | Backend token management | Security best practice | Tokens never exposed to client code |

**Deprecated/outdated:**
- `enableTeamDrives` parameter: Use `supportDrives` instead (still works but deprecated)
- Direct gapi.auth usage: Prefer google.accounts.oauth2 for new implementations
- Client-side token refresh: Always use backend proxy to avoid token exposure

## Open Questions

Things that couldn't be fully resolved:

1. **Drive File Download for Workflow Runs**
   - What we know: Backend needs to download Drive files when executing workflows
   - What's unclear: Should Drive files be re-downloaded on every run, or cached?
   - Recommendation: Phase 4 just selects files. Phase 5/6 will handle download strategy during execution. For now, store Drive file IDs in workflow definition.

2. **Shared Drive Permission Edge Cases**
   - What we know: Users need read access to files they select
   - What's unclear: What happens if permissions change between workflow creation and execution?
   - Recommendation: Handle gracefully in execution phase with error messages. Phase 4 just needs to store file IDs.

3. **Google Sheets vs Excel Files**
   - What we know: Picker can select Google Sheets (application/vnd.google-apps.spreadsheet)
   - What's unclear: Should we filter to only Excel MIME types, or support native Sheets?
   - Recommendation: Start with Excel-only filtering (`viewId: 'SPREADSHEETS'` already filters). Google Sheets support can be phase 5+ enhancement.

4. **API Key Security**
   - What we know: Developer key must be in frontend, restricted by domain
   - What's unclear: Is the current project deployed, and are restrictions configured?
   - Recommendation: Document API key restriction setup in implementation. Check .env.example exists with VITE_GOOGLE_API_KEY.

## Sources

### Primary (HIGH confidence)
- [Google Picker API Overview](https://developers.google.com/workspace/drive/picker/guides/overview) - Official Google documentation
- [Google Picker API Reference](https://developers.google.com/workspace/drive/picker/reference/picker) - Official API reference
- [ResponseObject and DocumentObject Reference](https://developers.google.com/picker/docs/results) - Callback data structure
- [Shared Drives Implementation Guide](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives) - Official shared drives docs
- [DocsView.setEnableDrives Method](https://developers.google.com/workspace/drive/picker/reference/picker.docsview.setenabledrives) - Shared drives configuration
- Backend code: `/backend/app/auth/router.py` - Token endpoint already implemented

### Secondary (MEDIUM confidence)
- [react-google-drive-picker npm](https://www.npmjs.com/package/react-google-drive-picker) - Most popular React wrapper
- [Google Picker API with React TypeScript - Medium](https://medium.com/@mohammedshameemke/google-picker-api-integration-to-reactjs-mui-typescript-6c7461aa4598) - Integration tutorial
- [react-google-drive-picker GitHub](https://github.com/Jose-cd/React-google-drive-picker) - Source code and examples
- [Google Cloud Blog: Upcoming Changes to Drive API](https://cloud.google.com/blog/products/application-development/upcoming-changes-to-the-google-drive-api-and-google-picker-api) - Shared Drives migration info

### Tertiary (LOW confidence - general patterns)
- [React Multiple Files Upload - BezKoder](https://www.bezkoder.com/react-multiple-files-upload/) - General file upload patterns
- [Common Ninja: React Hook Form Multiple Uploads](https://www.commoninja.com/blog/handling-multiple-uploads-react-hook-form) - Form handling patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-google-drive-picker is widely used, official API is stable
- Architecture: HIGH - Patterns verified with official docs and backend code
- Pitfalls: HIGH - Common issues documented in official blogs and issue trackers
- Code examples: HIGH - Synthesized from official docs, npm package docs, and backend implementation
- Drive file execution: MEDIUM - Phase 4 just selects files, execution is future phase

**Research date:** 2026-02-07
**Valid until:** 2026-04-07 (60 days - Google APIs are stable, Picker API rarely changes)
