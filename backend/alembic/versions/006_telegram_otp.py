"""Telegram OTP verification codes table

Revision ID: 006_telegram_otp
Revises: 005_telegram_auth
Create Date: 2026-04-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006_telegram_otp"
down_revision: Union[str, None] = "005_telegram_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "telegram_verification_codes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("telegram_username", sa.String(64), nullable=True, index=True),
        sa.Column("code", sa.String(6), nullable=False),
        sa.Column("telegram_id", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("verified", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("used", sa.Boolean, nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("telegram_verification_codes")
