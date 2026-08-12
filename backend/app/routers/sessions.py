import json
import asyncio
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db, async_session
from app.models.models import ChatSession, Message, User, TreatmentPlan
from app.schemas.session import SessionCreate, SessionUpdate, SessionResponse, SessionListResponse, SessionDetailResponse
from app.middleware.auth import get_current_user
from app.services import billing, events
from app.services.plan_service import (
    get_or_none as get_plan,
    update_plan,
    build_initial_plan,
)

settings = get_settings()
logger = structlog.get_logger()

router = APIRouter()


def _paywall_payload(user: User) -> dict:
    quota = billing.get_user_quota(user)
    return {
        "reason": "session_quota_exhausted",
        "tier": quota["tier"],
        "free_sessions_left": quota["free_sessions_left"],
        "paid_sessions_left": quota["paid_sessions_left"],
        # Fake door: a real price screen that takes no money and collects a
        # contact instead. Never shown to someone in an acute state.
        "fake_door": settings.FAKE_DOOR_ENABLED,
        "price_rub": settings.FAKE_DOOR_PRICE_RUB,
    }


async def _had_recent_crisis(db: AsyncSession, user_id: str) -> bool:
    """True if the user's most recent session tripped the crisis detector.

    Gates the fake door: per spec, a person who just disclosed a crisis must not
    be met with a wall saying their credits ran out.
    """
    result = await db.execute(
        select(ChatSession.crisis_flagged)
        .where(ChatSession.user_id == user_id)
        .order_by(ChatSession.updated_at.desc())
        .limit(1)
    )
    return bool(result.scalar_one_or_none())


async def _consume_or_paywall(db: AsyncSession, user: User) -> None:
    """Spend one session credit, or raise 402 with the paywall payload.

    Crisis exception: instead of the paywall, grant a small emergency reserve so
    the conversation can continue. Logged so the cost is visible in the admin.
    """
    if billing.consume_session_quota(user) is not None:
        return

    if await _had_recent_crisis(db, user.id):
        reserve = settings.CRISIS_EMERGENCY_SESSIONS
        if reserve > 0:
            user.sessions_quota_balance = (user.sessions_quota_balance or 0) + reserve
            billing.consume_session_quota(user)
            await events.log_event(
                events.EVENT_CRISIS_RESOURCES_SHOWN,
                user_id=user.id,
                campaign_code=user.campaign_code,
                payload={"reason": "emergency_session_granted"},
                db=db,
            )
            logger.info("crisis_emergency_session_granted", user_id=user.id)
            return

    await events.log_event(
        events.EVENT_CREDITS_EXHAUSTED,
        user_id=user.id,
        campaign_code=user.campaign_code,
        payload={"tier": billing.get_user_quota(user)["tier"]},
        db=db,
    )
    await db.commit()
    raise HTTPException(status_code=402, detail=_paywall_payload(user))


@router.get("")
async def list_sessions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user.id)
        .order_by(ChatSession.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    sessions = result.scalars().all()

    count_result = await db.execute(
        select(func.count(ChatSession.id)).where(ChatSession.user_id == user.id)
    )
    total = count_result.scalar() or 0

    return {
        "sessions": [SessionListResponse.model_validate(s) for s in sessions],
        "total": total,
        "page": page,
        "limit": limit,
        "has_next": offset + len(sessions) < total,
    }


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(body: SessionCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _consume_or_paywall(db, user)
    session = ChatSession(user_id=user.id, title=body.title, max_exchanges=settings.SESSION_MAX_EXCHANGES)
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Check for session-related achievements (fire-and-forget style)
    try:
        from app.services.achievement_service import check_and_award
        await check_and_award(user.id, "session_created", db)
    except Exception:
        pass

    return session


@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session(session_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    msg_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.desc())
        .limit(50)
    )
    messages = list(reversed(msg_result.scalars().all()))

    count_result = await db.execute(
        select(func.count()).where(Message.session_id == session_id, Message.role == "user")
    )
    exchange_count = count_result.scalar() or 0

    from app.schemas.message import MessageResponse
    return SessionDetailResponse(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        summary=session.summary,
        continuation_context=session.continuation_context,
        max_exchanges=session.max_exchanges,
        exchange_count=exchange_count,
        messages=[MessageResponse.model_validate(m) for m in messages],
    )


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(session_id: str, body: SessionUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if body.title is not None:
        session.title = body.title
    session.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    return session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.delete(session)
    await db.commit()


@router.post("/{session_id}/continue", status_code=status.HTTP_201_CREATED)
async def continue_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    prev_session = result.scalar_one_or_none()
    if not prev_session:
        raise HTTPException(status_code=404, detail="Session not found")

    await _consume_or_paywall(db, user)

    use_continuation = billing.continuation_enabled_for(user)

    msg_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.desc())
        .limit(20)
    )
    all_messages = list(reversed(msg_result.scalars().all()))

    insights = ""
    if all_messages:
        pairs_text = ""
        for m in all_messages[-10:]:
            role = "Пользователь" if m.role == "user" else "Ника"
            pairs_text += f"{role}: {m.content[:300]}\n"

        from app.agents.base import client
        from app.config import get_settings
        settings = get_settings()

        try:
            response = await client.chat.completions.create(
                model=settings.ZAI_SMALL_MODEL,
                max_tokens=500,
                temperature=0.3,
                messages=[
                    {
                        "role": "user",
                        "content": f"""Из этой сессии извлеки выжимку для следующей встречи.

Верни JSON:
{{
  "main_theme": "одна фраза — главная тема",
  "user_request": "что человек хотел получить от сессии",
  "key_insights": ["инсайт 1", "инсайт 2"],
  "homework": "конкретная практика если была",
  "continue_from": "с чего начать следующий разговор — 1 предложение"
}}

Диалог:
{pairs_text}""",
                    }
                ],
            )
            raw = response.choices[0].message.content.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            json.loads(raw)
            insights = raw
        except Exception:
            insights = '{"main_theme": "Сессия завершена", "user_request": "", "key_insights": [], "homework": "", "continue_from": "Продолжим с того места, где остановились."}'

    continuation_ctx = json.dumps({
        "previous_title": prev_session.title or "Без названия",
        "insights": insights,
        "previous_id": session_id,
    }, ensure_ascii=False) if use_continuation else None

    new_session = ChatSession(
        user_id=user.id,
        title=None,
        continuation_context=continuation_ctx,
        max_exchanges=settings.SESSION_MAX_EXCHANGES,
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)

    history_dicts = [
        {"role": "user" if m.role == "user" else "assistant", "content": m.content}
        for m in all_messages
    ]
    from app.models.models import UserProfile
    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()
    ltm = profile.long_term_memory if profile else ""

    plan_obj = await get_plan(user.id, db)
    if plan_obj:
        plan_dict = {"formulation": plan_obj.formulation, "focus_areas": plan_obj.focus_areas}
        asyncio.create_task(
            _background_plan_update(
                user.id, history_dicts, ltm, plan_dict, session_id,
            )
        )
    else:
        sessions_count = await db.execute(
            select(func.count()).where(ChatSession.user_id == user.id)
        )
        if (sessions_count.scalar() or 0) >= 1:
            asyncio.create_task(
                _background_plan_build(user.id, history_dicts, ltm, session_id)
            )

    return {
        "new_session_id": new_session.id,
        "previous_title": prev_session.title or "Без названия",
        "insights_preview": insights[:100] if insights else "",
    }


async def _background_plan_update(
    user_id: str, history: list[dict], memory: str, plan_dict: dict, session_id: str
):
    try:
        async with async_session() as p_db:
            await update_plan(user_id, history, memory, plan_dict, p_db, session_id=session_id)
    except Exception as e:
        import structlog
        structlog.get_logger().error("Background plan update (continue_session) error", error=str(e))


async def _background_plan_build(
    user_id: str, history: list[dict], memory: str, session_id: str
):
    try:
        async with async_session() as p_db:
            await build_initial_plan(user_id, history, memory, p_db, session_id=session_id)
    except Exception as e:
        import structlog
        structlog.get_logger().error("Background plan build (continue_session) error", error=str(e))


@router.get("/{session_id}/insights")
async def get_session_insights(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    msg_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id, Message.role == "assistant")
        .order_by(Message.created_at)
    )
    messages = list(msg_result.scalars().all())

    if not messages:
        return {"insights": "Пока недостаточно данных для инсайтов."}

    combined = "\n".join([m.content[:500] for m in messages[-10:]])

    from app.agents.base import client
    from app.config import get_settings
    settings = get_settings()

    try:
        response = await client.chat.completions.create(
            model=settings.ZAI_SMALL_MODEL,
            max_tokens=500,
            temperature=0.3,
            messages=[
                {
                    "role": "user",
                    "content": f"Проанализируй ответы ИИ-терапевта из сессии и выдели краткие инсайты: ключевые темы, эмоциональные паттерны, прогресс и рекомендации. Пиши на русском, кратко.\n\nОтветы терапевта:\n{combined}",
                }
            ],
        )
        insights = response.choices[0].message.content.strip()
    except Exception:
        insights = "Не удалось сгенерировать инсайты."

    return {"insights": insights, "session_title": session.title}


@router.get("/{session_id}/plan-progress")
async def get_plan_progress(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    plan = await get_plan(user.id, db)
    if not plan:
        return {"has_plan": False, "plan_summary": None, "active_focus_title": None, "active_focus_progress": None}

    active_focus_title = None
    active_focus_progress = None
    try:
        areas = json.loads(plan.focus_areas)
        for a in areas:
            if a.get("id") == plan.active_focus_id:
                active_focus_title = a.get("title", "")
                active_focus_progress = a.get("progress", 0)
                break
    except Exception:
        pass

    return {
        "has_plan": True,
        "plan_summary": plan.plan_summary,
        "active_focus_title": active_focus_title,
        "active_focus_progress": active_focus_progress,
    }
