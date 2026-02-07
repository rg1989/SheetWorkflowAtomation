"""
Drive and Sheets API endpoints.

REST endpoints for downloading Drive files, reading Google Sheets,
and getting file metadata. Exposes Phase 2's service layer to the frontend.
"""
import math
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import UserDB
from app.services.google_auth import build_drive_service, build_sheets_service
from app.services.drive import download_drive_file_to_df, get_drive_file_metadata
from app.services.sheets import read_sheet_to_df

logger = logging.getLogger("uvicorn.error")

router = APIRouter()


# Pydantic Models

class DownloadRequest(BaseModel):
    """Request model for Drive file download."""
    file_id: str = Field(description="Google Drive file ID")


class SheetsReadRequest(BaseModel):
    """Request model for Google Sheets read."""
    spreadsheet_id: str = Field(description="Google Sheets spreadsheet ID")
    range_name: Optional[str] = Field(None, description="A1 notation range, e.g. 'Sheet1!A1:D10'")


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
        # Build service objects
        drive_service = await build_drive_service(current_user, db)
        sheets_service = await build_sheets_service(current_user, db)

        # Get file metadata
        metadata = await get_drive_file_metadata(drive_service, request.file_id)

        # Download and parse file
        df = await download_drive_file_to_df(
            drive_service,
            request.file_id,
            mime_type=metadata["mimeType"],
            sheets_service=sheets_service
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
        df = await read_sheet_to_df(
            sheets_service,
            request.spreadsheet_id,
            range_name=request.range_name or ""
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
