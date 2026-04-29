from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import TimeCapsule, User

router = APIRouter()


class CapsuleCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    days_until_open: int = Field(..., ge=1, le=30)
    session_id: str | None = None


@router.get("")
async def list_capsules(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TimeCapsule)
        .where(TimeCapsule.user_id == user.id)
        .order_by(TimeCapsule.created_at.desc())
    )
    capsules = result.scalars().all()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    return [
        {
            "id": c.id,
            "session_id": c.session_id,
            "content": c.content if (c.opened or c.open_after <= now) else None,
            "open_after": c.open_after,
            "opened": c.opened or c.open_after <= now,
            "created_at": c.created_at,
            "is_ready": c.open_after <= now,
        }
        for c in capsules
    ]


@router.post("", status_code=201)
async def create_capsule(
    body: CapsuleCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    open_after = now + timedelta(days=body.days_until_open)

    capsule = TimeCapsule(
        user_id=user.id,
        session_id=body.session_id,
        content=body.content,
        open_after=open_after,
    )
    db.add(capsule)
    await db.commit()
    await db.refresh(capsule)

    return {
        "id": capsule.id,
        "open_after": capsule.open_after,
        "days_until_open": body.days_until_open,
        "created_at": capsule.created_at,
    }


@router.delete("/{capsule_id}", status_code=204)
async def delete_capsule(
    capsule_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TimeCapsule).where(TimeCapsule.id == capsule_id, TimeCapsule.user_id == user.id)
    )
    capsule = result.scalar_one_or_none()
    if not capsule:
        raise HTTPException(status_code=404, detail="Капсула не найдена")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if capsule.opened or capsule.open_after <= now:
        raise HTTPException(status_code=400, detail="Нельзя удалить уже открытую капсулу")

    await db.delete(capsule)
    await db.commit()
