from pydantic import BaseModel, Field
from datetime import datetime


class SessionCreate(BaseModel):
    title: str | None = None


class SessionUpdate(BaseModel):
    title: str | None = None


class SessionResponse(BaseModel):
    id: str
    title: str | None
    created_at: datetime
    updated_at: datetime
    summary: str | None

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    id: str
    title: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionDetailResponse(BaseModel):
    id: str
    title: str | None
    created_at: datetime
    updated_at: datetime
    summary: str | None
    messages: list["MessageResponse"] = []

    model_config = {"from_attributes": True}
