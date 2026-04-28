import time
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import User
from app.services.auth import decode_token

security = HTTPBearer(auto_error=False)

_token_cache: dict[str, tuple[str, float]] = {}  # token -> (user_id, expires_at)
TOKEN_CACHE_TTL = 60  # 60 seconds (access token is 15 min)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = None
    if credentials:
        token = credentials.credentials
    elif "access_token" in request.cookies:
        token = request.cookies["access_token"]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # Check cache — store only user_id to avoid stale User objects across DB sessions
    now = time.monotonic()
    cached = _token_cache.get(token)
    if cached is not None:
        user_id_cached, exp = cached
        if now < exp:
            from sqlalchemy import select
            result = await db.execute(select(User).where(User.id == user_id_cached))
            user = result.scalar_one_or_none()
            if user and user.is_active:
                return user

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Cache the validated token
    _token_cache[token] = (user_id, now + TOKEN_CACHE_TTL)

    # Evict expired entries occasionally
    if len(_token_cache) > 10000:
        expired_keys = [k for k, (_, exp) in _token_cache.items() if exp < now]
        for k in expired_keys:
            del _token_cache[k]

    return user
