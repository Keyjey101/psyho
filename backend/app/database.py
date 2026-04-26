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
    async with engine.begin() as conn:
        await conn.execute(sqlalchemy.text("PRAGMA journal_mode=WAL"))
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(sqlalchemy.text(
                "ALTER TABLE sessions ADD COLUMN max_exchanges INTEGER DEFAULT 20"
            ))
        except Exception:
            pass
