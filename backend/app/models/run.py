"""
Run/execution Pydantic models.
"""
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from enum import Enum

from app.models.diff import DiffResult


class RunStatus(str, Enum):
    PREVIEW = "preview"
    APPROVED = "approved"
    COMPLETED = "completed"
    FAILED = "failed"


class Run(BaseModel):
    """A workflow run record."""
    id: str
    workflowId: str
    status: RunStatus
    createdAt: datetime
    completedAt: Optional[datetime] = None
    outputExcel: Optional[str] = None
    outputPdf: Optional[str] = None

    class Config:
        from_attributes = True


class RunPreview(BaseModel):
    """Preview result from a workflow run."""
    runId: str
    workflowId: str
    diff: Optional[DiffResult] = None
    status: RunStatus
