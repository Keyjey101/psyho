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
    Payment, PromoCode, PromoRedemption, SubscriptionEvent,
)
from app.schemas.billing import AdminGrantRequest, PromoCreateRequest, PromoUpdateRequest
from app.services import billing, notify

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

        quota = billing.get_user_quota(u)
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
            "subscription_tier": quota["tier"],
            "subscription_expires_at": quota["expires_at"],
            "free_sessions_left": quota["free_sessions_left"],
            "paid_sessions_left": quota["paid_sessions_left"],
            "autorenew": quota["autorenew"],
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

    quota = billing.get_user_quota(user)

    grant_events_q = await db.execute(
        select(SubscriptionEvent)
        .where(
            SubscriptionEvent.user_id == user_id,
            SubscriptionEvent.event_type.in_(["admin_grant_pro", "admin_grant_sessions"]),
        )
        .order_by(SubscriptionEvent.created_at.desc())
        .limit(20)
    )
    grants = [
        {
            "event_type": e.event_type,
            "note": e.note,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in grant_events_q.scalars().all()
    ]

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
        "subscription_tier": quota["tier"],
        "subscription_expires_at": quota["expires_at"],
        "free_sessions_left": quota["free_sessions_left"],
        "paid_sessions_left": quota["paid_sessions_left"],
        "autorenew": quota["autorenew"],
        "notify_telegram_linked": quota["notify_telegram_linked"],
        "admin_grants": grants,
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


# ── Monetization admin: UTM, promo codes, payments ─────────────────────────


@router.get("/utm")
async def utm_breakdown(
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
):
    """Aggregates by ``utm_source × utm_campaign``.

    - ``users``: registered (lifetime, filtered by ``created_at`` window if provided)
    - ``paid_users``: distinct users with at least one ``succeeded`` payment
    - ``revenue_kopecks``: sum of succeeded payment amounts (less promo discount)
    - ``conversion_pct``: ``paid_users / users * 100``
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)

    users_q = await db.execute(
        select(
            func.coalesce(User.utm_source, "(none)").label("source"),
            func.coalesce(User.utm_campaign, "(none)").label("campaign"),
            func.count(User.id).label("users"),
        )
        .where(User.created_at >= since)
        .group_by("source", "campaign")
    )
    users_map: dict[tuple[str, str], int] = {(r.source, r.campaign): r.users for r in users_q}

    payments_q = await db.execute(
        select(
            func.coalesce(Payment.utm_source, "(none)").label("source"),
            func.coalesce(Payment.utm_campaign, "(none)").label("campaign"),
            func.count(func.distinct(Payment.user_id)).label("paid_users"),
            func.sum(Payment.amount_kopecks).label("revenue"),
        )
        .where(Payment.status == "succeeded", Payment.created_at >= since)
        .group_by("source", "campaign")
    )
    pay_map: dict[tuple[str, str], dict] = {
        (r.source, r.campaign): {"paid_users": r.paid_users, "revenue": int(r.revenue or 0)}
        for r in payments_q
    }

    keys = set(users_map.keys()) | set(pay_map.keys())
    rows = []
    for key in sorted(keys, key=lambda k: -(pay_map.get(k, {}).get("revenue", 0))):
        users = users_map.get(key, 0)
        pay = pay_map.get(key, {})
        paid = pay.get("paid_users", 0)
        revenue = pay.get("revenue", 0)
        rows.append({
            "utm_source": key[0],
            "utm_campaign": key[1],
            "users": users,
            "paid_users": paid,
            "revenue_kopecks": revenue,
            "conversion_pct": round(100 * paid / users, 1) if users else 0.0,
        })
    return {"days": days, "rows": rows}


@router.get("/promos")
async def list_promos(admin=Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(PromoCode).order_by(PromoCode.created_at.desc()))).scalars().all()
    return [
        {
            "id": r.id,
            "code": r.code,
            "discount_percent": r.discount_percent,
            "max_uses": r.max_uses,
            "used_count": r.used_count,
            "valid_until": r.valid_until.isoformat() if r.valid_until else None,
            "applies_to": r.applies_to,
            "active": r.active,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "created_by_admin_email": r.created_by_admin_email,
        }
        for r in rows
    ]


@router.post("/promos")
async def create_promo(
    body: PromoCreateRequest,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    code = body.code.strip().upper()
    existing = (await db.execute(select(PromoCode).where(PromoCode.code == code))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Промокод уже существует")
    promo = PromoCode(
        code=code,
        discount_percent=body.discount_percent,
        max_uses=body.max_uses,
        valid_until=body.valid_until,
        applies_to=body.applies_to,
        active=True,
        created_by_admin_email=getattr(admin, "email", None),
    )
    db.add(promo)
    await db.commit()
    await db.refresh(promo)
    return {"id": promo.id, "code": promo.code}


@router.patch("/promos/{promo_id}")
async def update_promo(
    promo_id: str,
    body: PromoUpdateRequest,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    promo = (await db.execute(select(PromoCode).where(PromoCode.id == promo_id))).scalar_one_or_none()
    if not promo:
        raise HTTPException(status_code=404, detail="Промокод не найден")
    if body.active is not None:
        promo.active = body.active
    if body.valid_until is not None:
        promo.valid_until = body.valid_until
    if body.max_uses is not None:
        promo.max_uses = body.max_uses
    await db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/grant")
async def grant_to_user(
    user_id: str,
    body: AdminGrantRequest,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually credit a user. Additive only — kind="pro_days" extends Pro
    access by N days, kind="sessions" tops up the paid-session balance."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    now = datetime.now(timezone.utc)
    admin_email = getattr(admin, "email", None) or "admin"
    note_prefix = f"by {admin_email}"
    user_note = (body.note or "").strip()
    full_note = f"{note_prefix}: {user_note}" if user_note else note_prefix

    if body.kind == "pro_days":
        if body.amount > 365:
            raise HTTPException(status_code=400, detail="Не более 365 дней за раз")
        previous_tier = user.subscription_tier
        cur = user.subscription_expires_at
        if cur is not None and cur.tzinfo is None:
            cur = cur.replace(tzinfo=timezone.utc)
        base = cur if (cur and cur > now) else now
        user.subscription_expires_at = base + timedelta(days=body.amount)
        user.subscription_tier = "pro"
        if not user.subscription_started_at:
            user.subscription_started_at = now
        db.add(SubscriptionEvent(
            user_id=user.id,
            event_type="admin_grant_pro",
            from_tier=previous_tier,
            to_tier="pro",
            note=f"+{body.amount}d {full_note}",
        ))
        msg = (
            f"🎁 Тебе начислено {body.amount} дн. Ника Pro. "
            f"Доступ до {user.subscription_expires_at:%d.%m.%Y}."
        )
    else:  # sessions
        if body.amount > 1000:
            raise HTTPException(status_code=400, detail="Не более 1000 сессий за раз")
        user.sessions_quota_balance = (user.sessions_quota_balance or 0) + body.amount
        db.add(SubscriptionEvent(
            user_id=user.id,
            event_type="admin_grant_sessions",
            from_tier=user.subscription_tier,
            to_tier=user.subscription_tier,
            note=f"+{body.amount} sessions {full_note}",
        ))
        msg = f"🎁 Начислено {body.amount} сессий. Всего доступно: {user.sessions_quota_balance}."

    await db.commit()

    try:
        await notify.notify_user(user, msg)
    except Exception as e:
        logger.warning("admin_grant_notify_failed", error=str(e), user_id=user.id)

    quota = billing.get_user_quota(user)
    return {
        "ok": True,
        "subscription_tier": quota["tier"],
        "subscription_expires_at": quota["expires_at"].isoformat() if quota["expires_at"] else None,
        "paid_sessions_left": quota["paid_sessions_left"],
        "free_sessions_left": quota["free_sessions_left"],
    }


@router.get("/payments")
async def list_payments(
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    status_filter: Optional[str] = Query(None, alias="status"),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(100, ge=1, le=500),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    q = select(Payment).where(Payment.created_at >= since).order_by(Payment.created_at.desc()).limit(limit)
    if status_filter:
        q = q.where(Payment.status == status_filter)
    rows = (await db.execute(q)).scalars().all()
    return [
        {
            "id": p.id,
            "user_id": p.user_id,
            "amount_kopecks": p.amount_kopecks,
            "discount_kopecks": p.discount_kopecks,
            "status": p.status,
            "purpose": p.purpose,
            "is_recurring": p.is_recurring,
            "utm_source": p.utm_source,
            "utm_campaign": p.utm_campaign,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "completed_at": p.completed_at.isoformat() if p.completed_at else None,
        }
        for p in rows
    ]
