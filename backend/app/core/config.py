"""Application configuration, loaded from environment variables.

Copy backend/.env.example to backend/.env and fill in values for local dev.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # App
    app_name: str = "MindAnchor"
    environment: str = "development"
    debug: bool = True

    # Database — Google Cloud SQL (PostgreSQL).
    # Local dev can point at a Cloud SQL Auth Proxy on localhost, or a local Postgres.
    # Example: postgresql+psycopg2://user:pass@localhost:5432/mindanchor
    database_url: str = "postgresql+psycopg2://mindanchor:mindanchor@localhost:5432/mindanchor"

    # Auth (single-user JWT)
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Anthropic Claude
    anthropic_api_key: str = ""
    model_planning: str = "claude-opus-4-8"
    model_fast: str = "claude-sonnet-4-6"

    # CORS — frontend origins allowed to call the API
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
