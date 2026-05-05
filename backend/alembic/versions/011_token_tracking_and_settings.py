"""Add token tracking to messages and app_settings table

Revision ID: 011_token_tracking_and_settings
Revises: 010_drop_email_verification_codes
Create Date: 2026-05-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "011_token_tracking_and_settings"
down_revision: Union[str, None] = "010_drop_email_verification_codes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("prompt_tokens", sa.Integer(), nullable=True))
    op.add_column("messages", sa.Column("completion_tokens", sa.Integer(), nullable=True))
    op.add_column("messages", sa.Column("total_tokens", sa.Integer(), nullable=True))

    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("messages", "total_tokens")
    op.drop_column("messages", "completion_tokens")
    op.drop_column("messages", "prompt_tokens")
    op.drop_table("app_settings")
