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
from app.models.models import EmailVerificationCode, User, UserProfile, TelegramVerificationCode
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RefreshRequest,
    SendCodeRequest,
    SendCodeResponse,
    TokenResponse,
    VerifyCodeRequest,
    VerifyCodeResponse,
    TelegramAuthRequest,
    TelegramAuthResponse,
    LinkTelegramRequest,
    LinkEmailSendRequest,
    LinkEmailVerifyRequest,
    TgRequestCodeRequest,
    TgRequestCodeResponse,
    TgCheckResponse,
)
from app.services.auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
)
from app.services.email_service import send_otp_email
from app.middleware.auth import get_current_user

router = APIRouter()
logger = structlog.get_logger()
settings = get_settings()

COOKIE_ACCESS_MAX_AGE = 15 * 60
COOKIE_REFRESH_MAX_AGE = 30 * 24 * 60 * 60

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _set_token_cookies(response: Response, access: str, refresh: str):
    response.set_cookie(
        "access_token",
        access,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=COOKIE_ACCESS_MAX_AGE,
        path="/",
    )
    response.set_cookie(
        "refresh_token",
        refresh,
        httponly=True,
        secure=True,
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


@router.post("/send-code", response_model=SendCodeResponse)
async def send_code(body: SendCodeRequest, request: Request, db: AsyncSession = Depends(get_db)):
    email = body.email.lower().strip()

    user_result = await db.execute(select(User).where(User.email == email))
    existing_user = user_result.scalar_one_or_none()

    # In test mode, skip OTP generation entirely — TEST_PASSWORD_CODE is the code
    if settings.TEST_PASSWORD_CODE:
        return SendCodeResponse(user_exists=existing_user is not None)

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=settings.OTP_RATE_LIMIT_MINUTES)

    rate_result = await db.execute(
        select(EmailVerificationCode).where(
            EmailVerificationCode.email == email,
            EmailVerificationCode.created_at >= window_start,
        )
    )
    recent_codes = rate_result.scalars().all()
    if len(recent_codes) >= settings.OTP_RATE_LIMIT_COUNT:
        raise HTTPException(
            status_code=429,
            detail=f"Слишком много попыток. Попробуй через {settings.OTP_RATE_LIMIT_MINUTES} минут."
        )

    await db.execute(
        delete(EmailVerificationCode).where(
            EmailVerificationCode.email == email,
            EmailVerificationCode.used == True,  # noqa: E712
        )
    )

    code = _generate_otp()
    code_record = EmailVerificationCode(
        email=email,
        code_hash=_hash_code(code),
        expires_at=now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
    )
    db.add(code_record)
    await db.commit()

    sent = await send_otp_email(email, code)
    if not sent:
        raise HTTPException(status_code=503, detail="Не удалось отправить письмо. Попробуй позже.")

    return SendCodeResponse(user_exists=existing_user is not None)


@router.post("/verify-code", response_model=VerifyCodeResponse)
async def verify_code(body: VerifyCodeRequest, response: Response, db: AsyncSession = Depends(get_db)):
    email = body.email.lower().strip()

    logger.info("verify-code attempt", email=email, code=body.code, test_code_set=bool(settings.TEST_PASSWORD_CODE), test_code=settings.TEST_PASSWORD_CODE)

    if settings.TEST_PASSWORD_CODE and body.code == settings.TEST_PASSWORD_CODE:
        user_result = await db.execute(select(User).where(User.email == email))
        user = user_result.scalar_one_or_none()
        is_new_user = user is None
        if is_new_user:
            user = User(email=email, name="", password=_hash_code(secrets.token_hex(32)))
            db.add(user)
            await db.flush()
            profile = UserProfile(user_id=user.id)
            db.add(profile)
            await db.commit()
            await db.refresh(user)
        access = create_access_token({"sub": user.id})
        refresh = create_refresh_token({"sub": user.id})
        _set_token_cookies(response, access, refresh)
        return VerifyCodeResponse(access_token=access, refresh_token=refresh, is_new_user=is_new_user)

    now = datetime.now(timezone.utc)

    codes_result = await db.execute(
        select(EmailVerificationCode).where(
            EmailVerificationCode.email == email,
            EmailVerificationCode.used == False,  # noqa: E712
            EmailVerificationCode.expires_at > now,
        ).order_by(EmailVerificationCode.created_at.desc())
    )
    code_record = codes_result.scalars().first()

    if not code_record:
        raise HTTPException(status_code=400, detail="Код недействителен или истёк. Запроси новый.")

    if code_record.attempts >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail="Превышено число попыток. Запроси новый код.")

    if not _verify_code(body.code, code_record.code_hash):
        code_record.attempts += 1
        await db.commit()
        remaining = settings.OTP_MAX_ATTEMPTS - code_record.attempts
        raise HTTPException(
            status_code=400,
            detail=f"Неверный код. Осталось попыток: {remaining}."
        )

    code_record.used = True
    await db.commit()

    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()
    is_new_user = user is None

    if is_new_user:
        # password field has NOT NULL DB constraint (legacy); store a random token
        # that can never be used to log in via password auth
        user = User(email=email, name="", password=_hash_code(secrets.token_hex(32)))
        db.add(user)
        await db.flush()
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        await db.commit()
        await db.refresh(user)

    access = create_access_token({"sub": user.id})
    refresh = create_refresh_token({"sub": user.id})
    _set_token_cookies(response, access, refresh)

    return VerifyCodeResponse(
        access_token=access,
        refresh_token=refresh,
        is_new_user=is_new_user,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email,
        password=hash_password(body.password),
        name=body.name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access = create_access_token({"sub": user.id})
    refresh = create_refresh_token({"sub": user.id})
    _set_token_cookies(response, access, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access = create_access_token({"sub": user.id})
    refresh = create_refresh_token({"sub": user.id})
    _set_token_cookies(response, access, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh)


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
        expires_at=now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return TgRequestCodeResponse(
        request_id=record.id,
        code=code,
        bot_username=settings.TELEGRAM_BOT_USERNAME,
        expires_in=settings.OTP_EXPIRE_MINUTES * 60,
    )


@router.get("/tg/check/{request_id}", response_model=TgCheckResponse)
async def tg_check(request_id: str, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TelegramVerificationCode).where(TelegramVerificationCode.id == request_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Запрос не найден")

    now = datetime.utcnow()

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
    refresh = create_refresh_token({"sub": user.id})
    _set_token_cookies(response, access, refresh)

    return TgCheckResponse(
        status="verified",
        access_token=access,
        refresh_token=refresh,
        is_new_user=is_new_user,
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
    refresh = create_refresh_token({"sub": user.id})
    _set_token_cookies(response, access, refresh)

    return TelegramAuthResponse(
        access_token=access,
        refresh_token=refresh,
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


@router.post("/link-email/send")
async def link_email_send(
    body: LinkEmailSendRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    email = body.email.lower().strip()

    if settings.TEST_PASSWORD_CODE:
        return {"ok": True}

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=settings.OTP_RATE_LIMIT_MINUTES)
    rate_result = await db.execute(
        select(EmailVerificationCode).where(
            EmailVerificationCode.email == email,
            EmailVerificationCode.created_at >= window_start,
        )
    )
    recent_codes = rate_result.scalars().all()
    if len(recent_codes) >= settings.OTP_RATE_LIMIT_COUNT:
        raise HTTPException(status_code=429, detail=f"Слишком много попыток. Попробуй через {settings.OTP_RATE_LIMIT_MINUTES} минут.")

    await db.execute(
        delete(EmailVerificationCode).where(
            EmailVerificationCode.email == email,
            EmailVerificationCode.used == True,  # noqa: E712
        )
    )

    code = _generate_otp()
    code_record = EmailVerificationCode(
        email=email,
        code_hash=_hash_code(code),
        expires_at=now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
    )
    db.add(code_record)
    await db.commit()

    sent = await send_otp_email(email, code)
    if not sent:
        raise HTTPException(status_code=503, detail="Не удалось отправить письмо.")
    return {"ok": True}


@router.post("/link-email/verify")
async def link_email_verify(
    body: LinkEmailVerifyRequest,
    response: Response,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    email = body.email.lower().strip()

    existing_result = await db.execute(select(User).where(User.email == email, User.id != user.id))
    existing_owner = existing_result.scalar_one_or_none()

    if settings.TEST_PASSWORD_CODE and body.code == settings.TEST_PASSWORD_CODE:
        if existing_owner:
            return await _merge_tg_into_email_user(user, existing_owner, response, db)
        user.email = email
        await db.commit()
        return {"ok": True, "merged": False}

    now = datetime.now(timezone.utc)
    codes_result = await db.execute(
        select(EmailVerificationCode).where(
            EmailVerificationCode.email == email,
            EmailVerificationCode.used == False,  # noqa: E712
            EmailVerificationCode.expires_at > now,
        ).order_by(EmailVerificationCode.created_at.desc())
    )
    code_record = codes_result.scalars().first()

    if not code_record:
        raise HTTPException(status_code=400, detail="Код недействителен или истёк.")

    if code_record.attempts >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail="Превышено число попыток.")

    if not _verify_code(body.code, code_record.code_hash):
        code_record.attempts += 1
        await db.commit()
        raise HTTPException(status_code=400, detail="Неверный код.")

    code_record.used = True

    if existing_owner:
        return await _merge_tg_into_email_user(user, existing_owner, response, db)

    user.email = email
    await db.commit()
    return {"ok": True, "merged": False}


async def _merge_tg_into_email_user(tg_user: User, email_user: User, response: Response, db: AsyncSession):
    """Transfer TG identity to the existing email account and invalidate the TG-only account."""
    email_user.telegram_id = tg_user.telegram_id
    email_user.telegram_username = tg_user.telegram_username
    tg_user.is_active = False
    await db.commit()

    access = create_access_token({"sub": email_user.id})
    refresh = create_refresh_token({"sub": email_user.id})
    _set_token_cookies(response, access, refresh)
    return {"ok": True, "merged": True, "access_token": access, "refresh_token": refresh}
