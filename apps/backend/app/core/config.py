"""Application configuration.

Settings are loaded from environment variables (and a repo-root ``.env`` file
for local development) and validated by Pydantic. Required values have no
defaults, so the application fails fast at startup if they are missing.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# apps/backend/app/core/config.py -> repo root is four parents up from this file's dir.
_REPO_ROOT = Path(__file__).resolve().parents[4]


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

    # Database (Supabase PostgreSQL)
    database_url: str

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance."""
    return Settings()  # type: ignore[call-arg]
