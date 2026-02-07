"""
Drive and Sheets API endpoints.

REST endpoints for downloading Drive files, reading Google Sheets,
and getting file metadata. Exposes Phase 2's service layer to the frontend.
"""
import math
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
import pandas as pd

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import UserDB, RunDB
from app.models.run import RunStatus
from app.services.google_auth import build_drive_service, build_sheets_service
from app.services.drive import download_drive_file_to_df, get_drive_file_metadata
from app.services.sheets import read_sheet_to_df, create_spreadsheet, update_sheet_values, get_sheet_tabs

logger = logging.getLogger("uvicorn.error")

router = APIRouter()


# Pydantic Models

class DownloadRequest(BaseModel):
    """Request model for Drive file download."""
    file_id: str = Field(description="Google Drive file ID")
    header_row: Optional[int] = Field(None, description="Which row contains headers (1-indexed, default: 1)")


class SheetsReadRequest(BaseModel):
    """Request model for Google Sheets read."""
    spreadsheet_id: str = Field(description="Google Sheets spreadsheet ID")
    range_name: Optional[str] = Field(None, description="A1 notation range, e.g. 'Sheet1!A1:D10'")
    header_row: Optional[int] = Field(None, description="Which row contains headers (1-indexed, default: 1)")


class FileMetadata(BaseModel):
    """Drive file metadata."""
    id: str
    name: str
    mime_type: str
    modified_time: str
    owner: str
    web_view_link: str
    size: Optional[int] = None


class DriveFileResponse(BaseModel):
    """Response model for Drive/Sheets operations."""
    success: bool
    file_metadata: FileMetadata
    row_count: int
    columns: list[str]
    sample_data: list[dict]


class ExportCreateRequest(BaseModel):
    """Request to create new Google Sheet with workflow results."""
    run_id: str = Field(description="Workflow run ID whose output to export")
    title: str = Field(description="Title for the new Google Sheet")


class ExportUpdateRequest(BaseModel):
    """Request to update existing Google Sheet with workflow results."""
    run_id: str = Field(description="Workflow run ID whose output to export")
    spreadsheet_id: str = Field(description="Target Google Sheet ID to overwrite")


class ExportResponse(BaseModel):
    """Response from export operation."""
    success: bool
    spreadsheet_id: str
    spreadsheet_url: str
    updated_cells: int


# Helper Functions

def _sanitize_sample_rows(df, n=5) -> list[dict]:
    """
    Convert DataFrame to list of dicts with NaN values replaced by None.

    Args:
        df: pandas DataFrame
        n: Number of rows to extract (default: 5)

    Returns:
        list[dict]: Serializable list of row dicts
    """
    rows = df.head(n).to_dict('records')
    for row in rows:
        for key, value in row.items():
            if isinstance(value, float) and math.isnan(value):
                row[key] = None
    return rows


# Endpoints

@router.post("/download", response_model=DriveFileResponse)
async def download_drive_file(
    request: DownloadRequest,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Download a Drive file and return metadata with data preview.

    Supports Excel (.xlsx), CSV, and Google Sheets files.
    Returns file metadata and the first 5 rows as a preview.

    Args:
        request: DownloadRequest with file_id
        current_user: Authenticated user
        db: Database session

    Returns:
        DriveFileResponse: File metadata, row count, columns, and sample data

    Raises:
        HTTPException 400: Unsupported file type
        HTTPException 401: User not authenticated or Drive not connected
        HTTPException 403: Access denied to file
        HTTPException 404: File not found
    """
    try:
        # Log user's current scopes for debugging
        logger.info(
            "Downloading Drive file %s for user %s with scopes: %s",
            request.file_id,
            current_user.id,
            current_user.drive_scopes
        )

        # Build service objects
        drive_service = await build_drive_service(current_user, db)
        sheets_service = await build_sheets_service(current_user, db)

        # Get file metadata
        metadata = await get_drive_file_metadata(drive_service, request.file_id)

        # Download and parse file
        # Convert 1-indexed frontend header_row to 0-indexed pandas header_row
        header_row_param = (request.header_row - 1) if request.header_row else 0
        df = await download_drive_file_to_df(
            drive_service,
            request.file_id,
            mime_type=metadata["mimeType"],
            sheets_service=sheets_service,
            header_row=header_row_param
        )

        # Extract owner email
        owner_email = metadata.get("owners", [{}])[0].get("emailAddress", "Unknown")

        # Prepare response
        file_metadata = FileMetadata(
            id=metadata["id"],
            name=metadata["name"],
            mime_type=metadata["mimeType"],
            modified_time=metadata.get("modifiedTime", ""),
            owner=owner_email,
            web_view_link=metadata.get("webViewLink", ""),
            size=metadata.get("size")
        )

        return DriveFileResponse(
            success=True,
            file_metadata=file_metadata,
            row_count=len(df),
            columns=df.columns.tolist(),
            sample_data=_sanitize_sample_rows(df)
        )

    except ValueError as e:
        # Unsupported file type
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/read", response_model=DriveFileResponse)
async def read_google_sheet(
    request: SheetsReadRequest,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Read a Google Sheet and return metadata with data preview.

    Uses native Sheets API v4 for efficient reading.
    Returns file metadata and the first 5 rows as a preview.

    Args:
        request: SheetsReadRequest with spreadsheet_id and optional range_name
        current_user: Authenticated user
        db: Database session

    Returns:
        DriveFileResponse: File metadata, row count, columns, and sample data

    Raises:
        HTTPException 401: User not authenticated or Drive not connected
        HTTPException 403: Access denied to spreadsheet
        HTTPException 404: Spreadsheet not found
    """
    try:
        # Build service objects
        sheets_service = await build_sheets_service(current_user, db)
        drive_service = await build_drive_service(current_user, db)

        # Get file metadata from Drive
        metadata = await get_drive_file_metadata(drive_service, request.spreadsheet_id)

        # Read sheet via Sheets API
        # Convert 1-indexed frontend header_row to 0-indexed pandas header_row
        header_row_param = (request.header_row - 1) if request.header_row else 0
        df = await read_sheet_to_df(
            sheets_service,
            request.spreadsheet_id,
            range_name=request.range_name or "",
            header_row=header_row_param
        )

        # Extract owner email
        owner_email = metadata.get("owners", [{}])[0].get("emailAddress", "Unknown")

        # Prepare response
        file_metadata = FileMetadata(
            id=metadata["id"],
            name=metadata["name"],
            mime_type=metadata["mimeType"],
            modified_time=metadata.get("modifiedTime", ""),
            owner=owner_email,
            web_view_link=metadata.get("webViewLink", ""),
            size=metadata.get("size")
        )

        return DriveFileResponse(
            success=True,
            file_metadata=file_metadata,
            row_count=len(df),
            columns=df.columns.tolist(),
            sample_data=_sanitize_sample_rows(df)
        )

    except ValueError as e:
        # Unsupported operation or file type
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sheets/tabs")
async def list_sheet_tabs(
    spreadsheet_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all sheet tabs in a Google Sheets spreadsheet.

    Args:
        spreadsheet_id: Google Sheets spreadsheet ID
        current_user: Authenticated user
        db: Database session

    Returns:
        dict: {"tabs": [{"title": str, "index": int, "sheetId": int}, ...]}

    Raises:
        HTTPException 401: User not authenticated or Drive not connected
        HTTPException 403: Access denied to spreadsheet
        HTTPException 404: Spreadsheet not found
    """
    try:
        # Build Sheets service
        sheets_service = await build_sheets_service(current_user, db)

        # Get sheet tabs
        tabs = await get_sheet_tabs(sheets_service, spreadsheet_id)

        return {"tabs": tabs}

    except ValueError as e:
        # Drive not connected
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/export/create", response_model=ExportResponse)
async def export_create(
    request: ExportCreateRequest,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create new Google Sheet with workflow results.

    Args:
        request: ExportCreateRequest with run_id and title
        current_user: Authenticated user
        db: Database session

    Returns:
        ExportResponse: Success status, spreadsheet ID, URL, and cell count

    Raises:
        HTTPException 400: Run not completed
        HTTPException 401: User not authenticated or Drive not connected
        HTTPException 403: Access denied
        HTTPException 404: Run or output file not found
    """
    try:
        # Query run by ID and enforce ownership
        result = await db.execute(
            select(RunDB).where(
                RunDB.id == request.run_id,
                RunDB.user_id == current_user.id
            )
        )
        run = result.scalar_one_or_none()

        if not run:
            raise HTTPException(status_code=404, detail="Run not found")

        if run.status != RunStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Run not completed")

        if not run.output_path or not os.path.exists(run.output_path):
            raise HTTPException(status_code=404, detail="Output file not found")

        # Read output file
        df = pd.read_excel(run.output_path, engine="openpyxl")

        # Build Sheets service
        sheets_service = await build_sheets_service(current_user, db)

        # Create spreadsheet with data
        result = await create_spreadsheet(sheets_service, request.title, df)

        return ExportResponse(
            success=True,
            spreadsheet_id=result["spreadsheetId"],
            spreadsheet_url=result["spreadsheetUrl"],
            updated_cells=len(df) * len(df.columns)
        )

    except ValueError as e:
        # Drive not connected
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/export/update", response_model=ExportResponse)
async def export_update(
    request: ExportUpdateRequest,
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update existing Google Sheet with workflow results.

    Args:
        request: ExportUpdateRequest with run_id and spreadsheet_id
        current_user: Authenticated user
        db: Database session

    Returns:
        ExportResponse: Success status, spreadsheet ID, URL, and cell count

    Raises:
        HTTPException 400: Run not completed
        HTTPException 401: User not authenticated or Drive not connected
        HTTPException 403: Access denied or read-only sheet
        HTTPException 404: Run, output file, or spreadsheet not found
    """
    try:
        # Query run by ID and enforce ownership
        result = await db.execute(
            select(RunDB).where(
                RunDB.id == request.run_id,
                RunDB.user_id == current_user.id
            )
        )
        run = result.scalar_one_or_none()

        if not run:
            raise HTTPException(status_code=404, detail="Run not found")

        if run.status != RunStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Run not completed")

        if not run.output_path or not os.path.exists(run.output_path):
            raise HTTPException(status_code=404, detail="Output file not found")

        # Read output file
        df = pd.read_excel(run.output_path, engine="openpyxl")

        # Build services
        sheets_service = await build_sheets_service(current_user, db)
        drive_service = await build_drive_service(current_user, db)

        # Update spreadsheet with data
        update_result = await update_sheet_values(sheets_service, request.spreadsheet_id, df)

        # Get spreadsheet URL
        metadata = await get_drive_file_metadata(drive_service, request.spreadsheet_id)
        spreadsheet_url = metadata.get("webViewLink", "")

        return ExportResponse(
            success=True,
            spreadsheet_id=request.spreadsheet_id,
            spreadsheet_url=spreadsheet_url,
            updated_cells=update_result.get("updatedCells", 0)
        )

    except ValueError as e:
        # Drive not connected
        raise HTTPException(status_code=401, detail=str(e))
