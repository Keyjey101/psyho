from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import client
from app.config import get_settings
from app.models.models import Message

settings = get_settings()

DIARY_PROMPT = """Ты — помощник Ники-психолога. На основе разговора между пользователем и Никой создай короткую терапевтическую запись в дневник (150-200 слов).

Запись должна:
1. Отражать основную тему и эмоции пользователя
2. Выделить ключевые инсайты и осознания
3. Записать что удалось проработать
4. Быть написана от первого лица (от имени пользователя)
5. Звучать тепло и поддерживающе

История разговора:
{messages}

Верни только текст записи без заголовков."""


async def generate_diary_entry(session_id: str, db: AsyncSession) -> str:
    """Generate a diary entry from session messages using LLM."""
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.desc())
        .limit(20)
    )
    messages = list(reversed(result.scalars().all()))

    if not messages:
        return "Сессия пока не содержит сообщений."

    lines = []
    for m in messages:
        role = "Пользователь" if m.role == "user" else "Ника"
        lines.append(f"{role}: {m.content[:500]}")
    history_text = "\n".join(lines)

    prompt = DIARY_PROMPT.format(messages=history_text)

    response = await client.chat.completions.create(
        model=settings.ZAI_SMALL_MODEL,
        max_tokens=400,
        temperature=0.5,
        messages=[{"role": "user", "content": prompt}],
    )
    content = response.choices[0].message.content
    return content.strip() if content else "Не удалось создать запись."
