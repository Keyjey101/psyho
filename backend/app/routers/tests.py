from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import TestResult, ChatSession, User

router = APIRouter()


class TestResultCreate(BaseModel):
    test_id: str = Field(..., min_length=1, max_length=64)
    score: int = Field(..., ge=0, le=1000)
    level: str = Field(..., min_length=1, max_length=80)


@router.post("/results")
async def create_test_result(
    body: TestResultCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entry = TestResult(
        user_id=user.id,
        test_id=body.test_id,
        score=body.score,
        level=body.level,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return {
        "id": entry.id,
        "test_id": entry.test_id,
        "score": entry.score,
        "level": entry.level,
        "completed_at": entry.completed_at,
    }


@router.get("/results")
async def list_test_results(
    test_id: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(TestResult).where(TestResult.user_id == user.id)
    if test_id:
        query = query.where(TestResult.test_id == test_id)
    query = query.order_by(TestResult.completed_at.desc()).limit(200)
    rows = (await db.execute(query)).scalars().all()
    return [
        {
            "id": r.id,
            "test_id": r.test_id,
            "score": r.score,
            "level": r.level,
            "completed_at": r.completed_at,
        }
        for r in rows
    ]


@router.get("/completed-sessions")
async def get_completed_session_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return how many sessions the user has had so the frontend can decide
    whether the "retake after 2 sessions" rule unlocks a test."""
    result = await db.execute(
        select(func.count(ChatSession.id)).where(ChatSession.user_id == user.id)
    )
    count = result.scalar() or 0
    return {"count": int(count)}


@router.delete("/results/{result_id}")
async def delete_test_result(
    result_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TestResult).where(
            TestResult.id == result_id,
            TestResult.user_id == user.id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Result not found")
    await db.delete(row)
    await db.commit()
    return {"ok": True}
