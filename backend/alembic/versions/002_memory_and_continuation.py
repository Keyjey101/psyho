"""Add memory and continuation fields

Revision ID: 002_memory_and_continuation
Revises: 001_initial
Create Date: 2026-04-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_memory_and_continuation"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_profiles", sa.Column("memory_enabled", sa.Boolean, nullable=False, server_default="1"))
    op.add_column("user_profiles", sa.Column("long_term_memory", sa.Text, nullable=True))
    op.add_column("sessions", sa.Column("continuation_context", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("user_profiles", "memory_enabled")
    op.drop_column("user_profiles", "long_term_memory")
    op.drop_column("sessions", "continuation_context")
