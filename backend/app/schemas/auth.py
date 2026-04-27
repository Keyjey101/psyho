from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    name: str = Field(min_length=1, max_length=100)

    @field_validator("password")
    @classmethod
    def password_must_contain_digit(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Пароль должен содержать хотя бы одну цифру")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


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


class SendCodeRequest(BaseModel):
    email: EmailStr


class SendCodeResponse(BaseModel):
    user_exists: bool
    message: str = "Код отправлен"


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=10, pattern=r"^\d+$")


class VerifyCodeResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool


class TelegramAuthRequest(BaseModel):
    init_data: str


class TelegramAuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool
    tg_name: str = ""


class LinkTelegramRequest(BaseModel):
    init_data: str


class LinkEmailSendRequest(BaseModel):
    email: EmailStr


class LinkEmailVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=10, pattern=r"^\d+$")
