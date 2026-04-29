import time
from collections import deque

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import AnonymousInsight

router = APIRouter()

# Simple in-memory rate limiting by IP for anonymous endpoints
_post_rate_limits: dict[str, deque] = {}
_react_rate_limits: dict[str, deque] = {}
_POST_RATE_LIMIT = 3  # per hour
_REACT_RATE_LIMIT = 20  # per hour
_HOUR = 3600.0


def _check_rate_limit(limits_dict: dict[str, deque], key: str, limit: int, window: float = _HOUR) -> bool:
    now = time.monotonic()
    if key not in limits_dict:
        limits_dict[key] = deque()
    dq = limits_dict[key]
    while dq and dq[0] < now - window:
        dq.popleft()
    if len(dq) >= limit:
        return False
    dq.append(now)
    return True


class InsightCreate(BaseModel):
    content: str = Field(..., min_length=10, max_length=500)


@router.get("")
async def list_insights(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit
    result = await db.execute(
        select(AnonymousInsight)
        .where(AnonymousInsight.is_approved == True)  # noqa: E712
        .order_by(AnonymousInsight.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    insights = result.scalars().all()
    return [
        {
            "id": i.id,
            "content": i.content,
            "reactions": i.reactions,
            "created_at": i.created_at,
        }
        for i in insights
    ]


@router.post("", status_code=201)
async def post_insight(
    body: InsightCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(_post_rate_limits, client_ip, _POST_RATE_LIMIT):
        raise HTTPException(status_code=429, detail="Слишком много публикаций. Попробуй позже.")

    insight = AnonymousInsight(content=body.content)
    db.add(insight)
    await db.commit()
    await db.refresh(insight)

    return {
        "id": insight.id,
        "content": insight.content,
        "reactions": insight.reactions,
        "created_at": insight.created_at,
    }


@router.post("/{insight_id}/react")
async def react_to_insight(
    insight_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{client_ip}:{insight_id}"
    if not _check_rate_limit(_react_rate_limits, rate_key, 1):
        raise HTTPException(status_code=429, detail="Ты уже реагировал на этот инсайт.")

    result = await db.execute(
        select(AnonymousInsight).where(
            AnonymousInsight.id == insight_id,
            AnonymousInsight.is_approved == True,  # noqa: E712
        )
    )
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=404, detail="Инсайт не найден")

    insight.reactions += 1
    await db.commit()
    return {"reactions": insight.reactions}
