import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    telegram_id: Mapped[str | None] = mapped_column(String(20), nullable=True, unique=True, index=True)
    telegram_username: Mapped[str | None] = mapped_column(String(64), nullable=True)

    sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")


class ChatSession(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    summary: Mapped[str | None] = mapped_column(Text)
    continuation_context: Mapped[str | None] = mapped_column(Text)
    max_exchanges: Mapped[int] = mapped_column(Integer, default=20, server_default="20")

    user = relationship("User", back_populates="sessions")
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    agents_used: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    session = relationship("ChatSession", back_populates="messages")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    therapy_goals: Mapped[str | None] = mapped_column(Text)
    preferred_style: Mapped[str] = mapped_column(String(20), default="balanced")
    crisis_plan: Mapped[str | None] = mapped_column(Text)
    memory_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    long_term_memory: Mapped[str | None] = mapped_column(Text)
    memory_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pop_score: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    address_form: Mapped[str] = mapped_column(String(10), default="ты", server_default="ты")
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="profile")


class TelegramVerificationCode(Base):
    __tablename__ = "telegram_verification_codes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    telegram_username: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    code_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    telegram_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    used: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")


class MoodEntry(Base):
    __tablename__ = "mood_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("sessions.id", ondelete="SET NULL"))
    value: Mapped[int] = mapped_column(nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user = relationship("User")
    session = relationship("ChatSession")


class PersonalitySnapshot(Base):
    __tablename__ = "personality_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    self_awareness: Mapped[int] = mapped_column(Integer, default=50)
    emotional_regulation: Mapped[int] = mapped_column(Integer, default=50)
    self_compassion: Mapped[int] = mapped_column(Integer, default=50)
    acceptance: Mapped[int] = mapped_column(Integer, default=50)
    values_clarity: Mapped[int] = mapped_column(Integer, default=50)
    resourcefulness: Mapped[int] = mapped_column(Integer, default=50)
    dominant_theme: Mapped[str | None] = mapped_column(String(50))
    summary_note: Mapped[str | None] = mapped_column(Text)


class SessionTask(Base):
    __tablename__ = "session_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class DiaryEntry(Base):
    __tablename__ = "diary_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    user_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    topics: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mood_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User")
    session = relationship("ChatSession")


class TimeCapsule(Base):
    __tablename__ = "time_capsules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    open_after: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    opened: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user = relationship("User")


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    achievement_type: Mapped[str] = mapped_column(String(50), nullable=False)
    earned_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user = relationship("User")


class TestResult(Base):
    __tablename__ = "test_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    test_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    level: Mapped[str] = mapped_column(String(80), nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user = relationship("User")


class AnonymousInsight(Base):
    __tablename__ = "anonymous_insights"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    reactions: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True)
