"""Tests for the Phase 4 agent flow: propose -> approve/reject -> apply.

Runs entirely on the StubLLM (no ANTHROPIC_API_KEY), so no network or cost.
"""
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  register tables / avoid name shadowing
from app.agents.llm import StubLLM
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


def test_no_api_key_uses_stub_llm(monkeypatch):
    # With no key configured, the orchestrator picks the offline stub.
    from app.agents import llm

    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    llm.get_settings.cache_clear()
    assert isinstance(llm.get_llm(), StubLLM)


def test_propose_then_approve_reorders_by_deadline():
    sid = client.post("/systems", json={"name": "S"}).json()["id"]
    today = date.today()
    later = (today + timedelta(days=20)).isoformat()
    soon = (today + timedelta(days=2)).isoformat()
    # Create "later" first (position 0), "soon" second (position 1).
    t_later = client.post(
        "/tasks", json={"system_id": sid, "title": "later", "deadline": later}
    ).json()["id"]
    t_soon = client.post(
        "/tasks", json={"system_id": sid, "title": "soon", "deadline": soon}
    ).json()["id"]

    # Ask the agent to propose — nothing changes yet.
    prop = client.post(f"/systems/{sid}/rebalance").json()
    assert prop["status"] == "pending"
    assert prop["summary"]
    # Positions unchanged until approval (both still at the default 0).
    assert client.get(f"/tasks/{t_later}").json()["position"] == 0

    # Approve → soon-due task moves ahead of later-due task.
    approved = client.post(f"/rebalance-proposals/{prop['id']}/approve").json()
    assert approved["status"] == "approved"
    assert client.get(f"/tasks/{t_soon}").json()["position"] == 0
    assert client.get(f"/tasks/{t_later}").json()["position"] == 1


def test_reject_does_not_apply():
    sid = client.post("/systems", json={"name": "S"}).json()["id"]
    tid = client.post("/tasks", json={"system_id": sid, "title": "t"}).json()["id"]
    before = client.get(f"/tasks/{tid}").json()["position"]

    prop = client.post(f"/systems/{sid}/rebalance").json()
    rejected = client.post(f"/rebalance-proposals/{prop['id']}/reject").json()
    assert rejected["status"] == "rejected"
    assert client.get(f"/tasks/{tid}").json()["position"] == before


def test_cannot_decide_twice():
    sid = client.post("/systems", json={"name": "S"}).json()["id"]
    client.post("/tasks", json={"system_id": sid, "title": "t"})
    prop = client.post(f"/systems/{sid}/rebalance").json()
    client.post(f"/rebalance-proposals/{prop['id']}/approve")
    again = client.post(f"/rebalance-proposals/{prop['id']}/approve")
    assert again.status_code == 409


def test_add_pretask_action_creates_front_task():
    sid = client.post("/systems", json={"name": "S"}).json()["id"]
    soon = (date.today() + timedelta(days=1)).isoformat()
    client.post("/tasks", json={"system_id": sid, "title": "urgent", "deadline": soon})

    prop = client.post(f"/systems/{sid}/rebalance").json()
    # Stub suggests a prep pre-task for the near-term deadline.
    assert any(a["type"] == "add_pretask" for a in prop["actions"])

    client.post(f"/rebalance-proposals/{prop['id']}/approve")
    titles = [t["title"] for t in client.get(f"/tasks?system_id={sid}").json()]
    assert any(t.startswith("Prep for:") for t in titles)
