from pydantic import BaseModel
from datetime import datetime

from app.schemas.message import MessageResponse


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
    continuation_context: str | None = None
    max_exchanges: int = 20

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    id: str
    title: str | None
    created_at: datetime
    updated_at: datetime
    summary: str | None
    continuation_context: str | None = None
    max_exchanges: int = 20

    model_config = {"from_attributes": True}


class SessionDetailResponse(BaseModel):
    id: str
    title: str | None
    created_at: datetime
    updated_at: datetime
    summary: str | None
    continuation_context: str | None = None
    max_exchanges: int = 20
    messages: list[MessageResponse] = []

    model_config = {"from_attributes": True}
