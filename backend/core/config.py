try:
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        database_url: str
        secret_key: str
        debug: bool = False

        # add all the vars you reference
        access_token_expire_minutes: int = 60
        algorithm: str = "HS256"
        upload_dir: str = "./data/uploads"
        text_dir: str = "./data/text"
        podcast_dir: str = "./data/podcasts"
        ollama_url: str
        ollama_model: str
        tts_voice_female: str
        tts_voice_male: str

        model_config = SettingsConfigDict(
            env_file=".env",
            case_sensitive=False,
            extra="ignore"          # ignore truly unused vars
        )

except ImportError:
    from pydantic import BaseSettings, Field

    class Settings(BaseSettings):
        database_url: str = Field(..., env="DATABASE_URL")
        secret_key: str   = Field(..., env="SECRET_KEY")
        debug: bool       = Field(False, env="DEBUG")
        access_token_expire_minutes: int = Field(60, env="ACCESS_TOKEN_EXPIRE_MINUTES")
        algorithm: str    = Field("HS256", env="ALGORITHM")
        upload_dir: str   = Field("./data/uploads", env="UPLOAD_DIR")
        text_dir: str     = Field("./data/text", env="TEXT_DIR")
        podcast_dir: str  = Field("./data/podcasts", env="PODCAST_DIR")
        ollama_url: str   = Field(..., env="OLLAMA_URL")
        ollama_model: str = Field(..., env="OLLAMA_MODEL")
        tts_voice_female: str = Field(..., env="TTS_VOICE_FEMALE")
        tts_voice_male: str   = Field(..., env="TTS_VOICE_MALE")

        class Config:
            env_file = ".env"
            case_sensitive = False
            extra = "ignore"

settings = Settings()