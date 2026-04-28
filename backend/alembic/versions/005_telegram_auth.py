"""Telegram auth fields: telegram_id, telegram_username

Revision ID: 005_telegram_auth
Revises: 004_otp_auth_and_profile
Create Date: 2026-04-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005_telegram_auth"
down_revision: Union[str, None] = "004_otp_auth_and_profile"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("telegram_id", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("telegram_username", sa.String(64), nullable=True))
    op.create_index("ix_users_telegram_id", "users", ["telegram_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_telegram_id", table_name="users")
    op.drop_column("users", "telegram_username")
    op.drop_column("users", "telegram_id")
