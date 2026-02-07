"""Auth routes: Google OAuth login/callback, me, logout."""
import os

from fastapi import APIRouter, Request, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.auth.config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    OAUTH_REDIRECT_BASE,
)
from app.auth.deps import get_current_user
from app.db.database import get_db
from app.db.models import UserDB

router = APIRouter(prefix="/auth", tags=["auth"])

# Lazy init OAuth so we can use env vars (set after app load)
_oauth = None


def get_oauth():
    global _oauth
    if _oauth is None:
        from authlib.integrations.starlette_client import OAuth
        oauth = OAuth()
        oauth.register(
            name="google",
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )
        _oauth = oauth
    return _oauth


@router.get("/login")
async def login(request: Request):
    """Redirect to Google consent screen."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return RedirectResponse(url="/?error=oauth_not_configured", status_code=302)
    base = OAUTH_REDIRECT_BASE.rstrip("/") if OAUTH_REDIRECT_BASE else str(request.base_url).rstrip("/")
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
