"""Application configuration, loaded from environment variables.

Copy backend/.env.example to backend/.env and fill in values for local dev.
In production (Cloud Run) all values are injected as env vars / secrets.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # App
    app_name: str = "MindAnchor"
    environment: str = "development"
    debug: bool = False

    # Database — Google Cloud SQL (PostgreSQL) in prod; local Postgres in dev.
    # Cloud Run: set via Secret Manager secret mounted as DATABASE_URL env var.
    # Cloud SQL socket path example:
    #   postgresql+psycopg2://user:pass@/mindanchor?host=/cloudsql/PROJECT:REGION:INSTANCE
    database_url: str = "postgresql+psycopg2://mindanchor:mindanchor@localhost:5432/mindanchor"

    # Auth (single-user JWT)
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days
    # bcrypt hash of the owner password — generate with:
    #   python -c "from passlib.hash import bcrypt; print(bcrypt.hash('yourpassword'))"
    password_hash: str = ""

    # Anthropic Claude
    anthropic_api_key: str = ""
    model_planning: str = "claude-opus-4-8"
    model_fast: str = "claude-sonnet-4-6"

    # CORS — comma-separated in env: CORS_ORIGINS=https://mindanchor.vercel.app,https://custom.domain
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        """Accept the bare ``postgres://`` scheme that managed hosts (Render,
        Heroku, Railway) emit and rewrite it to the driver-qualified form that
        SQLAlchemy 2.x requires. SQLAlchemy 2.0 dropped the ``postgres`` alias,
        so leaving it unrewritten raises NoSuchModuleError on every request.
        """
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return "postgresql+psycopg2://" + v[len("postgres://"):]
            if v.startswith("postgresql://"):
                return "postgresql+psycopg2://" + v[len("postgresql://"):]
        return v

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, v: object) -> object:
        """Allow CORS_ORIGINS to be given as a comma-separated string in the
        environment (the natural form for a hosting dashboard) in addition to a
        JSON array. Without this, a plain string fails settings validation and
        the app cannot boot.
        """
        if isinstance(v, str):
            s = v.strip()
            if not s:
                return []
            if s.startswith("["):  # JSON array form
                import json

                return json.loads(s)
            return [item.strip() for item in s.split(",") if item.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
