"""
SheetWorkflowAutomation - FastAPI Backend
A local workflow runner for Excel file operations.
"""
from contextlib import asynccontextmanager
from pathlib import Path
import os
import sys

from dotenv import load_dotenv

# Load .env before any config reads os.environ
load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.sessions import SessionMiddleware

from app.db.database import create_tables
from app.api import workflows, runs, files
from app.auth import router as auth_router
from app.auth.config import SESSION_SECRET_KEY


# Determine base directory (works for both development and bundled app)
if getattr(sys, 'frozen', False):
    # Running as bundled executable
    APP_DIR = Path(sys._MEIPASS) / "app"
else:
    # Running in development
    APP_DIR = Path(__file__).parent

# Static files directory (built frontend)
STATIC_DIR = APP_DIR / "static"

# Data directory - check environment variable first (set by desktop_app.py)
DATA_DIR = Path(os.environ.get(
    "SHEET_WORKFLOW_DATA_DIR",
    Path(__file__).parent.parent.parent / "data"
))
UPLOADS_DIR = DATA_DIR / "uploads"
OUTPUTS_DIR = DATA_DIR / "outputs"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and directories on startup."""
    # Ensure data directories exist
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    
    await create_tables()
    yield


app = FastAPI(
    title="SheetWorkflowAutomation",
    description="Local workflow runner for Excel file operations",
    version="1.0.0",
    lifespan=lifespan,
)

# Session for OAuth state and logged-in user (must be before CORS so session is available)
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET_KEY)

# CORS: include deployed origin from env so cookie works when frontend is same host
_cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
if os.environ.get("CORS_ORIGIN"):
    _cors_origins.append(os.environ["CORS_ORIGIN"].rstrip("/"))
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth_router, prefix="/api")
app.include_router(workflows.router, prefix="/api/workflows", tags=["workflows"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(files.router, prefix="/api/files", tags=["files"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "1.0.0"}


# Serve static frontend files if they exist (production/bundled mode)
if STATIC_DIR.exists():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")
    
    # Serve index.html for all non-API routes (SPA routing)
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        """Serve the SPA for all non-API routes."""
        # Don't intercept API routes
        if full_path.startswith("api/"):
            return {"error": "Not found"}
        
        # Serve specific static files if they exist
        static_file = STATIC_DIR / full_path
        if static_file.exists() and static_file.is_file():
            return FileResponse(static_file)
        
        # Default to index.html for SPA routing
        return FileResponse(STATIC_DIR / "index.html")
