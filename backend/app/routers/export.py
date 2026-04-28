from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import ChatSession, Message, User

router = APIRouter()


@router.get("/session/{session_id}", response_class=PlainTextResponse)
async def export_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sess_result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")

    msg_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
    )
    messages = msg_result.scalars().all()

    title = session.title or "Без названия"
    created = session.created_at.strftime("%Y-%m-%d %H:%M") if session.created_at else ""

    lines = [
        f"# Сессия: {title}",
        f"Дата: {created}",
        "",
    ]

    if session.summary:
        lines += ["## Резюме сессии", session.summary, ""]

    lines.append("## Диалог")
    lines.append("")

    for m in messages:
        role = "Пользователь" if m.role == "user" else "Ника"
        ts = m.created_at.strftime("%H:%M") if m.created_at else ""
        lines.append(f"**{role}** [{ts}]")
        lines.append(m.content)
        lines.append("")

    content = "\n".join(lines)
    filename = f"session_{session_id[:8]}.md"

    return PlainTextResponse(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
