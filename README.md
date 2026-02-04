# Sheet Workflow Automation

A local, browser-based app for automating Excel data transformations. Define workflows to process data between Excel files (e.g., deduct sales from inventory), preview changes with cell-level diffs, approve, and export.

## Features

- **Visual Workflow Editor**: Create flexible workflows with conditions and actions
- **Cell-Level Diff Preview**: See exactly what will change before approving
- **Approval Flow**: Review and approve changes before generating output
- **Excel & PDF Export**: Download updated Excel files and PDF summaries
- **Run History**: Track all workflow executions with audit trail

## Tech Stack

- **Backend**: Python + FastAPI + SQLite
- **Frontend**: React + Vite + Tailwind CSS (with Bun)
- **Excel Processing**: openpyxl + pandas

## Prerequisites

- Python 3.10+
- Bun (for frontend) - Install from https://bun.sh

## Setup

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
bun install

# Run development server
bun dev
```

## Usage

1. Open http://localhost:5173 in your browser
2. Create a new workflow:
   - Upload sample Excel files to detect columns
   - Set the key column for matching rows
   - Add steps with conditions and actions
3. Run the workflow:
   - Upload source and target Excel files
   - Preview the changes
   - Approve and download the output

## Workflow Concepts

### Conditions
Match rows in the source file:
- `equals`, `contains`, `startsWith`, `endsWith`
- `exists`, `isEmpty`
- `greaterThan`, `lessThan`, etc.

### Actions
Apply changes to the target file:
- `setValue`: Set a specific value
- `increment`/`decrement`: Add or subtract from numeric values
- `copyFrom`: Copy value from source column
- `clear`: Clear the cell value
- `flag`: Mark the row with a flag value

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflows` | List all workflows |
| POST | `/api/workflows` | Create workflow |
| GET | `/api/workflows/{id}` | Get workflow details |
| PUT | `/api/workflows/{id}` | Update workflow |
| DELETE | `/api/workflows/{id}` | Delete workflow |
| POST | `/api/runs/preview` | Preview workflow run |
| POST | `/api/runs/{id}/execute` | Execute approved run |
| GET | `/api/runs/{id}/download/{type}` | Download output file |
| GET | `/api/runs` | List run history |

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/           # API endpoints
│   │   ├── core/          # Business logic (engine, parser, differ, exporter)
│   │   ├── db/            # Database models and connection
│   │   └── models/        # Pydantic schemas
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities and API client
│   │   └── types/         # TypeScript types
│   └── package.json
└── data/                  # SQLite database and file storage
```

## License

MIT
# SheetWorkflowAtomation
