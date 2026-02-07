"""Auth routes: Google OAuth login/callback, me, logout."""
import logging
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.auth.deps import get_current_user
from app.auth.encryption import encrypt_token
from app.auth.token_refresh import get_valid_access_token
from app.db.database import get_db
from app.db.models import UserDB

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/auth", tags=["auth"])

# Lazy init OAuth so we can use env vars (set after app load)
_oauth = None


def _get_credentials():
    """Read OAuth credentials from environment at call time (not import time)."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    redirect_base = os.environ.get("OAUTH_REDIRECT_BASE", "")
    if not redirect_base and os.environ.get("RAILWAY_PUBLIC_DOMAIN"):
        redirect_base = f"https://{os.environ['RAILWAY_PUBLIC_DOMAIN']}"
    return client_id, client_secret, redirect_base


def get_oauth():
    global _oauth
    if _oauth is None:
        from authlib.integrations.starlette_client import OAuth
        client_id, client_secret, _ = _get_credentials()
        oauth = OAuth()
        oauth.register(
            name="google",
            client_id=client_id,
            client_secret=client_secret,
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )
        _oauth = oauth
    return _oauth


@router.get("/login")
async def login(request: Request, scope: str = None):
    """Redirect to Google consent screen.

    Args:
        scope: Optional scope parameter. Pass 'drive' to request Drive and Sheets scopes.
    """
    client_id, client_secret, redirect_base = _get_credentials()
    if not client_id or not client_secret:
        logger.error(
            "OAuth not configured – GOOGLE_CLIENT_ID=%s GOOGLE_CLIENT_SECRET=%s",
            "set" if client_id else "MISSING",
            "set" if client_secret else "MISSING",
        )
        return RedirectResponse(url="/?error=oauth_not_configured", status_code=302)
    base = redirect_base.rstrip("/") if redirect_base else str(request.base_url).rstrip("/")
    redirect_uri = f"{base}/api/auth/callback"
    oauth = get_oauth()

    # Determine scopes based on query parameter
    scopes = "openid email profile"
    extra_params = {}

    if scope == "drive":
        # Request Drive and Sheets scopes with offline access
        # drive.readonly: Read-only access to all Drive files (needed to download user-selected files)
        # spreadsheets: Full access to Sheets (needed to create/update output sheets)
        scopes = "openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets"
        extra_params = {
            "access_type": "offline",
            "prompt": "consent"
        }
        request.session["oauth_scope_mode"] = "drive"

    return await oauth.google.authorize_redirect(
        request,
        redirect_uri,
        scope=scopes,
        **extra_params
    )


@router.get("/callback")
async def callback(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Google OAuth callback: exchange code, create/update user, store tokens, set session."""
    oauth = get_oauth()
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception:
        return RedirectResponse(url="/?error=oauth_failed", status_code=302)
    userinfo = token.get("userinfo")
    if not userinfo:
        return RedirectResponse(url="/?error=no_userinfo", status_code=302)
    sub = userinfo.get("sub")
    email = userinfo.get("email") or ""
    name = userinfo.get("name")
    picture = userinfo.get("picture")
    if not sub:
        return RedirectResponse(url="/?error=no_sub", status_code=302)

    # Create or update user
    result = await db.execute(select(UserDB).where(UserDB.id == sub))
    user = result.scalar_one_or_none()
    if not user:
        user = UserDB(id=sub, email=email, name=name, avatar_url=picture)
        db.add(user)
    else:
        user.email = email
        user.name = name
        user.avatar_url = picture

    # Store OAuth tokens if present
    if "access_token" in token:
        encrypted_access_token = encrypt_token(token["access_token"])
        user.google_access_token = encrypted_access_token

        # Calculate token expiry
        expires_in = token.get("expires_in", 3600)
        user.token_expiry = datetime.utcnow() + timedelta(seconds=expires_in)

        # Store refresh token if present (only returned on first consent or when prompt=consent)
        if "refresh_token" in token:
            encrypted_refresh_token = encrypt_token(token["refresh_token"])
            user.google_refresh_token = encrypted_refresh_token

        # Store granted scopes
        user.drive_scopes = token.get("scope", "")

        logger.info(
            "Stored OAuth tokens for user %s (scopes: %s, has_refresh: %s)",
            user.id,
            user.drive_scopes,
            "refresh_token" in token
        )

    # Clear session oauth scope mode
    request.session.pop("oauth_scope_mode", None)

    await db.commit()
    request.session["user_id"] = user.id

    # Redirect to app root (SPA will load)
    # In dev mode, frontend runs on a separate Vite dev server
    frontend_url = os.environ.get("FRONTEND_URL", "")
    if not frontend_url:
        # Auto-detect: if no static dir is served, assume dev mode on port 5173
        from app.main import STATIC_DIR
        if not STATIC_DIR.exists():
            frontend_url = "http://localhost:5173"
    return RedirectResponse(url=frontend_url + "/" if frontend_url else "/", status_code=302)


@router.get("/me")
async def me(current_user: UserDB = Depends(get_current_user)):
    """Return current user or 401."""
    # Check if user has Drive scopes
    drive_connected = False
    if current_user.drive_scopes:
        scopes = current_user.drive_scopes.split()
        # Accept either drive.file (legacy) or drive.readonly (new)
        has_drive_scope = (
            "https://www.googleapis.com/auth/drive.file" in scopes or
            "https://www.googleapis.com/auth/drive.readonly" in scopes
        )
        drive_connected = (
            has_drive_scope and
            "https://www.googleapis.com/auth/spreadsheets" in scopes
        )

    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "avatarUrl": current_user.avatar_url,
        "driveConnected": drive_connected,
    }


@router.get("/drive-status")
async def drive_status(current_user: UserDB = Depends(get_current_user)):
    """Return Drive connection status and granted scopes."""
    if not current_user.drive_scopes:
        return {"connected": False, "scopes": []}

    scopes = current_user.drive_scopes.split()
    # Accept either drive.file (legacy) or drive.readonly (new)
    has_drive_scope = (
        "https://www.googleapis.com/auth/drive.file" in scopes or
        "https://www.googleapis.com/auth/drive.readonly" in scopes
    )
    connected = (
        has_drive_scope and
        "https://www.googleapis.com/auth/spreadsheets" in scopes
    )

    return {
        "connected": connected,
        "scopes": scopes,
    }


@router.get("/token")
async def get_access_token(
    current_user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Return the user's current valid Google access token.

    This endpoint is used by the frontend to initialize Google Picker.
    Automatically refreshes the token if it's expired or close to expiry.

    Returns:
        dict: {
            "access_token": str,  # Valid access token
            "expires_at": str     # ISO 8601 expiry timestamp (or None)
        }

    Raises:
        HTTPException 401: User has no Drive connection or refresh failed
    """
    # Check if user has Drive tokens
    if not current_user.google_access_token:
        raise HTTPException(
            status_code=401,
            detail="No Google access token. Connect Google Drive first."
        )

    try:
        # Get valid access token (handles refresh if needed)
        access_token = await get_valid_access_token(current_user, db)

        return {
            "access_token": access_token,
            "expires_at": current_user.token_expiry.isoformat() if current_user.token_expiry else None
        }
    except ValueError as e:
        # User has no Drive connection
        raise HTTPException(
            status_code=401,
            detail=str(e)
        )


@router.post("/logout")
async def logout(request: Request):
    """Clear session and return 200."""
    request.session.clear()
    return {}
