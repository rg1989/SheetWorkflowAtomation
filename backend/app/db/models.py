"""
SQLAlchemy database models.
"""
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.db.database import Base


class UserDB(Base):
    """User account (Google OAuth). id is Google 'sub'."""
    __tablename__ = "users"

    id = Column(String, primary_key=True)  # Google sub
    email = Column(String, nullable=False)
    name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    google_access_token = Column(String, nullable=True)
    google_refresh_token = Column(String, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    drive_scopes = Column(String, nullable=True)


class WorkflowDB(Base):
    """Workflow database model."""
    __tablename__ = "workflows"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)  # nullable for existing rows
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    config = Column(JSON, nullable=False)  # Full workflow definition
    version = Column(Integer, default=1)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class RunDB(Base):
    """Run history database model."""
    __tablename__ = "runs"

    id = Column(String, primary_key=True)
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)  # nullable for existing rows
    status = Column(String, nullable=False)  # 'preview' | 'completed' | 'failed'
    input_files = Column(JSON, nullable=True)
    output_path = Column(String, nullable=True)
    result_summary = Column(JSON, nullable=True)  # Summary of the run result
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)


class AuditLogDB(Base):
    """Audit log database model."""
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, ForeignKey("runs.id"), nullable=True)
    action = Column(String, nullable=False)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, server_default=func.now())
