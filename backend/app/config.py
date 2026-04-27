import os
from pydantic import field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    PROJECT_NAME: str = "PsyHo"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"

    ZAI_API_KEY: str = ""
    ZAI_BASE_URL: str = "https://api.zai.chat/v1"
    ZAI_MODEL: str = "glm-5"
    ZAI_SMALL_MODEL: str = "glm-4-flash"

    SECRET_KEY: str = "change-me-to-a-long-random-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    DATABASE_URL: str = "sqlite+aiosqlite:///./data/psyho.db"

    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    ADMIN_EMAILS: str = ""
    RATE_LIMIT_CHAT: str = "30/minute"
    RATE_LIMIT_AUTH: str = "5/minute"

    CONTEXT_COMPRESSION_THRESHOLD: int = 40
    CONTEXT_KEEP_MESSAGES: int = 20

    AGENT_TIMEOUT_SECONDS: int = 15
    AGENT_MAX_TOKENS: int = 2048
    SYNTHESIS_MAX_TOKENS: int = 4096
    MAX_MESSAGE_LENGTH: int = 4000
    CLASSIFICATION_MAX_TOKENS: int = 200
    SESSION_MAX_EXCHANGES: int = 20

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM: str = "noreply@psyho.app"
    SMTP_TLS: bool = True

    TEST_PASSWORD_CODE: str = ""

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_BOT_USERNAME: str = ""

    OTP_EXPIRE_MINUTES: int = 10
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RATE_LIMIT_COUNT: int = 3
    OTP_RATE_LIMIT_MINUTES: int = 10

    model_config = {"env_file": (".env", "../.env"), "env_file_encoding": "utf-8", "extra": "ignore"}

    @field_validator("TELEGRAM_BOT_USERNAME")
    @classmethod
    def strip_bot_username_at(cls, v: str) -> str:
        return v.lstrip("@")

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_strong(cls, v: str) -> str:
        if v == "change-me-to-a-long-random-secret-key-in-production" and os.getenv("ENVIRONMENT") == "production":
            raise ValueError("SECRET_KEY must be changed in production")
        return v

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def admin_emails_list(self) -> list[str]:
        return [e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
