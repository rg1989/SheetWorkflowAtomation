"""
Database connection and session management.
"""
import os
import sys
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# Database path - check environment variable first (set by desktop_app.py when bundled)
if os.environ.get("SHEET_WORKFLOW_DATA_DIR"):
    DATA_DIR = Path(os.environ["SHEET_WORKFLOW_DATA_DIR"])
elif getattr(sys, 'frozen', False):
    # Running as bundled executable without env var set
    DATA_DIR = Path(sys.executable).parent / "data"
else:
    # Running in development
    DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"

DATA_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite+aiosqlite:///{DATA_DIR / 'workflow.db'}"

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    future=True,
)

# Create session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass


async def create_tables():
    """Create all database tables and add user_id columns if missing."""
    from app.db.models import UserDB, WorkflowDB, RunDB, AuditLogDB  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Migration: add user_id to existing workflows/runs tables (SQLite)
    async with engine.begin() as conn:
        from sqlalchemy import text
        for table in ("workflows", "runs"):
            try:
                result = await conn.execute(text(f"PRAGMA table_info({table})"))
                rows = result.fetchall()
                columns = [row[1] for row in rows]
                if "user_id" not in columns:
                    await conn.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN user_id VARCHAR REFERENCES users(id)")
                    )
            except Exception:
                pass  # Table might not exist yet or already has column


async def get_db():
    """Dependency to get database session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
