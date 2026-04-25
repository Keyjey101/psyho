import json
import structlog
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.models.models import ChatSession, Message, User, UserProfile
from app.schemas.message import MessageResponse, MessageListResponse
from app.middleware.auth import get_current_user
from app.services.auth import decode_token
from app.agents.orchestrator import Orchestrator
from app.services.context import maybe_compress_context, generate_session_title
from app.services.memory_service import extract_and_update_memory

from app.config import get_settings

router = APIRouter()

orchestrator = Orchestrator()
settings = get_settings()


@router.get("/{session_id}/messages", response_model=MessageListResponse)
async def list_messages(
    session_id: str,
    offset: int = 0,
    limit: int = 50,
    before_id: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found")

    count_result = await db.execute(
        select(func.count()).where(Message.session_id == session_id)
    )
    total = count_result.scalar() or 0

    q = (
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.desc())
    )
    if before_id:
        sub = select(Message.created_at).where(Message.id == before_id).limit(1)
        sub_result = await db.execute(sub)
        before_time = sub_result.scalar_one_or_none()
        if before_time:
            q = q.where(Message.created_at < before_time)

    msg_result = await db.execute(q.offset(offset).limit(limit))
    messages = list(reversed(msg_result.scalars().all()))
    return MessageListResponse(messages=messages, total=total)


@router.websocket("/{session_id}/chat")
async def websocket_chat(websocket: WebSocket, session_id: str):
    token = websocket.cookies.get("access_token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = payload.get("sub")

    async with async_session() as db:
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            await websocket.close(code=4004, reason="Session not found")
            return

        profile_result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == user_id)
        )
        profile = profile_result.scalar_one_or_none()
        preferred_style = profile.preferred_style if profile else "balanced"
        long_term_memory = profile.long_term_memory if (profile and profile.memory_enabled) else ""
        therapy_goals = profile.therapy_goals or "" if profile else ""
        address_form = getattr(profile, "address_form", "ты") if profile else "ты"
        gender = getattr(profile, "gender", "") if profile else ""

        continuation_context = session.continuation_context
        existing_msg_result = await db.execute(
            select(func.count()).where(Message.session_id == session_id)
        )
        existing_count = existing_msg_result.scalar() or 0

    await websocket.accept()

    if continuation_context and existing_count == 0:
        try:
            ctx = json.loads(continuation_context)
            insights = ctx.get("insights", "")
            prev_title = ctx.get("previous_title", "нашу предыдущую сессию")
        except Exception:
            insights = ""
            prev_title = "нашу предыдущую сессию"

        if insights:
            continuation_prompt = f"""КОНТЕКСТ ДЛЯ НИКА (не показывать пользователю):
Это продолжение предыдущей сессии «{prev_title}».
Инсайты и итоги прошлой работы:
{insights}

ЗАДАЧА: Начни новую сессию естественно. Поприветствуй пользователя,
кратко напомни о чём говорили (не перечисляй всё — выбери главное),
спроси как он/она себя чувствует после того разговора,
и мягко предложи продолжить работу или попробовать что-то новое.
Говори как Ника — тепло, без официоза."""

            greeting_content = ""
            try:
                from app.agents.base import client as ai_client

                stream = await ai_client.chat.completions.create(
                    model=settings.ZAI_MODEL,
                    max_tokens=settings.SYNTHESIS_MAX_TOKENS,
                    temperature=0.7,
                    messages=[
                        {"role": "system", "content": orchestrator.system_prompt},
                        {"role": "user", "content": continuation_prompt},
                    ],
                    stream=True,
                )
                await websocket.send_json({"type": "agents_used", "agents": ["orchestrator"]})
                async for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        token_content = chunk.choices[0].delta.content
                        greeting_content += token_content
                        await websocket.send_json({"type": "token", "content": token_content})
            except Exception as e:
                structlog.get_logger().error("Continuation greeting error", error=str(e))

            if greeting_content:
                async with async_session() as db:
                    greeting_msg = Message(
                        session_id=session_id,
                        role="assistant",
                        content=greeting_content,
                        agents_used=json.dumps(["orchestrator"]),
                    )
                    db.add(greeting_msg)
                    await db.commit()
                    await db.refresh(greeting_msg)
                    await websocket.send_json({"type": "done", "message_id": greeting_msg.id})

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") != "message":
                continue

            content = data.get("content", "").strip()
            if not content:
                continue

            if len(content) > settings.MAX_MESSAGE_LENGTH:
                await websocket.send_json({"type": "error", "message": "Сообщение слишком длинное (максимум 4000 символов)"})
                continue

            async with async_session() as db:
                user_msg = Message(
                    session_id=session_id,
                    role="user",
                    content=content,
                )
                db.add(user_msg)
                await db.commit()

                msg_result = await db.execute(
                    select(Message)
                    .join(ChatSession, Message.session_id == ChatSession.id)
                    .where(Message.session_id == session_id, ChatSession.user_id == user_id)
                    .order_by(Message.created_at)
                )
                all_messages = list(msg_result.scalars().all())

                history_dicts = [
                    {"role": m.role, "content": m.content, "agents_used": m.agents_used}
                    for m in all_messages
                ]

                sess_result = await db.execute(
                    select(ChatSession).where(ChatSession.id == session_id)
                )
                fresh_session = sess_result.scalar_one_or_none()
                summary_text = fresh_session.summary if fresh_session else ""

            agents_used_list = []
            full_response = ""

            try:
                async for event in orchestrator.process(
                    content, history_dicts, summary_text, preferred_style, long_term_memory,
                    therapy_goals, address_form, gender,
                ):
                    if event["type"] == "token":
                        await websocket.send_json({"type": "token", "content": event["content"]})
                        full_response += event["content"]
                    elif event["type"] == "agents_used":
                        agents_used_list = event["agents"]
                        await websocket.send_json({"type": "agents_used", "agents": agents_used_list})
                    elif event["type"] == "error":
                        await websocket.send_json({"type": "error", "message": event["message"]})
            except Exception as e:
                structlog.get_logger().error("Orchestrator error", error=str(e))
                await websocket.send_json({"type": "error", "message": "Произошла ошибка. Попробуй ещё раз."})
                break

            async with async_session() as db:
                assistant_msg = Message(
                    session_id=session_id,
                    role="assistant",
                    content=full_response,
                    agents_used=json.dumps(agents_used_list) if agents_used_list else None,
                )
                db.add(assistant_msg)

                result2 = await db.execute(
                    select(ChatSession).where(ChatSession.id == session_id)
                )
                sess = result2.scalar_one_or_none()
                if sess:
                    sess.updated_at = datetime.now(timezone.utc)
                    if not sess.title:
                        title = await generate_session_title(content)
                        sess.title = title

                await db.commit()
                await db.refresh(assistant_msg)

                compressed = await maybe_compress_context(db, session_id)
                if compressed:
                    await websocket.send_json({"type": "context_compressed"})

                await websocket.send_json({"type": "done", "message_id": assistant_msg.id})

            if profile and profile.memory_enabled and full_response:
                try:
                    async with async_session() as mem_db:
                        await extract_and_update_memory(
                            profile.long_term_memory,
                            history_dicts,
                            mem_db,
                            user_id,
                        )
                except Exception as e:
                    structlog.get_logger().error("Memory update error", error=str(e))

    except WebSocketDisconnect:
        pass
