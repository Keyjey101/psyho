from pydantic import BaseModel, Field
from datetime import datetime


class UserProfileResponse(BaseModel):
    user_id: str
    therapy_goals: str | None
    preferred_style: str
    crisis_plan: str | None
    memory_enabled: bool = True
    long_term_memory: str | None = None
    pop_score: int = 0
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    therapy_goals: str | None = None
    preferred_style: str | None = Field(None, pattern="^(direct|gentle|balanced)$")
    crisis_plan: str | None = None
    memory_enabled: bool | None = None


class PopScoreAdd(BaseModel):
    count: int = Field(ge=1, le=500)


class UserMeResponse(BaseModel):
    id: str
    email: str
    name: str
    is_active: bool
    created_at: datetime
    profile: UserProfileResponse | None = None

    model_config = {"from_attributes": True}
