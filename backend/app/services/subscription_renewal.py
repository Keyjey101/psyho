"""APScheduler-driven jobs for subscription lifecycle.

Two jobs run hourly:
    * ``renew_due_subscriptions`` — recurring charges for users whose
      ``subscription_expires_at`` is within the lookahead window and who
      enabled autorenew.
    * ``expire_subscriptions`` — flips users whose ``expires_at`` has passed
      back to ``free`` (or marks them deactivated after the grace period).

Both are idempotent and tolerate missed ticks. They no-op when
``MONETIZATION_ENABLED`` is False.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session
from app.models.models import Payment, SubscriptionEvent, User
from app.services import billing, notify, yookassa_client

logger = structlog.get_logger()

_scheduler: Optional[AsyncIOScheduler] = None


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
        billing.PURPOSE_PRO_RENEWAL: timedelta(days=30),
    }.get(purpose, timedelta(days=30))


async def _last_pro_purchase(db: AsyncSession, user_id: str) -> Optional[Payment]:
    q = await db.execute(
        select(Payment)
        .where(
            Payment.user_id == user_id,
            Payment.status == "succeeded",
            Payment.purpose.in_(list(billing.PRO_PURPOSES)),
        )
        .order_by(Payment.completed_at.desc())
        .limit(1)
    )
    return q.scalar_one_or_none()


async def renew_due_subscriptions() -> None:
    s = get_settings()
    if not s.MONETIZATION_ENABLED or not yookassa_client.is_configured():
        return
    horizon = _utcnow() + timedelta(hours=s.SUBSCRIPTION_RENEW_LOOKAHEAD_HOURS)
    async with async_session() as db:
        q = await db.execute(
            select(User).where(
                User.autorenew_enabled == True,  # noqa: E712
                User.subscription_tier == "pro",
                User.subscription_expires_at.isnot(None),
                User.subscription_expires_at <= horizon,
                User.saved_payment_method_id.isnot(None),
            )
        )
        users = q.scalars().all()
        for user in users:
            await _try_renew_user(db, user)


async def _try_renew_user(db: AsyncSession, user: User) -> None:
    s = get_settings()
    last_pro = await _last_pro_purchase(db, user.id)
    purpose = last_pro.purpose if last_pro else billing.PURPOSE_PRO_MONTH
    amount = billing.amount_for_purpose(purpose)
    idem = f"renew-{user.id}-{int(_utcnow().timestamp() // 3600)}"

    payment = Payment(
        user_id=user.id,
        provider_idempotence_key=idem,
        amount_kopecks=amount,
        status="pending",
        purpose=billing.PURPOSE_PRO_RENEWAL,
        is_recurring=True,
    )
    db.add(payment)
    await db.flush()

    try:
        resp = await yookassa_client.charge_recurring(
            payment_method_id=user.saved_payment_method_id,
            amount_kopecks=amount,
            description=f"Продление Ника Pro для {user.email}",
            idempotence_key=idem,
            metadata={"user_id": user.id, "purpose": billing.PURPOSE_PRO_RENEWAL},
        )
    except Exception as e:
        logger.warning("renewal_charge_failed", user_id=user.id, error=str(e))
        payment.status = "canceled"
        await db.commit()
        await notify.notify_user(
            user,
            "⚠️ Не удалось продлить подписку — попробуем ещё раз через сутки. Если карта изменилась, "
            "обнови способ оплаты в личном кабинете.",
            manage_url=s.YOOKASSA_RETURN_URL,
        )
        return

    payment.provider_payment_id = resp.get("id")
    if resp.get("status") == "succeeded":
        payment.status = "succeeded"
        payment.completed_at = _utcnow()
        cur = _normalize(user.subscription_expires_at) or _utcnow()
        if cur < _utcnow():
            cur = _utcnow()
        user.subscription_expires_at = cur + _period_for_purpose(purpose)
        db.add(SubscriptionEvent(user_id=user.id, event_type="renewed", from_tier="pro", to_tier="pro", payment_id=payment.id))
        await db.commit()
        await notify.notify_user(
            user,
            f"✅ Подписка продлена. Доступ до {user.subscription_expires_at:%d.%m.%Y}.",
        )
    else:
        payment.status = "pending"
        await db.commit()


async def expire_subscriptions() -> None:
    s = get_settings()
    if not s.MONETIZATION_ENABLED:
        return
    grace_cutoff = _utcnow() - timedelta(days=s.SUBSCRIPTION_GRACE_DAYS)
    async with async_session() as db:
        q = await db.execute(
            select(User).where(
                User.subscription_tier == "pro",
                User.subscription_expires_at.isnot(None),
                User.subscription_expires_at < grace_cutoff,
            )
        )
        users = q.scalars().all()
        for user in users:
            user.subscription_tier = "free"
            user.autorenew_enabled = False
            db.add(SubscriptionEvent(user_id=user.id, event_type="downgraded", from_tier="pro", to_tier="free"))
            await db.commit()
            await notify.notify_user(
                user,
                "Подписка Ника Pro закончилась. Возвращайся, когда будешь готов(а) — мы рядом.",
                manage_url=s.YOOKASSA_RETURN_URL,
            )


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(renew_due_subscriptions, "interval", hours=1, id="renew_due", coalesce=True, max_instances=1)
    _scheduler.add_job(expire_subscriptions, "interval", hours=1, id="expire_subs", coalesce=True, max_instances=1)
    _scheduler.start()
    logger.info("subscription_scheduler_started")
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    _scheduler.shutdown(wait=False)
    _scheduler = None
    logger.info("subscription_scheduler_stopped")


def issue_link_token() -> str:
    return secrets.token_urlsafe(24)
