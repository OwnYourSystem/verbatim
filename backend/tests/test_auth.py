"""Tests for the auth endpoint."""
import pytest
from fastapi.testclient import TestClient
from passlib.hash import bcrypt as _bcrypt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import get_current_user
from app.core.config import get_settings
from app.db import Base, get_db
from app.main import app
from app.models import User

try:
    _HASH = _bcrypt.hash("testpass")
    _BCRYPT_OK = True
except Exception:
    _BCRYPT_OK = False

_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_Session = sessionmaker(bind=_engine, autoflush=False, autocommit=False)


def _override_db():
    db = _Session()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def _auth_db(monkeypatch):
    if not _BCRYPT_OK:
        pytest.skip("bcrypt backend unavailable in this env")

    Base.metadata.create_all(bind=_engine)

    with _Session() as s:
        if not s.query(User).filter_by(username="testuser").first():
            s.add(User(username="testuser", password_hash=_HASH, role="tester"))
            s.commit()

    monkeypatch.setenv("PASSWORD_HASH", _HASH)
    get_settings.cache_clear()
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides[get_db] = _override_db
    yield
    get_settings.cache_clear()
    app.dependency_overrides[get_current_user] = lambda: "owner"
    app.dependency_overrides.pop(get_db, None)

    Base.metadata.drop_all(bind=_engine)


client = TestClient(app)


def test_login_success():
    resp = client.post("/auth/login", json={"username": "testuser", "password": "testpass"})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_owner_legacy_fallback():
    """Owner account falls back to PASSWORD_HASH env var when not in DB."""
    resp = client.post("/auth/login", json={"username": "owner", "password": "testpass"})
    assert resp.status_code == 200


def test_login_wrong_password():
    resp = client.post("/auth/login", json={"username": "testuser", "password": "wrong"})
    assert resp.status_code == 401


def test_protected_route_without_token():
    app.dependency_overrides.pop(get_current_user, None)
    try:
        resp = client.get("/systems")
        assert resp.status_code == 401
    finally:
        app.dependency_overrides[get_current_user] = lambda: "owner"
