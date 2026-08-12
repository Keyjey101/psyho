"""Acquisition analytics: campaigns, append-only events, and LLM spend guards.

Three rules this module exists to enforce:

1. Attribution is **first-touch and immutable**. ``User.campaign_code`` is written
   exactly once, at the moment the user record is created. Nothing rewrites it.
2. ``Event`` is **append-only** and carries **no message text**. ``payload_json``
   holds metadata only (lengths, ordinals, types) — never what a user wrote.
3. Spend is bounded per-user-per-day and globally-per-day, independent of credits,
   so an ad campaign cannot run up an unbounded LLM bill overnight.
"""
from datetime import datetime, timezone

from sqlalchemy import String, Text, Boolean, DateTime, Integer, Float, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def gen_uuid():
    import uuid
    return str(uuid.uuid4())


class Campaign(Base):
    """Traffic-source directory.

    Deep links carry only ``code`` (Telegram caps the ``/start`` payload at 64
    chars, ``[A-Za-z0-9_-]`` only) — full UTM values are resolved here on the
    backend rather than packed into the payload.
    """

    __tablename__ = "campaigns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)

    utm_source: Mapped[str | None] = mapped_column(String(64), nullable=True)
    utm_medium: Mapped[str | None] = mapped_column(String(64), nullable=True)
    utm_campaign: Mapped[str | None] = mapped_column(String(128), nullable=True)
    utm_content: Mapped[str | None] = mapped_column(String(128), nullable=True)

    channel_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cost_rub: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    placed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")

    # "manual" — created by an admin; "auto_created" — minted from unknown UTM
    # so traffic is never dropped on the floor; "viral" — share-card links.
    origin: Mapped[str] = mapped_column(String(20), default="manual", server_default="manual")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Event(Base):
    """Append-only analytics log. Never updated, never carries message text."""

    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    # Internal user id — never a telegram_id, never an email.
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    # Anonymous browser/bot identity for pre-registration events.
    anon_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    campaign_code: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    __table_args__ = (
        Index("ix_events_type_created", "event_type", "created_at"),
        Index("ix_events_user_created", "user_id", "created_at"),
    )


class PendingAttribution(Base):
    """Bridges a Telegram ``/start`` to the user row that appears later.

    A ``/start`` arrives before the user has ever authenticated, so there is no
    ``user_id`` to attribute yet. We stash the campaign against the telegram_id
    and claim it when the user record is finally created.
    """

    __tablename__ = "pending_attributions"

    telegram_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    campaign_code: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    claimed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")


class DailySpend(Base):
    """Global LLM spend for one UTC day. Row id is the ``YYYY-MM-DD`` string."""

    __tablename__ = "daily_spend"

    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    calls: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Highest alert threshold (50/80/100) already delivered, so each is sent once.
    alert_level_sent: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class UserDailyUsage(Base):
    """Per-user token budget for one UTC day — a hard cap, independent of credits."""

    __tablename__ = "user_daily_usage"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    day: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    __table_args__ = (UniqueConstraint("user_id", "day", name="uq_user_daily_usage"),)


class WaitlistEntry(Base):
    """Fake-door contact capture. No payment data is ever collected here."""

    __tablename__ = "waitlist_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    contact: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_type: Mapped[str] = mapped_column(String(20), default="email", server_default="email")
    campaign_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
