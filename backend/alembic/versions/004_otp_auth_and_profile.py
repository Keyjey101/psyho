"""OTP auth table, address_form, gender, password nullable

Revision ID: 004_otp_auth_and_profile
Revises: 003_add_pop_score
Create Date: 2026-04-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004_otp_auth_and_profile"
down_revision: Union[str, None] = "003_add_pop_score"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_verification_codes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, index=True),
        sa.Column("code_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("used", sa.Boolean, nullable=False, server_default="0"),
    )
    op.create_index("ix_email_verification_codes_email", "email_verification_codes", ["email"])

    op.add_column("user_profiles", sa.Column("address_form", sa.String(10), nullable=False, server_default="ты"))
    op.add_column("user_profiles", sa.Column("gender", sa.String(20), nullable=True))

    # SQLite doesn't support ALTER COLUMN, so password nullable is handled by model default
    # For new SQLite databases, column is nullable=True already


def downgrade() -> None:
    op.drop_index("ix_email_verification_codes_email", table_name="email_verification_codes")
    op.drop_table("email_verification_codes")
    op.drop_column("user_profiles", "address_form")
    op.drop_column("user_profiles", "gender")
