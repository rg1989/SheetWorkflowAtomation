# Codebase Structure

**Analysis Date:** 2026-02-07

## Directory Layout

```
SheetWorkflowAtomation/
├── backend/                      # FastAPI backend
│   └── app/
│       ├── api/                  # API route handlers (CRUD)
│       │   ├── workflows.py       # Workflow CRUD, execution, download
│       │   ├── runs.py            # Run history and results
│       │   └── files.py           # File upload and parsing
│       ├── auth/                  # OAuth2 authentication
│       │   ├── config.py          # OAuth config, secrets
│       │   ├── deps.py            # Authentication dependencies
│       │   └── router.py          # Auth endpoints (/login, /logout, /me)
│       ├── core/                  # Core business logic
│       │   ├── engine.py          # WorkflowEngine: join, compute output columns
│       │   ├── parser.py          # ExcelParser: parse Excel → DataFrame
│       │   ├── exporter.py        # Export DataFrame → Excel (not yet fully integrated)
│       │   └── differ.py          # Diff computation (not yet integrated)
│       ├── db/                    # Database layer
│       │   ├── database.py        # SQLAlchemy setup, async connection
│       │   └── models.py          # ORM models: UserDB, WorkflowDB, RunDB, AuditLogDB
│       ├── models/                # Pydantic schemas
│       │   ├── workflow.py        # Workflow, WorkflowCreate, WorkflowUpdate
│       │   ├── run.py             # Run, RunStatus schemas
│       │   └── diff.py            # Diff-related schemas (not used)
│       └── main.py                # FastAPI app, middleware, lifespan, static serving
├── frontend/                      # React + Vite frontend
│   ├── src/
│   │   ├── components/            # Reusable UI components
│   │   │   ├── DiffPreview/       # Result diff display (CellDiff, RowDiff, etc.)
│   │   │   ├── FileUpload/        # File upload zone component
│   │   │   ├── WorkflowCard.tsx   # Workflow list card
│   │   │   ├── WorkflowWizard/    # Multi-step form for creating/editing workflows
│   │   │   │   ├── steps/         # Individual wizard steps (Files, KeyColumn, OutputColumns, Preview)
│   │   │   │   └── *.tsx          # Supporting components (FileCard, OutputColumnCard, etc.)
│   │   │   └── ui/                # Primitive UI components (Button, Card, Input, Badge, etc.)
│   │   ├── context/               # React Context for shared state
│   │   │   └── AuthContext.tsx    # Authentication state (user, loading, login/logout)
│   │   ├── lib/                   # Utilities and API client
│   │   │   ├── api.ts             # API client (workflows, runs, files, auth)
│   │   │   ├── colors.ts          # Color palette for file cards
│   │   │   └── utils.ts           # Helpers (generateId, etc.)
│   │   ├── pages/                 # Route pages (one per major route)
│   │   │   ├── LoginPage.tsx      # OAuth login entry point
│   │   │   ├── WorkflowsPage.tsx  # Workflow list + create button
│   │   │   ├── WorkflowEditorPage.tsx # Create/edit workflow (wraps WorkflowWizard)
│   │   │   ├── RunWorkflowPage.tsx # Execute workflow with new files
│   │   │   └── HistoryPage.tsx    # Run history and downloads
│   │   ├── types/
│   │   │   └── index.ts           # All TypeScript interfaces/types
│   │   ├── App.tsx                # Root router, AuthGuard, routes
│   │   ├── main.tsx               # React entrypoint, React Query provider
│   │   └── index.css              # Global styles (Tailwind)
│   ├── public/                    # Static assets (favicon, etc.)
│   ├── vite.config.ts             # Vite build config
│   └── tsconfig.json              # TypeScript config
├── data/                          # Runtime data directory
│   ├── uploads/                   # Uploaded Excel files (by workflow/user)
│   ├── outputs/                   # Generated output Excel files
│   └── workflow.db                # SQLite database
├── demo/                          # Demo files and workflows
├── .github/workflows/             # CI/CD pipelines
├── .planning/codebase/            # This documentation
├── Dockerfile                     # Docker image for deployment
├── Makefile                       # Development and build commands
├── README.md                      # Project overview
└── blueprint.md                   # Original design document
```

## Directory Purposes

**`backend/app/`:**
- Purpose: All server-side Python code
- Contains: API routes, business logic, database models, authentication
- Key files: `main.py` (app entry), `core/engine.py` (workflow execution)

**`backend/app/api/`:**
- Purpose: HTTP request handlers organized by resource
- Contains: Route definitions, request validation, response mapping
- Key files:
  - `workflows.py`: List, create, update, delete, run workflows
  - `runs.py`: Fetch run history and results
  - `files.py`: Upload, parse, and infer schema from Excel files

**`backend/app/core/`:**
- Purpose: Domain logic independent of HTTP layer
- Contains: Workflow execution, file parsing, data transformation
- Key files:
  - `engine.py`: WorkflowEngine class—join strategies, column computation
  - `parser.py`: ExcelParser class—read Excel, infer types, handle sheets

**`backend/app/db/`:**
- Purpose: Data persistence layer
- Contains: SQLAlchemy ORM models, async connection management
- Key files:
  - `database.py`: Engine creation, session factory, table initialization
  - `models.py`: ORM models (UserDB, WorkflowDB, RunDB, AuditLogDB)

**`backend/app/auth/`:**
- Purpose: OAuth2 authentication (Google)
- Contains: OAuth configuration, login/logout flow, protected route dependency
- Key files:
  - `config.py`: OAuth client ID, secret, redirect URI
  - `router.py`: `/login`, `/logout`, `/me` endpoints

**`backend/app/models/`:**
- Purpose: Pydantic request/response schemas
- Contains: Type definitions for workflows, runs, files
- Key files:
  - `workflow.py`: Workflow, WorkflowCreate, OutputColumn, ColumnSource (discriminated union)
  - `run.py`: Run, RunStatus, RunResult schemas

**`frontend/src/pages/`:**
- Purpose: Top-level pages mapped to routes
- Contains: Page-level components that compose smaller components
- Key files:
  - `WorkflowEditorPage.tsx`: Create/edit workflow (uses WorkflowWizard)
  - `RunWorkflowPage.tsx`: Execute workflow with files (uses FileUpload, shows results)
  - `WorkflowsPage.tsx`: List workflows, create button
  - `HistoryPage.tsx`: View past runs, download outputs
  - `LoginPage.tsx`: OAuth login button

**`frontend/src/components/WorkflowWizard/`:**
- Purpose: Multi-step form for workflow creation/editing
- Contains: Main wizard controller + individual step components
- Key files:
  - `WorkflowWizard.tsx`: Step manager, navigation, save logic
  - `steps/FilesStep.tsx`: File upload interface
  - `steps/KeyColumnStep.tsx`: Select matching columns
  - `steps/OutputColumnsStep.tsx`: Define output columns
  - `steps/PreviewStep.tsx`: Show preview, summary, save button

**`frontend/src/components/ui/`:**
- Purpose: Reusable primitive components
- Contains: Button, Card, Input, Badge, Select, Spinner, Layout wrapper
- Pattern: Headless UI library (Radix) wrapped with Tailwind styling

**`frontend/src/context/`:**
- Purpose: React Context for shared state
- Contains: AuthContext—user loading, login/logout functions
- Usage: Wrapped around root App, provides useAuth() hook

**`frontend/src/lib/`:**
- Purpose: Utilities and API client
- Contains:
  - `api.ts`: Fetch wrapper, all API endpoints (workflowApi, runApi, filesApi, authApi)
  - `colors.ts`: Color palette for file cards (0-4 color indexes)
  - `utils.ts`: Helper functions (generateId)

**`frontend/src/types/`:**
- Purpose: Single source of truth for all TypeScript types
- Contains: Interfaces for Workflow, Run, FileDefinition, ColumnSource, etc.
- Import: All pages and components import from this single file

**`data/`:**
- Purpose: Runtime directory for files and database
- Contains:
  - `uploads/`: Uploaded Excel files (organized by user/workflow)
  - `outputs/`: Generated output Excel files
  - `workflow.db`: SQLite database file
- Cleanup: Manual (not automated)

## Key File Locations

**Entry Points:**

- `backend/app/main.py`: FastAPI application root, middleware setup, routes registration
- `frontend/src/main.tsx`: React app initialization, React Query setup
- `frontend/src/App.tsx`: Root router, authentication guard, route definitions
- `backend/app/api/workflows.py`: Primary API entry for workflow operations

**Configuration:**

- `backend/app/auth/config.py`: OAuth credentials (env vars)
- `frontend/vite.config.ts`: Vite dev server, build settings
- `frontend/tsconfig.json`: TypeScript compiler options
- `.env` (not in repo): Environment variables (GOOGLE_CLIENT_ID, SESSION_SECRET_KEY, etc.)

**Core Logic:**

- `backend/app/core/engine.py`: Workflow execution—join logic, column computation (590 lines)
- `backend/app/core/parser.py`: Excel parsing and schema inference
- `backend/app/models/workflow.py`: Workflow schema with discriminated union for column sources

**Database:**

- `backend/app/db/models.py`: ORM models (UserDB, WorkflowDB, RunDB)
- `backend/app/db/database.py`: SQLAlchemy async setup, create_tables migration

**Testing:**

- Not present in current codebase
- No test files found

## Naming Conventions

**Files:**

- Python: `snake_case.py` (e.g., `workflow.py`, `engine.py`, `database.py`)
- TypeScript: `camelCase.tsx` for components, `camelCase.ts` for utilities
- Directories: `lowercase` or `camelCase` depending on context

**Directories:**

- Feature-based: `api/`, `auth/`, `core/` group by functionality
- Component-based: `components/DiffPreview/`, `components/WorkflowWizard/` group UI elements
- Component subdirectories: `steps/` for related components (wizard steps)

**Functions:**

- Python: `snake_case` for functions, `PascalCase` for classes
- TypeScript: `camelCase` for functions, `PascalCase` for components and classes
- Hooks: `useAuth()`, `useQuery()` prefix for custom hooks and React hooks

**Variables:**

- Python: `snake_case` for variables and parameters
- TypeScript: `camelCase` for variables and parameters; `UPPER_CASE` for constants
- State: `[state, setState]` pattern in React (e.g., `[files, setFiles]`)

**Types:**

- TypeScript: `PascalCase` (e.g., `Workflow`, `FileDefinition`, `ColumnSource`)
- Pydantic: `PascalCase` for classes (e.g., `WorkflowCreate`, `OutputColumn`)

## Where to Add New Code

**New Feature (e.g., new workflow operation):**
- Primary code: `backend/app/core/` (logic class) + `backend/app/api/workflows.py` (endpoint)
- Frontend: `frontend/src/components/WorkflowWizard/steps/` (new step) or `frontend/src/pages/` (new page)
- Tests: `backend/tests/test_[feature].py` (create if not exists)

**New Component/Module:**
- Implementation: `frontend/src/components/[FeatureName]/[Component].tsx`
- Barrel export: `frontend/src/components/[FeatureName]/index.ts` (re-export from index)
- Import: Use barrel export from parent directory

**Utilities:**
- Shared helpers: `frontend/src/lib/utils.ts` (or new file in `lib/`)
- Backend utilities: `backend/app/core/` (if domain-specific) or new module in `backend/app/`

**API Endpoints:**
- RESTful pattern: `backend/app/api/[resource].py`
- Endpoint pattern: `@router.get("/{id}")`, `@router.post("")`, `@router.put("/{id}")`
- Dependency injection: Use `Depends(get_current_user)` for protected routes

**Database Schema:**
- Add ORM model: `backend/app/db/models.py`
- Migration: Update `create_tables()` in `backend/app/db/database.py`
- Foreign keys: Follow pattern in existing models (e.g., RunDB.workflow_id)

**Authentication-Protected Routes:**
- Add dependency: `current_user: UserDB = Depends(get_current_user)`
- Check ownership: Compare `current_user.id` against resource's `user_id`
- Example: `backend/app/api/workflows.py` line 121

## Special Directories

**`backend/`:**
- Purpose: Python package root for backend
- Generated: No (source)
- Committed: Yes
- Dependencies: Listed in `requirements.txt` or setup.py (not shown)

**`frontend/`:**
- Purpose: Node.js package root for frontend
- Generated: `node_modules/` (not committed)
- Committed: `package.json`, `package-lock.json` only
- Build output: `dist/` (not committed, generated by `npm run build`)

**`data/`:**
- Purpose: Runtime data storage
- Generated: Yes (created at startup if missing)
- Committed: No (in `.gitignore`)
- Contents: User-uploaded files, outputs, SQLite database

**`.github/workflows/`:**
- Purpose: CI/CD pipeline definitions
- Generated: No
- Committed: Yes
- Trigger: Push, pull request, manual

**`.planning/codebase/`:**
- Purpose: Architecture and planning documentation
- Generated: Yes (by GSD tools)
- Committed: Yes
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, etc.

---

*Structure analysis: 2026-02-07*
