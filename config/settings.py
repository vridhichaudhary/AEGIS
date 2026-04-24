from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    GOOGLE_API_KEY: Optional[str] = None
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

    VALIDATION_CONFIDENCE_THRESHOLD: float = 0.4
    DEDUP_SIMILARITY_THRESHOLD: float = 0.85
    MAX_DISPATCH_LATENCY_SECONDS: float = 3.0

    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
