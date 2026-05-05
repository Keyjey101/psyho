import csv
import io
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
import structlog
from sqlalchemy import select, func, text, case, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from typing import Optional

from app.middleware.admin import get_admin_user
from app.database import get_db
from app.models.models import (
    User, ChatSession, Message, MoodEntry, AnonymousInsight,
    AppSetting, Achievement, DiaryEntry, SessionTask,
)

logger = structlog.get_logger()
router = APIRouter(prefix="/api/admin", tags=["admin"])


async def _get_setting(db: AsyncSession, key: str, default: str = "") -> str:
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    setting = result.scalar_one_or_none()
    return setting.value if setting else default


async def _set_setting(db: AsyncSession, key: str, value: str):
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = value
        setting.updated_at = datetime.now(timezone.utc)
    else:
        db.add(AppSetting(key=key, value=value))
    await db.flush()


@router.get("/stats")
async def get_stats(admin=Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    users_count = await db.scalar(select(func.count()).select_from(User))
    sessions_count = await db.scalar(select(func.count()).select_from(ChatSession))
    messages_count = await db.scalar(select(func.count()).select_from(Message))
    tokens_result = await db.execute(
        select(func.sum(Message.total_tokens)).where(Message.total_tokens.isnot(None))
    )
    total_tokens = tokens_result.scalar() or 0

    token_price = float(await _get_setting(db, "token_price", "0.0"))

    return {
        "users": users_count,
        "sessions": sessions_count,
        "messages": messages_count,
        "total_tokens": total_tokens,
        "estimated_cost": round(total_tokens * token_price, 4),
    }


@router.get("/stats/extended")
async def get_extended_stats(admin=Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

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

    tokens_total = (await db.execute(
        select(func.sum(Message.total_tokens)).where(Message.total_tokens.isnot(None))
    )).scalar() or 0

    tokens_7d = (await db.execute(
        select(func.sum(Message.total_tokens)).where(
            Message.total_tokens.isnot(None), Message.created_at >= seven_days_ago
        )
    )).scalar() or 0

    tokens_30d = (await db.execute(
        select(func.sum(Message.total_tokens)).where(
            Message.total_tokens.isnot(None), Message.created_at >= thirty_days_ago
        )
    )).scalar() or 0

    tokens_today = (await db.execute(
        select(func.sum(Message.total_tokens)).where(
            Message.total_tokens.isnot(None), Message.created_at >= today_start
        )
    )).scalar() or 0

    token_price = float(await _get_setting(db, "token_price", "0.0"))

    dau_result = await db.execute(
        select(func.count(func.distinct(Message.session_id)))
        .where(Message.created_at >= today_start)
    )
    sessions_today = dau_result.scalar() or 0

    active_users_today = await db.scalar(
        select(func.count(func.distinct(ChatSession.user_id)))
        .where(ChatSession.created_at >= today_start)
    )

    week_ago = now - timedelta(days=7)
    active_users_week = await db.scalar(
        select(func.count(func.distinct(ChatSession.user_id)))
        .where(ChatSession.created_at >= week_ago)
    )

    active_users_month = await db.scalar(
        select(func.count(func.distinct(ChatSession.user_id)))
        .where(ChatSession.created_at >= thirty_days_ago)
    )

    users_with_session = await db.scalar(select(func.count(func.distinct(ChatSession.user_id))))

    users_returned_subq = (
        select(ChatSession.user_id)
        .group_by(ChatSession.user_id)
        .having(func.count(ChatSession.id) >= 2)
    ).subquery()
    users_returned = await db.scalar(select(func.count()).select_from(users_returned_subq)) or 0

    sessions_msg_subq = (
        select(func.count(Message.id).label("cnt"))
        .where(Message.role == "user")
        .group_by(Message.session_id)
    ).subquery()
    session_msg_counts = (await db.execute(
        select(sessions_msg_subq.c.cnt)
    )).scalars().all()
    completed_sessions = sum(1 for c in session_msg_counts if c >= 15)

    daily_messages_result = await db.execute(
        select(
            func.strftime("%Y-%m-%d", Message.created_at).label("date"),
            func.count().label("cnt"),
        )
        .where(Message.created_at >= thirty_days_ago)
        .group_by(text("date"))
        .order_by(text("date"))
    )
    daily_messages = [{"date": d, "count": c} for d, c in daily_messages_result.all()]

    daily_tokens_result = await db.execute(
        select(
            func.strftime("%Y-%m-%d", Message.created_at).label("date"),
            func.sum(Message.total_tokens).label("tokens"),
        )
        .where(Message.created_at >= thirty_days_ago, Message.total_tokens.isnot(None))
        .group_by(text("date"))
        .order_by(text("date"))
    )
    daily_tokens = [{"date": d, "tokens": t or 0} for d, t in daily_tokens_result.all()]

    daily_mood_result = await db.execute(
        select(
            func.strftime("%Y-%m-%d", MoodEntry.created_at).label("date"),
            func.avg(MoodEntry.value).label("avg_mood"),
            func.count().label("cnt"),
        )
        .where(MoodEntry.created_at >= thirty_days_ago)
        .group_by(text("date"))
        .order_by(text("date"))
    )
    daily_mood = [{"date": d, "avg_mood": round(m, 2) if m else None, "count": c} for d, m, c in daily_mood_result.all()]

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
        "daily_messages": daily_messages,
        "daily_tokens": daily_tokens,
        "daily_mood": daily_mood,
        "tokens_total": tokens_total,
        "tokens_last_7d": tokens_7d,
        "tokens_last_30d": tokens_30d,
        "tokens_today": tokens_today,
        "token_price": token_price,
        "cost_total": round(tokens_total * token_price, 4),
        "cost_last_7d": round(tokens_7d * token_price, 4),
        "cost_last_30d": round(tokens_30d * token_price, 4),
        "cost_today": round(tokens_today * token_price, 4),
        "dau": active_users_today or 0,
        "wau": active_users_week or 0,
        "mau": active_users_month or 0,
        "retention_7d": round(users_returned / users_total * 100, 1) if users_total else 0,
        "retention_30d": round(users_returned / users_total * 100, 1) if users_total else 0,
        "sessions_completed_pct": round(completed_sessions / len(session_msg_counts) * 100, 1) if session_msg_counts else 0,
        "users_with_session": users_with_session or 0,
        "users_returned": users_returned,
        "activation_rate": round((users_with_session or 0) / users_total * 100, 1) if users_total else 0,
        "sessions_today": sessions_today,
    }


@router.get("/users")
async def list_users(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = Query(None),
    active_only: Optional[bool] = Query(None),
    sort: str = Query("created_at"),
    order: str = Query("desc"),
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(User)

    if search:
        search_lower = f"%{search.lower()}%"
        query = query.where(
            (func.lower(User.email).like(search_lower)) |
            (func.lower(User.name).like(search_lower))
        )

    if active_only is not None:
        query = query.where(User.is_active == active_only)

    sort_col = getattr(User, sort, User.created_at)
    if order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    user_data = []
    for u in users:
        sessions_count = await db.scalar(
            select(func.count()).select_from(ChatSession).where(ChatSession.user_id == u.id)
        )
        messages_count = await db.scalar(
            select(func.count())
            .select_from(Message)
            .join(ChatSession, Message.session_id == ChatSession.id)
            .where(ChatSession.user_id == u.id)
        )
        tokens = (await db.execute(
            select(func.sum(Message.total_tokens))
            .join(ChatSession, Message.session_id == ChatSession.id)
            .where(ChatSession.user_id == u.id, Message.total_tokens.isnot(None))
        )).scalar() or 0
        last_session = await db.scalar(
            select(func.max(ChatSession.updated_at)).where(ChatSession.user_id == u.id)
        )
        avg_mood = await db.scalar(
            select(func.avg(MoodEntry.value)).where(MoodEntry.user_id == u.id)
        )
        token_price = float(await _get_setting(db, "token_price", "0.0"))

        user_data.append({
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "created_at": u.created_at,
            "is_active": u.is_active,
            "sessions_count": sessions_count or 0,
            "messages_count": messages_count or 0,
            "tokens_total": tokens,
            "cost_total": round(tokens * token_price, 4),
            "last_active_at": last_session,
            "avg_mood": round(avg_mood, 1) if avg_mood else None,
        })

    return user_data


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: str,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    token_price = float(await _get_setting(db, "token_price", "0.0"))

    sessions_result = await db.execute(
        select(ChatSession).where(ChatSession.user_id == user_id)
        .order_by(ChatSession.created_at.desc()).limit(20)
    )
    sessions = sessions_result.scalars().all()

    session_data = []
    for s in sessions:
        msg_count = await db.scalar(
            select(func.count()).select_from(Message)
            .where(Message.session_id == s.id, Message.role == "user")
        )
        tokens = (await db.execute(
            select(func.sum(Message.total_tokens))
            .where(Message.session_id == s.id, Message.total_tokens.isnot(None))
        )).scalar() or 0
        session_data.append({
            "id": s.id,
            "title": s.title,
            "created_at": s.created_at,
            "updated_at": s.updated_at,
            "message_count": msg_count or 0,
            "tokens": tokens,
            "cost": round(tokens * token_price, 4),
        })

    total_tokens = (await db.execute(
        select(func.sum(Message.total_tokens))
        .join(ChatSession, Message.session_id == ChatSession.id)
        .where(ChatSession.user_id == user_id, Message.total_tokens.isnot(None))
    )).scalar() or 0

    total_messages = await db.scalar(
        select(func.count())
        .select_from(Message)
        .join(ChatSession, Message.session_id == ChatSession.id)
        .where(ChatSession.user_id == user_id)
    )

    total_sessions = await db.scalar(
        select(func.count()).select_from(ChatSession).where(ChatSession.user_id == user_id)
    )

    avg_mood = await db.scalar(
        select(func.avg(MoodEntry.value)).where(MoodEntry.user_id == user_id)
    )

    achievements = (await db.execute(
        select(Achievement).where(Achievement.user_id == user_id)
        .order_by(Achievement.earned_at.desc())
    )).scalars().all()

    diary_count = await db.scalar(
        select(func.count()).select_from(DiaryEntry).where(DiaryEntry.user_id == user_id)
    )

    tasks_count = await db.scalar(
        select(func.count()).select_from(SessionTask).where(SessionTask.user_id == user_id)
    )
    tasks_completed = await db.scalar(
        select(func.count()).select_from(SessionTask)
        .where(SessionTask.user_id == user_id, SessionTask.completed == True)  # noqa: E712
    )

    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "created_at": user.created_at,
        "is_active": user.is_active,
        "total_sessions": total_sessions or 0,
        "total_messages": total_messages or 0,
        "total_tokens": total_tokens,
        "total_cost": round(total_tokens * token_price, 4),
        "avg_mood": round(avg_mood, 1) if avg_mood else None,
        "diary_entries_count": diary_count or 0,
        "tasks_count": tasks_count or 0,
        "tasks_completed": tasks_completed or 0,
        "achievements": [
            {"achievement_type": a.achievement_type, "earned_at": a.earned_at}
            for a in achievements
        ],
        "sessions": session_data,
    }


class SettingUpdate(BaseModel):
    key: str
    value: str


class SettingsUpdate(BaseModel):
    settings: list[SettingUpdate]


@router.get("/settings")
async def get_settings_endpoint(admin=Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppSetting))
    settings = result.scalars().all()
    return {s.key: s.value for s in settings}


@router.put("/settings")
async def update_settings(
    body: SettingsUpdate,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    for s in body.settings:
        await _set_setting(db, s.key, s.value)
    await db.commit()
    return {"ok": True}


@router.get("/insights")
async def list_insights_admin(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    approved: Optional[bool] = Query(None),
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit
    query = select(AnonymousInsight).order_by(AnonymousInsight.created_at.desc())

    if approved is not None:
        query = query.where(AnonymousInsight.is_approved == approved)

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    insights = result.scalars().all()

    total = await db.scalar(select(func.count()).select_from(AnonymousInsight))
    pending = await db.scalar(
        select(func.count()).select_from(AnonymousInsight)
        .where(AnonymousInsight.is_approved == True)  # noqa: E712
    )

    return {
        "total": total or 0,
        "pending_count": (total or 0) - (pending or 0),
        "insights": [
            {
                "id": i.id,
                "content": i.content,
                "reactions": i.reactions,
                "created_at": i.created_at,
                "is_approved": i.is_approved,
            }
            for i in insights
        ],
    }


@router.patch("/insights/{insight_id}/toggle")
async def toggle_insight(
    insight_id: str,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AnonymousInsight).where(AnonymousInsight.id == insight_id))
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=404, detail="Инсайт не найден")
    insight.is_approved = not insight.is_approved
    await db.commit()
    return {"ok": True, "is_approved": insight.is_approved}


@router.patch("/users/{user_id}/status")
async def toggle_user_status(
    user_id: str,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.is_active = not user.is_active
    await db.commit()
    return {"ok": True, "is_active": user.is_active}


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


@router.get("/export/users")
async def export_users_csv(
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()

    token_price = float(await _get_setting(db, "token_price", "0.0"))

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Email", "Имя", "Дата регистрации", "Активен",
        "Сессии", "Сообщения", "Токены", "Стоимость", "Последняя активность",
    ])

    for u in users:
        sessions_count = await db.scalar(
            select(func.count()).select_from(ChatSession).where(ChatSession.user_id == u.id)
        ) or 0
        messages_count = await db.scalar(
            select(func.count())
            .select_from(Message)
            .join(ChatSession, Message.session_id == ChatSession.id)
            .where(ChatSession.user_id == u.id)
        ) or 0
        tokens = (await db.execute(
            select(func.sum(Message.total_tokens))
            .join(ChatSession, Message.session_id == ChatSession.id)
            .where(ChatSession.user_id == u.id, Message.total_tokens.isnot(None))
        )).scalar() or 0
        last_active = await db.scalar(
            select(func.max(ChatSession.updated_at)).where(ChatSession.user_id == u.id)
        )

        writer.writerow([
            u.id,
            u.email,
            u.name,
            u.created_at.isoformat() if u.created_at else "",
            "Да" if u.is_active else "Нет",
            sessions_count,
            messages_count,
            tokens,
            round(tokens * token_price, 4),
            last_active.isoformat() if last_active else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=users_export_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
        },
    )
