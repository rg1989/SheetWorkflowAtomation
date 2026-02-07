"""
Automatic token refresh for Google OAuth tokens.

Provides get_valid_access_token() function that transparently handles
token expiry by refreshing with Google's token endpoint.
"""
import os
import logging
from datetime import datetime, timedelta

import httpx
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.encryption import encrypt_token, decrypt_token
from app.db.models import UserDB

logger = logging.getLogger("uvicorn.error")


async def get_valid_access_token(user: UserDB, db: AsyncSession) -> str:
    """
    Get a valid access token for the user, refreshing if necessary.

    Checks if the current access token is valid (not expired). If expired or close
    to expiry (< 5 minutes), automatically refreshes using the refresh token.

    Args:
        user: UserDB instance with OAuth tokens
        db: Database session for persisting refreshed tokens

    Returns:
        str: Valid plaintext access token ready for API calls

    Raises:
        ValueError: User has not connected Google Drive (no tokens)
        HTTPException 401: Refresh token missing or revoked, user must re-authenticate
        HTTPException 502: Token refresh request failed (network/server error)
    """
    # Check if user has Drive tokens
    if user.google_access_token is None:
        raise ValueError("User has not connected Google Drive")

    # Check if current token is still valid (with 5-minute buffer)
    if user.token_expiry is not None:
        buffer_time = datetime.utcnow() + timedelta(minutes=5)
        if user.token_expiry > buffer_time:
            # Token is still valid, decrypt and return
            try:
                return decrypt_token(user.google_access_token)
            except ValueError as e:
                # Decryption failed (encryption key changed)
                logger.warning(
                    "Failed to decrypt access token for user %s: %s",
                    user.id,
                    str(e)
                )
                raise HTTPException(
                    status_code=401,
                    detail="drive_reconnect_required"
                )

    # Token is expired or close to expiry, need to refresh
    if user.google_refresh_token is None:
        raise HTTPException(
            status_code=401,
            detail="drive_reconnect_required"
        )

    # Decrypt refresh token
    try:
        refresh_token = decrypt_token(user.google_refresh_token)
    except ValueError as e:
        logger.warning(
            "Failed to decrypt refresh token for user %s: %s",
            user.id,
            str(e)
        )
        raise HTTPException(
            status_code=401,
            detail="drive_reconnect_required"
        )

    # Prepare token refresh request
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")

    if not client_id or not client_secret:
        logger.error("OAuth credentials not configured for token refresh")
        raise HTTPException(
            status_code=502,
            detail="Token refresh failed: OAuth not configured"
        )

    token_endpoint = "https://oauth2.googleapis.com/token"
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }

    # Make refresh request
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(token_endpoint, data=payload)

        if response.status_code != 200:
            error_data = response.json()
            error_type = error_data.get("error", "unknown")

            if error_type == "invalid_grant":
                # Refresh token has been revoked
                logger.warning(
                    "Refresh token revoked for user %s (invalid_grant)",
                    user.id
                )
                raise HTTPException(
                    status_code=401,
                    detail="drive_reconnect_required"
                )

            # Other error
            logger.error(
                "Token refresh failed for user %s: %s - %s",
                user.id,
                response.status_code,
                error_data
            )
            raise HTTPException(
                status_code=502,
                detail="Token refresh failed"
            )

        # Parse response
        token_data = response.json()
        new_access_token = token_data.get("access_token")
        expires_in = token_data.get("expires_in", 3600)

        if not new_access_token:
            logger.error(
                "Token refresh response missing access_token for user %s",
                user.id
            )
            raise HTTPException(
                status_code=502,
                detail="Token refresh failed"
            )

        # Encrypt and store new access token
        encrypted_access_token = encrypt_token(new_access_token)
        user.google_access_token = encrypted_access_token
        user.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in)

        # Note: Google does NOT return a new refresh_token on refresh
        # Keep the existing refresh_token

        await db.commit()

        logger.info(
            "Refreshed Drive access token for user %s (expires in %ds)",
            user.id,
            expires_in
        )

        return new_access_token

    except httpx.RequestError as e:
        logger.error(
            "Network error during token refresh for user %s: %s",
            user.id,
            str(e)
        )
        raise HTTPException(
            status_code=502,
            detail="Token refresh failed: Network error"
        )
