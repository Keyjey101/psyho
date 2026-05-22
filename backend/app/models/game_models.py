"""SQLAlchemy models for the Beat-Nika mini-game."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, Integer, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def gen_uuid() -> str:
    return str(uuid.uuid4())


class UserPseudonym(Base):
    """A display name chosen by (or generated for) a player."""
    __tablename__ = "user_pseudonyms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    leaderboard_entries: Mapped[list["LeaderboardEntry"]] = relationship(
        "LeaderboardEntry", back_populates="pseudonym", lazy="selectin"
    )


class GameSession(Base):
    """One play-through of the Beat-Nika game."""
    __tablename__ = "game_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    # anonymous cookie-based identifier (UUID string)
    anon_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    pseudonym_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("user_pseudonyms.id", ondelete="SET NULL"), nullable=True
    )

    # Game state
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active"
    )  # active | finished | expired
    move_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # JSON list of answer dicts: [{question, choice_text, choice_index}, ...]
    answers: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON list of past question strings (for de-duplication)
    past_questions: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Detected dominant topic (set at game end)
    dominant_topic: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Scenario: "A" (Nika wins) or "B" (user wins)
    scenario: Mapped[str | None] = mapped_column(String(2), nullable=True)
    # Address form preference (ты / вы)
    address_form: Mapped[str] = mapped_column(String(8), nullable=False, default="ты")

    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Wall-clock seconds taken to finish (set at game end)
    time_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)


class LeaderboardEntry(Base):
    """One scored result on the leaderboard."""
    __tablename__ = "leaderboard_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    pseudonym_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("user_pseudonyms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    moves_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    time_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # "A" = Nika wins, "B" = user wins
    scenario: Mapped[str] = mapped_column(String(2), nullable=False, default="A")
    topic: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    pseudonym: Mapped["UserPseudonym"] = relationship(
        "UserPseudonym", back_populates="leaderboard_entries"
    )


class LandingAnswer(Base):
    """Quick answers submitted from the landing page (before full session)."""
    __tablename__ = "landing_answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    anon_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    choice_text: Mapped[str] = mapped_column(Text, nullable=False)
    choice_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class BudgetTracker(Base):
    """Running total of LLM spend for the game feature (single-row table)."""
    __tablename__ = "budget_tracker"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    total_cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
