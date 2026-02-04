"""
Workflow Pydantic models.
"""
from typing import List, Optional, Union
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class ConditionOperator(str, Enum):
    EQUALS = "equals"
    NOT_EQUALS = "notEquals"
    CONTAINS = "contains"
    NOT_CONTAINS = "notContains"
    STARTS_WITH = "startsWith"
    ENDS_WITH = "endsWith"
    EXISTS = "exists"
    IS_EMPTY = "isEmpty"
    GREATER_THAN = "greaterThan"
    LESS_THAN = "lessThan"
    GREATER_THAN_OR_EQUAL = "greaterThanOrEqual"
    LESS_THAN_OR_EQUAL = "lessThanOrEqual"


class ActionType(str, Enum):
    SET_VALUE = "setValue"
    INCREMENT = "increment"
    DECREMENT = "decrement"
    COPY_FROM = "copyFrom"
    FORMULA = "formula"
    FLAG = "flag"
    CLEAR = "clear"


class Condition(BaseModel):
    """A single condition in a workflow step."""
    id: str
    column: str
    operator: ConditionOperator
    value: Optional[Union[str, int, float]] = None


class Action(BaseModel):
    """A single action in a workflow step."""
    id: str
    type: ActionType
    targetColumn: str
    sourceColumn: Optional[str] = None  # For copyFrom
    value: Optional[Union[str, int, float]] = None  # For setValue/increment/decrement
    formula: Optional[str] = None  # For formula action


class WorkflowStep(BaseModel):
    """A workflow step with conditions and actions."""
    id: str
    name: str
    conditions: List[Condition] = Field(default_factory=list)
    actions: List[Action] = Field(default_factory=list)


class SourceConfig(BaseModel):
    """Configuration for source file handling."""
    type: str = "custom"  # 'inventory' | 'sales' | 'custom'
    keyColumn: str  # Column used for matching between files


class WorkflowBase(BaseModel):
    """Base workflow fields."""
    name: str
    description: Optional[str] = None
    sourceConfig: SourceConfig
    steps: List[WorkflowStep] = Field(default_factory=list)


class WorkflowCreate(WorkflowBase):
    """Schema for creating a workflow."""
    pass


class WorkflowUpdate(BaseModel):
    """Schema for updating a workflow."""
    name: Optional[str] = None
    description: Optional[str] = None
    sourceConfig: Optional[SourceConfig] = None
    steps: Optional[List[WorkflowStep]] = None


class Workflow(WorkflowBase):
    """Full workflow schema with metadata."""
    id: str
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True
