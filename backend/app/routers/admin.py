from fastapi import APIRouter, Depends, HTTPException
import json
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta

from app.middleware.admin import get_admin_user
from app.database import get_db
from app.models.models import User, ChatSession, Message, MoodEntry

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
async def get_stats(admin=Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    users_count = await db.scalar(select(func.count()).select_from(User))
    sessions_count = await db.scalar(select(func.count()).select_from(ChatSession))
    messages_count = await db.scalar(select(func.count()).select_from(Message))
    return {
        "users": users_count,
        "sessions": sessions_count,
        "messages": messages_count,
    }


@router.get("/stats/extended")
async def get_extended_stats(admin=Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)

    users_total = await db.scalar(select(func.count()).select_from(User))
    users_last_7d = await db.scalar(
        select(func.count()).select_from(User).where(User.created_at >= seven_days_ago)
    )
    users_last_30d = await db.scalar(
        select(func.count()).select_from(User).where(User.created_at >= thirty_days_ago)
    )

    sessions_last_7d = await db.scalar(
        select(func.count()).select_from(ChatSession).where(ChatSession.created_at >= seven_days_ago)
    )
    sessions_last_30d = await db.scalar(
        select(func.count()).select_from(ChatSession).where(ChatSession.created_at >= thirty_days_ago)
    )

    avg_session_result = await db.execute(
        select(func.count(Message.id))
        .where(Message.role == "user")
        .group_by(Message.session_id)
    )
    counts = avg_session_result.scalars().all()
    avg_session_length = sum(counts) / len(counts) if counts else 0

    avg_mood = await db.scalar(
        select(func.avg(MoodEntry.value)).where(MoodEntry.created_at >= thirty_days_ago)
    )

    agent_usage_result = await db.execute(
        select(Message.agents_used, func.count().label("cnt"))
        .where(Message.agents_used.isnot(None))
        .group_by(Message.agents_used)
        .order_by(func.count().desc())
        .limit(20)
    )
    agent_usage: dict[str, int] = {}
    for agents_str, cnt in agent_usage_result.all():
        if agents_str:
            try:
                agents = json.loads(agents_str)
                for a in agents:
                    agent_usage[a] = agent_usage.get(a, 0) + cnt
            except Exception:
                pass

    top_topics_result = await db.execute(
        select(ChatSession.title, func.count().label("cnt"))
        .where(ChatSession.title.isnot(None), ChatSession.created_at >= thirty_days_ago)
        .group_by(ChatSession.title)
        .order_by(func.count().desc())
        .limit(10)
    )
    top_topics = [{"topic": t or "", "count": c} for t, c in top_topics_result.all()]

    daily_result = await db.execute(
        select(
            func.strftime("%Y-%m-%d", ChatSession.created_at).label("date"),
            func.count().label("cnt"),
        )
        .where(ChatSession.created_at >= thirty_days_ago)
        .group_by(text("date"))
        .order_by(text("date"))
    )
    daily_sessions = [{"date": d, "count": c} for d, c in daily_result.all()]

    return {
        "users_total": users_total,
        "users_last_7d": users_last_7d,
        "users_last_30d": users_last_30d,
        "sessions_last_7d": sessions_last_7d,
        "sessions_last_30d": sessions_last_30d,
        "avg_session_length_exchanges": round(avg_session_length or 0, 1),
        "avg_mood_last_30d": round(avg_mood, 1) if avg_mood else None,
        "agent_usage": agent_usage,
        "top_topics": top_topics,
        "daily_sessions": daily_sessions,
    }


@router.get("/users")
async def list_users(
    skip: int = 0,
    limit: int = 50,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
    )
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "created_at": u.created_at,
            "is_active": u.is_active,
        }
        for u in users
    ]


@router.patch("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.is_active = False
    await db.commit()
    return {"ok": True}
