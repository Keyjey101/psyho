from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Achievement, User
from app.services.achievement_service import ACHIEVEMENTS

router = APIRouter()


@router.get("")
async def list_achievements(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Achievement)
        .where(Achievement.user_id == user.id)
        .order_by(Achievement.earned_at.desc())
    )
    achievements = result.scalars().all()

    return [
        {
            "id": a.id,
            "achievement_type": a.achievement_type,
            "earned_at": a.earned_at,
            **ACHIEVEMENTS.get(a.achievement_type, {"name": a.achievement_type, "description": "", "emoji": "🏅"}),
        }
        for a in achievements
    ]
