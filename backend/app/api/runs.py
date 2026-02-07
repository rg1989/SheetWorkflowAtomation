"""
Run history management API endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import os

from app.db.database import get_db
from app.db.models import RunDB, AuditLogDB, UserDB
from app.auth.deps import get_current_user
from app.models.run import Run, RunStatus

router = APIRouter()


@router.get("", response_model=List[Run])
async def list_runs(
    workflow_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """List runs for the current user, optionally filtered by workflow."""
    query = select(RunDB).where(RunDB.user_id == current_user.id).order_by(RunDB.created_at.desc())
    
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
            outputExcel=r.output_path if r.output_path else None,
            outputPdf=None,  # PDF generation not currently supported
        )
        for r in runs
    ]


@router.get("/{run_id}", response_model=Run)
async def get_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Get a specific run."""
    result = await db.execute(
        select(RunDB).where(
            RunDB.id == run_id,
            RunDB.user_id == current_user.id,
        )
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    return Run(
        id=run.id,
        workflowId=run.workflow_id,
        status=run.status,
        createdAt=run.created_at,
        completedAt=run.completed_at,
        outputExcel=run.output_path if run.output_path else None,
        outputPdf=None,
    )


@router.get("/{run_id}/download/{file_type}")
async def download_output(
    run_id: str,
    file_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Download output file (excel)."""
    result = await db.execute(
        select(RunDB).where(
            RunDB.id == run_id,
            RunDB.user_id == current_user.id,
        )
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    if run.status != RunStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Run not completed")
    
    if file_type == "excel":
        path = run.output_path
        if not path or not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Excel file not found")
        return FileResponse(
            path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"output_{run_id[:8]}.xlsx"
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid file type. Only 'excel' is supported.")


@router.delete("/{run_id}")
async def delete_run(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Delete a run and its associated files."""
    result = await db.execute(
        select(RunDB).where(
            RunDB.id == run_id,
            RunDB.user_id == current_user.id,
        )
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    # Clean up output file
    try:
        if run.output_path and os.path.exists(run.output_path):
            os.remove(run.output_path)
    except Exception:
        pass  # Continue even if file cleanup fails
    
    # Delete associated audit logs
    await db.execute(
        delete(AuditLogDB).where(AuditLogDB.run_id == run_id)
    )
    
    await db.delete(run)
    await db.commit()
    
    return {"message": "Run deleted successfully"}


@router.delete("")
async def delete_all_runs(
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Delete all runs for the current user and their associated files."""
    result = await db.execute(select(RunDB).where(RunDB.user_id == current_user.id))
    runs = result.scalars().all()
    
    deleted_count = 0
    for run in runs:
        # Clean up output file
        try:
            if run.output_path and os.path.exists(run.output_path):
                os.remove(run.output_path)
        except Exception:
            pass
        
        # Delete associated audit logs
        await db.execute(
            delete(AuditLogDB).where(AuditLogDB.run_id == run.id)
        )
        
        await db.delete(run)
        deleted_count += 1
    
    await db.commit()
    
    return {"message": f"Deleted {deleted_count} run(s)"}
