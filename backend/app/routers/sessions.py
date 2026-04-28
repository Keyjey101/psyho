import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.models import ChatSession, Message, User
from app.schemas.session import SessionCreate, SessionUpdate, SessionResponse, SessionListResponse, SessionDetailResponse
from app.middleware.auth import get_current_user

settings = get_settings()

router = APIRouter()


@router.get("", response_model=list[SessionListResponse])
async def list_sessions(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(body: SessionCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    session = ChatSession(user_id=user.id, title=body.title, max_exchanges=settings.SESSION_MAX_EXCHANGES)
    db.add(session)
    await db.commit()
    await db.refresh(session)
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
    }, ensure_ascii=False)

    new_session = ChatSession(
        user_id=user.id,
        title=None,
        continuation_context=continuation_ctx,
        max_exchanges=settings.SESSION_MAX_EXCHANGES,
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)

    return {
        "new_session_id": new_session.id,
        "previous_title": prev_session.title or "Без названия",
        "insights_preview": insights[:100] if insights else "",
    }


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
