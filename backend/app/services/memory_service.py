import hashlib
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import client
from app.config import get_settings
from app.models.models import UserProfile

logger = structlog.get_logger()


def _memory_fingerprint(text: str) -> str:
    """Stable hash of memory content for skip-on-noop comparisons.

    Lowercased + whitespace-collapsed so trivial reformatting doesn't trigger
    a write.
    """
    normalized = " ".join(text.lower().split())
    return hashlib.sha1(normalized.encode("utf-8")).hexdigest()

MEMORY_EXTRACT_PROMPT = """Из этого диалога извлеки ключевую информацию о пользователе.
Верни компактный текст (не более 200 слов) с фактами:
- Имя пользователя (если назвал)
- Основные темы и проблемы с которыми работали
- Ключевые эмоциональные паттерны
- Прогресс и инсайты
- Важные личные детали (семья, работа, привычки — если упомянуты)

Помечай временной контекст: [тогда] для прошлого, [сейчас] для текущего.
Пример: '[тогда] боялся публичных выступлений → [сейчас] чувствует прогресс'.
Фиксируй изменения, а не только факты.

Если текущая память уже есть — обнови и дополни её, не дублируй.
Если новой важной информации нет — верни текущую память без изменений.

Текущая память:
{current_memory}

Диалог (последние сообщения пользователя):
{user_messages}
"""


async def extract_and_update_memory(
    current_memory: str | None,
    messages: list[dict],
    db: AsyncSession,
    user_id: str,
) -> str:
    user_msgs = [m["content"] for m in messages[-10:] if m["role"] == "user"]
    if not user_msgs:
        return current_memory or ""

    settings = get_settings()
    prompt = MEMORY_EXTRACT_PROMPT.format(
        current_memory=current_memory or "(пусто)",
        user_messages="\n".join(user_msgs[-5:]),
    )

    try:
        response = await client.chat.completions.create(
            model=settings.ZAI_SMALL_MODEL,
            max_tokens=500,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}],
        )
        new_memory = response.choices[0].message.content.strip()

        from sqlalchemy import select
        result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
        profile = result.scalar_one_or_none()
        if profile:
            new_hash = _memory_fingerprint(new_memory)
            if profile.memory_hash == new_hash:
                logger.info("memory_unchanged", user_id=user_id, hash=new_hash[:8])
                return new_memory
            profile.long_term_memory = new_memory
            profile.memory_hash = new_hash
            await db.commit()

        return new_memory
    except Exception as e:
        logger.error("Memory extraction failed", error=str(e))
        return current_memory or ""
