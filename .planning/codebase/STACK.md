# Technology Stack

**Analysis Date:** 2026-02-07

## Languages

**Primary:**
- TypeScript 5.6.2 - Frontend (React) with strict mode enabled
- Python 3.11 - Backend (FastAPI) for API and business logic
- JavaScript (ECMAScript 2020) - Vite build output

**Secondary:**
- HTML5 - Frontend templates via Vite
- CSS3 - Tailwind CSS utilities

## Runtime

**Environment:**
- Node.js 20+ (frontend development and build)
- Python 3.11+ (backend)
- Docker containers (production deployment via railway.json)

**Package Manager:**
- Frontend: npm (with bun.lock file present, but npm is primary - package-lock.json)
- Backend: pip

## Frameworks

**Core:**
- React 18.3.1 - UI framework (`frontend/src`)
- FastAPI 0.109.0+ - Web framework (`backend/app`)
- Vite 6.0.5 - Frontend build tool and dev server

**Frontend Libraries:**
- react-router-dom 6.22.0 - Client-side routing
- @tanstack/react-query 5.17.19 - Server state management
- framer-motion 12.31.0 - Animations
- @dnd-kit/* (core, sortable, utilities) - Drag and drop for workflow editor
- lucide-react 0.312.0 - Icon library
- clsx 2.1.0 - className utilities
- tailwind-merge 2.2.1 - Tailwind class merging

**Styling:**
- Tailwind CSS 3.4.1 - Utility-first CSS framework (`frontend/tailwind.config.js`)
- PostCSS 8.4.35 - CSS processing pipeline
- Autoprefixer 10.4.17 - Browser vendor prefixing

**Backend Libraries:**
- uvicorn[standard] 0.27.0+ - ASGI server
- sqlalchemy 2.0.25+ - ORM with async support
- aiosqlite 0.19.0 - Async SQLite driver
- pydantic 2.5.3+ - Data validation and schemas
- authlib 1.3.0 - OAuth 2.0 client (Google OAuth)
- python-multipart 0.0.6 - File upload handling
- openpyxl 3.1.2 - Excel file reading/writing
- pandas 2.1.4 - Data manipulation for Excel processing
- reportlab 4.0.8 - PDF generation
- python-dotenv 1.0.0 - Environment variable loading
- itsdangerous 2.1.0 - Signed session tokens
- watchdog 3.0.0 - File system watching (optional)
- greenlet 3.0.0 - Async support for SQLAlchemy

## Testing & Development

**Linting:**
- ESLint 9.17.0 - JavaScript/TypeScript linting
- @eslint/js 9.17.0 - ESLint core library
- typescript-eslint 8.18.2 - TypeScript support for ESLint
- eslint-plugin-react-hooks 5.0.0 - React hooks rules
- eslint-plugin-react-refresh 0.4.16 - React Fast Refresh support

**Build:**
- @vitejs/plugin-react 4.3.4 - React integration for Vite
- TypeScript 5.6.2 - Type checking for frontend
- globals 15.14.0 - ESLint global variables

**Note:** No test framework detected (Jest/Vitest not in dependencies)

## Key Dependencies

**Critical:**
- FastAPI - Powers all API endpoints and serves built SPA
- React - User interface for workflow editor and execution
- SQLAlchemy - Data persistence and multi-user support
- authlib - Google OAuth authentication integration

**Infrastructure:**
- SQLite (aiosqlite) - Local database storage (`backend/app/db/database.py`)
- openpyxl - Excel file I/O for workflow processing
- pandas - Data transformation for Excel operations
- reportlab - PDF export functionality
- Starlette SessionMiddleware - Secure session management for OAuth flow

## Configuration

**Environment:**
- `.env` files supported (python-dotenv)
- Environment variables read at request time (not import time) - see `backend/app/auth/router.py` lines 22-29
- Key env vars:
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth credentials
  - `SESSION_SECRET_KEY` - Session encryption (read at startup)
  - `OAUTH_REDIRECT_BASE` - OAuth redirect URL override
  - `RAILWAY_PUBLIC_DOMAIN` - Auto-detected from Railway deployment
  - `SHEET_WORKFLOW_DATA_DIR` - SQLite and upload directory (default: `data/`)
  - `FRONTEND_URL` - Frontend URL for post-login redirect
  - `PORT` - Server port (default 8000, Railway injects 8080)
  - `CORS_ORIGIN` - Manual CORS origin configuration

**Frontend Config:**
- `frontend/tsconfig.json` - Strict TypeScript settings, path alias `@/*`
- `frontend/vite.config.ts` - Port 5173, proxies `/api` to backend on 8000
- `frontend/tailwind.config.js` - Custom primary color scheme
- `frontend/postcss.config.js` - PostCSS pipeline

**Backend Config:**
- Python async engine with SQLite
- CORS middleware auto-configured for localhost and Railway domains
- Session middleware with httponly cookies, lax same-site policy
- Static file serving from `backend/app/static/` (built React output)

## Platform Requirements

**Development:**
- Node.js 20+ (frontend)
- Python 3.10+ (backend)
- Bun or npm for package management (bun optional, npm used)
- Unix-like shell for development scripts

**Production:**
- Docker container (includes Python 3.11 slim + Node.js build stage)
- Railway.app deployment (auto-detected and configured)
- Port 8080 (Railway standard) or configurable via `PORT` env var
- Persistent volume for SQLite database and file uploads (optional, uses container filesystem by default)

## Build Process

**Frontend:**
1. TypeScript compilation (`tsc -b`)
2. Vite build to `frontend/dist/`
3. Output copied to `backend/app/static/` by Docker

**Backend:**
- Python dependencies installed via pip
- No build step; FastAPI serves pre-built static files and API

**Docker (Production):**
- Multi-stage build: Node.js 20 → Python 3.11 slim
- Frontend built first, output embedded in backend
- Single container serves both API and SPA

---

*Stack analysis: 2026-02-07*
