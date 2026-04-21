import os
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

    RATE_LIMIT_CHAT: str = "30/minute"
    RATE_LIMIT_AUTH: str = "5/minute"

    CONTEXT_COMPRESSION_THRESHOLD: int = 40
    CONTEXT_KEEP_MESSAGES: int = 20

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
