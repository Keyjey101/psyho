"""Billing endpoints: pricing, /me, promo, subscribe, package, cancel,
notify-link, webhook, payment history."""
from __future__ import annotations

import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import (
    Payment,
    PromoCode,
    PromoRedemption,
    SubscriptionEvent,
    User,
)
from app.schemas.billing import (
    CheckoutResponse,
    NotifyLinkResponse,
    PackageRequest,
    PaymentItem,
    PricingResponse,
    PromoCheckRequest,
    PromoCheckResponse,
    SubscribeRequest,
    SubscriptionMe,
)
from app.services import billing, notify, yookassa_client

logger = structlog.get_logger()
router = APIRouter(prefix="/api/billing", tags=["Billing"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _period_for_purpose(purpose: str) -> timedelta:
    return {
        billing.PURPOSE_PRO_MONTH: timedelta(days=30),
        billing.PURPOSE_PRO_3M: timedelta(days=92),
        billing.PURPOSE_PRO_YEAR: timedelta(days=365),
    }.get(purpose, timedelta(days=30))


@router.get("/pricing", response_model=PricingResponse)
async def get_pricing():
    s = get_settings()
    return PricingResponse(
        monetization_enabled=s.MONETIZATION_ENABLED,
        free_lifetime_sessions=s.FREE_LIFETIME_SESSIONS,
        plans={
            "pro_month": {"amount_kopecks": s.PRICING_PRO_MONTH_KOPECKS, "label": "Pro месяц"},
            "pro_3m": {"amount_kopecks": s.PRICING_PRO_3M_KOPECKS, "label": "Pro 3 месяца"},
            "pro_year": {"amount_kopecks": s.PRICING_PRO_YEAR_KOPECKS, "label": "Pro год"},
        },
        packs={
            "pack_5": {"amount_kopecks": s.PRICING_PACK_5_KOPECKS, "label": "5 сессий", "size": s.PACK_5_SIZE},
            "pack_15": {"amount_kopecks": s.PRICING_PACK_15_KOPECKS, "label": "15 сессий", "size": s.PACK_15_SIZE},
        },
    )


@router.get("/me", response_model=SubscriptionMe)
async def get_me(user: User = Depends(get_current_user)):
    quota = billing.get_user_quota(user)
    return SubscriptionMe(
        tier=quota["tier"],
        expires_at=quota["expires_at"],
        autorenew=quota["autorenew"],
        free_sessions_left=quota["free_sessions_left"],
        paid_sessions_left=quota["paid_sessions_left"],
        notify_telegram_linked=quota["notify_telegram_linked"],
    )


@router.post("/promo/check", response_model=PromoCheckResponse)
async def promo_check(
    body: PromoCheckRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    final, promo, err = await billing.apply_promo_code(db, body.code, body.purpose, user)
    if err or promo is None:
        return PromoCheckResponse(valid=False, error=err or "Промокод не найден")
    return PromoCheckResponse(
        valid=True,
        discount_percent=promo.discount_percent,
        final_amount_kopecks=final,
    )


async def _create_payment_for(
    *,
    db: AsyncSession,
    user: User,
    purpose: str,
    promo_code: Optional[str],
    save_payment_method: bool,
) -> CheckoutResponse:
    s = get_settings()
    if not s.MONETIZATION_ENABLED:
        raise HTTPException(status_code=503, detail="Платежи временно отключены")
    if not yookassa_client.is_configured():
        raise HTTPException(status_code=503, detail="Платёжный провайдер не настроен")

    final, promo, err = await billing.apply_promo_code(db, promo_code, purpose, user)
    if err:
        raise HTTPException(status_code=400, detail=err)
    base = billing.amount_for_purpose(purpose)
    discount = base - final

    idem = uuid.uuid4().hex
    payment = Payment(
        user_id=user.id,
        provider_idempotence_key=idem,
        amount_kopecks=final,
        status="pending",
        purpose=purpose,
        promo_code_id=promo.id if promo else None,
        discount_kopecks=discount,
        utm_source=user.utm_source,
        utm_campaign=user.utm_campaign,
        is_recurring=False,
    )
    db.add(payment)
    await db.flush()

    receipt_email = None
    if user.email and "@" in user.email and not user.email.endswith("@tg.local"):
        receipt_email = user.email

    description = {
        billing.PURPOSE_PRO_MONTH: "PsyHo Pro · 1 месяц",
        billing.PURPOSE_PRO_3M: "PsyHo Pro · 3 месяца",
        billing.PURPOSE_PRO_YEAR: "PsyHo Pro · 1 год",
        billing.PURPOSE_PACK_5: "PsyHo · 5 сессий",
        billing.PURPOSE_PACK_15: "PsyHo · 15 сессий",
    }.get(purpose, "PsyHo")

    try:
        resp = await yookassa_client.create_payment(
            amount_kopecks=final,
            description=description,
            idempotence_key=idem,
            return_url=s.YOOKASSA_RETURN_URL,
            metadata={"user_id": user.id, "purpose": purpose, "payment_id": payment.id},
            save_payment_method=save_payment_method,
            receipt_email=receipt_email,
        )
    except Exception as e:
        logger.error("create_payment_failed", error=str(e))
        payment.status = "canceled"
        await db.commit()
        raise HTTPException(status_code=502, detail="Не удалось создать платёж")

    payment.provider_payment_id = resp.get("id")
    confirmation_url = (resp.get("confirmation") or {}).get("confirmation_url", "")
    await db.commit()

    if not confirmation_url:
        raise HTTPException(status_code=502, detail="Платёжный провайдер не вернул ссылку")

    return CheckoutResponse(
        confirmation_url=confirmation_url,
        payment_id=payment.id,
        amount_kopecks=final,
        discount_kopecks=discount,
    )


@router.post("/subscribe", response_model=CheckoutResponse)
async def subscribe(
    body: SubscribeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _create_payment_for(
        db=db, user=user, purpose=body.plan, promo_code=body.promo_code, save_payment_method=True,
    )


@router.post("/package", response_model=CheckoutResponse)
async def buy_package(
    body: PackageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _create_payment_for(
        db=db, user=user, purpose=body.pack, promo_code=body.promo_code, save_payment_method=False,
    )


@router.post("/cancel")
async def cancel_subscription(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.autorenew_enabled and user.subscription_tier != "pro":
        return {"ok": True, "message": "Подписка не активна"}
    user.autorenew_enabled = False
    db.add(SubscriptionEvent(user_id=user.id, event_type="autorenew_cancelled", from_tier="pro", to_tier="pro"))
    await db.commit()
    expires = _normalize(user.subscription_expires_at)
    if expires:
        await notify.notify_user(
            user,
            f"Автопродление отключено. Доступ к Pro сохраняется до {expires:%d.%m.%Y}.",
        )
    return {"ok": True, "expires_at": expires.isoformat() if expires else None}


@router.post("/notify-link/start", response_model=NotifyLinkResponse)
async def start_notify_link(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    s = get_settings()
    if not s.TELEGRAM_BOT_USERNAME:
        raise HTTPException(status_code=503, detail="Telegram-бот не настроен")
    token = secrets.token_urlsafe(24)
    user.notify_link_token = token
    await db.commit()
    return NotifyLinkResponse(
        bot_url=f"https://t.me/{s.TELEGRAM_BOT_USERNAME}?start=link_{token}",
    )


@router.get("/payments", response_model=list[PaymentItem])
async def list_payments(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = await db.execute(
        select(Payment).where(Payment.user_id == user.id).order_by(desc(Payment.created_at)).limit(50)
    )
    return [PaymentItem.model_validate(p) for p in q.scalars().all()]


# ── Webhook ────────────────────────────────────────────────────────────────


@router.post("/webhook")
async def yookassa_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """ЮKassa notification endpoint. Gates on IP allowlist + reverse-verifies
    payment status via API before mutating state."""
    s = get_settings()
    if not s.MONETIZATION_ENABLED:
        return {"ok": True}

    client_ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
                 or (request.client.host if request.client else ""))
    if not yookassa_client.is_trusted_ip(client_ip):
        logger.warning("webhook_untrusted_ip", ip=client_ip)
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Bad JSON")

    event = payload.get("event")
    obj = payload.get("object") or {}
    payment_id = obj.get("id")
    if not payment_id:
        return {"ok": True}

    try:
        verified = await yookassa_client.get_payment(payment_id)
    except Exception as e:
        logger.error("webhook_reverse_verify_failed", payment_id=payment_id, error=str(e))
        raise HTTPException(status_code=502, detail="Verification failed")

    real_status = verified.get("status")
    metadata = verified.get("metadata") or {}
    internal_payment_id = metadata.get("payment_id")

    pay_q = await db.execute(select(Payment).where(Payment.provider_payment_id == payment_id))
    payment = pay_q.scalar_one_or_none()
    if payment is None and internal_payment_id:
        pay_q = await db.execute(select(Payment).where(Payment.id == internal_payment_id))
        payment = pay_q.scalar_one_or_none()
    if payment is None:
        logger.warning("webhook_payment_not_found", payment_id=payment_id)
        return {"ok": True}

    user_q = await db.execute(select(User).where(User.id == payment.user_id))
    user = user_q.scalar_one_or_none()
    if user is None:
        return {"ok": True}

    if real_status == "succeeded" and payment.status != "succeeded":
        await _apply_succeeded_payment(db, user, payment, verified)
    elif real_status == "canceled" and payment.status != "canceled":
        payment.status = "canceled"
        await db.commit()

    return {"ok": True}


async def _apply_succeeded_payment(
    db: AsyncSession,
    user: User,
    payment: Payment,
    verified: dict,
) -> None:
    payment.status = "succeeded"
    payment.completed_at = _utcnow()

    payment_method = verified.get("payment_method") or {}
    if payment_method.get("saved") and payment_method.get("id"):
        user.saved_payment_method_id = payment_method["id"]

    if payment.purpose in billing.PRO_PURPOSES:
        previous_tier = user.subscription_tier
        user.subscription_tier = "pro"
        if not user.subscription_started_at:
            user.subscription_started_at = _utcnow()
        cur = _normalize(user.subscription_expires_at)
        if cur is None or cur < _utcnow():
            cur = _utcnow()
        user.subscription_expires_at = cur + _period_for_purpose(payment.purpose)
        user.autorenew_enabled = bool(user.saved_payment_method_id)
        db.add(SubscriptionEvent(
            user_id=user.id,
            event_type="purchased",
            from_tier=previous_tier,
            to_tier="pro",
            payment_id=payment.id,
        ))
        msg = (
            f"✅ Подписка PsyHo Pro активна. Доступ до "
            f"{user.subscription_expires_at:%d.%m.%Y}."
        )
    elif payment.purpose in billing.PACK_PURPOSES:
        user.sessions_quota_balance = (user.sessions_quota_balance or 0) + billing.pack_size_for_purpose(payment.purpose)
        db.add(SubscriptionEvent(
            user_id=user.id,
            event_type="package_purchased",
            from_tier=user.subscription_tier,
            to_tier=user.subscription_tier,
            payment_id=payment.id,
        ))
        msg = f"✅ Пакет сессий добавлен. Доступно {user.sessions_quota_balance} сессий."
    else:
        msg = "✅ Платёж зачислен."

    if payment.promo_code_id:
        promo_q = await db.execute(select(PromoCode).where(PromoCode.id == payment.promo_code_id))
        promo = promo_q.scalar_one_or_none()
        if promo:
            promo.used_count += 1
            db.add(PromoRedemption(
                promo_code_id=promo.id,
                user_id=user.id,
                payment_id=payment.id,
            ))

    await db.commit()
    await notify.notify_user(user, msg)
