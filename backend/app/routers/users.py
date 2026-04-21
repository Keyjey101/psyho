import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import User, UserProfile
from app.schemas.user import UserProfileResponse, UserProfileUpdate, UserMeResponse
from app.middleware.auth import get_current_user

router = APIRouter()


@router.get("/me", response_model=UserMeResponse)
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    resp = UserMeResponse.model_validate(user)
    resp.profile = UserProfileResponse.model_validate(profile) if profile else None
    return resp


@router.patch("/me", response_model=UserMeResponse)
async def update_me(
    body: UserProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalar_one_or_none()

    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)

    if body.therapy_goals is not None:
        profile.therapy_goals = body.therapy_goals
    if body.preferred_style is not None:
        profile.preferred_style = body.preferred_style
    if body.crisis_plan is not None:
        profile.crisis_plan = body.crisis_plan

    await db.commit()
    await db.refresh(profile)

    resp = UserMeResponse.model_validate(user)
    resp.profile = UserProfileResponse.model_validate(profile)
    return resp
