from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import ChatSession, DiaryEntry, User
from app.services.diary_service import generate_diary_entry

router = APIRouter()


class DiaryEntryUpdate(BaseModel):
    user_note: str | None = None
    mood_score: int | None = None


@router.get("")
async def list_diary_entries(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit
    result = await db.execute(
        select(DiaryEntry)
        .where(DiaryEntry.user_id == user.id)
        .order_by(DiaryEntry.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    entries = result.scalars().all()
    return [
        {
            "id": e.id,
            "session_id": e.session_id,
            "content": e.content,
            "user_note": e.user_note,
            "topics": e.topics,
            "mood_score": e.mood_score,
            "created_at": e.created_at,
            "updated_at": e.updated_at,
        }
        for e in entries
    ]


@router.post("/generate")
async def generate_diary_auto(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sess_result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user.id)
        .order_by(ChatSession.created_at.desc())
        .limit(1)
    )
    session = sess_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Нет доступных сессий")

    content = await generate_diary_entry(session.id, db)
    entry = DiaryEntry(
        user_id=user.id,
        session_id=session.id,
        content=content,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    return {
        "id": entry.id,
        "session_id": entry.session_id,
        "content": entry.content,
        "user_note": entry.user_note,
        "topics": entry.topics,
        "mood_score": entry.mood_score,
        "created_at": entry.created_at,
        "updated_at": entry.updated_at,
    }


@router.post("/generate/{session_id}")
async def generate_diary(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify session belongs to user
    sess_result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    if not sess_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Сессия не найдена")

    content = await generate_diary_entry(session_id, db)

    entry = DiaryEntry(
        user_id=user.id,
        session_id=session_id,
        content=content,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    return {
        "id": entry.id,
        "session_id": entry.session_id,
        "content": entry.content,
        "user_note": entry.user_note,
        "topics": entry.topics,
        "mood_score": entry.mood_score,
        "created_at": entry.created_at,
        "updated_at": entry.updated_at,
    }


@router.patch("/{entry_id}")
async def update_diary_entry(
    entry_id: str,
    body: DiaryEntryUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DiaryEntry).where(DiaryEntry.id == entry_id, DiaryEntry.user_id == user.id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Запись не найдена")

    if body.user_note is not None:
        entry.user_note = body.user_note
    if body.mood_score is not None:
        if not (1 <= body.mood_score <= 10):
            raise HTTPException(status_code=400, detail="mood_score должен быть от 1 до 10")
        entry.mood_score = body.mood_score
    entry.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(entry)

    return {
        "id": entry.id,
        "content": entry.content,
        "user_note": entry.user_note,
        "mood_score": entry.mood_score,
        "updated_at": entry.updated_at,
    }


@router.delete("/{entry_id}", status_code=204)
async def delete_diary_entry(
    entry_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DiaryEntry).where(DiaryEntry.id == entry_id, DiaryEntry.user_id == user.id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Запись не найдена")

    await db.delete(entry)
    await db.commit()
