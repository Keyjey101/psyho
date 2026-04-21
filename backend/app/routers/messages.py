import json

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.models.models import ChatSession, Message, User
from app.schemas.message import MessageResponse, MessageListResponse
from app.middleware.auth import get_current_user
from app.services.auth import decode_token
from app.agents.orchestrator import Orchestrator
from app.services.context import maybe_compress_context, generate_session_title

router = APIRouter()

orchestrator = Orchestrator()


@router.get("/{session_id}/messages", response_model=MessageListResponse)
async def list_messages(
    session_id: str,
    offset: int = 0,
    limit: int = 100,
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

    msg_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
        .offset(offset)
        .limit(limit)
    )
    messages = list(msg_result.scalars().all())
    return MessageListResponse(messages=messages, total=total)


@router.websocket("/{session_id}/chat")
async def websocket_chat(websocket: WebSocket, session_id: str):
    token = websocket.query_params.get("token")
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

    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") != "message":
                continue

            content = data.get("content", "").strip()
            if not content:
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
                    .where(Message.session_id == session_id)
                    .order_by(Message.created_at)
                )
                all_messages = list(msg_result.scalars().all())

                history_dicts = [
                    {"role": m.role, "content": m.content}
                    for m in all_messages
                ]

                summary_text = session.summary or ""

            agents_used_list = []
            full_response = ""

            try:
                async for event in orchestrator.process(content, history_dicts, summary_text):
                    if event["type"] == "token":
                        await websocket.send_json({"type": "token", "content": event["content"]})
                        full_response += event["content"]
                    elif event["type"] == "agents_used":
                        agents_used_list = event["agents"]
                        await websocket.send_json({"type": "agents_used", "agents": agents_used_list})
                    elif event["type"] == "error":
                        await websocket.send_json({"type": "error", "message": event["message"]})
            except Exception as e:
                import structlog
                structlog.get_logger().error("Orchestrator error", error=str(e))
                await websocket.send_json({"type": "error", "message": "An error occurred. Please try again."})
                continue

            async with async_session() as db:
                assistant_msg = Message(
                    session_id=session_id,
                    role="assistant",
                    content=full_response,
                    agents_used=json.dumps(agents_used_list) if agents_used_list else None,
                )
                db.add(assistant_msg)

                if not session.title:
                    result2 = await db.execute(
                        select(ChatSession).where(ChatSession.id == session_id)
                    )
                    sess = result2.scalar_one_or_none()
                    if sess and not sess.title:
                        title = await generate_session_title(content)
                        sess.title = title

                await db.commit()
                await db.refresh(assistant_msg)

                await maybe_compress_context(db, session_id)

                await websocket.send_json({"type": "done", "message_id": assistant_msg.id})

    except WebSocketDisconnect:
        pass
