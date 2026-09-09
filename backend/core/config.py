from typing import List

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        database_url: str = "sqlite:///./data/notecast.db"
        secret_key: str = "dev-secret-change-me"
        debug: bool = False

        access_token_expire_minutes: int = 60
        algorithm: str = "HS256"
        upload_dir: str = "./data/uploads"
        text_dir: str = "./data/text"
        podcast_dir: str = "./data/podcasts"
        ollama_url: str = "http://127.0.0.1:11434"
        ollama_model: str = "llama3.2"
        tts_engine: str = "edge"
        tts_voice_female: str = "en-US-AriaNeural"
        tts_voice_male: str = "en-US-GuyNeural"
        tts_sample_rate: int = 24000
        cors_origins: str = ""

        model_config = SettingsConfigDict(
            env_file=".env",
            case_sensitive=False,
            extra="ignore",
        )

except ImportError:
    from pydantic import BaseSettings, Field

    class Settings(BaseSettings):
        database_url: str = Field("sqlite:///./data/notecast.db", env="DATABASE_URL")
        secret_key: str = Field("dev-secret-change-me", env="SECRET_KEY")
        debug: bool = Field(False, env="DEBUG")
        access_token_expire_minutes: int = Field(60, env="ACCESS_TOKEN_EXPIRE_MINUTES")
        algorithm: str = Field("HS256", env="ALGORITHM")
        upload_dir: str = Field("./data/uploads", env="UPLOAD_DIR")
        text_dir: str = Field("./data/text", env="TEXT_DIR")
        podcast_dir: str = Field("./data/podcasts", env="PODCAST_DIR")
        ollama_url: str = Field("http://127.0.0.1:11434", env="OLLAMA_URL")
        ollama_model: str = Field("llama3.2", env="OLLAMA_MODEL")
        tts_engine: str = Field("edge", env="TTS_ENGINE")
        tts_voice_female: str = Field("en-US-AriaNeural", env="TTS_VOICE_FEMALE")
        tts_voice_male: str = Field("en-US-GuyNeural", env="TTS_VOICE_MALE")
        tts_sample_rate: int = Field(24000, env="TTS_SAMPLE_RATE")
        cors_origins: str = Field("", env="CORS_ORIGINS")

        class Config:
            env_file = ".env"
            case_sensitive = False
            extra = "ignore"


settings = Settings()


def get_cors_origins() -> List[str]:
    defaults = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://notecast.infinia.chat",
    ]
    extra = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
    return list(dict.fromkeys(defaults + extra))
