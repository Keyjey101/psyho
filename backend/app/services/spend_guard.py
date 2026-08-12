"""Hard limits on LLM spend — the thing that must exist before the first ad rouble.

Two independent ceilings, neither of which is a credit balance:

* **Per user, per UTC day** — ``DAILY_USER_TOKEN_LIMIT`` total tokens. A single
  abusive or looping account cannot drain the budget.
* **Globally, per UTC day** — ``DAILY_GLOBAL_SPEND_LIMIT_USD``. On reaching it,
  *registration of new users stops* (existing users keep their sessions), and the
  admin gets a Telegram message. 50% / 80% / 100% each notify exactly once per day.

Both are enforced independently of credits, so a bug in quota logic still can't
produce an unbounded bill.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session
from app.models.analytics_models import DailySpend, UserDailyUsage

logger = structlog.get_logger()

# Price per 1k tokens (USD) for the GLM models this project calls. Keep in sync
# with the provider's pricing page — these drive the only spend ceiling we have.
PRICE_PER_1K_INPUT: float = 0.0005
PRICE_PER_1K_OUTPUT: float = 0.0015

ALERT_THRESHOLDS: tuple[int, ...] = (50, 80, 100)


def today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def compute_cost_usd(prompt_tokens: int, completion_tokens: int) -> float:
    return (prompt_tokens / 1000) * PRICE_PER_1K_INPUT + (
        completion_tokens / 1000
    ) * PRICE_PER_1K_OUTPUT


async def _get_or_create_day(db: AsyncSession, day: str) -> DailySpend:
    result = await db.execute(select(DailySpend).where(DailySpend.day == day))
    row = result.scalar_one_or_none()
    if row is None:
        row = DailySpend(day=day)
        db.add(row)
        await db.flush()
    return row


async def record_usage(
    user_id: Optional[str],
    prompt_tokens: int,
    completion_tokens: int,
) -> None:
    """Book token usage against today's global and per-user counters.

    Best-effort and fire-and-forget safe: a failure here must not break a reply
    that has already been streamed to the user.
    """
    if prompt_tokens <= 0 and completion_tokens <= 0:
        return

    cost = compute_cost_usd(prompt_tokens, completion_tokens)
    day = today_key()
    crossed: Optional[int] = None
    spent = 0.0
    limit = get_settings().DAILY_GLOBAL_SPEND_LIMIT_USD

    try:
        async with async_session() as db:
            global_row = await _get_or_create_day(db, day)
            global_row.cost_usd = (global_row.cost_usd or 0.0) + cost
            global_row.prompt_tokens = (global_row.prompt_tokens or 0) + prompt_tokens
            global_row.completion_tokens = (global_row.completion_tokens or 0) + completion_tokens
            global_row.calls = (global_row.calls or 0) + 1
            spent = global_row.cost_usd

            if user_id:
                user_q = await db.execute(
                    select(UserDailyUsage).where(
                        UserDailyUsage.user_id == user_id, UserDailyUsage.day == day
                    )
                )
                user_row = user_q.scalar_one_or_none()
                if user_row is None:
                    user_row = UserDailyUsage(user_id=user_id, day=day)
                    db.add(user_row)
                user_row.total_tokens = (user_row.total_tokens or 0) + prompt_tokens + completion_tokens
                user_row.cost_usd = (user_row.cost_usd or 0.0) + cost

            # Decide the alert inside the same transaction that moved the total,
            # so two concurrent requests can't both claim the same threshold.
            if limit > 0:
                pct = 100 * spent / limit
                already = global_row.alert_level_sent or 0
                for threshold in ALERT_THRESHOLDS:
                    if pct >= threshold > already:
                        crossed = threshold
                if crossed:
                    global_row.alert_level_sent = crossed

            await db.commit()
    except Exception as e:
        logger.warning("spend_record_failed", error=str(e))
        return

    if crossed:
        await _alert_admin(crossed, spent, limit, day)


async def _alert_admin(threshold: int, spent: float, limit: float, day: str) -> None:
    from app.services import events, notify

    if threshold >= 100:
        headline = "🛑 <b>Дневной лимит расходов на LLM исчерпан</b>"
        tail = "Приём новых пользователей автоматически остановлен до следующих суток UTC."
    elif threshold >= 80:
        headline = "⚠️ <b>80% дневного лимита расходов на LLM</b>"
        tail = "При 100% приём новых пользователей остановится автоматически."
    else:
        headline = "📊 <b>50% дневного лимита расходов на LLM</b>"
        tail = "Пока в пределах нормы."

    text = (
        f"{headline}\n\n"
        f"Потрачено сегодня: <b>${spent:.2f}</b> из ${limit:.2f}\n"
        f"Дата (UTC): {day}\n\n{tail}"
    )

    settings = get_settings()
    chat_ids = settings.admin_alert_chat_ids
    if not chat_ids:
        logger.warning("spend_alert_no_admin_chat", threshold=threshold, spent=round(spent, 2))
    for chat_id in chat_ids:
        await notify.send_to_chat(chat_id, text)

    logger.warning("spend_alert_sent", threshold=threshold, spent=round(spent, 4), limit=limit)
    if threshold >= 100:
        await events.log_event(
            events.EVENT_SPEND_LIMIT_HIT,
            payload={"day": day, "limit_usd": round(limit, 2), "spent_usd": round(spent, 2)},
        )


async def get_today_spend(db: Optional[AsyncSession] = None) -> float:
    async def _read(session: AsyncSession) -> float:
        result = await session.execute(select(DailySpend).where(DailySpend.day == today_key()))
        row = result.scalar_one_or_none()
        return float(row.cost_usd) if row else 0.0

    if db is not None:
        return await _read(db)
    async with async_session() as own:
        return await _read(own)


async def is_global_limit_reached() -> bool:
    """True when today's spend has hit the ceiling — blocks *new* signups only."""
    limit = get_settings().DAILY_GLOBAL_SPEND_LIMIT_USD
    if limit <= 0:
        return False
    return await get_today_spend() >= limit


async def new_users_blocked() -> bool:
    settings = get_settings()
    if not settings.SPEND_GUARD_ENABLED:
        return False
    return await is_global_limit_reached()


async def user_daily_tokens(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(
        select(UserDailyUsage.total_tokens).where(
            UserDailyUsage.user_id == user_id, UserDailyUsage.day == today_key()
        )
    )
    return int(result.scalar_one_or_none() or 0)


async def check_user_allowance(user_id: str) -> tuple[bool, int, int]:
    """(allowed, used_tokens, limit) for today. Limit <= 0 disables the check."""
    settings = get_settings()
    limit = settings.DAILY_USER_TOKEN_LIMIT
    if not settings.SPEND_GUARD_ENABLED or limit <= 0:
        return True, 0, limit
    async with async_session() as db:
        used = await user_daily_tokens(db, user_id)
    return used < limit, used, limit


async def spend_summary() -> dict:
    """Today + current month totals for the admin dashboard."""
    from sqlalchemy import func

    settings = get_settings()
    day = today_key()
    month_prefix = day[:7]

    async with async_session() as db:
        today_q = await db.execute(select(DailySpend).where(DailySpend.day == day))
        today_row = today_q.scalar_one_or_none()

        month_q = await db.execute(
            select(
                func.sum(DailySpend.cost_usd),
                func.sum(DailySpend.prompt_tokens),
                func.sum(DailySpend.completion_tokens),
                func.sum(DailySpend.calls),
            ).where(DailySpend.day.like(f"{month_prefix}%"))
        )
        m_cost, m_prompt, m_completion, m_calls = month_q.one()

        recent_q = await db.execute(
            select(DailySpend).order_by(DailySpend.day.desc()).limit(30)
        )
        recent = list(recent_q.scalars().all())

    limit = settings.DAILY_GLOBAL_SPEND_LIMIT_USD
    today_cost = float(today_row.cost_usd) if today_row else 0.0

    return {
        "enabled": settings.SPEND_GUARD_ENABLED,
        "day": day,
        "today_usd": round(today_cost, 4),
        "today_tokens": int((today_row.prompt_tokens or 0) + (today_row.completion_tokens or 0)) if today_row else 0,
        "today_calls": int(today_row.calls or 0) if today_row else 0,
        "daily_limit_usd": limit,
        "daily_pct": round(100 * today_cost / limit, 1) if limit > 0 else 0.0,
        "new_users_blocked": bool(settings.SPEND_GUARD_ENABLED and limit > 0 and today_cost >= limit),
        "month": month_prefix,
        "month_usd": round(float(m_cost or 0.0), 4),
        "month_tokens": int((m_prompt or 0) + (m_completion or 0)),
        "month_calls": int(m_calls or 0),
        "user_daily_token_limit": settings.DAILY_USER_TOKEN_LIMIT,
        "history": [
            {
                "day": r.day,
                "usd": round(float(r.cost_usd or 0.0), 4),
                "tokens": int((r.prompt_tokens or 0) + (r.completion_tokens or 0)),
                "calls": int(r.calls or 0),
            }
            for r in recent
        ],
    }
