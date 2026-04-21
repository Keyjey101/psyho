from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import MoodEntry, User
from app.middleware.auth import get_current_user

router = APIRouter()


class MoodCreate(BaseModel):
    value: int
    session_id: str | None = None
    note: str | None = None


@router.post("")
async def create_mood(
    body: MoodCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.value < 1 or body.value > 5:
        raise HTTPException(status_code=400, detail="Значение должно быть от 1 до 5")
    entry = MoodEntry(
        user_id=user.id,
        session_id=body.session_id,
        value=body.value,
        note=body.note,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return {"id": entry.id, "value": entry.value, "created_at": entry.created_at}


@router.get("")
async def list_moods(
    limit: int = 30,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MoodEntry)
        .where(MoodEntry.user_id == user.id)
        .order_by(MoodEntry.created_at.desc())
        .limit(limit)
    )
    entries = result.scalars().all()
    return [
        {
            "id": e.id,
            "value": e.value,
            "note": e.note,
            "session_id": e.session_id,
            "created_at": e.created_at,
        }
        for e in entries
    ]
