"""Regression tests for settings normalization.

Production runs on Render, whose managed Postgres emits a bare ``postgres://``
DATABASE_URL. SQLAlchemy 2.x rejects that scheme (NoSuchModuleError), which
caused 500s on every request. CORS_ORIGINS is likewise supplied as a plain
comma-separated string by the hosting dashboard. Both must be accepted.
"""
from app.core.config import Settings


def test_postgres_scheme_is_normalized():
    s = Settings(database_url="postgres://u:p@host:5432/db")
    assert s.database_url == "postgresql+psycopg2://u:p@host:5432/db"


def test_postgresql_scheme_gets_driver():
    s = Settings(database_url="postgresql://u:p@host:5432/db")
    assert s.database_url == "postgresql+psycopg2://u:p@host:5432/db"


def test_explicit_driver_is_left_untouched():
    url = "postgresql+psycopg2://u:p@host:5432/db"
    assert Settings(database_url=url).database_url == url


def test_sqlite_url_is_untouched():
    assert Settings(database_url="sqlite:///x.db").database_url == "sqlite:///x.db"


def test_cors_origins_accepts_comma_separated_string():
    s = Settings(cors_origins="https://a.vercel.app, https://b.com")
    assert s.cors_origins == ["https://a.vercel.app", "https://b.com"]


def test_cors_origins_accepts_json_array():
    s = Settings(cors_origins='["https://a.vercel.app"]')
    assert s.cors_origins == ["https://a.vercel.app"]


def test_cors_origins_empty_string_is_empty_list():
    assert Settings(cors_origins="").cors_origins == []
