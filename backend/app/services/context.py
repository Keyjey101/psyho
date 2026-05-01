import json
import structlog
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ChatSession, Message
from app.agents.base import client
from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger()


SUMMARY_MAX_CHARS = 3000


async def maybe_compress_context(db: AsyncSession, session_id: str):
    # Two triggers — whichever fires first wins:
    #   1. message count >= CONTEXT_COMPRESSION_THRESHOLD (default 40)
    #   2. total content length >= CONTEXT_COMPRESSION_CHARS (default 24000)
    # The char-based trigger protects sessions full of long, verbose answers
    # (philosophical mode) from blowing past the model context before the
    # message-count threshold ever fires.
    stats = await db.execute(
        select(
            func.count(Message.id),
            func.coalesce(func.sum(func.length(Message.content)), 0),
        ).where(Message.session_id == session_id)
    )
    total, total_chars = stats.one()
    total = int(total or 0)
    total_chars = int(total_chars or 0)

    by_count = total >= settings.CONTEXT_COMPRESSION_THRESHOLD
    by_chars = total_chars >= settings.CONTEXT_COMPRESSION_CHARS
    if not (by_count or by_chars):
        return
    logger.info(
        "context_compression_trigger",
        session_id=session_id,
        total=total,
        total_chars=total_chars,
        by_count=by_count,
        by_chars=by_chars,
    )

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

    if not summary or summary == "Резюме недоступно.":
        return

    session_result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if session:
        existing = session.summary or ""
        new_summary = f"{existing}\n\n--- Дополнительное резюме ---\n{summary}" if existing else summary
        if len(new_summary) > SUMMARY_MAX_CHARS:
            new_summary = new_summary[-SUMMARY_MAX_CHARS:]
        session.summary = new_summary

    await db.commit()

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
