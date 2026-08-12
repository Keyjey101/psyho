"""Append-only event logging.

Hard rule enforced here rather than at call sites: **no user message text ever
reaches the events table**. ``log_event`` runs every payload through a whitelist
of metadata keys, so a careless caller passing ``{"text": ...}`` drops it instead
of persisting it. See ``_SAFE_PAYLOAD_KEYS``.

Logging is best-effort: analytics must never break the product. Every failure is
swallowed and logged.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.analytics_models import Event
from app.models.models import User

logger = structlog.get_logger()


# ── Acquisition ───────────────────────────────────────────────────────────
EVENT_LANDING_VIEW = "landing_view"
EVENT_BOT_START = "bot_start"
EVENT_REPEAT_START = "repeat_start"

# ── Tests ─────────────────────────────────────────────────────────────────
EVENT_TEST_STARTED = "test_started"
EVENT_TEST_COMPLETED = "test_completed"
EVENT_TEST_RESULT_VIEWED = "test_result_viewed"
EVENT_TEST_SHARED = "test_shared"

# ── Activation ────────────────────────────────────────────────────────────
EVENT_FIRST_MESSAGE = "first_message"
EVENT_MESSAGE_3 = "message_3"
EVENT_SESSION_COMPLETED = "session_completed"

# ── Monetization (fake door) ──────────────────────────────────────────────
EVENT_CREDITS_EXHAUSTED = "credits_exhausted"
EVENT_PAYWALL_VIEWED = "paywall_viewed"
EVENT_PAYWALL_CLICKED = "paywall_clicked"
EVENT_EMAIL_SUBMITTED = "email_submitted"

# ── Safety ────────────────────────────────────────────────────────────────
EVENT_CRISIS_DETECTED = "crisis_detected"
EVENT_CRISIS_RESOURCES_SHOWN = "crisis_resources_shown"

# ── Ops ───────────────────────────────────────────────────────────────────
EVENT_SPEND_LIMIT_HIT = "spend_limit_hit"
EVENT_USER_LIMIT_HIT = "user_token_limit_hit"

KNOWN_EVENT_TYPES: frozenset[str] = frozenset({
    EVENT_LANDING_VIEW, EVENT_BOT_START, EVENT_REPEAT_START,
    EVENT_TEST_STARTED, EVENT_TEST_COMPLETED, EVENT_TEST_RESULT_VIEWED, EVENT_TEST_SHARED,
    EVENT_FIRST_MESSAGE, EVENT_MESSAGE_3, EVENT_SESSION_COMPLETED,
    EVENT_CREDITS_EXHAUSTED, EVENT_PAYWALL_VIEWED, EVENT_PAYWALL_CLICKED, EVENT_EMAIL_SUBMITTED,
    EVENT_CRISIS_DETECTED, EVENT_CRISIS_RESOURCES_SHOWN,
    EVENT_SPEND_LIMIT_HIT, EVENT_USER_LIMIT_HIT,
})

# Event types a browser is allowed to POST to /api/track. Anything server-side
# (activation, crisis, spend) is refused so the numbers can't be forged.
CLIENT_TRACKABLE: frozenset[str] = frozenset({
    EVENT_LANDING_VIEW,
    EVENT_TEST_STARTED, EVENT_TEST_COMPLETED, EVENT_TEST_RESULT_VIEWED, EVENT_TEST_SHARED,
    EVENT_PAYWALL_VIEWED, EVENT_PAYWALL_CLICKED,
})

# Whitelist, not a blacklist: unknown keys are dropped, so free-text can never
# sneak in via a new call site. Values are additionally clamped below.
_SAFE_PAYLOAD_KEYS: frozenset[str] = frozenset({
    "test_slug", "test_id", "score_band", "severity", "question_count",
    "message_length", "message_index", "exchange_count", "max_exchanges",
    "session_id", "duration_ms", "path", "source", "reason", "tier",
    "free_sessions_left", "paid_sessions_left", "plan", "price_rub",
    "contact_type", "agents_count", "share_target", "day", "limit_usd",
    "spent_usd", "pct", "tokens", "is_severe", "referrer_host", "variant",
})

_MAX_STR = 128


def sanitize_payload(payload: Optional[dict[str, Any]]) -> Optional[str]:
    """Whitelist-filter a payload down to safe metadata and JSON-encode it.

    Strings are truncated to 128 chars, which is far below anything that could
    hold a meaningful excerpt of a user message even if a key were mis-whitelisted.
    """
    if not payload:
        return None
    clean: dict[str, Any] = {}
    for key, value in payload.items():
        if key not in _SAFE_PAYLOAD_KEYS:
            continue
        if isinstance(value, bool) or isinstance(value, int) or isinstance(value, float):
            clean[key] = value
        elif isinstance(value, str):
            clean[key] = value[:_MAX_STR]
        elif value is None:
            continue
        # lists/dicts are intentionally unsupported — they are the easiest way
        # for free-text to leak in.
    if not clean:
        return None
    try:
        return json.dumps(clean, ensure_ascii=False)
    except (TypeError, ValueError):
        return None


async def log_event(
    event_type: str,
    *,
    user_id: Optional[str] = None,
    anon_id: Optional[str] = None,
    campaign_code: Optional[str] = None,
    payload: Optional[dict[str, Any]] = None,
    db: Optional[AsyncSession] = None,
) -> None:
    """Append one event. Never raises — analytics must not break the product.

    Pass ``db`` to join an existing transaction; otherwise a short-lived session
    is opened and committed independently.
    """
    if event_type not in KNOWN_EVENT_TYPES:
        logger.warning("event_unknown_type", event_type=event_type)
        return

    row = Event(
        user_id=user_id,
        anon_id=(anon_id or None) and str(anon_id)[:64],
        event_type=event_type,
        campaign_code=(campaign_code or None) and str(campaign_code)[:32],
        payload_json=sanitize_payload(payload),
    )

    try:
        if db is not None:
            db.add(row)
            await db.flush()
            return
        async with async_session() as own_db:
            own_db.add(row)
            await own_db.commit()
    except Exception as e:  # pragma: no cover — defensive
        logger.warning("event_log_failed", event_type=event_type, error=str(e))


async def log_event_for_user(
    user_id: str,
    event_type: str,
    *,
    payload: Optional[dict[str, Any]] = None,
    campaign_code: Optional[str] = None,
) -> None:
    """Log an event, resolving the user's first-touch campaign when not given.

    Opens its own session — safe to fire from ``asyncio.create_task``.
    """
    code = campaign_code
    try:
        if code is None:
            async with async_session() as db:
                result = await db.execute(select(User.campaign_code).where(User.id == user_id))
                code = result.scalar_one_or_none()
    except Exception:
        code = None
    await log_event(event_type, user_id=user_id, campaign_code=code, payload=payload)


async def has_event(db: AsyncSession, user_id: str, event_type: str) -> bool:
    """True if this user already has an event of this type (dedupe helper)."""
    result = await db.execute(
        select(Event.id).where(Event.user_id == user_id, Event.event_type == event_type).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def count_events_since(
    db: AsyncSession, event_type: str, days: int
) -> int:
    from sqlalchemy import func

    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(func.count(Event.id)).where(
            Event.event_type == event_type, Event.created_at >= since
        )
    )
    return int(result.scalar() or 0)
