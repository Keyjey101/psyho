from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Achievement, ChatSession, Message, MoodEntry, SessionTask

ACHIEVEMENTS = {
    "first_session": {"name": "Первый шаг", "description": "Первая сессия с Никой", "emoji": "🌱"},
    "5_sessions": {"name": "5 сессий", "description": "Завершил 5 сессий", "emoji": "⭐"},
    "10_sessions": {"name": "Практик", "description": "Завершил 10 сессий", "emoji": "🌟"},
    "first_exercise": {"name": "Практика", "description": "Первое выполненное упражнение", "emoji": "💪"},
    "3_exercises": {"name": "Тренируется", "description": "Выполнил 3 упражнения", "emoji": "🏆"},
    "7_day_streak": {"name": "Неделя", "description": "7 дней подряд", "emoji": "🔥"},
    "mood_tracked": {"name": "Самонаблюдение", "description": "Первая запись настроения", "emoji": "📊"},
}


async def get_user_achievements(user_id: str, db: AsyncSession) -> set[str]:
    result = await db.execute(
        select(Achievement.achievement_type).where(Achievement.user_id == user_id)
    )
    return set(result.scalars().all())


async def award_achievement(user_id: str, achievement_type: str, db: AsyncSession) -> bool:
    """Award an achievement if not already earned. Returns True if newly awarded."""
    existing = await db.execute(
        select(Achievement).where(
            Achievement.user_id == user_id,
            Achievement.achievement_type == achievement_type,
        )
    )
    if existing.scalar_one_or_none():
        return False

    achievement = Achievement(user_id=user_id, achievement_type=achievement_type)
    db.add(achievement)
    return True


async def check_and_award(user_id: str, trigger: str, db: AsyncSession) -> list[str]:
    """Check if user deserves any achievements based on trigger, award them, return new achievement types."""
    earned = await get_user_achievements(user_id, db)
    newly_awarded: list[str] = []

    if trigger == "session_created":
        # Count sessions
        count_result = await db.execute(
            select(func.count(ChatSession.id)).where(ChatSession.user_id == user_id)
        )
        session_count = count_result.scalar() or 0

        if "first_session" not in earned and session_count >= 1:
            if await award_achievement(user_id, "first_session", db):
                newly_awarded.append("first_session")

        if "5_sessions" not in earned and session_count >= 5:
            if await award_achievement(user_id, "5_sessions", db):
                newly_awarded.append("5_sessions")

        if "10_sessions" not in earned and session_count >= 10:
            if await award_achievement(user_id, "10_sessions", db):
                newly_awarded.append("10_sessions")

    elif trigger == "task_completed":
        # Count completed exercises
        count_result = await db.execute(
            select(func.count(SessionTask.id)).where(
                SessionTask.user_id == user_id,
                SessionTask.completed == True,  # noqa: E712
            )
        )
        completed_count = count_result.scalar() or 0

        if "first_exercise" not in earned and completed_count >= 1:
            if await award_achievement(user_id, "first_exercise", db):
                newly_awarded.append("first_exercise")

        if "3_exercises" not in earned and completed_count >= 3:
            if await award_achievement(user_id, "3_exercises", db):
                newly_awarded.append("3_exercises")

    elif trigger == "mood_tracked":
        if "mood_tracked" not in earned:
            count_result = await db.execute(
                select(func.count(MoodEntry.id)).where(MoodEntry.user_id == user_id)
            )
            if (count_result.scalar() or 0) >= 1:
                if await award_achievement(user_id, "mood_tracked", db):
                    newly_awarded.append("mood_tracked")

    if newly_awarded:
        await db.commit()

    return newly_awarded
