"""Shared test setup.

- Forces ANTHROPIC_API_KEY empty so agent calls use deterministic stubs.
- Overrides get_current_user so all protected routes work without a real JWT.
"""
import pytest

from app.auth import get_current_user
from app.core.config import get_settings
from app.main import app


@pytest.fixture(autouse=True)
def _force_offline_agents(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _bypass_auth():
    """Override JWT auth so tests don't need a real token."""
    app.dependency_overrides[get_current_user] = lambda: "owner"
    yield
    app.dependency_overrides.clear()
