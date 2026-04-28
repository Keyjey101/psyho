from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import SessionTask, User
from app.middleware.auth import get_current_user

router = APIRouter()


class TaskCreate(BaseModel):
    session_id: str
    text: str


@router.get("/pending")
async def get_pending_tasks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SessionTask)
        .where(SessionTask.user_id == user.id, SessionTask.completed == False)
        .order_by(SessionTask.created_at.desc())
    )
    tasks = result.scalars().all()
    return [
        {
            "id": t.id,
            "session_id": t.session_id,
            "text": t.text,
            "completed": t.completed,
            "created_at": t.created_at,
        }
        for t in tasks
    ]


@router.patch("/{task_id}/complete")
async def complete_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SessionTask).where(SessionTask.id == task_id, SessionTask.user_id == user.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    task.completed = True
    await db.commit()
    return {"ok": True}


@router.get("/history")
async def get_task_history(
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SessionTask)
        .where(SessionTask.user_id == user.id)
        .order_by(SessionTask.created_at.desc())
        .limit(limit)
    )
    tasks = result.scalars().all()
    return [
        {
            "id": t.id,
            "session_id": t.session_id,
            "text": t.text,
            "completed": t.completed,
            "created_at": t.created_at,
        }
        for t in tasks
    ]


@router.post("")
async def create_task(
    body: TaskCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = SessionTask(
        user_id=user.id,
        session_id=body.session_id,
        text=body.text,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return {"id": task.id, "text": task.text}
