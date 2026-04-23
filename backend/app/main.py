from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import structlog

from app.config import get_settings
from app.database import init_db
from app.routers import auth, sessions, messages, users, mood, actions
from app.routers import admin as admin_router

logger = structlog.get_logger()
settings = get_settings()

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("PsyHo backend started", environment=settings.ENVIRONMENT)
    yield
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
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])
app.include_router(messages.router, prefix="/api/sessions", tags=["Messages"])
app.include_router(users.router, prefix="/api/user", tags=["User"])
app.include_router(admin_router.router)
app.include_router(mood.router, prefix="/api/mood", tags=["Mood"])
app.include_router(actions.router, prefix="/api/sessions", tags=["Actions"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.VERSION}
