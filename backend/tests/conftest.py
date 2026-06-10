"""Shared test setup.

Tests must be hermetic and offline: never use a developer's local backend/.env
ANTHROPIC_API_KEY (which would route agents to the real Claude API). This fixture
forces an empty key so get_llm()/get_intake() select the deterministic stubs.
"""
import pytest

from app.core.config import get_settings


@pytest.fixture(autouse=True)
def _force_offline_agents(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
