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

## Host as a web app

The app runs as a single service: FastAPI serves the API and the built React frontend. Use the included Dockerfile to deploy to any platform that runs Docker.

### Railway (recommended)

1. Push this repo to GitHub and connect it at [railway.app](https://railway.app).
2. In the project, **New → GitHub Repo** and select the repo.
3. Railway will detect the **Dockerfile** and build it. No extra config needed.
4. Click **Deploy**. When it’s live, open the generated URL (e.g. `https://your-app.up.railway.app`).

You get one URL for both the UI and the API. Data (SQLite + uploads) is stored inside the container; for production you may add a [Railway volume](https://docs.railway.app/reference/volumes) and set `SHEET_WORKFLOW_DATA_DIR` to that path.

### Other platforms

- **Render**: New Web Service → connect repo → set **Docker** as environment, deploy.
- **Fly.io**: `fly launch` in the repo root (use the Dockerfile), then `fly deploy`.
- **Any Docker host**: `docker build -t sheet-workflow . && docker run -p 8000:8000 -e PORT=8000 sheet-workflow`. Serve on port 8000.

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
