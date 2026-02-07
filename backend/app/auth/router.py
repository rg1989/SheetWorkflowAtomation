"""Auth routes: Google OAuth login/callback, me, logout."""
import logging
import os

from fastapi import APIRouter, Request, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.auth.deps import get_current_user
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
async def login(request: Request):
    """Redirect to Google consent screen."""
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
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/callback")
async def callback(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Google OAuth callback: exchange code, create/update user, set session."""
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
    await db.commit()
    request.session["user_id"] = user.id
    # Redirect to app root (SPA will load)
    return RedirectResponse(url="/", status_code=302)


@router.get("/me")
async def me(current_user: UserDB = Depends(get_current_user)):
    """Return current user or 401."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "avatarUrl": current_user.avatar_url,
    }


@router.post("/logout")
async def logout(request: Request):
    """Clear session and return 200."""
    request.session.clear()
    return {}
