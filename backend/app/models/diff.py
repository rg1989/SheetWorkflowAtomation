"""
Diff-related Pydantic models.
"""
from typing import List, Optional, Union, Any
from pydantic import BaseModel
from enum import Enum


class ChangeType(str, Enum):
    ADDED = "added"
    REMOVED = "removed"
    MODIFIED = "modified"
    UNCHANGED = "unchanged"


class CellChange(BaseModel):
    """A single cell change."""
    row: int  # Row index (0-based)
    column: str  # Column name
    keyValue: str  # Value of the key column for this row
    oldValue: Optional[Union[str, int, float]] = None
    newValue: Optional[Union[str, int, float]] = None
    changeType: ChangeType
    stepId: Optional[str] = None  # Which workflow step caused this
    stepName: Optional[str] = None


class RowChange(BaseModel):
    """Changes for a single row."""
    rowIndex: int
    keyValue: str
    cells: List[CellChange]
    hasWarning: bool = False
    warningMessage: Optional[str] = None


class DiffSummary(BaseModel):
    """Summary statistics for a diff."""
    rowsAffected: int
    cellsModified: int
    totalRows: int
    warnings: int
    errors: int


class Warning(BaseModel):
    """A warning about the diff."""
    type: str
    message: str
    row: Optional[int] = None
    column: Optional[str] = None


class DiffResult(BaseModel):
    """Full diff result from workflow execution."""
    summary: DiffSummary
    changes: List[RowChange]
    warnings: List[Warning] = []
    columns: List[str]  # All column names
    keyColumn: str
