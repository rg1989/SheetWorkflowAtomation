"""
Build Google API service objects from stored OAuth tokens.

Uses Phase 1's token storage and refresh logic to construct
authenticated Drive v3 and Sheets v4 service objects.
"""
import os
import logging
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.token_refresh import get_valid_access_token
from app.auth.encryption import decrypt_token
from app.db.models import UserDB

logger = logging.getLogger("uvicorn.error")


async def _build_credentials(user: UserDB, db: AsyncSession) -> Credentials:
    """
    Build Google OAuth2 credentials from stored tokens.

    Args:
        user: UserDB instance with OAuth tokens
        db: Database session for token refresh

    Returns:
        Credentials: Google OAuth2 credentials object

    Raises:
        ValueError: User has not connected Google Drive
    """
    # Validate user has Drive tokens
    if user.google_access_token is None or user.google_refresh_token is None:
        raise ValueError("User has not connected Google Drive")

    # Get valid access token (auto-refreshes if expired)
    access_token = await get_valid_access_token(user, db)

    # Decrypt refresh token
    refresh_token = decrypt_token(user.google_refresh_token)

    # Build credentials object
    credentials = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get("GOOGLE_CLIENT_ID"),
        client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
        scopes=user.drive_scopes.split() if user.drive_scopes else [],
    )

    return credentials


async def build_drive_service(user: UserDB, db: AsyncSession):
    """
    Build Google Drive v3 API service object.

    Args:
        user: UserDB instance with OAuth tokens
        db: Database session for token refresh

    Returns:
        Resource: Google Drive API service object

    Raises:
        ValueError: User has not connected Google Drive
    """
    credentials = await _build_credentials(user, db)
    service = build("drive", "v3", credentials=credentials)
    logger.info("Built Drive v3 service for user %s", user.id)
    return service


async def build_sheets_service(user: UserDB, db: AsyncSession):
    """
    Build Google Sheets v4 API service object.

    Args:
        user: UserDB instance with OAuth tokens
        db: Database session for token refresh

    Returns:
        Resource: Google Sheets API service object

    Raises:
        ValueError: User has not connected Google Drive
    """
    credentials = await _build_credentials(user, db)
    service = build("sheets", "v4", credentials=credentials)
    logger.info("Built Sheets v4 service for user %s", user.id)
    return service
