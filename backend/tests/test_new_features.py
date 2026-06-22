"""Smoke tests for the newer features whose missing migrations caused the
production 500s: Specific Knowledge, Check Out ASAP (reading items), and the
Wall of Pains. These assert the endpoints respond without server errors and
that core create/read flows work end to end against a fresh schema.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  register tables / avoid name shadowing
from app.db import Base, get_db
from app.main import app as fastapi_app

engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def _override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def _setup_db():
    Base.metadata.create_all(bind=engine)
    fastapi_app.dependency_overrides[get_db] = _override_get_db
    yield
    fastapi_app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


client = TestClient(fastapi_app)


# ── Specific Knowledge ────────────────────────────────────────────────────────

def test_specific_knowledge_crud_and_universe():
    assert client.get("/specific-knowledges").json() == []

    created = client.post(
        "/specific-knowledges",
        json={"name": "Rare GPU kernel tuning", "temperature": 9},
    )
    assert created.status_code in (200, 201)
    sk_id = created.json()["id"]

    listed = client.get("/specific-knowledges")
    assert listed.status_code == 200
    assert any(s["id"] == sk_id for s in listed.json())

    updated = client.put(
        f"/specific-knowledges/{sk_id}", json={"temperature": 3}
    )
    assert updated.status_code == 200
    assert updated.json()["temperature"] == 3

    assert client.delete(f"/specific-knowledges/{sk_id}").status_code in (200, 204)


def test_specific_knowledge_suggest_offline():
    res = client.post(
        "/specific-knowledges/suggest",
        json={"title": "Build a vector search index", "description": "pgvector"},
    )
    assert res.status_code == 200
    body = res.json()
    assert "name" in body and "temperature" in body


# ── Check Out ASAP (reading items) ────────────────────────────────────────────

def test_reading_items_check_flow():
    assert client.get("/reading-items?archived=false").json() == []

    created = client.post(
        "/reading-items",
        json={"title": "Latent Space post", "url": "https://example.com"},
    )
    assert created.status_code in (200, 201)
    item_id = created.json()["id"]
    assert created.json()["is_checked"] is False

    checked = client.patch(
        f"/reading-items/{item_id}", json={"is_checked": True}
    )
    assert checked.status_code == 200
    assert checked.json()["is_checked"] is True
    assert checked.json()["checked_at"] is not None

    # archived list now contains it
    archived = client.get("/reading-items?archived=true")
    assert any(i["id"] == item_id for i in archived.json())


# ── Wall of Pains ─────────────────────────────────────────────────────────────

def test_pain_to_project_to_system():
    assert client.get("/pains").json() == []

    pain = client.post(
        "/pains",
        json={"title": "ETL pipelines are brittle", "area": "data_engineering"},
    )
    assert pain.status_code in (200, 201)
    pain_id = pain.json()["id"]

    project = client.post(
        f"/pains/{pain_id}/project",
        json={"name": "ResilientETL", "phase": "idea"},
    )
    assert project.status_code in (200, 201)

    # creating a second project for the same pain is rejected
    dup = client.post(
        f"/pains/{pain_id}/project", json={"name": "Again", "phase": "idea"}
    )
    assert dup.status_code == 409

    sys_res = client.post(f"/pains/{pain_id}/create-system")
    assert sys_res.status_code in (200, 201)
    assert sys_res.json()["project"]["system_id"] is not None


def test_pain_discover_offline_returns_curated():
    res = client.post("/pains/discover?area=all")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list) and len(items) > 0
    assert "title" in items[0]
