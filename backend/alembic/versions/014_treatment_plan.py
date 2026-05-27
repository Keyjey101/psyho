"""Treatment plan + challenge_tolerance

Revision ID: 014_treatment_plan
Revises: 013_add_game_tables
Create Date: 2026-05-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "014_treatment_plan"
down_revision: Union[str, None] = "013_add_game_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "treatment_plans",
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("formulation", sa.Text(), nullable=False),
        sa.Column("focus_areas", sa.Text(), nullable=False),
        sa.Column("active_focus_id", sa.String(36), nullable=True),
        sa.Column("plan_summary", sa.Text(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("plan_hash", sa.String(64), nullable=True),
        sa.Column("last_session_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    op.add_column(
        "user_profiles",
        sa.Column("challenge_tolerance", sa.String(10), nullable=False, server_default="balanced"),
    )


def downgrade() -> None:
    op.drop_column("user_profiles", "challenge_tolerance")
    op.drop_table("treatment_plans")
