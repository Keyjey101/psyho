from pydantic import BaseModel
from datetime import datetime


class MessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    agents_used: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageListResponse(BaseModel):
    messages: list[MessageResponse]
    total: int
