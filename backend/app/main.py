"""MindAnchor backend entry point.

Phase 1: a minimal, runnable FastAPI app with health endpoints and CORS.
Data models, CRUD routes, and the agent layer arrive in later phases.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings

settings = get_settings()

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


@app.get("/", tags=["meta"])
def root() -> dict[str, str]:
    return {"app": settings.app_name, "version": "0.1.0", "status": "ok"}


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Liveness probe — used by hosting platform health checks."""
    return {"status": "healthy", "environment": settings.environment}
