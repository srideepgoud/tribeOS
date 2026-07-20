"""Application configuration.

Settings are loaded from environment variables (and a repo-root ``.env`` file
for local development) and validated by Pydantic. Required values have no
defaults, so the application fails fast at startup if they are missing.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# apps/backend/app/core/config.py -> repo root is four parents up from this file's dir.
_REPO_ROOT = Path(__file__).resolve().parents[4]

_DEFAULT_DEV_CORS_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
)


class Settings(BaseSettings):
    """Validated application settings.

    Environment variable names are matched case-insensitively to field names,
    so ``DATABASE_URL`` populates ``database_url``.
    """

    model_config = SettingsConfigDict(
        env_file=_REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Runtime
    app_env: str = "development"
    log_level: str = "INFO"

    # Comma-separated browser origins allowed for CORS (local Next.js ports by default).
    cors_origins: list[str] = Field(default_factory=lambda: list(_DEFAULT_DEV_CORS_ORIGINS))

    # Database (Supabase PostgreSQL)
    database_url: str

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if value is None or value == "":
            return list(_DEFAULT_DEV_CORS_ORIGINS)
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance."""
    return Settings()  # type: ignore[call-arg]
