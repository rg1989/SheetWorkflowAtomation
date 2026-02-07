"""
Google Drive file download service.

Downloads Excel and CSV files from Drive to pandas DataFrames.
Handles Google Sheets files by exporting as Excel first.
Includes retry logic for rate limits and user-friendly error messages.
"""
import io
import json
import asyncio
import logging
from typing import Optional

import pandas as pd
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload
from fastapi import HTTPException
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

logger = logging.getLogger("uvicorn.error")

# MIME type constants
MIME_EXCEL = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MIME_CSV = "text/csv"
MIME_GOOGLE_SHEET = "application/vnd.google-apps.spreadsheet"
DOWNLOADABLE_MIMES = {MIME_EXCEL, MIME_CSV}


def _is_retryable(exception):
    """
    Check if exception should trigger retry.

    Only retry on HttpError with 429 or 5xx status.
    """
    if isinstance(exception, HttpError):
        return exception.resp.status in (429, 500, 502, 503, 504)
    return False


# Retry decorator for Google API calls
drive_retry = retry(
    retry=retry_if_exception(_is_retryable),
    wait=wait_exponential(multiplier=1, min=2, max=60),
    stop=stop_after_attempt(5),
    reraise=True,
)


def _handle_drive_error(e: HttpError, file_id: str):
    """
    Handle Google Drive API errors with user-friendly messages.

    Maps HTTP status codes to appropriate error messages and HTTPExceptions.
    For retryable errors (429, 5xx), re-raises the HttpError so tenacity can retry.
    For client errors (403, 404), raises HTTPException immediately.

    Args:
        e: HttpError from Google API
        file_id: Drive file ID for context

    Raises:
        HttpError: For retryable errors (429, 5xx)
        HTTPException: For client errors with user-friendly messages
    """
    status_code = e.resp.status

    # Parse error details
    try:
        error_body = json.loads(e.content.decode("utf-8"))
        error_message = error_body.get("error", {}).get("message", "Unknown error")
        error_reason = error_body.get("error", {}).get("errors", [{}])[0].get("reason", "")
    except (json.JSONDecodeError, AttributeError):
        error_message = str(e)
        error_reason = ""

    # Log the error
    logger.warning(
        "Drive API error for file %s: %s %s (reason: %s)",
        file_id,
        status_code,
        error_message,
        error_reason
    )

    # Handle retryable errors - re-raise for tenacity
    if status_code in (429, 500, 502, 503, 504):
        raise e

    # Handle client errors - convert to HTTPException
    if status_code == 403:
        if "storageQuota" in error_reason:
            detail = "Google Drive storage quota exceeded."
        else:
            detail = (
                f"Access denied to file {file_id}. "
                "Ensure the file is shared with you or request access from the owner."
            )
        raise HTTPException(status_code=403, detail=detail)

    if status_code == 404:
        detail = (
            "File not found. It may have been deleted or moved, "
            "or you may not have access."
        )
        raise HTTPException(status_code=404, detail=detail)

    # Other errors
    detail = f"Drive API error: {error_message}"
    raise HTTPException(status_code=status_code, detail=detail)


@drive_retry
async def get_drive_file_metadata(service, file_id: str) -> dict:
    """
    Get metadata for a Drive file.

    Args:
        service: Google Drive API service object
        file_id: Drive file ID

    Returns:
        dict: File metadata including id, name, mimeType, modifiedTime, etc.

    Raises:
        HTTPException: On permission errors, file not found, or API errors
    """
    try:
        metadata = await asyncio.to_thread(
            lambda: service.files().get(
                fileId=file_id,
                fields="id,name,mimeType,modifiedTime,owners,webViewLink,size"
            ).execute()
        )
        logger.info("Retrieved metadata for Drive file %s: %s", file_id, metadata.get("name"))
        return metadata
    except HttpError as e:
        _handle_drive_error(e, file_id)


@drive_retry
async def _download_binary_to_df(service, file_id: str, format: str) -> pd.DataFrame:
    """
    Download binary file from Drive and parse to DataFrame.

    Args:
        service: Google Drive API service object
        file_id: Drive file ID
        format: "excel" or "csv"

    Returns:
        pd.DataFrame: Parsed DataFrame with stripped column names

    Raises:
        HTTPException: On permission errors, file not found, or API errors
    """
    try:
        # Create request for file content
        request = service.files().get_media(fileId=file_id)

        # Download to BytesIO buffer
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)

        done = False
        while not done:
            status, done = await asyncio.to_thread(downloader.next_chunk)
            if status:
                logger.debug("Download progress: %d%%", int(status.progress() * 100))

        # Reset buffer to start
        buffer.seek(0)

        # Parse based on format
        if format == "excel":
            df = pd.read_excel(buffer, engine="openpyxl")
        elif format == "csv":
            df = pd.read_csv(buffer)
        else:
            raise ValueError(f"Unsupported format: {format}")

        # Strip whitespace from column names (match ExcelParser behavior)
        df.columns = df.columns.str.strip()

        logger.info("Downloaded and parsed %s file %s (%d rows)", format, file_id, len(df))
        return df

    except HttpError as e:
        _handle_drive_error(e, file_id)


@drive_retry
async def _export_google_sheet_to_df(service, file_id: str) -> pd.DataFrame:
    """
    Export Google Sheet as Excel and parse to DataFrame.

    Args:
        service: Google Drive API service object
        file_id: Drive file ID (must be Google Sheet)

    Returns:
        pd.DataFrame: Parsed DataFrame with stripped column names

    Raises:
        HTTPException: On permission errors, file not found, or API errors
    """
    try:
        # Export Google Sheet as Excel
        request = service.files().export_media(
            fileId=file_id,
            mimeType=MIME_EXCEL
        )

        # Download to BytesIO buffer
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)

        done = False
        while not done:
            status, done = await asyncio.to_thread(downloader.next_chunk)
            if status:
                logger.debug("Export progress: %d%%", int(status.progress() * 100))

        # Reset buffer to start
        buffer.seek(0)

        # Parse as Excel
        df = pd.read_excel(buffer, engine="openpyxl")

        # Strip whitespace from column names
        df.columns = df.columns.str.strip()

        logger.info("Exported and parsed Google Sheet %s (%d rows)", file_id, len(df))
        return df

    except HttpError as e:
        _handle_drive_error(e, file_id)


async def download_drive_file_to_df(
    service,
    file_id: str,
    mime_type: Optional[str] = None
) -> pd.DataFrame:
    """
    Download a Drive file and convert to pandas DataFrame.

    Supports Excel (.xlsx), CSV, and Google Sheets files.
    Automatically determines MIME type if not provided.

    Args:
        service: Google Drive API service object
        file_id: Drive file ID
        mime_type: Optional MIME type (if known, skips metadata lookup)

    Returns:
        pd.DataFrame: Parsed DataFrame

    Raises:
        ValueError: Unsupported file type
        HTTPException: On permission errors, file not found, or API errors
    """
    # Get MIME type if not provided
    if mime_type is None:
        metadata = await get_drive_file_metadata(service, file_id)
        mime_type = metadata.get("mimeType")

    logger.info("Downloading Drive file %s (%s)", file_id, mime_type)

    # Route based on MIME type
    if mime_type == MIME_GOOGLE_SHEET:
        return await _export_google_sheet_to_df(service, file_id)
    elif mime_type == MIME_EXCEL:
        return await _download_binary_to_df(service, file_id, "excel")
    elif mime_type == MIME_CSV:
        return await _download_binary_to_df(service, file_id, "csv")
    else:
        raise ValueError(
            f"Unsupported file type: {mime_type}. "
            "Supported: Google Sheets, Excel (.xlsx), CSV."
        )
