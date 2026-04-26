import json
import structlog
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import client
from app.config import get_settings
from app.models.models import PersonalitySnapshot, UserProfile, ChatSession, MoodEntry

logger = structlog.get_logger()

PERSONALITY_PROMPT = """Проанализируй память о пользователе и историю сессий.
Оцени каждое измерение от 0 до 100.
0 = острая проблема / полное отсутствие, 50 = средний уровень, 100 = высокий ресурс.
Будь реалистичен — большинство людей в терапии в диапазоне 20–65.

Память: {memory}
Темы сессий: {themes}
Настроение (последние записи): {mood_trend}

Верни JSON:
{{
  "self_awareness": int,
  "emotional_regulation": int,
  "self_compassion": int,
  "acceptance": int,
  "values_clarity": int,
  "resourcefulness": int,
  "dominant_theme": "anxiety|relationships|self_esteem|depression|meaning|burnout|identity|stress|grief|loneliness",
  "summary_note": "1-2 предложения о текущем состоянии"
}}"""


async def compute_personality_snapshot(user_id: str, db: AsyncSession) -> PersonalitySnapshot | None:
    settings = get_settings()

    profile_result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        return None

    memory = profile.long_term_memory or ""

    session_result = await db.execute(
        select(ChatSession.title)
        .where(ChatSession.user_id == user_id, ChatSession.title.isnot(None))
        .order_by(ChatSession.created_at.desc())
        .limit(10)
    )
    titles = [t for (t,) in session_result.all()]
    themes = ", ".join(titles) if titles else "нет данных"

    mood_result = await db.execute(
        select(MoodEntry.value)
        .where(MoodEntry.user_id == user_id)
        .order_by(MoodEntry.created_at.desc())
        .limit(5)
    )
    mood_values = [v for (v,) in mood_result.all()]
    mood_trend = ", ".join(str(v) for v in mood_values) if mood_values else "нет данных"

    if not memory and not titles:
        return None

    prompt = PERSONALITY_PROMPT.format(
        memory=memory or "(пусто)",
        themes=themes,
        mood_trend=mood_trend,
    )

    try:
        response = await client.chat.completions.create(
            model=settings.ZAI_SMALL_MODEL,
            max_tokens=400,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        data = json.loads(text)

        snapshot = PersonalitySnapshot(
            user_id=user_id,
            self_awareness=max(0, min(100, int(data.get("self_awareness", 50)))),
            emotional_regulation=max(0, min(100, int(data.get("emotional_regulation", 50)))),
            self_compassion=max(0, min(100, int(data.get("self_compassion", 50)))),
            acceptance=max(0, min(100, int(data.get("acceptance", 50)))),
            values_clarity=max(0, min(100, int(data.get("values_clarity", 50)))),
            resourcefulness=max(0, min(100, int(data.get("resourcefulness", 50)))),
            dominant_theme=data.get("dominant_theme"),
            summary_note=data.get("summary_note"),
        )
        db.add(snapshot)
        await db.commit()
        await db.refresh(snapshot)
        return snapshot
    except Exception as e:
        logger.error("Personality snapshot computation failed", error=str(e))
        return None


async def should_compute_snapshot(user_id: str, db: AsyncSession) -> bool:
    session_count = await db.scalar(
        select(func.count()).select_from(ChatSession).where(ChatSession.user_id == user_id)
    )
    if (session_count or 0) < 3:
        return False

    latest = await db.execute(
        select(PersonalitySnapshot.created_at)
        .where(PersonalitySnapshot.user_id == user_id)
        .order_by(PersonalitySnapshot.created_at.desc())
        .limit(1)
    )
    last_time = latest.scalar_one_or_none()
    if last_time is None:
        return True

    three_days_ago = datetime.now(timezone.utc) - timedelta(days=3)
    if last_time.tzinfo is None:
        last_time = last_time.replace(tzinfo=timezone.utc)
    return last_time < three_days_ago
