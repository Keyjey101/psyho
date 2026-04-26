from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import PersonalitySnapshot, User
from app.middleware.auth import get_current_user

router = APIRouter()


@router.get("/me/personality")
async def get_personality(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PersonalitySnapshot)
        .where(PersonalitySnapshot.user_id == user.id)
        .order_by(PersonalitySnapshot.created_at.desc())
        .limit(5)
    )
    snapshots = result.scalars().all()

    if not snapshots:
        return {"snapshot": None, "history": []}

    latest = snapshots[0]
    return {
        "snapshot": {
            "id": latest.id,
            "self_awareness": latest.self_awareness,
            "emotional_regulation": latest.emotional_regulation,
            "self_compassion": latest.self_compassion,
            "acceptance": latest.acceptance,
            "values_clarity": latest.values_clarity,
            "resourcefulness": latest.resourcefulness,
            "dominant_theme": latest.dominant_theme,
            "summary_note": latest.summary_note,
            "created_at": latest.created_at,
        },
        "history": [
            {
                "id": s.id,
                "self_awareness": s.self_awareness,
                "emotional_regulation": s.emotional_regulation,
                "self_compassion": s.self_compassion,
                "acceptance": s.acceptance,
                "values_clarity": s.values_clarity,
                "resourcefulness": s.resourcefulness,
                "dominant_theme": s.dominant_theme,
                "summary_note": s.summary_note,
                "created_at": s.created_at,
            }
            for s in snapshots
        ],
    }


@router.get("/me/personality/history")
async def get_personality_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PersonalitySnapshot)
        .where(PersonalitySnapshot.user_id == user.id)
        .order_by(PersonalitySnapshot.created_at.asc())
    )
    snapshots = result.scalars().all()
    return [
        {
            "id": s.id,
            "self_awareness": s.self_awareness,
            "emotional_regulation": s.emotional_regulation,
            "self_compassion": s.self_compassion,
            "acceptance": s.acceptance,
            "values_clarity": s.values_clarity,
            "resourcefulness": s.resourcefulness,
            "dominant_theme": s.dominant_theme,
            "summary_note": s.summary_note,
            "created_at": s.created_at,
        }
        for s in snapshots
    ]
