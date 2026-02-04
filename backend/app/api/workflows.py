"""
Workflow CRUD API endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
from datetime import datetime

from app.db.database import get_db
from app.db.models import WorkflowDB
from app.models.workflow import Workflow, WorkflowCreate, WorkflowUpdate

router = APIRouter()


@router.post("", response_model=Workflow)
async def create_workflow(
    workflow: WorkflowCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new workflow."""
    workflow_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    db_workflow = WorkflowDB(
        id=workflow_id,
        name=workflow.name,
        description=workflow.description,
        config=workflow.model_dump(),
        version=1,
        created_at=now,
        updated_at=now,
    )
    
    db.add(db_workflow)
    await db.commit()
    await db.refresh(db_workflow)
    
    return Workflow(
        id=db_workflow.id,
        name=db_workflow.name,
        description=db_workflow.description,
        sourceConfig=workflow.sourceConfig,
        steps=workflow.steps,
        createdAt=db_workflow.created_at,
        updatedAt=db_workflow.updated_at,
    )


@router.get("", response_model=List[Workflow])
async def list_workflows(db: AsyncSession = Depends(get_db)):
    """List all workflows."""
    result = await db.execute(select(WorkflowDB).order_by(WorkflowDB.updated_at.desc()))
    workflows = result.scalars().all()
    
    return [
        Workflow(
            id=w.id,
            name=w.name,
            description=w.description,
            sourceConfig=w.config.get("sourceConfig", {}),
            steps=w.config.get("steps", []),
            createdAt=w.created_at,
            updatedAt=w.updated_at,
        )
        for w in workflows
    ]


@router.get("/{workflow_id}", response_model=Workflow)
async def get_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific workflow by ID."""
    result = await db.execute(
        select(WorkflowDB).where(WorkflowDB.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    return Workflow(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        sourceConfig=workflow.config.get("sourceConfig", {}),
        steps=workflow.config.get("steps", []),
        createdAt=workflow.created_at,
        updatedAt=workflow.updated_at,
    )


@router.put("/{workflow_id}", response_model=Workflow)
async def update_workflow(
    workflow_id: str,
    workflow_update: WorkflowUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an existing workflow."""
    result = await db.execute(
        select(WorkflowDB).where(WorkflowDB.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Update fields
    if workflow_update.name is not None:
        workflow.name = workflow_update.name
    if workflow_update.description is not None:
        workflow.description = workflow_update.description
    
    # Update config with new values
    config = workflow.config.copy()
    if workflow_update.sourceConfig is not None:
        config["sourceConfig"] = workflow_update.sourceConfig.model_dump()
    if workflow_update.steps is not None:
        config["steps"] = [s.model_dump() for s in workflow_update.steps]
    
    workflow.config = config
    workflow.version += 1
    workflow.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(workflow)
    
    return Workflow(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        sourceConfig=workflow.config.get("sourceConfig", {}),
        steps=workflow.config.get("steps", []),
        createdAt=workflow.created_at,
        updatedAt=workflow.updated_at,
    )


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a workflow."""
    result = await db.execute(
        select(WorkflowDB).where(WorkflowDB.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    await db.delete(workflow)
    await db.commit()
    
    return {"message": "Workflow deleted successfully"}
