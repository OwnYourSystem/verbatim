"""Tests for the auth endpoint."""
import pytest
from fastapi.testclient import TestClient
from passlib.hash import bcrypt as _bcrypt

from app.auth import get_current_user
from app.core.config import get_settings
from app.main import app

client = TestClient(app)


@pytest.fixture
def _with_password(monkeypatch):
    """Set a known bcrypt hash so login tests can use the real verify path."""
    try:
        hashed = _bcrypt.hash("testpass")
    except Exception:
        pytest.skip("bcrypt backend unavailable in this env (passlib version conflict)")
    hashed = _bcrypt.hash("testpass")
    monkeypatch.setenv("PASSWORD_HASH", hashed)
    get_settings.cache_clear()
    # Remove the auth override so real auth runs
    app.dependency_overrides.pop(get_current_user, None)
    yield
    get_settings.cache_clear()
    app.dependency_overrides[get_current_user] = lambda: "owner"


def test_login_success(_with_password):
    resp = client.post("/auth/login", json={"password": "testpass"})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password(_with_password):
    resp = client.post("/auth/login", json={"password": "wrong"})
    assert resp.status_code == 401


def test_protected_route_without_token():
    app.dependency_overrides.pop(get_current_user, None)
    try:
        resp = client.get("/systems")
        assert resp.status_code == 401
    finally:
        app.dependency_overrides[get_current_user] = lambda: "owner"
