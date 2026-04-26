import random
import secrets
import string
from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from passlib.context import CryptContext
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.models import EmailVerificationCode, User, UserProfile
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RefreshRequest,
    SendCodeRequest,
    SendCodeResponse,
    TokenResponse,
    VerifyCodeRequest,
    VerifyCodeResponse,
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
