from pydantic import BaseModel, Field
from datetime import datetime


class UserProfileResponse(BaseModel):
    user_id: str
    therapy_goals: str | None
    preferred_style: str
    crisis_plan: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    therapy_goals: str | None = None
    preferred_style: str | None = Field(None, pattern="^(direct|gentle|balanced)$")
    crisis_plan: str | None = None


class UserMeResponse(BaseModel):
    id: str
    email: str
    name: str
    is_active: bool
    created_at: datetime
    profile: UserProfileResponse | None = None

    model_config = {"from_attributes": True}
