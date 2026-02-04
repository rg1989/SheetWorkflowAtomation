"""
Workflow Pydantic models.
"""
from enum import Enum
from typing import List, Optional, Union, Literal, Annotated
from pydantic import BaseModel, Field, Discriminator
from datetime import datetime


class JoinType(str, Enum):
    """Types of joins supported for merging tables."""
    INNER = "inner"  # Only rows with matching keys in ALL files
    LEFT = "left"    # All rows from primary file, matching from others
    RIGHT = "right"  # All rows from last file, matching from others
    FULL = "full"    # All rows from ALL files (union of keys)


class JoinConfig(BaseModel):
    """Configuration for how tables should be joined."""
    joinType: JoinType = JoinType.LEFT
    primaryFileId: str  # Which file to keep all rows from (for LEFT join)


class ColumnInfo(BaseModel):
    """Information about a column in a file."""
    name: str
    type: str = "text"  # 'text' | 'number' | 'date' | 'integer' | 'boolean'
    sampleValues: List[Union[str, int, float, None]] = Field(default_factory=list)


class FileDefinition(BaseModel):
    """A file definition within a workflow."""
    id: str
    name: str  # User-friendly name
    filename: str  # Original filename
    colorIndex: int  # 0-4 for predefined colors
    columns: List[ColumnInfo] = Field(default_factory=list)


class KeyColumnConfig(BaseModel):
    """Configuration for the key column used to match rows across files.
    Maps each file ID to its key column name (allows different column names per file).
    """
    mappings: dict  # fileId -> column name


# Column source types
class DirectColumnSource(BaseModel):
    """Source that directly maps from a column."""
    type: Literal["direct"] = "direct"
    fileId: str
    column: str


class ConcatColumnPart(BaseModel):
    """A part of a concatenation."""
    type: Literal["column", "literal"]
    fileId: Optional[str] = None
    column: Optional[str] = None
    value: Optional[str] = None


class ConcatColumnSource(BaseModel):
    """Source that concatenates multiple parts."""
    type: Literal["concat"] = "concat"
    parts: List[ConcatColumnPart] = Field(default_factory=list)
    separator: Optional[str] = None


class MathOperand(BaseModel):
    """An operand in a math operation."""
    type: Literal["column", "literal"]
    fileId: Optional[str] = None
    column: Optional[str] = None
    value: Optional[float] = None


class MathColumnSource(BaseModel):
    """Source that performs math operations."""
    type: Literal["math"] = "math"
    operation: Literal["add", "subtract", "multiply", "divide"]
    operands: List[MathOperand] = Field(default_factory=list)


class CustomColumnSource(BaseModel):
    """Source with a custom static value."""
    type: Literal["custom"] = "custom"
    defaultValue: str = ""


# Use discriminator to properly parse the union based on "type" field
ColumnSource = Annotated[
    Union[DirectColumnSource, ConcatColumnSource, MathColumnSource, CustomColumnSource],
    Discriminator("type")
]


class OutputColumn(BaseModel):
    """An output column in the result."""
    id: str
    name: str
    source: ColumnSource
    order: int


class WorkflowBase(BaseModel):
    """Base workflow fields."""
    name: str
    description: Optional[str] = None
    files: List[FileDefinition] = Field(default_factory=list)
    keyColumn: Optional[KeyColumnConfig] = None
    joinConfig: Optional[JoinConfig] = None
    outputColumns: List[OutputColumn] = Field(default_factory=list)


class WorkflowCreate(WorkflowBase):
    """Schema for creating a workflow."""
    pass


class WorkflowUpdate(BaseModel):
    """Schema for updating a workflow."""
    name: Optional[str] = None
    description: Optional[str] = None
    files: Optional[List[FileDefinition]] = None
    keyColumn: Optional[KeyColumnConfig] = None
    joinConfig: Optional[JoinConfig] = None
    outputColumns: Optional[List[OutputColumn]] = None


class Workflow(WorkflowBase):
    """Full workflow schema with metadata."""
    id: str
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True


class PreviewRequest(BaseModel):
    """Request for previewing a workflow execution."""
    workflowId: str
    # File data would be sent separately as form data


class PreviewRow(BaseModel):
    """A row in the preview."""
    rowIndex: int
    keyValue: Optional[str] = None
    values: dict  # Column name -> value


class PreviewResult(BaseModel):
    """Result of a workflow preview."""
    columns: List[str]
    rows: List[PreviewRow]
    totalRows: int
    filesUsed: List[str]
    warnings: List[str] = Field(default_factory=list)
