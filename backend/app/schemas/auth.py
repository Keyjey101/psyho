from pydantic import BaseModel
from datetime import datetime


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UtmInfo(BaseModel):
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None
    utm_content: str | None = None
    utm_term: str | None = None
    referrer_host: str | None = None


class TelegramAuthRequest(BaseModel):
    init_data: str
    utm: UtmInfo | None = None


class TelegramAuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool
    tg_name: str = ""


class LinkTelegramRequest(BaseModel):
    init_data: str


class TgRequestCodeRequest(BaseModel):
    telegram_username: str | None = None


class TgRequestCodeResponse(BaseModel):
    request_id: str
    code: str
    bot_username: str
    expires_in: int = 600


class TgCheckResponse(BaseModel):
    status: str
    access_token: str | None = None
    refresh_token: str | None = None
    is_new_user: bool | None = None


class TgMiniAppRequest(BaseModel):
    telegram_id: str
    first_name: str = ""
    username: str | None = None
    utm: UtmInfo | None = None
