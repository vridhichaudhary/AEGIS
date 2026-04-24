from typing import Optional

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _clean_env_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value
    cleaned = value.strip().strip("\"'").strip()
    if " #" in cleaned:
        cleaned = cleaned.split(" #", 1)[0].strip()
    return cleaned or None


class Settings(BaseSettings):
    GOOGLE_API_KEY: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("GOOGLE_API_KEY", "GEMINI_API_KEY"),
    )
    LLM_PROVIDER: str = "google"
    LLM_MODEL: str = "gemini-1.5-flash"

    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_API_KEY: Optional[str] = None
    LANGCHAIN_PROJECT: str = "aegis-hackathon"

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    PORTAL_WS_URL: Optional[str] = None

    USE_MOCK_ROUTING: bool = True
    ENABLE_SEMANTIC_EMBEDDINGS: bool = False
    LLM_TIMEOUT_SECONDS: float = 8.0

    VALIDATION_CONFIDENCE_THRESHOLD: float = 0.4
    DEDUP_SIMILARITY_THRESHOLD: float = 0.85
    MAX_DISPATCH_LATENCY_SECONDS: float = 3.0

    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator(
        "GOOGLE_API_KEY",
        "LLM_PROVIDER",
        "LLM_MODEL",
        "LANGCHAIN_API_KEY",
        "LANGCHAIN_PROJECT",
        "REDIS_HOST",
        "CORS_ORIGINS",
        "PORTAL_WS_URL",
        "ENVIRONMENT",
        "LOG_LEVEL",
        mode="before",
    )
    @classmethod
    def strip_comments_and_whitespace(cls, value):
        if isinstance(value, str):
            return _clean_env_value(value)
        return value


settings = Settings()
