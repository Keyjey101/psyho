"""Public acquisition endpoints: event tracking, bot-link resolution, waitlist.

These are unauthenticated by design — the funnel starts before anyone has an
account. Consequences handled here:

* Only client-safe event types are accepted (``events.CLIENT_TRACKABLE``);
  activation, crisis and spend events are server-side only so they can't be forged.
* Payloads go through the same whitelist as every other event, so a crafted
  request still cannot write free text into the analytics table.
* Rate limited per IP.
"""
from __future__ import annotations

from typing import Any, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import get_current_user_optional
from app.models.analytics_models import WaitlistEntry
from app.models.models import User
from app.services import attribution, events

logger = structlog.get_logger()
settings = get_settings()

router = APIRouter()


class TrackRequest(BaseModel):
    event_type: str = Field(..., max_length=48)
    campaign_code: Optional[str] = Field(None, max_length=32)
    anon_id: Optional[str] = Field(None, max_length=64)
    utm_source: Optional[str] = Field(None, max_length=64)
    utm_medium: Optional[str] = Field(None, max_length=64)
    utm_campaign: Optional[str] = Field(None, max_length=128)
    utm_content: Optional[str] = Field(None, max_length=128)
    payload: Optional[dict[str, Any]] = None

    @field_validator("payload")
    @classmethod
    def payload_must_be_small(cls, v: Optional[dict]) -> Optional[dict]:
        if v is not None and len(v) > 20:
            raise ValueError("payload too large")
        return v


@router.post("/track", status_code=202)
async def track(
    body: TrackRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    """Record one funnel event from the browser.

    Returns 202 unconditionally for accepted types — the client must never wait
    on or branch over analytics.
    """
    if body.event_type not in events.CLIENT_TRACKABLE:
        raise HTTPException(status_code=400, detail="Unsupported event type")

    code = await _resolve_code(db, body)

    await events.log_event(
        body.event_type,
        user_id=user.id if user else None,
        anon_id=None if user else body.anon_id,
        campaign_code=code,
        payload=body.payload,
        db=db,
    )
    await db.commit()
    return {"ok": True}


async def _resolve_code(db: AsyncSession, body: TrackRequest) -> str:
    """Turn whatever the client knows into a real campaign code.

    An explicit ``campaign_code`` wins; otherwise UTM is matched (or a campaign
    is auto-created so paid traffic is never silently lost); otherwise organic.
    """
    explicit = attribution.normalize_code(body.campaign_code)
    if explicit:
        campaign = await attribution.get_or_create_campaign(
            db, explicit, channel_name=explicit, origin="auto_created"
        )
        return campaign.code

    if body.utm_source or body.utm_campaign:
        campaign = await attribution.resolve_campaign_for_utm(
            db,
            utm_source=body.utm_source,
            utm_medium=body.utm_medium,
            utm_campaign=body.utm_campaign,
            utm_content=body.utm_content,
        )
        return campaign.code

    await attribution.ensure_organic(db)
    return attribution.ORGANIC_CODE


class BotLinkRequest(BaseModel):
    campaign_code: Optional[str] = Field(None, max_length=32)
    utm_source: Optional[str] = Field(None, max_length=64)
    utm_medium: Optional[str] = Field(None, max_length=64)
    utm_campaign: Optional[str] = Field(None, max_length=128)
    utm_content: Optional[str] = Field(None, max_length=128)


@router.post("/bot-link")
async def resolve_bot_link(body: BotLinkRequest, db: AsyncSession = Depends(get_db)):
    """Build the ``t.me/<bot>?start=<code>`` link that preserves web attribution.

    The client holds UTM (from localStorage); the campaign directory lives here.
    Only the short code travels in the payload — Telegram allows 64 chars of
    ``[A-Za-z0-9_-]`` and nothing more.
    """
    code = await _resolve_code(db, TrackRequest(event_type=events.EVENT_LANDING_VIEW, **body.model_dump()))
    await db.commit()

    bot = settings.TELEGRAM_BOT_USERNAME
    return {
        "campaign_code": code,
        "bot_username": bot,
        "url": attribution.bot_deep_link(bot, code) if bot else None,
    }


class WaitlistRequest(BaseModel):
    contact: str = Field(..., min_length=3, max_length=255)
    contact_type: str = Field("email", max_length=20)
    campaign_code: Optional[str] = Field(None, max_length=32)

    @field_validator("contact_type")
    @classmethod
    def known_contact_type(cls, v: str) -> str:
        return v if v in ("email", "telegram") else "email"


@router.post("/waitlist", status_code=201)
async def join_waitlist(
    body: WaitlistRequest,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    """Fake-door contact capture. Deliberately collects no payment data."""
    contact = body.contact.strip()
    if body.contact_type == "email" and "@" not in contact:
        raise HTTPException(status_code=400, detail="Похоже, в адресе опечатка")

    code = attribution.normalize_code(body.campaign_code) or (user.campaign_code if user else None)

    db.add(
        WaitlistEntry(
            user_id=user.id if user else None,
            contact=contact,
            contact_type=body.contact_type,
            campaign_code=code,
        )
    )
    await events.log_event(
        events.EVENT_EMAIL_SUBMITTED,
        user_id=user.id if user else None,
        campaign_code=code,
        payload={"contact_type": body.contact_type},
        db=db,
    )
    await db.commit()
    return {"ok": True}
