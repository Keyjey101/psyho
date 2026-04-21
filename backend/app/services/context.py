import json
import structlog
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ChatSession, Message
from app.agents.base import client
from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger()


async def maybe_compress_context(db: AsyncSession, session_id: str):
    count_result = await db.execute(
        select(func.count()).where(Message.session_id == session_id)
    )
    total = count_result.scalar() or 0

    if total < settings.CONTEXT_COMPRESSION_THRESHOLD:
        return

    msg_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
    )
    all_messages = list(msg_result.scalars().all())

    keep_count = settings.CONTEXT_KEEP_MESSAGES
    old_messages = all_messages[:-keep_count]

    if not old_messages:
        return

    formatted = _format_messages(old_messages)
    summary = await _generate_summary(formatted)

    session_result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if session:
        existing = session.summary or ""
        session.summary = f"{existing}\n\n--- Дополнительное резюме ---\n{summary}" if existing else summary

    old_ids = [m.id for m in old_messages]
    await db.execute(delete(Message).where(Message.id.in_(old_ids)))
    await db.commit()

    return True


async def generate_session_title(first_message: str) -> str:
    try:
        response = await client.chat.completions.create(
            model=settings.ZAI_SMALL_MODEL,
            max_tokens=30,
            temperature=0.3,
            messages=[
                {
                    "role": "user",
                    "content": f"Сгенерируй короткое название (максимум 5 слов) для чата с психологом, где первое сообщение пользователя: \"{first_message[:200]}\"\n\nВерни ТОЛЬКО название, без кавычек и пояснений.",
                }
            ],
        )
        title = response.choices[0].message.content.strip().strip('"').strip("'")
        return title[:100]
    except Exception as e:
        logger.warning("Failed to generate session title", error=str(e))
        words = first_message.split()[:5]
        return " ".join(words) + ("..." if len(first_message.split()) > 5 else "")


def _format_messages(messages: list[Message]) -> str:
    lines = []
    for m in messages:
        role = "Пользователь" if m.role == "user" else "Терапевт"
        lines.append(f"{role}: {m.content[:300]}")
    return "\n".join(lines)


async def _generate_summary(formatted_messages: str) -> str:
    try:
        response = await client.chat.completions.create(
            model=settings.ZAI_SMALL_MODEL,
            max_tokens=500,
            temperature=0.2,
            messages=[
                {
                    "role": "user",
                    "content": f"Сожми историю психологической беседы в краткое резюме. Укажи ключевые темы, эмоции, инсайты и прогресс.\n\nИстория:\n{formatted_messages}",
                }
            ],
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.warning("Failed to generate context summary", error=str(e))
        return "Резюме недоступно."
