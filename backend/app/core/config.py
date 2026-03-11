from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "LinguaCompanion API"
    DEBUG: bool = False
    VERSION: str = "0.1.0"

    # Database (optional for local dev without DB)
    DATABASE_URL: str = "sqlite:///./dev.db"

    # Redis
    REDIS_URL: str = "redis://localhost:6380/0"

    # LLM — swap provider via single env var
    LLM_MODEL: str = "groq/llama-3.3-70b-versatile"
    GROQ_API_KEY: Optional[str] = None
    DEEPGRAM_API_KEY: Optional[str] = None
    STT_PROVIDER: str = "deepgram"  # deepgram | groq
    GEMINI_API_KEY: Optional[str] = None

    # STT
    WHISPER_MODEL: str = "whisper-large-v3-turbo"

    # TTS
    GOOGLE_TTS_API_KEY: Optional[str] = None

    # Auth (default for local dev)
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Rate limits
    STT_RATE_LIMIT: str = "10/minute"
    CHAT_RATE_LIMIT: str = "30/minute"

    # Embeddings
    EMBEDDINGS_MODEL: str = "multilingual-e5-large"
    USE_LOCAL_EMBEDDINGS: bool = False  # False = Google API (saves RAM)

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra env vars not defined in Settings


settings = Settings()
