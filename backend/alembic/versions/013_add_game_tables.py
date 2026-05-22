"""Add Beat-Nika mini-game tables

Revision ID: 013_add_game_tables
Revises: 012_monetization
Create Date: 2026-05-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "013_add_game_tables"
down_revision: Union[str, None] = "012_monetization"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. user_pseudonyms
    op.create_table(
        "user_pseudonyms",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(64), nullable=False, unique=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_user_pseudonyms_name", "user_pseudonyms", ["name"], unique=True)
    op.create_index("ix_user_pseudonyms_user_id", "user_pseudonyms", ["user_id"])

    # 2. game_sessions
    op.create_table(
        "game_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("anon_id", sa.String(64), nullable=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("pseudonym_id", sa.String(36), sa.ForeignKey("user_pseudonyms.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("move_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("answers", sa.Text(), nullable=True),
        sa.Column("past_questions", sa.Text(), nullable=True),
        sa.Column("dominant_topic", sa.String(64), nullable=True),
        sa.Column("scenario", sa.String(2), nullable=True),
        sa.Column("address_form", sa.String(8), nullable=False, server_default="ты"),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("time_seconds", sa.Integer(), nullable=True),
    )
    op.create_index("ix_game_sessions_anon_id", "game_sessions", ["anon_id"])
    op.create_index("ix_game_sessions_user_id", "game_sessions", ["user_id"])

    # 3. leaderboard_entries
    op.create_table(
        "leaderboard_entries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("pseudonym_id", sa.String(36), sa.ForeignKey("user_pseudonyms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("moves_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("time_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("scenario", sa.String(2), nullable=False, server_default="A"),
        sa.Column("topic", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_leaderboard_entries_pseudonym_id", "leaderboard_entries", ["pseudonym_id"])

    # 4. landing_answers
    op.create_table(
        "landing_answers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("anon_id", sa.String(64), nullable=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("choice_text", sa.Text(), nullable=False),
        sa.Column("choice_index", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_landing_answers_anon_id", "landing_answers", ["anon_id"])
    op.create_index("ix_landing_answers_user_id", "landing_answers", ["user_id"])

    # 5. budget_tracker
    op.create_table(
        "budget_tracker",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("total_cost_usd", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # Seed initial budget_tracker row
    op.execute(
        "INSERT INTO budget_tracker (id, total_cost_usd, prompt_tokens, completion_tokens, updated_at) "
        "VALUES (1, 0.0, 0, 0, CURRENT_TIMESTAMP)"
    )


def downgrade() -> None:
    op.drop_table("budget_tracker")
    op.drop_table("landing_answers")
    op.drop_table("leaderboard_entries")
    op.drop_table("game_sessions")
    op.drop_table("user_pseudonyms")
