from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    GEMINI_API_KEY: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    GEMINI_LIVE_MODEL: str = "models/gemini-3.1-flash-live-preview"
    GEMINI_EMBEDDING_MODEL: str = "text-embedding-004"


settings = Settings()
