# Coding Conventions

**Analysis Date:** 2026-02-07

## Naming Patterns

**Files:**
- **React components:** PascalCase (e.g., `Button.tsx`, `WorkflowCard.tsx`, `AuthContext.tsx`)
- **Page components:** PascalCase with "Page" suffix (e.g., `RunWorkflowPage.tsx`, `HistoryPage.tsx`, `WorkflowsPage.tsx`)
- **Hooks/utilities:** camelCase (e.g., `useAuth`, `formatDate`, `cn`)
- **Type definitions:** PascalCase (e.g., `ColumnInfo`, `FileDefinition`, `Workflow`)
- **API modules:** camelCase (e.g., `api.ts`, `utils.ts`, `colors.ts`)
- **Python modules:** snake_case (e.g., `engine.py`, `parser.py`, `exporter.py`, `database.py`)
- **Python classes:** PascalCase (e.g., `ExcelParser`, `WorkflowEngine`)

**Functions (TypeScript/React):**
- Components: PascalCase (e.g., `function WorkflowCard()`)
- Hooks: camelCase with "use" prefix (e.g., `useAuth()`, `useCallback`)
- Utilities: camelCase (e.g., `generateId()`, `formatDate()`, `validateFileColumns()`)
- Closures/callbacks: camelCase with "handle" or "on" prefix (e.g., `handleAddFile()`, `onDelete()`, `handleFileUpload()`)

**Functions (Python):**
- All functions: snake_case (e.g., `parse()`, `get_sheets()`, `infer_schema()`, `db_to_model()`)
- Private/internal: leading underscore (e.g., `_get_credentials()`, `_get_key_values_for_join_type()`)

**Variables:**
- **TypeScript:** camelCase throughout (e.g., `uploadedFiles`, `isProcessing`, `currentStep`, `selectedSheet`)
- **React state:** camelCase with "is"/"has" prefix for booleans (e.g., `isLoading`, `isDeleting`, `hasWarning`)
- **Python:** snake_case (e.g., `file_path`, `header_row`, `column_name`, `join_type`)

**Types/Interfaces:**
- **TypeScript interfaces:** PascalCase (e.g., `ButtonProps`, `WorkflowCardProps`, `UploadedFileState`)
- **TypeScript types:** PascalCase (e.g., `JoinType`, `WizardStep`, `RunStatus`)
- **Python Enums:** UPPER_CASE values (e.g., `INNER = "inner"`, `LEFT = "left"`)
- **Pydantic models:** PascalCase (e.g., `Workflow`, `FileDefinition`, `OutputColumn`, `JoinConfig`)

## Code Style

**Formatting:**
- **Tool:** No explicit formatter configured (but TypeScript uses standard conventions)
- **Indentation:** 2 spaces (TypeScript/React), 4 spaces (Python)
- **Line length:** ~100 characters (practical limit, not enforced)
- **Semicolons:** Present in TypeScript (modern ES modules)

**Linting:**
- **TypeScript:** ESLint v9.17.0 with `@eslint/js`, `typescript-eslint`, and `eslint-plugin-react-hooks`
  - No custom `.eslintrc` file (using package.json config or defaults)
  - Run: `npm lint`
- **Python:** No linting tool configured; follow PEP 8 conventions
- **React:** ESLint rules for React hooks compliance enabled

**Module Type:**
- **Frontend:** ES modules (`"type": "module"` in package.json)
- **Imports:** Use `import` syntax, not CommonJS `require()`

## Import Organization

**TypeScript/React Order:**
1. React/framework imports (e.g., `import React`, `import { useState }`)
2. External dependencies (e.g., `import { useNavigate }`, `import { Button }`)
3. Internal components (e.g., `import { Card }`)
4. Internal utilities and APIs (e.g., `import { workflowApi }`)
5. Types (e.g., `import type { FileDefinition }`)
6. CSS/styles (e.g., `import './index.css'`)

**Python Order:**
1. Standard library (e.g., `import os`, `from pathlib import Path`)
2. Third-party libraries (e.g., `import pandas`, `from fastapi import`)
3. Local app modules (e.g., `from app.db.database import`, `from app.models.workflow import`)

**Path Aliases:**
- **Frontend:** `@/*` maps to `src/*` in `tsconfig.json`
  - Example: `import { cn } from '@/lib/utils'` instead of `import { cn } from '../../lib/utils'`

## Error Handling

**Patterns:**

**TypeScript/React:**
- Try/catch blocks in async operations (e.g., `handleFileUpload()` in `RunWorkflowPage.tsx`)
- Error stored in component state: `const [error, setError] = useState<string | null>(null)`
- Errors caught silently in some contexts with default fallbacks
  - Example in `AuthContext.tsx`: `catch { setUser(null) }` - error not logged
  - Example in `api.ts`: `catch (() => ({ detail: 'Unknown error' }))` - graceful JSON parsing failure
- API errors extracted from response detail field: `error.detail || \`HTTP ${response.status}\``
- File validation errors returned as tuple: `{ valid: boolean; error?: string }`

**Python/FastAPI:**
- Errors raised as `ValueError` with descriptive messages (e.g., in `ExcelParser`)
- HTTPException raised in API endpoints with status codes and detail messages
- Try/except in core business logic (e.g., `WorkflowEngine`, `ExcelParser`)
- Warnings collected in lists and returned with results (non-fatal errors)

## Logging

**Framework:**
- **TypeScript:** No logging framework; no console logs found in codebase
- **Python:** `logging` module with logger named after module
  - `logger = logging.getLogger("uvicorn.error")` in `main.py`
  - `logger.info()`, `logger.error()` used for startup diagnostics and OAuth failures

**Patterns:**
- Python: Log critical startup info and errors (auth config, database init, path diagnostics)
- No verbose logging in hot paths
- Errors in auth flow logged with context (e.g., what OAuth credentials are missing)

## Comments

**When to Comment:**
- **Module docstrings:** Always present (e.g., `"""Workflow CRUD API endpoints..."""`, `"""Excel file parsing utilities."""`)
- **Class docstrings:** Present for complex classes (e.g., `WorkflowEngine.__init__()` documents args)
- **Function docstrings:** Present for public APIs and complex logic
  - Example: `fileApi.parseColumns()` documents parameters and return type
  - Example: `workflowApi.run()` documents files parameter and fileConfigs structure
- **Inline comments:** Rare; used for non-obvious logic or configuration decisions
  - Example: `// Keep reference to original file for re-parsing with different sheet`
  - Example: `# Load .env before any config reads os.environ`

**JSDoc/TSDoc:**
- **TypeScript:** Minimal JSDoc usage; types documented via TypeScript interfaces
- **Python:** Docstrings follow standard format with Args/Returns sections
  - Example in `ExcelParser.parse()`: Documents parameters and return value
  - Example in `WorkflowEngine._get_key_values_for_join_type()`: Documents each parameter and return

## Function Design

**Size:**
- Small functions preferred (50-150 lines typical, max ~600 lines for complex UI components)
- Largest files: `RunWorkflowPage.tsx` (631 lines, single page component with form logic)
- `ColumnSourceEditor.tsx` (506 lines, UI component with nested state management)

**Parameters:**
- Destructuring used for props: `function WorkflowCard({ workflow, onDelete, isDeleting })`
- Options objects used for complex parameter lists (e.g., `fileApi.parseColumns(file, sheetName, headerRow)`)
- Callback parameters have clear prefixes: `onDelete`, `handleFileUpload`, `validateFileColumns`
- Python uses type hints: `def parse(self, file_path: str, sheet_name: Optional[str] = None, header_row: int = 0)`

**Return Values:**
- Single values or objects (no tuple unpacking except in Python utilities)
- Promise-based APIs return typed responses: `Promise<T>`
- Query hooks return destructured data: `const { data: workflow, isLoading, error }`
- Python returns typed objects: `pd.DataFrame`, `List[Dict[str, Any]]`, or `Workflow` (Pydantic)

## Module Design

**Exports:**
- **React:** Named exports for components: `export function WorkflowCard()`
- **Utilities:** Named exports: `export const cn = ...`, `export function generateId()`
- **Python:** Classes and functions all exported; no explicit `__all__`
- **API modules:** Object-based API export pattern
  - Example in `api.ts`: `export const authApi = { me, logout, loginUrl }`
  - Example in `api.ts`: `export const workflowApi = { list, get, create, update, delete, run, downloadUrl }`

**Barrel Files:**
- **Used:** Yes, for component exports and UI utilities
- **Location:** `src/components/ui/index.ts`, `src/components/WorkflowWizard/index.ts`
- **Pattern:** `export { ComponentName } from './ComponentName'`
- **Usage:** Imports simplify to `import { Button, Card } from '@/components/ui'`

**Database Models:**
- SQLAlchemy models with `__tablename__` defined
- No Alembic migrations configured; tables created at startup via `create_tables()`
- Config stored as JSON in database (workflow definitions stored in `WorkflowDB.config` JSON column)

**API Response Models:**
- Pydantic models define API schemas with camelCase field names (camelCase in JSON, snake_case in Python)
- Example: `OutputColumn` with fields `id`, `name`, `source`, `order` (matches frontend expectations)
- Database models use snake_case, API models use camelCase (FastAPI automatic conversion via Pydantic)

---

*Convention analysis: 2026-02-07*
