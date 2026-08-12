"""First-touch, immutable traffic attribution.

The single invariant: ``User.campaign_code`` is written **once**, when the user
row is created, and no code path anywhere may rewrite it. A user who arrived
from channel X and later clicks a link from channel Y stays attributed to X —
the second click produces a ``repeat_start`` event and nothing else.

Telegram caps the ``/start`` payload at 64 chars of ``[A-Za-z0-9_-]``, so links
carry only ``campaign.code``; full UTM values are resolved from the directory here.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analytics_models import Campaign, PendingAttribution
from app.models.models import User

logger = structlog.get_logger()

ORGANIC_CODE = "organic"
CODE_RE = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
_MAX_TG_PAYLOAD = 64

# Non-campaign /start payloads already in use by the bot (account linking).
_RESERVED_PREFIXES = ("link_",)


def is_valid_code(code: str) -> bool:
    return bool(code) and bool(CODE_RE.fullmatch(code))


def normalize_code(raw: Optional[str]) -> Optional[str]:
    """Return a usable campaign code, or None when the payload isn't one."""
    if not raw:
        return None
    candidate = raw.strip()
    if not candidate or len(candidate) > _MAX_TG_PAYLOAD:
        return None
    if any(candidate.startswith(p) for p in _RESERVED_PREFIXES):
        return None
    if not is_valid_code(candidate):
        return None
    return candidate


def _slugify_component(value: Optional[str], fallback: str) -> str:
    if not value:
        return fallback
    cleaned = re.sub(r"[^A-Za-z0-9]+", "_", value.strip().lower()).strip("_")
    return cleaned or fallback


def code_from_utm(
    utm_source: Optional[str],
    utm_campaign: Optional[str],
    utm_content: Optional[str] = None,
) -> str:
    """Deterministic code for a UTM triple, so repeat visits map to one campaign."""
    parts = [
        _slugify_component(utm_source, "web"),
        _slugify_component(utm_campaign, "none"),
    ]
    if utm_content:
        parts.append(_slugify_component(utm_content, ""))
    code = "_".join(p for p in parts if p)[:32].strip("_")
    return code or ORGANIC_CODE


async def get_campaign(db: AsyncSession, code: str) -> Optional[Campaign]:
    result = await db.execute(select(Campaign).where(Campaign.code == code))
    return result.scalar_one_or_none()


async def ensure_organic(db: AsyncSession) -> Campaign:
    return await get_or_create_campaign(db, ORGANIC_CODE, channel_name="Органика", origin="manual")


async def get_or_create_campaign(
    db: AsyncSession,
    code: str,
    *,
    utm_source: Optional[str] = None,
    utm_medium: Optional[str] = None,
    utm_campaign: Optional[str] = None,
    utm_content: Optional[str] = None,
    channel_name: Optional[str] = None,
    origin: str = "auto_created",
) -> Campaign:
    """Fetch a campaign, minting it if unknown so traffic is never lost.

    Concurrent first-hits on the same new code can race; the unique index on
    ``code`` decides the winner and the loser re-reads the row.
    """
    existing = await get_campaign(db, code)
    if existing:
        return existing

    campaign = Campaign(
        code=code,
        utm_source=utm_source,
        utm_medium=utm_medium,
        utm_campaign=utm_campaign,
        utm_content=utm_content,
        channel_name=channel_name or code,
        origin=origin,
    )
    db.add(campaign)
    try:
        await db.flush()
    except Exception:
        await db.rollback()
        again = await get_campaign(db, code)
        if again:
            return again
        raise
    logger.info("campaign_auto_created", code=code, origin=origin)
    return campaign


async def resolve_campaign_for_utm(
    db: AsyncSession,
    *,
    utm_source: Optional[str],
    utm_medium: Optional[str] = None,
    utm_campaign: Optional[str] = None,
    utm_content: Optional[str] = None,
) -> Campaign:
    """Find (or auto-create) the campaign matching an inbound UTM set.

    Prefers an existing campaign whose UTM fields match exactly — that's the
    admin-created row an operator will recognise in reports — and only falls
    back to minting a derived code when nothing matches.
    """
    if not any([utm_source, utm_campaign, utm_content]):
        return await ensure_organic(db)

    query = select(Campaign).where(Campaign.utm_source == utm_source)
    if utm_campaign:
        query = query.where(Campaign.utm_campaign == utm_campaign)
    if utm_content:
        query = query.where(Campaign.utm_content == utm_content)
    result = await db.execute(query.limit(1))
    matched = result.scalar_one_or_none()
    if matched:
        return matched

    code = code_from_utm(utm_source, utm_campaign, utm_content)
    return await get_or_create_campaign(
        db,
        code,
        utm_source=utm_source,
        utm_medium=utm_medium or "web",
        utm_campaign=utm_campaign,
        utm_content=utm_content,
        channel_name=f"{utm_source or 'web'} / {utm_campaign or '—'}",
        origin="auto_created",
    )


def apply_first_touch(user: User, campaign_code: Optional[str], campaign: Optional[Campaign] = None) -> bool:
    """Stamp attribution onto a user **only if** they have none yet.

    Returns True when it wrote, False when attribution already existed. This is
    the only function permitted to set ``user.campaign_code``.
    """
    if not campaign_code:
        return False
    if user.campaign_code:
        return False

    user.campaign_code = campaign_code
    if campaign:
        # Don't clobber UTM captured from the web form if it's already there.
        if not user.utm_source:
            user.utm_source = campaign.utm_source
            user.utm_medium = campaign.utm_medium
            user.utm_campaign = campaign.utm_campaign
            user.utm_content = campaign.utm_content
    return True


# ── Telegram pending attribution ──────────────────────────────────────────
#
# A /start lands before any user row exists, so the campaign is parked against
# the telegram_id and claimed when the account is finally created.

async def stash_pending(db: AsyncSession, telegram_id: str, campaign_code: str) -> None:
    """Record a /start campaign for a not-yet-registered telegram user.

    First-touch also applies here: an existing unclaimed stash is left alone.
    """
    result = await db.execute(
        select(PendingAttribution).where(PendingAttribution.telegram_id == telegram_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return
    db.add(
        PendingAttribution(
            telegram_id=telegram_id,
            campaign_code=campaign_code,
            created_at=datetime.now(timezone.utc),
        )
    )
    await db.flush()


async def claim_pending(db: AsyncSession, telegram_id: Optional[str]) -> Optional[str]:
    """Consume the parked campaign code for a telegram_id, if any."""
    if not telegram_id:
        return None
    result = await db.execute(
        select(PendingAttribution).where(
            PendingAttribution.telegram_id == str(telegram_id),
            PendingAttribution.claimed == False,  # noqa: E712
        )
    )
    pending = result.scalar_one_or_none()
    if not pending:
        return None
    pending.claimed = True
    return pending.campaign_code


def bot_deep_link(bot_username: str, code: str) -> str:
    return f"https://t.me/{bot_username.lstrip('@')}?start={code}"


def web_link(base_url: str, campaign: Campaign, path: str = "/") -> str:
    from urllib.parse import urlencode

    params = {
        k: v
        for k, v in (
            ("utm_source", campaign.utm_source),
            ("utm_medium", campaign.utm_medium),
            ("utm_campaign", campaign.utm_campaign),
            ("utm_content", campaign.utm_content),
            ("c", campaign.code),
        )
        if v
    }
    sep = "" if path.startswith("/") else "/"
    return f"{base_url.rstrip('/')}{sep}{path}?{urlencode(params)}"
