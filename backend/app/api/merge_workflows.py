"""
Merge Workflow CRUD API endpoints.
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
import io
import json
import pandas as pd
import math

from app.db.database import get_db
from app.db.models import MergeWorkflowDB
from app.models.merge_workflow import (
    MergeWorkflow,
    MergeWorkflowCreate,
    MergeWorkflowUpdate,
)
from app.core.parser import ExcelParser
from app.core.merge_engine import MergeEngine

router = APIRouter()


def db_to_model(db_workflow: MergeWorkflowDB) -> MergeWorkflow:
    """Convert database model to Pydantic model."""
    config = db_workflow.config or {}
    return MergeWorkflow(
        id=db_workflow.id,
        name=db_workflow.name,
        description=db_workflow.description,
        files=config.get("files", []),
        keyColumn=config.get("keyColumn"),
        outputColumns=config.get("outputColumns", []),
        createdAt=db_workflow.created_at,
        updatedAt=db_workflow.updated_at,
    )


@router.post("", response_model=MergeWorkflow)
async def create_merge_workflow(
    workflow: MergeWorkflowCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new merge workflow."""
    workflow_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    # Build config from the workflow data
    config = {
        "name": workflow.name,
        "description": workflow.description,
        "files": [f.model_dump() for f in workflow.files],
        "keyColumn": workflow.keyColumn.model_dump() if workflow.keyColumn else None,
        "outputColumns": [c.model_dump() for c in workflow.outputColumns],
    }
    
    db_workflow = MergeWorkflowDB(
        id=workflow_id,
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


@router.get("", response_model=List[MergeWorkflow])
async def list_merge_workflows(db: AsyncSession = Depends(get_db)):
    """List all merge workflows."""
    result = await db.execute(
        select(MergeWorkflowDB).order_by(MergeWorkflowDB.updated_at.desc())
    )
    workflows = result.scalars().all()
    
    return [db_to_model(w) for w in workflows]


@router.get("/{workflow_id}", response_model=MergeWorkflow)
async def get_merge_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific merge workflow by ID."""
    result = await db.execute(
        select(MergeWorkflowDB).where(MergeWorkflowDB.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Merge workflow not found")
    
    return db_to_model(workflow)


@router.put("/{workflow_id}", response_model=MergeWorkflow)
async def update_merge_workflow(
    workflow_id: str,
    workflow_update: MergeWorkflowUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an existing merge workflow."""
    result = await db.execute(
        select(MergeWorkflowDB).where(MergeWorkflowDB.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Merge workflow not found")
    
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
async def delete_merge_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a merge workflow."""
    result = await db.execute(
        select(MergeWorkflowDB).where(MergeWorkflowDB.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Merge workflow not found")
    
    await db.delete(workflow)
    await db.commit()
    
    return {"message": "Merge workflow deleted successfully"}


@router.post("/{workflow_id}/run")
async def run_merge_workflow(
    workflow_id: str,
    files: List[UploadFile] = File(...),
    file_configs: str = Form(...),  # JSON string with file ID -> {sheetName, headerRow} mapping
    db: AsyncSession = Depends(get_db)
):
    """
    Run a merge workflow with uploaded files.
    
    Args:
        workflow_id: The workflow to run
        files: Uploaded Excel files (one per expected file in workflow)
        file_configs: JSON string mapping file IDs to their sheet/header config
                     Format: {"fileId": {"sheetName": "Sheet1", "headerRow": 1}, ...}
    
    Returns:
        Preview data and run ID for downloading the result
    """
    # Get the workflow
    result = await db.execute(
        select(MergeWorkflowDB).where(MergeWorkflowDB.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Merge workflow not found")
    
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
        
        # Execute the merge
        engine = MergeEngine(workflow_config)
        output_df, warnings = engine.execute(dataframes)
        
        # Generate a unique run ID
        run_id = str(uuid.uuid4())
        
        # Save the output to a temp file for download
        output_path = os.path.join(tempfile.gettempdir(), f"merge_result_{run_id}.xlsx")
        output_df.to_excel(output_path, index=False, engine='openpyxl')
        
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
        raise HTTPException(status_code=400, detail=f"Merge failed: {str(e)}")
    
    finally:
        # Clean up temp files
        for path in temp_files:
            try:
                os.unlink(path)
            except:
                pass


@router.get("/{workflow_id}/download/{run_id}")
async def download_merge_result(
    workflow_id: str,
    run_id: str,
):
    """
    Download the result of a merge workflow run.
    """
    output_path = os.path.join(tempfile.gettempdir(), f"merge_result_{run_id}.xlsx")
    
    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Merge result not found or expired")
    
    # Read the file
    with open(output_path, 'rb') as f:
        content = f.read()
    
    # Return as downloadable file
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="merge_result_{run_id[:8]}.xlsx"'
        }
    )
