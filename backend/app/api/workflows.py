"""
Workflow CRUD API endpoints with run tracking.
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
from datetime import datetime
import tempfile
import os
import sys
import io
import json
import pandas as pd
import math
from pathlib import Path

from app.db.database import get_db
from app.db.models import WorkflowDB, RunDB, AuditLogDB
from app.auth.deps import get_current_user
from app.db.models import UserDB
from app.models.workflow import (
    Workflow,
    WorkflowCreate,
    WorkflowUpdate,
)
from app.models.run import Run, RunStatus
from app.core.parser import ExcelParser
from app.core.engine import WorkflowEngine

router = APIRouter()

# Data directories - check environment variable first (set by desktop_app.py when bundled)
if os.environ.get("SHEET_WORKFLOW_DATA_DIR"):
    DATA_DIR = Path(os.environ["SHEET_WORKFLOW_DATA_DIR"])
elif getattr(sys, 'frozen', False):
    DATA_DIR = Path(sys.executable).parent / "data"
else:
    DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"

OUTPUTS_DIR = DATA_DIR / "outputs"


def db_to_model(db_workflow: WorkflowDB) -> Workflow:
    """Convert database model to Pydantic model."""
    config = db_workflow.config or {}
    return Workflow(
        id=db_workflow.id,
        name=db_workflow.name,
        description=db_workflow.description,
        files=config.get("files", []),
        keyColumn=config.get("keyColumn"),
        joinConfig=config.get("joinConfig"),
        outputColumns=config.get("outputColumns", []),
        createdAt=db_workflow.created_at,
        updatedAt=db_workflow.updated_at,
    )


@router.post("", response_model=Workflow)
async def create_workflow(
    workflow: WorkflowCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Create a new workflow."""
    workflow_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    # Build config from the workflow data
    config = {
        "name": workflow.name,
        "description": workflow.description,
        "files": [f.model_dump() for f in workflow.files],
        "keyColumn": workflow.keyColumn.model_dump() if workflow.keyColumn else None,
        "joinConfig": workflow.joinConfig.model_dump() if workflow.joinConfig else None,
        "outputColumns": [c.model_dump() for c in workflow.outputColumns],
    }
    
    db_workflow = WorkflowDB(
        id=workflow_id,
        user_id=current_user.id,
        name=workflow.name,
        description=workflow.description,
        config=config,
        version=1,
        created_at=now,
        updated_at=now,
    )
    
    db.add(db_workflow)
    await db.commit()
    await db.refresh(db_workflow)
    
    return db_to_model(db_workflow)


@router.get("", response_model=List[Workflow])
async def list_workflows(
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """List all workflows for the current user."""
    result = await db.execute(
        select(WorkflowDB)
        .where(WorkflowDB.user_id == current_user.id)
        .order_by(WorkflowDB.updated_at.desc())
    )
    workflows = result.scalars().all()
    
    return [db_to_model(w) for w in workflows]


@router.get("/{workflow_id}", response_model=Workflow)
async def get_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Get a specific workflow by ID."""
    result = await db.execute(
        select(WorkflowDB).where(
            WorkflowDB.id == workflow_id,
            WorkflowDB.user_id == current_user.id,
        )
    )
    workflow = result.scalar_one_or_none()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    return db_to_model(workflow)


@router.put("/{workflow_id}", response_model=Workflow)
async def update_workflow(
    workflow_id: str,
    workflow_update: WorkflowUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Update an existing workflow."""
    result = await db.execute(
        select(WorkflowDB).where(
            WorkflowDB.id == workflow_id,
            WorkflowDB.user_id == current_user.id,
        )
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
    config = workflow.config.copy() if workflow.config else {}
    
    if workflow_update.files is not None:
        config["files"] = [f.model_dump() for f in workflow_update.files]
    if workflow_update.keyColumn is not None:
        config["keyColumn"] = workflow_update.keyColumn.model_dump()
    if workflow_update.joinConfig is not None:
        config["joinConfig"] = workflow_update.joinConfig.model_dump()
    if workflow_update.outputColumns is not None:
        config["outputColumns"] = [c.model_dump() for c in workflow_update.outputColumns]
    
    # Also update name/description in config for consistency
    if workflow_update.name is not None:
        config["name"] = workflow_update.name
    if workflow_update.description is not None:
        config["description"] = workflow_update.description
    
    workflow.config = config
    workflow.version += 1
    workflow.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(workflow)
    
    return db_to_model(workflow)


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Delete a workflow."""
    result = await db.execute(
        select(WorkflowDB).where(
            WorkflowDB.id == workflow_id,
            WorkflowDB.user_id == current_user.id,
        )
    )
    workflow = result.scalar_one_or_none()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    await db.delete(workflow)
    await db.commit()
    
    return {"message": "Workflow deleted successfully"}


@router.post("/{workflow_id}/run")
async def run_workflow(
    workflow_id: str,
    files: List[UploadFile] = File(...),
    file_configs: str = Form(...),  # JSON string with file ID -> {sheetName, headerRow} mapping
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Run a workflow with uploaded files.
    
    Args:
        workflow_id: The workflow to run
        files: Uploaded Excel files (one per expected file in workflow)
        file_configs: JSON string mapping file IDs to their sheet/header config
                     Format: {"fileId": {"sheetName": "Sheet1", "headerRow": 1}, ...}
    
    Returns:
        Preview data and run ID for downloading the result
    """
    # Get the workflow (must belong to current user)
    result = await db.execute(
        select(WorkflowDB).where(
            WorkflowDB.id == workflow_id,
            WorkflowDB.user_id == current_user.id,
        )
    )
    workflow = result.scalar_one_or_none()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Parse file configs
    try:
        configs = json.loads(file_configs)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid file_configs JSON")
    
    # Get workflow config
    workflow_config = workflow.config or {}
    expected_files = workflow_config.get("files", [])
    
    if len(files) != len(expected_files):
        raise HTTPException(
            status_code=400, 
            detail=f"Expected {len(expected_files)} files, got {len(files)}"
        )
    
    # Parse each uploaded file into a DataFrame
    parser = ExcelParser()
    dataframes: Dict[str, pd.DataFrame] = {}
    temp_files: List[str] = []
    
    # Generate a unique run ID
    run_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    try:
        for i, (upload_file, expected_file) in enumerate(zip(files, expected_files)):
            file_id = expected_file.get("id")
            
            # Get config for this file
            file_config = configs.get(file_id, {})
            sheet_name = file_config.get("sheetName")
            header_row = file_config.get("headerRow", 1)
            
            # Save to temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
                content = await upload_file.read()
                tmp.write(content)
                temp_files.append(tmp.name)
            
            # Parse with correct sheet and header row
            df = parser.parse(
                temp_files[-1], 
                sheet_name=sheet_name, 
                header_row=header_row - 1  # Convert to 0-indexed
            )
            dataframes[file_id] = df
        
        # Execute the workflow
        engine = WorkflowEngine(workflow_config)
        output_df, warnings = engine.execute(dataframes)
        
        # Per-user output directory
        user_output_dir = OUTPUTS_DIR / str(current_user.id)
        user_output_dir.mkdir(parents=True, exist_ok=True)
        output_path = str(user_output_dir / f"workflow_result_{run_id}.xlsx")
        output_df.to_excel(output_path, index=False, engine='openpyxl')
        
        # Create run record
        db_run = RunDB(
            id=run_id,
            workflow_id=workflow_id,
            user_id=current_user.id,
            status=RunStatus.COMPLETED,
            input_files=json.dumps({
                "files": [f.filename for f in files],
                "configs": configs,
            }),
            output_path=output_path,
            result_summary=json.dumps({
                "rowCount": len(output_df),
                "columnCount": len(output_df.columns),
                "columns": list(output_df.columns),
                "warnings": warnings,
            }),
            created_at=now,
            completed_at=now,
        )
        db.add(db_run)
        
        # Add audit log
        audit = AuditLogDB(
            run_id=run_id,
            action="execute",
            details=json.dumps({
                "workflow_id": workflow_id,
                "workflow_name": workflow.name,
                "files": [f.filename for f in files],
                "row_count": len(output_df),
            }),
            timestamp=now,
        )
        db.add(audit)
        
        await db.commit()
        
        # Convert preview data to JSON-safe format
        preview_rows = output_df.head(20).to_dict('records')
        for row in preview_rows:
            for key, value in row.items():
                if isinstance(value, float) and math.isnan(value):
                    row[key] = None
                elif hasattr(value, 'isoformat'):  # datetime
                    row[key] = value.isoformat()
        
        return {
            "success": True,
            "runId": run_id,
            "rowCount": len(output_df),
            "columns": list(output_df.columns),
            "previewData": preview_rows,
            "warnings": warnings,
        }
        
    except Exception as e:
        # Create failed run record
        db_run = RunDB(
            id=run_id,
            workflow_id=workflow_id,
            user_id=current_user.id,
            status=RunStatus.FAILED,
            input_files=json.dumps({
                "files": [f.filename for f in files],
                "configs": configs,
            }),
            result_summary=json.dumps({"error": str(e)}),
            created_at=now,
            completed_at=now,
        )
        db.add(db_run)
        await db.commit()
        
        raise HTTPException(status_code=400, detail=f"Workflow execution failed: {str(e)}")
    
    finally:
        # Clean up temp files
        for path in temp_files:
            try:
                os.unlink(path)
            except:
                pass


@router.get("/{workflow_id}/download/{run_id}")
async def download_workflow_result(
    workflow_id: str,
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Download the result of a workflow run.
    """
    # Verify the run exists, belongs to this workflow, and to current user
    result = await db.execute(
        select(RunDB).where(
            RunDB.id == run_id,
            RunDB.workflow_id == workflow_id,
            RunDB.user_id == current_user.id,
        )
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    if run.status != RunStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Run not completed successfully")
    
    output_path = run.output_path
    if not output_path or not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Result file not found or expired")
    
    # Read the file
    with open(output_path, 'rb') as f:
        content = f.read()
    
    # Return as downloadable file
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="workflow_result_{run_id[:8]}.xlsx"'
        }
    )
