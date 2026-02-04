"""
Workflow execution and run management API endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
import os
import json
from datetime import datetime

from app.db.database import get_db
from app.db.models import RunDB, WorkflowDB, AuditLogDB
from app.models.run import Run, RunPreview, RunStatus
from app.models.diff import DiffResult
from app.core.engine import WorkflowEngine
from app.core.parser import ExcelParser
from app.core.differ import DiffGenerator
from app.core.exporter import ExcelExporter, PDFExporter

router = APIRouter()

# Data directories
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
OUTPUTS_DIR = os.path.join(DATA_DIR, "outputs")


@router.post("/preview", response_model=RunPreview)
async def preview_run(
    workflow_id: str = Form(...),
    source_file: UploadFile = File(...),
    target_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload files and run workflow in preview mode.
    Returns diff without applying changes.
    """
    # Get workflow
    result = await db.execute(
        select(WorkflowDB).where(WorkflowDB.id == workflow_id)
    )
    workflow = result.scalar_one_or_none()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Create run ID and save files
    run_id = str(uuid.uuid4())
    
    source_path = os.path.join(UPLOADS_DIR, f"{run_id}_source.xlsx")
    target_path = os.path.join(UPLOADS_DIR, f"{run_id}_target.xlsx")
    
    # Save uploaded files
    with open(source_path, "wb") as f:
        content = await source_file.read()
        f.write(content)
    
    with open(target_path, "wb") as f:
        content = await target_file.read()
        f.write(content)
    
    try:
        # Parse Excel files
        parser = ExcelParser()
        source_df = parser.parse(source_path)
        target_df = parser.parse(target_path)
        
        # Execute workflow
        engine = WorkflowEngine(workflow.config)
        changes, modified_df = engine.execute(source_df, target_df)
        
        # Generate diff
        differ = DiffGenerator()
        diff_result = differ.generate(target_df, modified_df, changes)
        
        # Create run record
        now = datetime.utcnow()
        db_run = RunDB(
            id=run_id,
            workflow_id=workflow_id,
            status=RunStatus.PREVIEW,
            input_files=json.dumps({
                "source": source_path,
                "target": target_path,
            }),
            diff_summary=json.dumps(diff_result.model_dump()),
            created_at=now,
        )
        
        db.add(db_run)
        
        # Add audit log
        audit = AuditLogDB(
            run_id=run_id,
            action="preview",
            details=json.dumps({
                "workflow_id": workflow_id,
                "source_file": source_file.filename,
                "target_file": target_file.filename,
                "rows_affected": diff_result.summary.rowsAffected,
            }),
            timestamp=now,
        )
        db.add(audit)
        
        await db.commit()
        
        return RunPreview(
            runId=run_id,
            workflowId=workflow_id,
            diff=diff_result,
            status=RunStatus.PREVIEW,
        )
        
    except Exception as e:
        # Clean up files on error
        if os.path.exists(source_path):
            os.remove(source_path)
        if os.path.exists(target_path):
            os.remove(target_path)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{run_id}/execute", response_model=Run)
async def execute_run(
    run_id: str,
    generate_pdf: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """
    Approve and execute a previewed run.
    Generates output Excel (and optional PDF).
    """
    # Get run
    result = await db.execute(
        select(RunDB).where(RunDB.id == run_id)
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    if run.status != RunStatus.PREVIEW:
        raise HTTPException(status_code=400, detail="Run already executed or failed")
    
    # Get workflow
    result = await db.execute(
        select(WorkflowDB).where(WorkflowDB.id == run.workflow_id)
    )
    workflow = result.scalar_one_or_none()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    try:
        # Load input files
        input_files = json.loads(run.input_files)
        source_path = input_files["source"]
        target_path = input_files["target"]
        
        # Parse and execute
        parser = ExcelParser()
        source_df = parser.parse(source_path)
        target_df = parser.parse(target_path)
        
        engine = WorkflowEngine(workflow.config)
        changes, modified_df = engine.execute(source_df, target_df)
        
        # Export Excel
        output_excel_path = os.path.join(OUTPUTS_DIR, f"{run_id}_output.xlsx")
        excel_exporter = ExcelExporter()
        excel_exporter.export(modified_df, output_excel_path, changes)
        
        output_pdf_path = None
        if generate_pdf:
            output_pdf_path = os.path.join(OUTPUTS_DIR, f"{run_id}_summary.pdf")
            pdf_exporter = PDFExporter()
            diff_summary = json.loads(run.diff_summary)
            pdf_exporter.export(diff_summary, output_pdf_path)
        
        # Update run status
        now = datetime.utcnow()
        run.status = RunStatus.COMPLETED
        run.output_path = json.dumps({
            "excel": output_excel_path,
            "pdf": output_pdf_path,
        })
        run.completed_at = now
        
        # Add audit log
        audit = AuditLogDB(
            run_id=run_id,
            action="execute",
            details=json.dumps({
                "output_excel": output_excel_path,
                "output_pdf": output_pdf_path,
            }),
            timestamp=now,
        )
        db.add(audit)
        
        await db.commit()
        await db.refresh(run)
        
        return Run(
            id=run.id,
            workflowId=run.workflow_id,
            status=run.status,
            createdAt=run.created_at,
            completedAt=run.completed_at,
            outputExcel=output_excel_path,
            outputPdf=output_pdf_path,
        )
        
    except Exception as e:
        run.status = RunStatus.FAILED
        await db.commit()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{run_id}/download/{file_type}")
async def download_output(
    run_id: str,
    file_type: str,
    db: AsyncSession = Depends(get_db)
):
    """Download output file (excel or pdf)."""
    result = await db.execute(
        select(RunDB).where(RunDB.id == run_id)
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    if run.status != RunStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Run not completed")
    
    output_paths = json.loads(run.output_path)
    
    if file_type == "excel":
        path = output_paths.get("excel")
        if not path or not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Excel file not found")
        return FileResponse(
            path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"output_{run_id}.xlsx"
        )
    elif file_type == "pdf":
        path = output_paths.get("pdf")
        if not path or not os.path.exists(path):
            raise HTTPException(status_code=404, detail="PDF file not found")
        return FileResponse(
            path,
            media_type="application/pdf",
            filename=f"summary_{run_id}.pdf"
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid file type")


@router.get("", response_model=List[Run])
async def list_runs(
    workflow_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all runs, optionally filtered by workflow."""
    query = select(RunDB).order_by(RunDB.created_at.desc())
    
    if workflow_id:
        query = query.where(RunDB.workflow_id == workflow_id)
    
    result = await db.execute(query)
    runs = result.scalars().all()
    
    return [
        Run(
            id=r.id,
            workflowId=r.workflow_id,
            status=r.status,
            createdAt=r.created_at,
            completedAt=r.completed_at,
            outputExcel=json.loads(r.output_path).get("excel") if r.output_path else None,
            outputPdf=json.loads(r.output_path).get("pdf") if r.output_path else None,
        )
        for r in runs
    ]


@router.get("/{run_id}", response_model=RunPreview)
async def get_run(
    run_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific run with its diff."""
    result = await db.execute(
        select(RunDB).where(RunDB.id == run_id)
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    diff_data = json.loads(run.diff_summary) if run.diff_summary else None
    diff = DiffResult(**diff_data) if diff_data else None
    
    return RunPreview(
        runId=run.id,
        workflowId=run.workflow_id,
        diff=diff,
        status=run.status,
    )
