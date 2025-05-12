try:
    # Pydantic v2+ (requires 'pydantic-settings' package)
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        # Environment-backed settings
        database_url: str
        secret_key: str
        debug: bool = False

        # Pydantic v2 config for .env, case insensitivity, and ignoring extra vars
        model_config = SettingsConfigDict(
            env_file=".env",
            case_sensitive=False,
            extra="ignore"
        )

except ImportError:
    # Fallback to Pydantic v1 BaseSettings + Field(env=...)
    from pydantic import BaseSettings, Field

    class Settings(BaseSettings):
        database_url: str = Field(..., env="DATABASE_URL")
        secret_key: str   = Field(..., env="SECRET_KEY")
        debug: bool       = Field(False, env="DEBUG")

        class Config:
            env_file = ".env"
            case_sensitive = False
            extra = "ignore"

# Instantiate a single settings object for import
settings = Settings()