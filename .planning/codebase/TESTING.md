# Testing Patterns

**Analysis Date:** 2026-02-07

## Test Framework

**Status:** Not detected

- **Test runner:** No test framework configured (no Jest, Vitest, pytest, or Unittest)
- **Config file:** Not found (no `jest.config.*`, `vitest.config.*`, `pytest.ini`)
- **Test files:** No `*.test.*` or `*.spec.*` files found in codebase
- **Coverage tool:** Not configured
- **Run commands:** Not applicable (no test suite exists)

## Test File Organization

**Not applicable** – No test files exist in this codebase.

**Recommendation for structure if tests are added:**
- **Location:** Co-located with source (standard for modern projects)
  - Format: `src/components/__tests__/ComponentName.test.tsx`
  - Format: `src/lib/__tests__/utils.test.ts`
  - Format: `backend/tests/` directory for Python
- **Naming:** `*.test.ts(x)` or `*.spec.ts(x)`

## Test Structure

**Not applicable** – No existing test patterns to document.

**Patterns to establish when writing tests:**

**TypeScript/React (recommended structure):**
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('renders with primary variant by default', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-primary-600')
  })

  it('respects variant prop', () => {
    render(<Button variant="danger">Delete</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-red-600')
  })
})
```

**Python (recommended structure):**
```python
import pytest
from app.core.engine import WorkflowEngine
from app.models.workflow import Workflow

class TestWorkflowEngine:
    def setup_method(self):
        """Setup test fixtures."""
        self.engine = WorkflowEngine({...})

    def test_inner_join_returns_intersection_keys(self):
        """Test INNER join returns only matching keys."""
        # Arrange
        # Act
        # Assert
```

## Mocking

**Framework:** Not determined – not applicable until tests are written

**Recommendations when mocking:**

**TypeScript/React mocking approach:**
- Mock API calls using `vi.mock()` (Vitest) or `jest.mock()` (Jest)
- Mock `fetch` API using `fetch-mock` or similar
- Mock router using React Router's test utilities
- Mock context providers by wrapping components in test providers

**Example pattern to follow:**
```typescript
vi.mock('@/lib/api', () => ({
  workflowApi: {
    list: vi.fn(() => Promise.resolve([])),
    get: vi.fn(),
  }
}))
```

**Python mocking approach:**
- Use `unittest.mock` or `pytest-mock`
- Mock external dependencies (pandas operations, file I/O, database)
- Mock FastAPI dependencies using `Depends` override

**What to Mock:**
- External API calls (Google OAuth, etc.)
- Database operations (use in-memory database for tests)
- File I/O operations
- Date/time for deterministic tests

**What NOT to Mock:**
- Internal business logic (e.g., `WorkflowEngine` should run real logic)
- Pure utility functions (test directly, don't mock)
- Component rendering (test output, not implementation)

## Fixtures and Factories

**Not detected** – No fixtures or factories exist

**Recommendation structure when adding tests:**

**TypeScript/React:**
```typescript
// src/__tests__/fixtures.ts
export const mockWorkflow = {
  id: 'test-1',
  name: 'Test Workflow',
  files: [
    { id: 'file-1', name: 'Sales Data', columns: [...] }
  ]
}

export const mockFileDefinition = {
  id: 'file-1',
  name: 'Test File',
  filename: 'test.xlsx',
  colorIndex: 0,
  columns: [
    { name: 'Name', type: 'text', sampleValues: ['Alice'] }
  ]
}
```

**Python:**
```python
# backend/tests/conftest.py
import pytest

@pytest.fixture
def sample_workflow_config():
    return {
        "files": [...],
        "keyColumn": {...},
        "outputColumns": [...]
    }

@pytest.fixture
def sample_dataframe():
    return pd.DataFrame({...})
```

**Location:**
- TypeScript: `src/__tests__/fixtures.ts` or `src/__tests__/factories.ts`
- Python: `backend/tests/conftest.py` (pytest convention)

## Coverage

**Requirements:** Not enforced (no coverage configuration found)

**Recommendation:** Add to package.json scripts when tests are created:
```json
{
  "test": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:watch": "vitest --watch"
}
```

**Python:** Add to backend setup:
```bash
pytest --cov=app --cov-report=html
```

## Test Types

**Not applicable** – No tests exist, but here's the recommended approach:

**Unit Tests (to add):**
- **Scope:** Individual functions and pure logic
  - Test `generateId()`, `formatDate()`, `formatRelativeTime()` (utilities)
  - Test `WorkflowEngine` join operations
  - Test `ExcelParser` schema inference
  - Test validation functions like `validateFileColumns()`
- **Approach:** Test inputs and outputs without side effects
- **Location:** `src/lib/__tests__/`, `backend/tests/unit/`

**Integration Tests (to add):**
- **Scope:** Component + API interactions
  - Test `RunWorkflowPage` workflow execution (file upload → parsing → running)
  - Test workflow creation flow (all wizard steps)
  - Test API endpoints (POST /workflows, GET /workflows/:id, etc.)
- **Approach:** Mock external APIs, use real database (or in-memory SQLite)
- **Location:** `src/__tests__/`, `backend/tests/integration/`

**E2E Tests (not used):**
- Not currently implemented
- Recommended tool if added: Playwright (already has `.playwright-mcp` directory)
- Could test complete workflows: login → create workflow → run → download

## Common Patterns

**Async Testing (when added):**
```typescript
// TypeScript/React async pattern
it('loads workflow data on mount', async () => {
  render(<RunWorkflowPage />)

  await waitFor(() => {
    expect(screen.getByText('Test Workflow')).toBeInTheDocument()
  })
})
```

```python
# Python async pattern
@pytest.mark.asyncio
async def test_create_workflow():
    result = await create_workflow(workflow_data, db=mock_db)
    assert result.id is not None
    assert result.name == 'Test Workflow'
```

**Error Testing (when added):**
```typescript
// TypeScript error handling test
it('handles API errors gracefully', async () => {
  vi.mocked(workflowApi.get).mockRejectedValue(
    new Error('Network error')
  )

  render(<WorkflowEditorPage />)

  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument()
  })
})
```

```python
# Python error handling test
def test_invalid_excel_file_raises_error():
    with pytest.raises(ValueError, match='Failed to parse'):
        parser.parse('invalid.xlsx')
```

## Recommendations for Implementation

**Priority:**
1. **Unit tests for core logic:** `WorkflowEngine`, `ExcelParser`, utility functions
2. **Component tests:** UI components with props and state (Button, Card, Form components)
3. **Integration tests:** Workflow creation and execution flows
4. **E2E tests:** Using Playwright for critical user paths (setup already exists)

**Suggested tech stack:**
- **Frontend:** Vitest + React Testing Library
- **Backend:** Pytest + pytest-asyncio
- **E2E:** Playwright (MCP integration already present)

**Initial setup (example commands):**
```bash
# Frontend
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom

# Backend
pip install pytest pytest-asyncio pytest-cov

# E2E (already partially configured)
pip install playwright
```

---

*Testing analysis: 2026-02-07*
