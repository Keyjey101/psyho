"""Memory hash column on user_profiles for dedup-skipping no-op updates

Revision ID: 009_memory_hash
Revises: 008_test_results
Create Date: 2026-05-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "009_memory_hash"
down_revision: Union[str, None] = "008_test_results"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column("memory_hash", sa.String(64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_profiles", "memory_hash")
