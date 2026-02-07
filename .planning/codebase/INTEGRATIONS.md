# External Integrations

**Analysis Date:** 2026-02-07

## APIs & External Services

**Google OAuth 2.0:**
- Service: Google OAuth for user authentication
  - SDK/Client: `authlib` (OpenID Connect integration)
  - Auth: Environment variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - Implementation: `backend/app/auth/router.py` (lines 32-46, 49-103)
  - Flow: User redirected to Google consent screen → callback handler exchanges code for token → user stored in database

**Error Logging:**
- Service: None (built-in uvicorn logging via logger)
  - Approach: Python `logging` module configured for "uvicorn.error" channel
  - Visible in Railway deploy logs via startup diagnostics in `backend/app/main.py` (lines 59-72)

## Data Storage

**Primary Database:**
- SQLite with async support
  - Provider: SQLite (local file-based)
  - Connection: `sqlite+aiosqlite:///` (path from `SHEET_WORKFLOW_DATA_DIR` or `data/workflow.db`)
  - Location: `backend/app/db/database.py` (lines 11-21)
  - Client: SQLAlchemy 2.0 with async session factory
  - Models: `backend/app/db/models.py`
    - `UserDB` - Google OAuth user accounts (id = Google 'sub')
    - `WorkflowDB` - Workflow definitions with full config JSON
    - `RunDB` - Execution history with input/output file references
    - `AuditLogDB` - Audit trail for compliance

**File Storage:**
- Local filesystem only
  - Upload directory: `{SHEET_WORKFLOW_DATA_DIR}/uploads/`
  - Output directory: `{SHEET_WORKFLOW_DATA_DIR}/outputs/`
  - Created on startup: `backend/app/main.py` (lines 53-55)
  - Excel files stored as uploaded (openpyxl reads directly)
  - PDF exports generated on-demand via reportlab

**Caching:**
- Frontend: React Query (@tanstack/react-query) for server state
  - Automatic refetch and stale-while-revalidate
  - No persistent cache (memory only during session)
- Backend: None (stateless API, all data in SQLite)

## Authentication & Identity

**Auth Provider:**
- Google OAuth 2.0 (OpenID Connect)
  - Implementation: authlib + Starlette SessionMiddleware
  - Session storage: HTTP-only cookies (browser)
  - Session secret: `SESSION_SECRET_KEY` env var (read at startup in `backend/app/auth/config.py`)
  - Token handling: `backend/app/auth/router.py`
    - `/auth/login` - Redirect to Google consent screen
    - `/auth/callback` - Exchange code for ID token, create/update UserDB, set session
    - `/auth/me` - Return current user from session
    - `/auth/logout` - Clear session cookie

**Session Management:**
- Starlette SessionMiddleware with signed cookies
  - `https_only=True` in production (detected via `RAILWAY_ENVIRONMENT_NAME`, `RAILWAY_PUBLIC_DOMAIN`, or `CORS_ORIGIN`)
  - `same_site="lax"` for OAuth redirect compatibility
  - User ID stored in `request.session["user_id"]` (Google 'sub')

**User Isolation:**
- All resources (workflows, runs) linked to `user_id` from session
- Database queries filtered by current user: `backend/app/api/workflows.py`, `backend/app/api/runs.py`

## Monitoring & Observability

**Error Tracking:**
- Service: None (no Sentry/Datadog integration)
- Approach: Python logging to stdout (captured by Railway/Docker logs)

**Logs:**
- Uvicorn error logs via Python `logging` module
- Startup diagnostics logged on app lifespan (FastAPI lifespan context manager):
  ```
  [logs include]
  - STATIC_DIR status (built frontend ready)
  - DATA_DIR path (SQLite location)
  - Production mode detection
  - PORT configuration
  - OAuth readiness
  - Asset file existence
  ```
- No structured logging (plain text format)

## CI/CD & Deployment

**Hosting:**
- Railway.app (primary - auto-detects Dockerfile)
- Docker-compatible platforms: Render, Fly.io, any Docker host

**CI Pipeline:**
- GitHub Actions workflow: `.github/` (reference present but contents not examined)
- Railway auto-deploys from git push (configured in railway.json)

**Deployment Config:**
- `Dockerfile` - Multi-stage build (Node.js → Python 3.11 slim)
- `railway.json` - Railway-specific settings:
  - Health check endpoint: `/api/health`
  - Health check timeout: 120 seconds
  - Restart policy: ON_FAILURE with max 5 retries
- Port binding: Dynamic port via `PORT` env var (Railway: 8080, local: 8000)
- Reverse proxy headers: Forwarded-allow-ips enabled for Railway's proxy

## Environment Configuration

**Required env vars:**
- `GOOGLE_CLIENT_ID` - OAuth client ID from Google Console
- `GOOGLE_CLIENT_SECRET` - OAuth client secret (must be secret)
- `SESSION_SECRET_KEY` - Session cookie signing key (defaults to "dev-secret-change-in-production")

**Optional env vars:**
- `OAUTH_REDIRECT_BASE` - Custom OAuth redirect base (auto-detected from `RAILWAY_PUBLIC_DOMAIN` if not set)
- `FRONTEND_URL` - Post-login redirect URL (auto-detects dev mode on port 5173)
- `SHEET_WORKFLOW_DATA_DIR` - Database and uploads directory (default: `data/` relative to repo root)
- `CORS_ORIGIN` - Manual CORS origin (auto-detected from Railway domain if not set)
- `PORT` - Server port (default: 8000, Railway injects: 8080)
- `RAILWAY_ENVIRONMENT_NAME` - Production detection (set by Railway)
- `RAILWAY_PUBLIC_DOMAIN` - Public domain (set by Railway, used for auto-config)

**Secrets location:**
- Environment variables (Railway: Project Variables, Docker: .env file or run -e)
- `.env` file present at `backend/.env` but NOT committed (in .gitignore)
- Session secret passed via environment (secure in Railway, default in dev)

**Development vs Production:**
- Dev: HTTP cookies, CORS allows localhost:5173 and localhost:8000
- Production: HTTPS cookies (https_only=True), CORS allows Railway public domain

## Webhooks & Callbacks

**Incoming:**
- `/api/auth/callback` - Google OAuth callback handler
  - Query params: `code` (authorization code), `state` (CSRF token managed by authlib)
  - Exchanges code for ID token, creates/updates user, sets session

**Outgoing:**
- None (no webhooks to external services)
- PDF and Excel exports generated locally, not sent to external services

## Data Flow - OAuth Authentication

1. User clicks "Login" → redirected to `/api/auth/login`
2. Endpoint calls `oauth.google.authorize_redirect()` with calculated redirect_uri
3. Browser redirected to Google consent screen
4. User authorizes → browser redirected to `/api/auth/callback?code=...&state=...`
5. Callback exchanges code via authlib for ID token
6. ID token decoded, `sub` (Google user ID) extracted
7. UserDB lookup/create with email, name, picture
8. `request.session["user_id"]` set to Google sub
9. Browser redirected to frontend (localhost:5173 or deployed domain)
10. Frontend calls `/api/auth/me`, gets current user, renders authenticated UI

## Data Flow - Workflow Execution

1. User uploads Excel files via `/api/files/parse-columns` (get column metadata)
2. Frontend displays columns for workflow configuration
3. User configures workflow via `/api/workflows` POST/PUT
4. User runs workflow with files via `/api/runs/preview` (FormData with files + config)
5. Backend parses files using openpyxl + pandas, executes workflow rules
6. Run stored in database with status='preview', preview diff generated
7. User approves via `/api/runs/{id}/execute` POST
8. Backend applies changes to Excel, generates output files
9. User downloads via `/api/runs/{id}/download/{type}` (Excel or PDF)
10. Files served from `{OUTPUTS_DIR}/` via FileResponse

---

*Integration audit: 2026-02-07*
