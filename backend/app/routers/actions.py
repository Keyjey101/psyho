from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import AppSetting, ChatSession, Message, SessionTask, User, UserProfile
from app.services import billing
from app.services.action_service import run_action

router = APIRouter()


async def _daily_action_count(db: AsyncSession, user_id: str) -> tuple[int, str]:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    key = f"daily_actions:{user_id}:{today}"
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = result.scalar_one_or_none()
    return (int(row.value) if row else 0), key


async def _bump_daily_action(db: AsyncSession, key: str, current: int) -> None:
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = str(current + 1)
    else:
        db.add(AppSetting(key=key, value=str(current + 1)))


class ActionRequest(BaseModel):
    action_type: str


class ActionResponse(BaseModel):
    content: str
    task_id: str | None = None


@router.post("/{session_id}/action", response_model=ActionResponse)
async def session_action(
    session_id: str,
    body: ActionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.action_type not in ("insight", "exercise"):
        raise HTTPException(status_code=400, detail="action_type must be 'insight' or 'exercise'")

    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    settings = get_settings()
    if settings.MONETIZATION_ENABLED and not billing.is_pro(user) and (user.sessions_quota_balance or 0) == 0:
        used, key = await _daily_action_count(db, user.id)
        if used >= settings.FREE_DAILY_ACTIONS:
            raise HTTPException(
                status_code=402,
                detail={
                    "reason": "daily_action_limit",
                    "limit": settings.FREE_DAILY_ACTIONS,
                },
            )
        await _bump_daily_action(db, key, used)

    msgs_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
    )
    messages = [{"role": m.role, "content": m.content} for m in msgs_result.scalars().all()]

    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()

    content = await run_action(
        action_type=body.action_type,
        messages=messages,
        long_term_memory=profile.long_term_memory if profile else None,
        therapy_goals=profile.therapy_goals if profile else None,
    )

    task_id = None
    if body.action_type == "exercise":
        first_line = content.split("\n")[0][:200]
        task = SessionTask(
            user_id=user.id,
            session_id=session_id,
            text=first_line,
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)
        task_id = task.id

    return ActionResponse(content=content, task_id=task_id)
