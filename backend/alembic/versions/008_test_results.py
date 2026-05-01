"""Test results table for psych quizzes

Revision ID: 008_test_results
Revises: 007_new_features
Create Date: 2026-05-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "008_test_results"
down_revision: Union[str, None] = "007_new_features"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "test_results",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("test_id", sa.String(64), nullable=False, index=True),
        sa.Column("score", sa.Integer, nullable=False),
        sa.Column("level", sa.String(80), nullable=False),
        sa.Column("completed_at", sa.DateTime, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("test_results")
