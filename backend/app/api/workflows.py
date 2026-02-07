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
from app.services.google_auth import build_drive_service, build_sheets_service
from app.services.drive import download_drive_file_to_df
from app.services.sheets import read_sheet_to_df

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
    files: List[UploadFile] = File(default=[]),
    file_configs: str = Form(...),  # JSON string with file ID -> {sheetName, headerRow} mapping
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Run a workflow with uploaded files and/or Drive file references.

    Args:
        workflow_id: The workflow to run
        files: Uploaded Excel files (optional if using Drive files)
        file_configs: JSON string mapping file IDs to their sheet/header/source config
                     Format: {
                         "fileId": {
                             "source": "local",  // or "drive"
                             "sheetName": "Sheet1",
                             "headerRow": 1,
                             // For Drive files:
                             "driveFileId": "1ABCxyz...",
                             "driveMimeType": "application/vnd.google-apps.spreadsheet"
                         }
                     }

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

    # Count expected local files (backward compat: missing source = local)
    expected_local_count = sum(
        1 for expected_file in expected_files
        if configs.get(expected_file.get("id"), {}).get("source", "local") == "local"
    )

    if len(files) != expected_local_count:
        raise HTTPException(
            status_code=400,
            detail=f"Expected {expected_local_count} local files, got {len(files)}"
        )
    
    # Parse each file (local uploads + Drive files) into a DataFrame
    parser = ExcelParser()
    dataframes: Dict[str, pd.DataFrame] = {}
    temp_files: List[str] = []
    file_info_list: List[str] = []  # Track file names/IDs for audit

    # Generate a unique run ID
    run_id = str(uuid.uuid4())
    now = datetime.utcnow()

    # Build Drive/Sheets services once for efficiency
    drive_service = None
    sheets_service = None

    try:
        local_file_index = 0  # Track which local file to use

        for expected_file in expected_files:
            file_id = expected_file.get("id")

            # Get config for this file
            file_config = configs.get(file_id, {})
            source = file_config.get("source", "local")  # Backward compat default
            sheet_name = file_config.get("sheetName")
            header_row = file_config.get("headerRow", 1)

            if source == "local":
                # Process local upload
                if local_file_index >= len(files):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Missing local file for file ID '{file_id}'"
                    )

                upload_file = files[local_file_index]
                local_file_index += 1

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
                file_info_list.append(upload_file.filename)

            elif source == "drive":
                # Process Drive file
                drive_file_id = file_config.get("driveFileId")
                drive_mime_type = file_config.get("driveMimeType")

                if not drive_file_id:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Missing driveFileId for Drive file '{file_id}'"
                    )

                try:
                    # Build services lazily (only if Drive files present)
                    if drive_service is None:
                        drive_service = await build_drive_service(current_user, db)
                    if sheets_service is None:
                        sheets_service = await build_sheets_service(current_user, db)

                    # Download Drive file to DataFrame
                    if drive_mime_type == "application/vnd.google-apps.spreadsheet" and sheet_name:
                        # Google Sheets with specific tab
                        df = await read_sheet_to_df(
                            sheets_service,
                            drive_file_id,
                            range_name=sheet_name,
                            header_row=header_row - 1  # Convert to 0-indexed
                        )
                    else:
                        # Other Drive files (Excel, CSV) or Sheets without tab selection
                        df = await download_drive_file_to_df(
                            drive_service,
                            drive_file_id,
                            mime_type=drive_mime_type,
                            sheets_service=sheets_service,
                            sheet_name=sheet_name,
                            header_row=header_row - 1  # Convert to 0-indexed
                        )

                    dataframes[file_id] = df
                    file_info_list.append(f"Drive:{drive_file_id}")

                except Exception as drive_err:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Failed to download Drive file '{drive_file_id}': {str(drive_err)}"
                    )

            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid source '{source}' for file '{file_id}'"
                )
        
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
                "files": file_info_list,  # Mix of filenames and Drive IDs
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
                "files": file_info_list,
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
        
    except HTTPException:
        # Re-raise HTTPExceptions as-is (already formatted)
        raise
    except Exception as e:
        # Create failed run record
        db_run = RunDB(
            id=run_id,
            workflow_id=workflow_id,
            user_id=current_user.id,
            status=RunStatus.FAILED,
            input_files=json.dumps({
                "files": file_info_list if file_info_list else [f.filename for f in files],
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


@router.get("/{workflow_id}/results/{run_id}")
async def get_workflow_result_data(
    workflow_id: str,
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Get the full result data of a workflow run as JSON.
    Returns all rows and columns for preview and search.
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

    # Read the Excel file into DataFrame
    df = pd.read_excel(output_path, engine='openpyxl')

    # Convert full DataFrame to JSON records
    records = df.to_dict('records')

    # Sanitize NaN and datetime values (same pattern as run endpoint)
    for row in records:
        for key, value in row.items():
            if isinstance(value, float) and math.isnan(value):
                row[key] = None
            elif hasattr(value, 'isoformat'):  # datetime
                row[key] = value.isoformat()

    return {
        "columns": list(df.columns),
        "data": records,
        "rowCount": len(df),
    }


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
