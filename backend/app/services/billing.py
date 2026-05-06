"""Single source of truth for tier checks, quota consumption and promo math.

Most call sites short-circuit when ``settings.MONETIZATION_ENABLED`` is False —
the gate is intentionally loose so the app keeps behaving like the previous
free-for-all build until the operator flips the flag in the environment.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional, Tuple

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.models import PromoCode, PromoRedemption, User

logger = structlog.get_logger()

PURPOSE_PRO_MONTH = "pro_month"
PURPOSE_PRO_3M = "pro_3m"
PURPOSE_PRO_YEAR = "pro_year"
PURPOSE_PACK_5 = "pack_5"
PURPOSE_PACK_15 = "pack_15"
PURPOSE_PRO_RENEWAL = "pro_renewal"

PRO_PURPOSES = {PURPOSE_PRO_MONTH, PURPOSE_PRO_3M, PURPOSE_PRO_YEAR, PURPOSE_PRO_RENEWAL}
PACK_PURPOSES = {PURPOSE_PACK_5, PURPOSE_PACK_15}

QuotaSource = Literal["free_lifetime", "pro", "package"]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def is_pro(user: User) -> bool:
    if user.subscription_tier != "pro":
        return False
    expires = _normalize(user.subscription_expires_at)
    return bool(expires and expires > _utcnow())


def has_active_subscription(user: User) -> bool:
    return is_pro(user)


def amount_for_purpose(purpose: str) -> int:
    s = get_settings()
    return {
        PURPOSE_PRO_MONTH: s.PRICING_PRO_MONTH_KOPECKS,
        PURPOSE_PRO_3M: s.PRICING_PRO_3M_KOPECKS,
        PURPOSE_PRO_YEAR: s.PRICING_PRO_YEAR_KOPECKS,
        PURPOSE_PACK_5: s.PRICING_PACK_5_KOPECKS,
        PURPOSE_PACK_15: s.PRICING_PACK_15_KOPECKS,
        PURPOSE_PRO_RENEWAL: s.PRICING_PRO_MONTH_KOPECKS,
    }.get(purpose, 0)


def pack_size_for_purpose(purpose: str) -> int:
    s = get_settings()
    if purpose == PURPOSE_PACK_5:
        return s.PACK_5_SIZE
    if purpose == PURPOSE_PACK_15:
        return s.PACK_15_SIZE
    return 0


def get_user_quota(user: User) -> dict:
    """Snapshot of what the user can do right now.

    Always safe to call regardless of ``MONETIZATION_ENABLED``.
    """
    s = get_settings()
    free_left = max(0, s.FREE_LIFETIME_SESSIONS - (user.lifetime_free_sessions_used or 0))
    return {
        "tier": "pro" if is_pro(user) else "free",
        "expires_at": _normalize(user.subscription_expires_at),
        "autorenew": bool(user.autorenew_enabled),
        "free_sessions_left": free_left,
        "paid_sessions_left": user.sessions_quota_balance or 0,
        "notify_telegram_linked": bool(user.notify_telegram_id or user.telegram_id),
    }


def can_create_session(user: User) -> Tuple[bool, Optional[QuotaSource]]:
    """Pure check, no side-effects."""
    s = get_settings()
    if not s.MONETIZATION_ENABLED:
        return True, "free_lifetime"
    if is_pro(user):
        return True, "pro"
    if (user.sessions_quota_balance or 0) > 0:
        return True, "package"
    if (user.lifetime_free_sessions_used or 0) < s.FREE_LIFETIME_SESSIONS:
        return True, "free_lifetime"
    return False, None


def consume_session_quota(user: User) -> Optional[QuotaSource]:
    """Mutates ``user`` in place; caller commits."""
    s = get_settings()
    if not s.MONETIZATION_ENABLED:
        return "free_lifetime"
    if is_pro(user):
        return "pro"
    if (user.sessions_quota_balance or 0) > 0:
        user.sessions_quota_balance = (user.sessions_quota_balance or 0) - 1
        return "package"
    if (user.lifetime_free_sessions_used or 0) < s.FREE_LIFETIME_SESSIONS:
        user.lifetime_free_sessions_used = (user.lifetime_free_sessions_used or 0) + 1
        return "free_lifetime"
    return None


def ws_rate_limit_per_minute(user: User) -> int:
    s = get_settings()
    if not s.MONETIZATION_ENABLED:
        return s.WS_RATE_LIMIT_PRO  # generous default in dev
    if is_pro(user):
        return s.WS_RATE_LIMIT_PRO
    if (user.sessions_quota_balance or 0) > 0:
        return s.WS_RATE_LIMIT_PACKAGE
    return s.WS_RATE_LIMIT_FREE


def memory_enabled_for(user: User) -> bool:
    """Pro keeps long-term memory across sessions; free / package — no."""
    s = get_settings()
    if not s.MONETIZATION_ENABLED:
        return True
    return is_pro(user)


def continuation_enabled_for(user: User) -> bool:
    s = get_settings()
    if not s.MONETIZATION_ENABLED:
        return True
    return is_pro(user)


async def apply_promo_code(
    db: AsyncSession,
    code: Optional[str],
    purpose: str,
    user: User,
) -> Tuple[int, Optional[PromoCode], Optional[str]]:
    """Returns (final_amount_kopecks, promo_or_none, error_or_none).

    Errors are returned as user-facing strings (Russian).
    """
    base = amount_for_purpose(purpose)
    if not code:
        return base, None, None

    code_norm = code.strip().upper()
    if not code_norm:
        return base, None, None

    result = await db.execute(select(PromoCode).where(PromoCode.code == code_norm))
    promo = result.scalar_one_or_none()
    if not promo or not promo.active:
        return base, None, "Промокод не найден"

    valid_until = _normalize(promo.valid_until)
    if valid_until and valid_until < _utcnow():
        return base, None, "Срок действия промокода истёк"

    if promo.max_uses is not None and promo.used_count >= promo.max_uses:
        return base, None, "Промокод больше не действует"

    if promo.applies_to != "all":
        if promo.applies_to == "pack" and purpose not in PACK_PURPOSES:
            return base, None, "Промокод действует только для пакетов"
        if promo.applies_to in PRO_PURPOSES and promo.applies_to != purpose:
            return base, None, "Промокод не подходит для выбранного тарифа"

    used_q = await db.execute(
        select(PromoRedemption).where(
            PromoRedemption.promo_code_id == promo.id,
            PromoRedemption.user_id == user.id,
        )
    )
    if used_q.scalar_one_or_none():
        return base, None, "Промокод уже использован вами"

    discount = base * promo.discount_percent // 100
    final = max(0, base - discount)
    return final, promo, None
