"""Monetization: subscription tier, payments, promo codes, UTM, notify-link

Revision ID: 012_monetization
Revises: 011_token_tracking_and_settings
Create Date: 2026-05-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "012_monetization"
down_revision: Union[str, None] = "011_token_tracking_and_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── User columns ──────────────────────────────────────────────────────
    op.add_column("users", sa.Column("subscription_tier", sa.String(20), nullable=False, server_default="free"))
    op.add_column("users", sa.Column("subscription_expires_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("subscription_started_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("autorenew_enabled", sa.Boolean(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("sessions_quota_balance", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("lifetime_free_sessions_used", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("saved_payment_method_id", sa.String(64), nullable=True))

    op.add_column("users", sa.Column("utm_source", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("utm_medium", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("utm_campaign", sa.String(128), nullable=True))
    op.add_column("users", sa.Column("utm_content", sa.String(128), nullable=True))
    op.add_column("users", sa.Column("utm_term", sa.String(128), nullable=True))
    op.add_column("users", sa.Column("referrer_host", sa.String(128), nullable=True))

    op.add_column("users", sa.Column("notify_telegram_id", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("notify_link_token", sa.String(64), nullable=True))

    op.create_index("ix_users_utm_source", "users", ["utm_source"])
    op.create_index("ix_users_utm_campaign", "users", ["utm_campaign"])
    op.create_index("ix_users_notify_telegram_id", "users", ["notify_telegram_id"])
    op.create_index("ix_users_notify_link_token", "users", ["notify_link_token"], unique=True)

    # ── PromoCode ─────────────────────────────────────────────────────────
    op.create_table(
        "promo_codes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("code", sa.String(40), nullable=False, unique=True),
        sa.Column("discount_percent", sa.Integer(), nullable=False),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valid_until", sa.DateTime(), nullable=True),
        sa.Column("applies_to", sa.String(20), nullable=False, server_default="all"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("created_by_admin_email", sa.String(255), nullable=True),
    )
    op.create_index("ix_promo_codes_code", "promo_codes", ["code"])

    # ── Payment ───────────────────────────────────────────────────────────
    op.create_table(
        "payments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(20), nullable=False, server_default="yookassa"),
        sa.Column("provider_payment_id", sa.String(64), nullable=True, unique=True),
        sa.Column("provider_idempotence_key", sa.String(64), nullable=False, unique=True),
        sa.Column("amount_kopecks", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="RUB"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("purpose", sa.String(20), nullable=False),
        sa.Column("promo_code_id", sa.String(36), sa.ForeignKey("promo_codes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("discount_kopecks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("utm_source", sa.String(64), nullable=True),
        sa.Column("utm_campaign", sa.String(128), nullable=True),
        sa.Column("is_recurring", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_payments_user_id", "payments", ["user_id"])
    op.create_index("ix_payments_status", "payments", ["status"])
    op.create_index("ix_payments_purpose", "payments", ["purpose"])
    op.create_index("ix_payments_provider_payment_id", "payments", ["provider_payment_id"], unique=True)

    # ── SubscriptionEvent ─────────────────────────────────────────────────
    op.create_table(
        "subscription_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(40), nullable=False),
        sa.Column("from_tier", sa.String(20), nullable=True),
        sa.Column("to_tier", sa.String(20), nullable=True),
        sa.Column("payment_id", sa.String(36), sa.ForeignKey("payments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_subscription_events_user_id", "subscription_events", ["user_id"])
    op.create_index("ix_subscription_events_created_at", "subscription_events", ["created_at"])

    # ── PromoRedemption ───────────────────────────────────────────────────
    op.create_table(
        "promo_redemptions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("promo_code_id", sa.String(36), sa.ForeignKey("promo_codes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payment_id", sa.String(36), sa.ForeignKey("payments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("redeemed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_promo_redemptions_user", "promo_redemptions", ["user_id"])
    op.create_index("ix_promo_redemptions_promo", "promo_redemptions", ["promo_code_id"])
    op.create_index(
        "uq_promo_redemptions_user_promo",
        "promo_redemptions",
        ["user_id", "promo_code_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_promo_redemptions_user_promo", table_name="promo_redemptions")
    op.drop_index("ix_promo_redemptions_promo", table_name="promo_redemptions")
    op.drop_index("ix_promo_redemptions_user", table_name="promo_redemptions")
    op.drop_table("promo_redemptions")

    op.drop_index("ix_subscription_events_created_at", table_name="subscription_events")
    op.drop_index("ix_subscription_events_user_id", table_name="subscription_events")
    op.drop_table("subscription_events")

    op.drop_index("ix_payments_provider_payment_id", table_name="payments")
    op.drop_index("ix_payments_purpose", table_name="payments")
    op.drop_index("ix_payments_status", table_name="payments")
    op.drop_index("ix_payments_user_id", table_name="payments")
    op.drop_table("payments")

    op.drop_index("ix_promo_codes_code", table_name="promo_codes")
    op.drop_table("promo_codes")

    op.drop_index("ix_users_notify_link_token", table_name="users")
    op.drop_index("ix_users_notify_telegram_id", table_name="users")
    op.drop_index("ix_users_utm_campaign", table_name="users")
    op.drop_index("ix_users_utm_source", table_name="users")

    for col in (
        "notify_link_token", "notify_telegram_id",
        "referrer_host", "utm_term", "utm_content", "utm_campaign", "utm_medium", "utm_source",
        "saved_payment_method_id", "lifetime_free_sessions_used", "sessions_quota_balance",
        "autorenew_enabled", "subscription_started_at", "subscription_expires_at", "subscription_tier",
    ):
        op.drop_column("users", col)
