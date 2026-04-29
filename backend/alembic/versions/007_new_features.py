"""New features: diary_entries, time_capsules, achievements, anonymous_insights; code_hash for telegram_verification_codes

Revision ID: 007_new_features
Revises: 006_telegram_otp
Create Date: 2026-04-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "007_new_features"
down_revision: Union[str, None] = "006_telegram_otp"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add code_hash to telegram_verification_codes
    op.add_column(
        "telegram_verification_codes",
        sa.Column("code_hash", sa.String(255), nullable=True),
    )

    # diary_entries
    op.create_table(
        "diary_entries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("user_note", sa.Text, nullable=True),
        sa.Column("topics", sa.String(255), nullable=True),
        sa.Column("mood_score", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # time_capsules
    op.create_table(
        "time_capsules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("open_after", sa.DateTime, nullable=False),
        sa.Column("opened", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    # achievements
    op.create_table(
        "achievements",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("achievement_type", sa.String(50), nullable=False),
        sa.Column("earned_at", sa.DateTime, nullable=False),
    )

    # anonymous_insights
    op.create_table(
        "anonymous_insights",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("reactions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("is_approved", sa.Boolean, nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_table("anonymous_insights")
    op.drop_table("achievements")
    op.drop_table("time_capsules")
    op.drop_table("diary_entries")
    op.drop_column("telegram_verification_codes", "code_hash")
