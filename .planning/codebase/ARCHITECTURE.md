# Architecture

**Analysis Date:** 2026-02-07

## Pattern Overview

**Overall:** Distributed layered architecture with FastAPI backend and React frontend, communicating via REST API. Workflow-centric design where a workflow definition drives data transformation.

**Key Characteristics:**
- **Workflow-as-Configuration**: Workflows are persisted as JSON configs storing file definitions, join strategy, and output column specifications
- **Engine-based Processing**: Core logic (parsing, joining, computing) delegated to specialized engine classes
- **Stateless API**: Backend API routes are thin controllers that orchestrate domain logic
- **Client-side State Management**: React Query handles server state; Context API for authentication
- **File-based Data Flow**: Excel files uploaded, parsed into DataFrames, combined, and exported back to Excel

## Layers

**Presentation (Frontend):**
- Purpose: User interface for workflow creation, execution, and history viewing
- Location: `frontend/src/`
- Contains: React components, pages, routing logic
- Depends on: API client (`frontend/src/lib/api.ts`), authentication context
- Used by: Browser/user interactions

**API Controllers (Backend):**
- Purpose: HTTP request handling and request/response mapping
- Location: `backend/app/api/`
- Contains: Route handlers for workflows, runs, files
- Depends on: Database models, core engines, authentication
- Used by: Frontend via REST calls, FastAPI framework

**Domain/Core Logic (Backend):**
- Purpose: Workflow execution, Excel parsing, data joining, column computation
- Location: `backend/app/core/`
- Contains: WorkflowEngine (`engine.py`), ExcelParser (`parser.py`), utilities
- Depends on: pandas, openpyxl, Pydantic models
- Used by: API routes

**Data Models (Backend):**
- Purpose: Type definitions and schemas
- Location: `backend/app/models/` (Pydantic) and `backend/app/db/models.py` (ORM)
- Contains: Workflow, Run, File schemas; User, WorkflowDB, RunDB ORM models
- Depends on: Pydantic, SQLAlchemy
- Used by: All layers

**Database Layer (Backend):**
- Purpose: Data persistence for workflows, runs, users, audit logs
- Location: `backend/app/db/`
- Contains: SQLAlchemy ORM models, async connection management
- Depends on: SQLite (aiosqlite)
- Used by: API routes, audit logging

**Authentication (Backend):**
- Purpose: OAuth2 (Google) authentication and session management
- Location: `backend/app/auth/`
- Contains: Config, OAuth flow, dependency for protected routes
- Depends on: FastAPI session middleware
- Used by: API routes as dependency injection

**Frontend State Management:**
- Purpose: Client-side state for authentication and server data
- Location: `frontend/src/context/` (auth), `frontend/src/lib/` (API client)
- Contains: AuthContext, API client wrapper with React Query integration
- Depends on: React, React Query, browser fetch API
- Used by: Pages and components

## Data Flow

**Workflow Definition Flow:**

1. User navigates to "New Workflow" (`WorkflowEditorPage`)
2. `WorkflowWizard` component guides through 4 steps:
   - `FilesStep`: User uploads Excel files
   - Frontend calls `POST /api/files/parse` (not directly shown, but implied)
   - Backend `ExcelParser.parse()` reads file, infers schema
   - `KeyColumnStep`: User selects matching columns per file
   - `OutputColumnsStep`: User defines output columns (direct, concat, math, custom sources)
   - `PreviewStep`: User previews results
3. User saves workflow → `POST /api/workflows` (or `PUT /api/workflows/{id}`)
4. Backend stores workflow config as JSON in WorkflowDB
5. Workflow ID returned to frontend, user navigated to workflow list

**Workflow Execution Flow:**

1. User selects workflow from list → navigates to `RunWorkflowPage`
2. User uploads new Excel files for this workflow
3. Frontend calls `POST /api/runs/{workflowId}` with FormData (files + file configs)
4. Backend:
   - Creates RunDB record
   - Parses each file using `ExcelParser` → pandas DataFrames
   - Loads workflow config from database
   - Instantiates `WorkflowEngine` with config
   - Calls `engine.execute(dataframes)` → applies join logic and computes output columns
   - Exports result DataFrame to Excel
   - Updates RunDB with output path and result summary
   - Returns RunResult to frontend (preview data, row count, warnings)
5. Frontend displays results and download link
6. User can download Excel output file

**State Transitions in Execution:**

```
RunDB.status: "preview" → "completed" (or "failed")
```

Each run tracks files used, output location, result summary (row counts, warnings).

**State Management:**

- **Frontend Authentication**: `AuthContext` loads user on mount, maintains auth state
- **Frontend Workflows**: React Query caches workflow list, individual workflows
- **Frontend Wizard**: Local component state for multi-step form
- **Backend Workflows**: Persisted in WorkflowDB, config stored as JSON
- **Backend Runs**: Each execution creates RunDB record, persists results

## Key Abstractions

**WorkflowEngine:**
- Purpose: Execute workflow transformation on multiple DataFrames
- Examples: `backend/app/core/engine.py`
- Pattern: Strategy pattern for different join types (INNER, LEFT, RIGHT, FULL)
  - Determines base row set based on join type
  - Iterates through rows, computing each output column value
  - Supports lazy matching by key column (strips whitespace)
  - Returns result DataFrame + warnings list

**ExcelParser:**
- Purpose: Abstract file parsing and schema inference
- Examples: `backend/app/core/parser.py`
- Pattern: Wrapper around pandas/openpyxl
  - Handles multiple sheets
  - Infers column types (text, number, date, integer, boolean)
  - Cleans column names (strips whitespace)

**ColumnSource (discriminated union):**
- Purpose: Extensible column value computation
- Examples: `backend/app/models/workflow.py` lines 49-97
- Pattern: Discriminated union by "type" field
  - `direct`: copy from column in a file
  - `concat`: concatenate multiple parts with separator
  - `math`: arithmetic operations (add, subtract, multiply, divide)
  - `custom`: static default value

**WorkflowDB Config:**
- Purpose: Store complete workflow definition as JSON
- Pattern: Denormalization—entire config stored as single JSON blob
  - Avoids normalization complexity (file-output relationships)
  - Enables versioning: version field tracks schema changes
  - Querying by workflow properties requires parsing JSON (acceptable for small datasets)

## Entry Points

**FastAPI App Startup:**
- Location: `backend/app/main.py`
- Triggers: Uvicorn server startup
- Responsibilities:
  - Load environment config (.env)
  - Initialize async database engine and tables
  - Mount CORS middleware, session middleware
  - Register API routers (auth, workflows, runs, files)
  - Set up static file serving for built frontend
  - Health check endpoint for deployment monitoring

**React App Initialization:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser loads index.html
- Responsibilities:
  - Create React Query client (5-minute stale time, 1 retry)
  - Render root App component
  - Mount to #root DOM node

**React Router Entry:**
- Location: `frontend/src/App.tsx`
- Triggers: React tree initialization
- Responsibilities:
  - Wrap with AuthProvider (loads current user)
  - Define routes with AuthGuard
  - Redirect unauthenticated users to login
  - Serve protected routes (workflows, history)

## Error Handling

**Strategy:** Return warnings/errors inline with successful results; fail fast for authentication/database issues.

**Patterns:**

- **File Parsing**: Exceptions caught in `ExcelParser`, re-raised as `ValueError` with context
- **Workflow Execution**: Returns `(DataFrame, warnings_list)` tuple; warnings accumulate during processing
  - Missing key columns: warning added, processing continues with None for missing data
  - Unmatched keys: tracked per file, summarized in final warnings
  - Math errors (division by zero): warning logged, operation returns None
- **API Routes**: HTTPException raised with status code (400, 401, 404, 500)
- **Frontend**: Error boundaries not explicitly shown; React Query retry + manual error handling in components

**Example** from `engine.py`:
```python
if key_values is None:
    return pd.DataFrame(), warnings
# Continue with empty result rather than crash
```

## Cross-Cutting Concerns

**Logging:** Not extensively used; relies on print/FastAPI default logging to stdout (Railway compatible)

**Validation:** Pydantic models validate input at API boundary; workflow config validated implicitly during execution

**Authentication:**
- Google OAuth2 via Google button
- Session middleware stores authenticated user
- `get_current_user` dependency checks session, returns UserDB or raises 401
- Protected routes: all `/api/workflows`, `/api/runs` require authentication

**File Management:**
- Upload directory: `data/uploads/`
- Output directory: `data/outputs/`
- Cleanup: not automated (files persist on disk)

**Data Isolation:**
- Per-user workflows (user_id foreign key)
- Runs associated with workflows (workflow_id) and users
- AuditLogDB for tracking actions (not actively used in current code)

---

*Architecture analysis: 2026-02-07*
