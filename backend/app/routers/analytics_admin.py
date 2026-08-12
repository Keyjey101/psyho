"""Admin analytics: source table, cohort retention, funnel, safety, spend.

The whole point of this screen is one number: **цена за D1-возврат** — cost
divided by the number of users who came back the next day. Everything else is
supporting detail for deciding whether to buy a channel again.

Retention is *computed*, never logged: a user "returned on D1" if any event of
theirs lands in the [bot_start + 1d, bot_start + 2d) window. That way a return
counts no matter how the person came back.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.admin import get_admin_user
from app.models.analytics_models import Campaign, Event, WaitlistEntry
from app.models.models import ChatSession, User
from app.services import attribution, events, spend_guard

logger = structlog.get_logger()
settings = get_settings()

router = APIRouter(prefix="/api/admin/analytics", tags=["admin-analytics"])

# Funnel order — also the column order in the sources table.
FUNNEL_STEPS: list[tuple[str, str]] = [
    (events.EVENT_LANDING_VIEW, "Клики"),
    (events.EVENT_BOT_START, "Старты бота"),
    (events.EVENT_TEST_COMPLETED, "Тест пройден"),
    (events.EVENT_FIRST_MESSAGE, "1-е сообщение"),
    (events.EVENT_MESSAGE_3, "3-е сообщение"),
]


def _since(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def _pct(part: float, whole: float) -> float:
    return round(100 * part / whole, 1) if whole else 0.0


def _naive(dt: datetime) -> datetime:
    """SQLite stores naive UTC — normalise before comparing."""
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


def _actor():
    """Identity expression used to count unique people per event type.

    Falls back to ``Event.id`` so an event that carries neither a user nor an
    anon id still counts as one occurrence instead of vanishing — ``COUNT
    DISTINCT`` skips NULLs, which would silently zero out whole columns.
    """
    return func.coalesce(Event.user_id, Event.anon_id, Event.id)


# ── Campaigns CRUD ────────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    utm_source: Optional[str] = Field(None, max_length=64)
    utm_medium: Optional[str] = Field(None, max_length=64)
    utm_campaign: Optional[str] = Field(None, max_length=128)
    utm_content: Optional[str] = Field(None, max_length=128)
    channel_name: Optional[str] = Field(None, max_length=255)
    cost_rub: float = 0.0
    placed_at: Optional[datetime] = None
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def code_charset(cls, v: str) -> str:
        v = v.strip()
        if not attribution.is_valid_code(v):
            raise ValueError("Код может содержать только A-Za-z0-9_- (до 32 символов)")
        return v


class CampaignUpdate(BaseModel):
    utm_source: Optional[str] = Field(None, max_length=64)
    utm_medium: Optional[str] = Field(None, max_length=64)
    utm_campaign: Optional[str] = Field(None, max_length=128)
    utm_content: Optional[str] = Field(None, max_length=128)
    channel_name: Optional[str] = Field(None, max_length=255)
    cost_rub: Optional[float] = None
    placed_at: Optional[datetime] = None
    is_active: Optional[bool] = None


def _campaign_dict(c: Campaign) -> dict:
    bot = settings.TELEGRAM_BOT_USERNAME
    return {
        "id": c.id,
        "code": c.code,
        "utm_source": c.utm_source,
        "utm_medium": c.utm_medium,
        "utm_campaign": c.utm_campaign,
        "utm_content": c.utm_content,
        "channel_name": c.channel_name,
        "cost_rub": float(c.cost_rub or 0.0),
        "placed_at": c.placed_at,
        "is_active": c.is_active,
        "origin": c.origin,
        "created_at": c.created_at,
        # Ready-to-paste links so nobody assembles URLs by hand.
        "bot_url": attribution.bot_deep_link(bot, c.code) if bot else None,
        "web_url": attribution.web_link(settings.PUBLIC_BASE_URL, c),
    }


@router.get("/campaigns")
async def list_campaigns(admin=Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).order_by(Campaign.created_at.desc()))
    return {
        "campaigns": [_campaign_dict(c) for c in result.scalars().all()],
        "bot_username": settings.TELEGRAM_BOT_USERNAME,
        "public_base_url": settings.PUBLIC_BASE_URL,
    }


@router.post("/campaigns", status_code=201)
async def create_campaign(
    body: CampaignCreate, admin=Depends(get_admin_user), db: AsyncSession = Depends(get_db)
):
    existing = await attribution.get_campaign(db, body.code)
    if existing:
        raise HTTPException(status_code=409, detail="Кампания с таким кодом уже существует")

    campaign = Campaign(origin="manual", **body.model_dump())
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return _campaign_dict(campaign)


@router.patch("/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    body: CampaignUpdate,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Кампания не найдена")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)
    await db.commit()
    await db.refresh(campaign)
    return _campaign_dict(campaign)


@router.delete("/campaigns/{campaign_id}", status_code=204)
async def delete_campaign(
    campaign_id: str, admin=Depends(get_admin_user), db: AsyncSession = Depends(get_db)
):
    """Removes the directory entry only — events keep their ``campaign_code``.

    Analytics history is never rewritten by an admin action.
    """
    await db.execute(delete(Campaign).where(Campaign.id == campaign_id))
    await db.commit()


# ── Sources table ─────────────────────────────────────────────────────────

async def _returns_by_campaign(db: AsyncSession, days: int) -> dict[str, dict[str, set[str]]]:
    """Per campaign, the set of users who returned on D1 / D3 / D7 / D14.

    Computed from raw events rather than a logged "retention" event: we take
    each user's first ``bot_start`` and check whether *any* later event of theirs
    falls in the corresponding day window.
    """
    since = _naive(_since(days + 15))

    starts_q = await db.execute(
        select(
            Event.user_id,
            Event.campaign_code,
            func.min(Event.created_at).label("started_at"),
        )
        .where(
            Event.event_type == events.EVENT_BOT_START,
            Event.user_id.isnot(None),
            Event.created_at >= since,
        )
        .group_by(Event.user_id)
    )
    starts: dict[str, tuple[str, datetime]] = {
        r.user_id: (r.campaign_code or attribution.ORGANIC_CODE, r.started_at)
        for r in starts_q
        if r.started_at is not None
    }
    if not starts:
        return {}

    activity_q = await db.execute(
        select(Event.user_id, Event.created_at)
        .where(Event.user_id.in_(list(starts.keys())), Event.created_at >= since)
    )

    windows = {"d1": (1, 2), "d3": (3, 4), "d7": (7, 8), "d14": (14, 15)}
    result: dict[str, dict[str, set[str]]] = {}

    for user_id, created_at in activity_q:
        if created_at is None:
            continue
        code, started_at = starts[user_id]
        delta_days = (created_at - started_at).total_seconds() / 86400.0
        bucket = result.setdefault(code, {k: set() for k in windows})
        for key, (lo, hi) in windows.items():
            if lo <= delta_days < hi:
                bucket[key].add(user_id)

    return result


@router.get("/sources")
async def sources_table(
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
):
    """One row per campaign, with the D1-return cost as the decision column."""
    since = _naive(_since(days))

    counts_q = await db.execute(
        select(
            func.coalesce(Event.campaign_code, attribution.ORGANIC_CODE).label("code"),
            Event.event_type,
            func.count(func.distinct(_actor())).label("uniques"),
            func.count(Event.id).label("total"),
        )
        .where(Event.created_at >= since)
        .group_by("code", Event.event_type)
    )
    by_code: dict[str, dict[str, dict[str, int]]] = {}
    for row in counts_q:
        by_code.setdefault(row.code, {})[row.event_type] = {
            "uniques": int(row.uniques or 0),
            "total": int(row.total or 0),
        }

    campaigns_q = await db.execute(select(Campaign))
    campaigns = {c.code: c for c in campaigns_q.scalars().all()}

    returns = await _returns_by_campaign(db, days)

    rows = []
    for code in sorted(set(by_code) | set(campaigns)):
        stats = by_code.get(code, {})
        campaign = campaigns.get(code)
        cost = float(campaign.cost_rub or 0.0) if campaign else 0.0

        def uniq(event_type: str) -> int:
            return stats.get(event_type, {}).get("uniques", 0)

        clicks = uniq(events.EVENT_LANDING_VIEW)
        bot_starts = uniq(events.EVENT_BOT_START)
        d1 = len(returns.get(code, {}).get("d1", set()))

        rows.append({
            "code": code,
            "channel_name": campaign.channel_name if campaign else code,
            "is_active": campaign.is_active if campaign else True,
            "origin": campaign.origin if campaign else "unknown",
            "clicks": clicks,
            "bot_starts": bot_starts,
            "tests_completed": uniq(events.EVENT_TEST_COMPLETED),
            "first_messages": uniq(events.EVENT_FIRST_MESSAGE),
            "third_messages": uniq(events.EVENT_MESSAGE_3),
            "returned_d1": d1,
            "paywall_clicks": uniq(events.EVENT_PAYWALL_CLICKED),
            "cost_rub": cost,
            # CPA = spend per bot start.
            "cpa_rub": round(cost / bot_starts, 2) if bot_starts else None,
            # The column the reinvestment decision is made on.
            "cost_per_d1_rub": round(cost / d1, 2) if d1 else None,
            "conv_click_to_start": _pct(bot_starts, clicks),
            "conv_start_to_first_msg": _pct(uniq(events.EVENT_FIRST_MESSAGE), bot_starts),
            "conv_first_to_third_msg": _pct(uniq(events.EVENT_MESSAGE_3), uniq(events.EVENT_FIRST_MESSAGE)),
            "conv_start_to_d1": _pct(d1, bot_starts),
        })

    rows.sort(key=lambda r: (r["cost_per_d1_rub"] is None, r["cost_per_d1_rub"] or 0))
    return {"days": days, "rows": rows}


# ── Cohort retention ──────────────────────────────────────────────────────

@router.get("/cohorts")
async def cohorts(
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    weeks: int = Query(8, ge=1, le=52),
    campaign_code: Optional[str] = None,
):
    """Rows = acquisition week (ISO), columns = D1 / D3 / D7 / D14."""
    since = _naive(datetime.now(timezone.utc) - timedelta(weeks=weeks))

    starts_query = (
        select(Event.user_id, Event.campaign_code, func.min(Event.created_at).label("started_at"))
        .where(
            Event.event_type == events.EVENT_BOT_START,
            Event.user_id.isnot(None),
            Event.created_at >= since,
        )
        .group_by(Event.user_id)
    )
    if campaign_code:
        starts_query = starts_query.where(Event.campaign_code == campaign_code)

    starts_q = await db.execute(starts_query)
    starts = {
        r.user_id: (r.started_at, r.campaign_code or attribution.ORGANIC_CODE)
        for r in starts_q
        if r.started_at is not None
    }
    if not starts:
        return {"weeks": weeks, "campaign_code": campaign_code, "rows": []}

    activity_q = await db.execute(
        select(Event.user_id, Event.created_at).where(Event.user_id.in_(list(starts.keys())))
    )

    windows = {"d1": (1, 2), "d3": (3, 4), "d7": (7, 8), "d14": (14, 15)}
    cohort_users: dict[str, set[str]] = {}
    cohort_returns: dict[str, dict[str, set[str]]] = {}

    for user_id, (started_at, _code) in starts.items():
        iso_year, iso_week, _ = started_at.isocalendar()
        key = f"{iso_year}-W{iso_week:02d}"
        cohort_users.setdefault(key, set()).add(user_id)
        cohort_returns.setdefault(key, {k: set() for k in windows})

    for user_id, created_at in activity_q:
        if created_at is None or user_id not in starts:
            continue
        started_at, _code = starts[user_id]
        iso_year, iso_week, _ = started_at.isocalendar()
        key = f"{iso_year}-W{iso_week:02d}"
        delta_days = (created_at - started_at).total_seconds() / 86400.0
        for w_key, (lo, hi) in windows.items():
            if lo <= delta_days < hi:
                cohort_returns[key][w_key].add(user_id)

    rows = []
    for key in sorted(cohort_users, reverse=True):
        size = len(cohort_users[key])
        row = {"cohort": key, "size": size}
        for w_key in windows:
            returned = len(cohort_returns[key][w_key])
            row[w_key] = returned
            row[f"{w_key}_pct"] = _pct(returned, size)
        rows.append(row)

    return {"weeks": weeks, "campaign_code": campaign_code, "rows": rows}


# ── Funnel ────────────────────────────────────────────────────────────────

@router.get("/funnel")
async def funnel(
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
    campaign_code: Optional[str] = None,
):
    """Click → third message, for one source or all of them."""
    since = _naive(_since(days))

    query = (
        select(
            Event.event_type,
            func.count(func.distinct(_actor())).label("uniques"),
        )
        .where(Event.created_at >= since)
        .group_by(Event.event_type)
    )
    if campaign_code:
        query = query.where(Event.campaign_code == campaign_code)

    result = await db.execute(query)
    counts = {r.event_type: int(r.uniques or 0) for r in result}

    steps = []
    first_count = counts.get(FUNNEL_STEPS[0][0], 0)
    previous: Optional[int] = None
    for event_type, label in FUNNEL_STEPS:
        value = counts.get(event_type, 0)
        steps.append({
            "event_type": event_type,
            "label": label,
            "count": value,
            "pct_of_top": _pct(value, first_count),
            "pct_of_previous": _pct(value, previous) if previous is not None else 100.0,
        })
        previous = value

    return {"days": days, "campaign_code": campaign_code, "steps": steps}


# ── Safety monitoring ─────────────────────────────────────────────────────

@router.get("/safety")
async def safety(
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
):
    """Crisis-detector counters only — never any dialogue content.

    Operationally: a rising share means the creatives are pulling in an audience
    too heavy for this product and need to change.
    """
    since = _naive(_since(days))

    detected = await events.count_events_since(db, events.EVENT_CRISIS_DETECTED, days)
    shown = await events.count_events_since(db, events.EVENT_CRISIS_RESOURCES_SHOWN, days)

    sessions_q = await db.execute(
        select(func.count(ChatSession.id)).where(ChatSession.created_at >= since)
    )
    total_sessions = int(sessions_q.scalar() or 0)

    flagged_q = await db.execute(
        select(func.count(ChatSession.id)).where(
            ChatSession.created_at >= since, ChatSession.crisis_flagged == True  # noqa: E712
        )
    )
    flagged_sessions = int(flagged_q.scalar() or 0)

    by_campaign_q = await db.execute(
        select(
            func.coalesce(Event.campaign_code, attribution.ORGANIC_CODE).label("code"),
            func.count(Event.id).label("n"),
        )
        .where(Event.event_type == events.EVENT_CRISIS_DETECTED, Event.created_at >= since)
        .group_by("code")
        .order_by(func.count(Event.id).desc())
    )

    return {
        "days": days,
        "crisis_detected": detected,
        "crisis_resources_shown": shown,
        "sessions_total": total_sessions,
        "sessions_flagged": flagged_sessions,
        "flagged_share_pct": _pct(flagged_sessions, total_sessions),
        "by_campaign": [{"code": r.code, "count": int(r.n)} for r in by_campaign_q],
    }


# ── Spend dashboard ───────────────────────────────────────────────────────

@router.get("/spend")
async def spend(admin=Depends(get_admin_user)):
    return await spend_guard.spend_summary()


# ── Waitlist (fake door output) ───────────────────────────────────────────

@router.get("/waitlist")
async def waitlist(
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(200, ge=1, le=1000),
):
    result = await db.execute(
        select(WaitlistEntry).order_by(WaitlistEntry.created_at.desc()).limit(limit)
    )
    rows = result.scalars().all()
    return {
        "total": len(rows),
        "entries": [
            {
                "id": e.id,
                "contact": e.contact,
                "contact_type": e.contact_type,
                "campaign_code": e.campaign_code,
                "created_at": e.created_at,
            }
            for e in rows
        ],
    }


# ── Privacy self-check ────────────────────────────────────────────────────

@router.get("/privacy-check")
async def privacy_check(admin=Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    """Acceptance criterion 9, checkable from the UI.

    Scans stored payloads for anything resembling message text: a disallowed key,
    or a string value long enough to be an excerpt. Should always report zero.
    """
    result = await db.execute(
        select(Event.id, Event.payload_json).where(Event.payload_json.isnot(None)).limit(5000)
    )
    import json as _json

    checked = 0
    violations: list[str] = []
    for event_id, payload_json in result:
        checked += 1
        try:
            parsed = _json.loads(payload_json)
        except (ValueError, TypeError):
            violations.append(event_id)
            continue
        if not isinstance(parsed, dict):
            violations.append(event_id)
            continue
        for key, value in parsed.items():
            if key not in events._SAFE_PAYLOAD_KEYS:
                violations.append(event_id)
                break
            if isinstance(value, str) and len(value) > 128:
                violations.append(event_id)
                break

    total_q = await db.execute(select(func.count(Event.id)))
    return {
        "events_total": int(total_q.scalar() or 0),
        "payloads_checked": checked,
        "violations": len(violations),
        "sample_violation_ids": violations[:10],
        "ok": not violations,
    }
