from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "LinguaCompanion API"
    DEBUG: bool = False
    VERSION: str = "0.2.0"

    # Database
    DATABASE_URL: str = "sqlite:///./dev.db"

    # Redis
    REDIS_URL: str = "redis://localhost:6380/0"

    # --- LLM Model Router ---
    OPENROUTER_API_KEY: Optional[str] = None
    # Legacy fallback (used by agents that haven't migrated to per-task models)
    LLM_MODEL: str = "openrouter/deepseek/deepseek-v3.2"
    # Per-task models
    MODEL_COMPANION: str = "openrouter/deepseek/deepseek-v3.2"
    MODEL_RECONSTRUCTION: str = "openrouter/deepseek/deepseek-v3.2"
    MODEL_VARIANTS: str = "openrouter/deepseek/deepseek-v3.2"
    MODEL_TRANSLATION: str = "openrouter/qwen/qwen3-235b-a22b-2507"
    MODEL_EXTRACTION: str = "openrouter/qwen/qwen3-235b-a22b-2507"
    MODEL_ONBOARDING: str = "openrouter/google/gemma-4-31b-it:free"
    MODEL_TOPIC_DISCOVERY: str = "openrouter/qwen/qwen3-235b-a22b-2507"

    # --- STT ---
    DEEPGRAM_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    STT_PROVIDER: str = "deepgram"
    WHISPER_MODEL: str = "whisper-large-v3-turbo"

    # --- TTS Fallback Chain ---
    ELEVENLABS_API_KEYS: str = ""  # comma-separated
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"

    # --- Embeddings ---
    GEMINI_API_KEY: Optional[str] = None
    GOOGLE_EMBEDDINGS_MODEL: str = "text-embedding-004"

    # --- Supabase ---
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    # --- Auth ---
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
