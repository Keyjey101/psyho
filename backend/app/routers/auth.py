import random
import secrets
import string
import uuid
import hashlib
import hmac
import json
from urllib.parse import parse_qs
from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from passlib.context import CryptContext
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.models import User, UserProfile, TelegramVerificationCode
from app.schemas.auth import (
    RefreshRequest,
    TokenResponse,
    TelegramAuthRequest,
    TelegramAuthResponse,
    LinkTelegramRequest,
    TgRequestCodeRequest,
    TgRequestCodeResponse,
    TgCheckResponse,
    TgMiniAppRequest,
)
from app.services.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.middleware.auth import get_current_user

router = APIRouter()
logger = structlog.get_logger()
settings = get_settings()

COOKIE_ACCESS_MAX_AGE = 15 * 60
COOKIE_REFRESH_MAX_AGE = 30 * 24 * 60 * 60

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _set_token_cookies(response: Response, access: str, refresh: str):
    is_secure = settings.ENVIRONMENT == "production"
    response.set_cookie(
        "access_token",
        access,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=COOKIE_ACCESS_MAX_AGE,
        path="/",
    )
    response.set_cookie(
        "refresh_token",
        refresh,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=COOKIE_REFRESH_MAX_AGE,
        path="/api/auth",
    )


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def _hash_code(code: str) -> str:
    return _pwd_context.hash(code)


def _verify_code(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    body = await request.json() if request.headers.get("content-type") else {}
    refresh_token = body.get("refresh_token") or request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    payload = decode_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user_id = payload.get("sub")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    access = create_access_token({"sub": user_id})
    new_refresh = create_refresh_token({"sub": user_id})
    _set_token_cookies(response, access, new_refresh)
    return TokenResponse(access_token=access, refresh_token=new_refresh)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/auth")
    return {"detail": "Logged out successfully"}


@router.post("/tg/request-code", response_model=TgRequestCodeResponse)
async def tg_request_code(body: TgRequestCodeRequest, request: Request, db: AsyncSession = Depends(get_db)):
    username = None
    if body.telegram_username:
        username = body.telegram_username.strip().lstrip("@").lower()

    now = datetime.now(timezone.utc)

    if username:
        window_start = now - timedelta(minutes=10)
        rate_result = await db.execute(
            select(TelegramVerificationCode).where(
                TelegramVerificationCode.telegram_username == username,
                TelegramVerificationCode.created_at >= window_start,
            )
        )
        if len(rate_result.scalars().all()) >= 5:
            raise HTTPException(status_code=429, detail="Слишком много попыток. Попробуй через 10 минут.")

        await db.execute(
            delete(TelegramVerificationCode).where(
                TelegramVerificationCode.telegram_username == username,
                TelegramVerificationCode.used == False,  # noqa: E712
            )
        )

    code = _generate_otp()
    record = TelegramVerificationCode(
        telegram_username=username,
        code=code,
        expires_at=now + timedelta(minutes=10),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return TgRequestCodeResponse(
        request_id=record.id,
        code=code,
        bot_username=settings.TELEGRAM_BOT_USERNAME,
        expires_in=600,
    )


@router.get("/tg/check/{request_id}", response_model=TgCheckResponse)
async def tg_check(request_id: str, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TelegramVerificationCode).where(TelegramVerificationCode.id == request_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Запрос не найден")

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if not record.verified:
        if now > record.expires_at:
            return TgCheckResponse(status="expired")
        return TgCheckResponse(status="pending")

    if record.used:
        return TgCheckResponse(status="expired")

    record.used = True

    user_result = await db.execute(select(User).where(User.telegram_id == record.telegram_id))
    user = user_result.scalar_one_or_none()
    is_new_user = user is None

    if is_new_user:
        synthetic_email = f"tg_{record.telegram_id}@tg.local"
        user = User(
            email=synthetic_email,
            name="",
            password=_hash_code(secrets.token_hex(32)),
            telegram_id=record.telegram_id,
            telegram_username=record.telegram_username,
        )
        db.add(user)
        await db.flush()
        profile = UserProfile(user_id=user.id)
        db.add(profile)

    await db.commit()

    access = create_access_token({"sub": user.id})
    refresh_tok = create_refresh_token({"sub": user.id})
    _set_token_cookies(response, access, refresh_tok)

    return TgCheckResponse(
        status="verified",
        access_token=access,
        refresh_token=refresh_tok,
        is_new_user=is_new_user,
    )


@router.post("/tg/mini-app", response_model=TelegramAuthResponse)
async def tg_mini_app_auth(body: TgMiniAppRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """TMA fallback: called when initData is empty (known Telegram Android bug) but initDataUnsafe.user is available."""
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram auth not configured")

    if not body.telegram_id.isdigit():
        raise HTTPException(status_code=400, detail="Invalid telegram_id")

    result = await db.execute(select(User).where(User.telegram_id == body.telegram_id))
    user = result.scalar_one_or_none()
    is_new_user = user is None

    if is_new_user:
        synthetic_email = f"tg_{body.telegram_id}@tg.local"
        user = User(
            email=synthetic_email,
            name=body.first_name,
            password=_hash_code(secrets.token_hex(32)),
            telegram_id=body.telegram_id,
            telegram_username=body.username,
        )
        db.add(user)
        await db.flush()
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        await db.commit()
        await db.refresh(user)
    else:
        if body.first_name and not user.name:
            user.name = body.first_name
        if body.username and not user.telegram_username:
            user.telegram_username = body.username
        await db.commit()

    access = create_access_token({"sub": user.id})
    refresh_tok = create_refresh_token({"sub": user.id})
    _set_token_cookies(response, access, refresh_tok)

    return TelegramAuthResponse(
        access_token=access,
        refresh_token=refresh_tok,
        is_new_user=is_new_user,
        tg_name=body.first_name,
    )


def _validate_telegram_init_data(init_data: str) -> dict | None:
    if not settings.TELEGRAM_BOT_TOKEN:
        return None
    try:
        parsed = parse_qs(init_data)
        hash_value = parsed.get("hash", [None])[0]
        if not hash_value:
            return None

        data_check_parts = []
        for key in sorted(parsed.keys()):
            if key == "hash":
                continue
            data_check_parts.append(f"{key}={parsed[key][0]}")
        data_check_string = "\n".join(data_check_parts)

        secret = hmac.new(b"WebAppData", settings.TELEGRAM_BOT_TOKEN.encode(), hashlib.sha256).digest()
        computed = hmac.new(secret, data_check_string.encode(), hashlib.sha256).hexdigest()

        if not hmac.compare_digest(computed, hash_value):
            return None

        user_json = parsed.get("user", [None])[0]
        if user_json:
            return json.loads(user_json)
        return None
    except Exception:
        return None


@router.post("/telegram", response_model=TelegramAuthResponse)
async def telegram_auth(body: TelegramAuthRequest, response: Response, db: AsyncSession = Depends(get_db)):
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram auth not configured")

    tg_user = _validate_telegram_init_data(body.init_data)
    if not tg_user:
        raise HTTPException(status_code=401, detail="Invalid Telegram signature")

    telegram_id = str(tg_user.get("id", ""))
    if not telegram_id:
        raise HTTPException(status_code=400, detail="Missing Telegram user ID")

    first_name = tg_user.get("first_name", "")
    tg_username = tg_user.get("username")

    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()
    is_new_user = user is None

    if is_new_user:
        synthetic_email = f"tg_{telegram_id}@tg.local"
        user = User(
            email=synthetic_email,
            name=first_name,
            password=_hash_code(secrets.token_hex(32)),
            telegram_id=telegram_id,
            telegram_username=tg_username,
        )
        db.add(user)
        await db.flush()
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        await db.commit()
        await db.refresh(user)
    else:
        if first_name and not user.name:
            user.name = first_name
        if tg_username and not user.telegram_username:
            user.telegram_username = tg_username
        await db.commit()

    access = create_access_token({"sub": user.id})
    refresh_tok = create_refresh_token({"sub": user.id})
    _set_token_cookies(response, access, refresh_tok)

    return TelegramAuthResponse(
        access_token=access,
        refresh_token=refresh_tok,
        is_new_user=is_new_user,
        tg_name=first_name,
    )


@router.post("/link-telegram")
async def link_telegram(
    body: LinkTelegramRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram auth not configured")

    tg_user = _validate_telegram_init_data(body.init_data)
    if not tg_user:
        raise HTTPException(status_code=401, detail="Invalid Telegram signature")

    telegram_id = str(tg_user.get("id", ""))
    if not telegram_id:
        raise HTTPException(status_code=400, detail="Missing Telegram user ID")

    existing_result = await db.execute(select(User).where(User.telegram_id == telegram_id, User.id != user.id))
    tg_only_user = existing_result.scalar_one_or_none()

    if tg_only_user:
        if not tg_only_user.email.endswith("@tg.local"):
            raise HTTPException(status_code=409, detail="Этот Telegram уже привязан к другому аккаунту с email")
        tg_only_user.telegram_id = None
        tg_only_user.is_active = False

    user.telegram_id = telegram_id
    user.telegram_username = tg_user.get("username")
    await db.commit()
    return {"ok": True, "merged": tg_only_user is not None}
