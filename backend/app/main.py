"""MindAnchor backend entry point."""
from __future__ import annotations

import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    agents,
    calendar,
    checkins,
    dashboard,
    intake,
    pains,
    reading,
    rebalance,
    reports,
    specific_knowledges,
    systems,
    tasks,
)
from app.api import auth as auth_router
from app.auth import get_current_user
from app.core.config import get_settings


def _run_migrations() -> None:
    """Apply any pending Alembic migrations on startup, then no-op on subsequent runs."""
    try:
        from alembic import command
        from alembic.config import Config

        cfg = Config("alembic.ini")
        command.upgrade(cfg, "head")
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).warning("Migration skipped: %s", exc)


settings = get_settings()
_run_migrations()

app = FastAPI(
    title=settings.app_name,
    description="Personal AI-powered productivity system — the external brain.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public routes — no auth required
app.include_router(auth_router.router)

# Protected routes — every request must carry a valid JWT
_auth = [Depends(get_current_user)]
app.include_router(systems.router, dependencies=_auth)
app.include_router(tasks.router, dependencies=_auth)
app.include_router(calendar.router, dependencies=_auth)
app.include_router(agents.router, dependencies=_auth)
app.include_router(dashboard.router, dependencies=_auth)
app.include_router(checkins.router, dependencies=_auth)
app.include_router(rebalance.router, dependencies=_auth)
app.include_router(intake.router, dependencies=_auth)
app.include_router(reports.router, dependencies=_auth)
app.include_router(specific_knowledges.router, dependencies=_auth)
app.include_router(reading.router, dependencies=_auth)
app.include_router(pains.router, dependencies=_auth)


@app.get("/", tags=["meta"])
def root() -> dict[str, str]:
    return {"app": settings.app_name, "version": "0.1.0", "status": "ok"}


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Liveness probe — used by hosting platform health checks."""
    return {"status": "healthy", "environment": settings.environment}
