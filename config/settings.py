from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Google Gemini (FREE tier)
    GOOGLE_API_KEY: str
    LLM_PROVIDER: str = "google"
    LLM_MODEL: str = "gemini-2.0-flash-exp"
    
    # LangSmith (optional)
    LANGCHAIN_TRACING_V2: bool = False
    LANGCHAIN_API_KEY: Optional[str] = None
    LANGCHAIN_PROJECT: str = "aegis-hackathon"
    
    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    
    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:3000"
    
    # Routing
    USE_MOCK_ROUTING: bool = True
    
    # Thresholds
    VALIDATION_CONFIDENCE_THRESHOLD: float = 0.4
    DEDUP_SIMILARITY_THRESHOLD: float = 0.85
    MAX_DISPATCH_LATENCY_SECONDS: float = 3.0
    
    # System
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"

settings = Settings()