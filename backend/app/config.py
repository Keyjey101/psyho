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
    ADMIN_TELEGRAM_USERNAMES: str = ""
    RATE_LIMIT_CHAT: str = "30/minute"
    RATE_LIMIT_AUTH: str = "5/minute"

    CONTEXT_COMPRESSION_THRESHOLD: int = 40
    # Trigger compression earlier on verbose sessions: when total content
    # length across all messages exceeds this many characters (≈ 8k tokens
    # for Russian text). Whichever threshold (count or chars) hits first wins.
    CONTEXT_COMPRESSION_CHARS: int = 24000
    CONTEXT_KEEP_MESSAGES: int = 20

    AGENT_TIMEOUT_SECONDS: int = 15
    AGENT_MAX_TOKENS: int = 2048
    SYNTHESIS_MAX_TOKENS: int = 4096
    MAX_MESSAGE_LENGTH: int = 4000
    CLASSIFICATION_MAX_TOKENS: int = 200
    SESSION_MAX_EXCHANGES: int = 20

    TEST_PASSWORD_CODE: str = ""  # Development only — must be empty in production

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_BOT_USERNAME: str = ""

    OTP_EXPIRE_MINUTES: int = 10

    # ── Monetization ──────────────────────────────────────────────────────
    MONETIZATION_ENABLED: bool = False

    # Prices in kopecks (RUB * 100). Floats banned to avoid rounding pain.
    PRICING_PRO_MONTH_KOPECKS: int = 39000
    PRICING_PRO_3M_KOPECKS: int = 99000
    PRICING_PRO_YEAR_KOPECKS: int = 299000
    PRICING_PACK_5_KOPECKS: int = 29000
    PRICING_PACK_15_KOPECKS: int = 69000

    FREE_LIFETIME_SESSIONS: int = 2
    FREE_DAILY_ACTIONS: int = 1

    PACK_5_SIZE: int = 5
    PACK_15_SIZE: int = 15

    WS_RATE_LIMIT_FREE: int = 20
    WS_RATE_LIMIT_PRO: int = 60
    WS_RATE_LIMIT_PACKAGE: int = 30

    YOOKASSA_SHOP_ID: str = ""
    YOOKASSA_SECRET_KEY: str = ""
    YOOKASSA_RETURN_URL: str = "https://psyho.app/profile/subscription?from=yookassa"

    SUBSCRIPTION_GRACE_DAYS: int = 3
    SUBSCRIPTION_RENEW_LOOKAHEAD_HOURS: int = 24

    # ── Mini-game ─────────────────────────────────────────────────────────
    GAME_MAX_MOVES: int = 12
    GAME_CONFIDENCE_THRESHOLD: float = 0.80
    GAME_LLM_TIMEOUT: float = 15.0
    GAME_BUDGET_LIMIT_USD: float = 50.0
    GAME_HOST_MAX_TOKENS: int = 120
    GAME_ANALYZER_MAX_TOKENS: int = 200
    GAME_DESIGNER_MAX_TOKENS: int = 400
    GAME_CANARY_TOKEN: str = ""
    GAME_SESSION_TTL_HOURS: int = 2

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

    @field_validator("TEST_PASSWORD_CODE")
    @classmethod
    def test_code_must_be_empty_in_production(cls, v: str) -> str:
        if v and os.getenv("ENVIRONMENT") == "production":
            raise ValueError("TEST_PASSWORD_CODE must be empty in production")
        return v

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def admin_emails_list(self) -> list[str]:
        return [e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()]

    @property
    def admin_telegram_usernames_list(self) -> list[str]:
        return [u.strip().lstrip("@").lower() for u in self.ADMIN_TELEGRAM_USERNAMES.split(",") if u.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
