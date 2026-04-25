from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    GEMINI_API_KEY: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_JWT_SECRET: str
    GEMINI_LIVE_MODEL: str = "models/gemini-2.0-flash-live-001"
    GEMINI_EMBEDDING_MODEL: str = "models/text-embedding-004"


settings = Settings()
