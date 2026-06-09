"""Database engine, session, and declarative base.

Development uses a local PostgreSQL instance (see backend/.env). Production will
point DATABASE_URL at Google Cloud SQL. Schema is managed by Alembic; in
development we also expose init_db() to create tables directly for convenience.
"""
from __future__ import annotations

from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

# Engine is created lazily so that merely importing this module never requires
# the Postgres driver. Tests override get_db and therefore never touch it.
SessionLocal = sessionmaker(autoflush=False, autocommit=False)


@lru_cache
def get_engine() -> Engine:
    return create_engine(settings.database_url, echo=settings.debug, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a database session."""
    db = SessionLocal(bind=get_engine())
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Dev convenience only — production uses Alembic."""
    import app.models  # noqa: F401  (ensure models are imported/registered)

    Base.metadata.create_all(bind=get_engine())
