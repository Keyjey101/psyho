"""Add pop_score to user_profiles

Revision ID: 003_add_pop_score
Revises: 002_memory_and_continuation
Create Date: 2026-04-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003_add_pop_score"
down_revision: Union[str, None] = "002_memory_and_continuation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_profiles", sa.Column("pop_score", sa.Integer, nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("user_profiles", "pop_score")
