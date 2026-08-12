"""Acquisition analytics: campaigns, events, spend guards, waitlist

Revision ID: 015_acquisition_analytics
Revises: 014_treatment_plan
Create Date: 2026-08-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "015_acquisition_analytics"
down_revision: Union[str, None] = "014_treatment_plan"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "campaigns",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("utm_source", sa.String(64), nullable=True),
        sa.Column("utm_medium", sa.String(64), nullable=True),
        sa.Column("utm_campaign", sa.String(128), nullable=True),
        sa.Column("utm_content", sa.String(128), nullable=True),
        sa.Column("channel_name", sa.String(255), nullable=True),
        sa.Column("cost_rub", sa.Float(), nullable=False, server_default="0"),
        sa.Column("placed_at", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("origin", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_campaigns_code", "campaigns", ["code"], unique=True)

    op.create_table(
        "events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=True),
        sa.Column("anon_id", sa.String(64), nullable=True),
        sa.Column("event_type", sa.String(48), nullable=False),
        sa.Column("campaign_code", sa.String(32), nullable=True),
        sa.Column("payload_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_events_user_id", "events", ["user_id"])
    op.create_index("ix_events_anon_id", "events", ["anon_id"])
    op.create_index("ix_events_event_type", "events", ["event_type"])
    op.create_index("ix_events_campaign_code", "events", ["campaign_code"])
    op.create_index("ix_events_created_at", "events", ["created_at"])
    op.create_index("ix_events_type_created", "events", ["event_type", "created_at"])
    op.create_index("ix_events_user_created", "events", ["user_id", "created_at"])

    op.create_table(
        "pending_attributions",
        sa.Column("telegram_id", sa.String(20), primary_key=True),
        sa.Column("campaign_code", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("claimed", sa.Boolean(), nullable=False, server_default="0"),
    )

    op.create_table(
        "daily_spend",
        sa.Column("day", sa.String(10), primary_key=True),
        sa.Column("cost_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("calls", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("alert_level_sent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "user_daily_usage",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("day", sa.String(10), nullable=False),
        sa.Column("total_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Float(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", "day", name="uq_user_daily_usage"),
    )
    op.create_index("ix_user_daily_usage_user_id", "user_daily_usage", ["user_id"])
    op.create_index("ix_user_daily_usage_day", "user_daily_usage", ["day"])

    op.create_table(
        "waitlist_entries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=True),
        sa.Column("contact", sa.String(255), nullable=False),
        sa.Column("contact_type", sa.String(20), nullable=False, server_default="email"),
        sa.Column("campaign_code", sa.String(32), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_waitlist_entries_user_id", "waitlist_entries", ["user_id"])

    op.add_column("users", sa.Column("campaign_code", sa.String(32), nullable=True))
    op.create_index("ix_users_campaign_code", "users", ["campaign_code"])
    op.add_column("users", sa.Column("consent_accepted_at", sa.DateTime(), nullable=True))

    op.add_column(
        "sessions",
        sa.Column("crisis_flagged", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("sessions", "crisis_flagged")
    op.drop_column("users", "consent_accepted_at")
    op.drop_index("ix_users_campaign_code", table_name="users")
    op.drop_column("users", "campaign_code")
    op.drop_table("waitlist_entries")
    op.drop_table("user_daily_usage")
    op.drop_table("daily_spend")
    op.drop_table("pending_attributions")
    op.drop_table("events")
    op.drop_table("campaigns")
