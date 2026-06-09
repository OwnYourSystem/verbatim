"""End-to-end CRUD tests for the Phase 2 data model.

Runs against an in-memory SQLite DB so it needs no live Postgres. The ORM-level
cascades and priority-inheritance logic are exercised here.
"""
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  register tables (also avoids 'app' name shadowing)
from app.db import Base, get_db
from app.main import app as fastapi_app

# Shared in-memory SQLite across the whole test module.
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
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


def test_system_priority_inheritance_flow():
    # Create a system
    r = client.post("/systems", json={"name": "SAP Datasphere CLI"})
    assert r.status_code == 201
    system = r.json()
    sid = system["id"]
    assert system["current_priority"] is None

    # Set this month's priority
    today = date.today()
    r = client.put(
        f"/systems/{sid}/priorities",
        json={"system_id": sid, "year": today.year, "month": today.month, "score": 90},
    )
    assert r.status_code == 200

    # System now reports the current priority
    r = client.get(f"/systems/{sid}")
    assert r.json()["current_priority"] == 90

    # Create a task under the system
    r = client.post("/tasks", json={"system_id": sid, "title": "Build CLI auth"})
    assert r.status_code == 201
    tid = r.json()["id"]

    # Create a subtask — it should inherit the system's priority
    r = client.post("/subtasks", json={"task_id": tid, "title": "Token refresh"})
    assert r.status_code == 201
    assert r.json()["inherited_priority"] == 90


def test_cascade_delete_system_removes_tasks_and_subtasks():
    sid = client.post("/systems", json={"name": "Alchemy"}).json()["id"]
    tid = client.post("/tasks", json={"system_id": sid, "title": "T"}).json()["id"]
    client.post("/subtasks", json={"task_id": tid, "title": "S"})

    assert len(client.get(f"/tasks?system_id={sid}").json()) == 1

    assert client.delete(f"/systems/{sid}").status_code == 204
    assert client.get(f"/tasks?system_id={sid}").json() == []
    assert client.get(f"/subtasks?task_id={tid}").json() == []


def test_priority_upsert_is_idempotent_per_month():
    sid = client.post("/systems", json={"name": "Vanguard"}).json()["id"]
    today = date.today()
    body = {"system_id": sid, "year": today.year, "month": today.month, "score": 50}
    client.put(f"/systems/{sid}/priorities", json=body)
    body["score"] = 75
    client.put(f"/systems/{sid}/priorities", json=body)

    priorities = client.get(f"/systems/{sid}/priorities").json()
    assert len(priorities) == 1  # updated in place, not duplicated
    assert priorities[0]["score"] == 75


def test_focus_block_and_agent_assignment():
    sid = client.post("/systems", json={"name": "Greensand"}).json()["id"]
    today = date.today().isoformat()
    r = client.post("/focus-blocks", json={"day": today, "system_id": sid, "note": "deep work"})
    assert r.status_code == 201

    prog = client.post(
        "/agent-programs",
        json={"name": "Greensand specialist", "content": "Own the Greensand system."},
    ).json()
    r = client.put(
        "/agent-assignments",
        json={"system_id": sid, "agent_name": "Agent-G", "program_id": prog["id"]},
    )
    assert r.status_code == 200
    assert r.json()["agent_name"] == "Agent-G"
