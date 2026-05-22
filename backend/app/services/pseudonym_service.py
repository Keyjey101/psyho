"""Pseudonym generation for the Beat-Nika mini-game leaderboard."""
from __future__ import annotations
import random
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.game_models import UserPseudonym

logger = structlog.get_logger()

ADJECTIVES: list[str] = [
    "Умный", "Смелый", "Тихий", "Яркий", "Лёгкий",
    "Быстрый", "Мудрый", "Честный", "Добрый", "Странный",
    "Дерзкий", "Нежный", "Твёрдый", "Гибкий", "Острый",
    "Весёлый", "Грустный", "Смешной", "Серьёзный", "Спокойный",
    "Живой", "Тёплый", "Холодный", "Ясный", "Тёмный",
    "Высокий", "Глубокий", "Широкий", "Узкий", "Круглый",
    "Лихой", "Бодрый", "Сильный", "Зоркий", "Чуткий",
]

NOUNS: list[str] = [
    "Лис", "Волк", "Медведь", "Орёл", "Сова",
    "Кот", "Пёс", "Конь", "Рысь", "Зубр",
    "Ёж", "Заяц", "Барсук", "Бобёр", "Выдра",
    "Гусь", "Дрозд", "Аист", "Журавль", "Ворон",
    "Дуб", "Клён", "Берёза", "Сосна", "Ель",
    "Камень", "Поток", "Ветер", "Огонь", "Лёд",
    "Мрак", "Свет", "Дым", "Туман", "Гром",
]


async def pseudonym_exists(db: AsyncSession, name: str) -> bool:
    result = await db.execute(
        select(UserPseudonym).where(UserPseudonym.name == name)
    )
    return result.scalar_one_or_none() is not None


async def generate_pseudonym(db: AsyncSession) -> str:
    """Generate a unique 'Adj Noun N' pseudonym."""
    for _ in range(20):
        adj = random.choice(ADJECTIVES)
        noun = random.choice(NOUNS)
        number = random.randint(1, 999)
        name = f"{adj} {noun} {number}"
        if not await pseudonym_exists(db, name):
            return name
    # Fallback: uuid-based
    import uuid
    return f"Игрок {str(uuid.uuid4())[:8].upper()}"


async def generate_ironic_pseudonym(db: AsyncSession) -> str:
    """Generate a unique ironic 'ЯВЗРОСЛЫЙ_#NNN' pseudonym."""
    for _ in range(20):
        number = random.randint(100, 999)
        name = f"ЯВЗРОСЛЫЙ_#{number}"
        if not await pseudonym_exists(db, name):
            return name
    import uuid
    return f"ЯВЗРОСЛЫЙ_#{str(uuid.uuid4())[:6].upper()}"
