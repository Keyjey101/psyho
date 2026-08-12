from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
import sqlalchemy

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


async def init_db():
    # Import for the side effect of registering every table on Base.metadata
    # before create_all runs — without this the new tables silently never appear.
    from app.models import models as _models  # noqa: F401
    from app.models import analytics_models as _analytics_models  # noqa: F401

    async with engine.begin() as conn:
        await conn.execute(sqlalchemy.text("PRAGMA journal_mode=WAL"))
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(sqlalchemy.text(
                "ALTER TABLE sessions ADD COLUMN max_exchanges INTEGER DEFAULT 20"
            ))
        except Exception:
            pass
        try:
            await conn.execute(sqlalchemy.text(
                "ALTER TABLE messages ADD COLUMN prompt_tokens INTEGER"
            ))
        except Exception:
            pass
        try:
            await conn.execute(sqlalchemy.text(
                "ALTER TABLE messages ADD COLUMN completion_tokens INTEGER"
            ))
        except Exception:
            pass
        try:
            await conn.execute(sqlalchemy.text(
                "ALTER TABLE messages ADD COLUMN total_tokens INTEGER"
            ))
        except Exception:
            pass
        # Monetization columns — additive, idempotent
        for ddl in (
            "ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(20) DEFAULT 'free'",
            "ALTER TABLE users ADD COLUMN subscription_expires_at DATETIME",
            "ALTER TABLE users ADD COLUMN subscription_started_at DATETIME",
            "ALTER TABLE users ADD COLUMN autorenew_enabled BOOLEAN DEFAULT 0",
            "ALTER TABLE users ADD COLUMN sessions_quota_balance INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN lifetime_free_sessions_used INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN saved_payment_method_id VARCHAR(64)",
            "ALTER TABLE users ADD COLUMN utm_source VARCHAR(64)",
            "ALTER TABLE users ADD COLUMN utm_medium VARCHAR(64)",
            "ALTER TABLE users ADD COLUMN utm_campaign VARCHAR(128)",
            "ALTER TABLE users ADD COLUMN utm_content VARCHAR(128)",
            "ALTER TABLE users ADD COLUMN utm_term VARCHAR(128)",
            "ALTER TABLE users ADD COLUMN referrer_host VARCHAR(128)",
            "ALTER TABLE users ADD COLUMN notify_telegram_id VARCHAR(20)",
            "ALTER TABLE users ADD COLUMN notify_link_token VARCHAR(64)",
            # Acquisition analytics — additive, idempotent
            "ALTER TABLE users ADD COLUMN campaign_code VARCHAR(32)",
            "ALTER TABLE users ADD COLUMN consent_accepted_at DATETIME",
            "ALTER TABLE sessions ADD COLUMN crisis_flagged BOOLEAN DEFAULT 0",
        ):
            try:
                await conn.execute(sqlalchemy.text(ddl))
            except Exception:
                pass
