"""Drop unused email_verification_codes table

Revision ID: 010_drop_email_verification_codes
Revises: 009_memory_hash
Create Date: 2026-05-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "010_drop_email_verification_codes"
down_revision: Union[str, None] = "009_memory_hash"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS email_verification_codes")


def downgrade() -> None:
    op.create_table(
        "email_verification_codes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("code_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("used", sa.Boolean, nullable=False, server_default="0"),
    )
    op.create_index("ix_email_verification_codes_email", "email_verification_codes", ["email"])
