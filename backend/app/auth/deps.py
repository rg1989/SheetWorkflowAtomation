"""Auth dependencies: get_current_user, get_current_user_optional."""
from typing import Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from starlette.requests import Request

from app.db.database import get_db
from app.db.models import UserDB


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserDB:
    """Require authenticated user; raise 401 if not logged in."""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    result = await db.execute(select(UserDB).where(UserDB.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        # Session references deleted user
        request.session.pop("user_id", None)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return user


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[UserDB]:
    """Return current user if logged in, else None."""
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    result = await db.execute(select(UserDB).where(UserDB.id == user_id))
    return result.scalar_one_or_none()
