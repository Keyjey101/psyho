from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import User, UserProfile
from app.schemas.user import UserProfileResponse, UserProfileUpdate, UserMeResponse, PopScoreAdd
from app.middleware.auth import get_current_user

router = APIRouter()


@router.get("/me", response_model=UserMeResponse)
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    return UserMeResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        is_active=user.is_active,
        created_at=user.created_at,
        profile=UserProfileResponse.model_validate(profile) if profile else None,
        telegram_username=user.telegram_username,
        has_real_email=not user.email.endswith("@tg.local"),
    )


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
    if body.memory_enabled is not None:
        profile.memory_enabled = body.memory_enabled
    if body.address_form is not None:
        profile.address_form = body.address_form
    if body.gender is not None:
        profile.gender = body.gender
    if body.name is not None:
        user.name = body.name

    await db.commit()
    await db.refresh(profile)

    return UserMeResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        is_active=user.is_active,
        created_at=user.created_at,
        profile=UserProfileResponse.model_validate(profile),
        telegram_username=user.telegram_username,
        has_real_email=not user.email.endswith("@tg.local"),
    )


@router.post("/me/pop")
async def add_pop_score(
    body: PopScoreAdd,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalar_one_or_none()

    if not profile:
        profile = UserProfile(user_id=user.id, pop_score=body.count)
        db.add(profile)
    else:
        profile.pop_score = (profile.pop_score or 0) + body.count

    await db.commit()
    return {"pop_score": profile.pop_score}
