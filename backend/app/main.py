from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import structlog

from app.config import get_settings
from app.database import init_db, async_session
from app.routers import auth, sessions, messages, users, mood, actions, personality, tasks
from app.routers import admin as admin_router
from app.services.telegram_bot import start_bot, stop_bot

logger = structlog.get_logger()
settings = get_settings()

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    if settings.TELEGRAM_BOT_TOKEN:
        await start_bot()
    logger.info("PsyHo backend started", environment=settings.ENVIRONMENT)
    yield
    if settings.TELEGRAM_BOT_TOKEN:
        await stop_bot()
    logger.info("PsyHo backend shutting down")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])
app.include_router(messages.router, prefix="/api/sessions", tags=["Messages"])
app.include_router(users.router, prefix="/api/user", tags=["User"])
app.include_router(admin_router.router)
app.include_router(mood.router, prefix="/api/mood", tags=["Mood"])
app.include_router(actions.router, prefix="/api/sessions", tags=["Actions"])
app.include_router(personality.router, prefix="/api/user", tags=["Personality"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])


@app.get("/health")
async def health():
    db_ok = False
    try:
        async with async_session() as db:
            from sqlalchemy import text
            await db.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        pass
    status_val = "ok" if db_ok else "degraded"
    return {"status": status_val, "version": settings.VERSION, "db": db_ok}
