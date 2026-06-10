"""Tests for the rule-based daily focus, dashboard, and end-of-day check-in."""
from datetime import date, timedelta

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


def _make_system(name: str, score: int) -> int:
    sid = client.post("/systems", json={"name": name}).json()["id"]
    today = date.today()
    client.put(
        f"/systems/{sid}/priorities",
        json={"system_id": sid, "year": today.year, "month": today.month, "score": score},
    )
    return sid


def test_focus_picks_highest_priority_system_with_open_work():
    low = _make_system("Low priority system", 20)
    high = _make_system("High priority system", 95)
    client.post("/tasks", json={"system_id": low, "title": "low task"})
    client.post("/tasks", json={"system_id": high, "title": "high task"})

    data = client.get("/dashboard/today").json()
    assert data["focus_system"]["id"] == high
    assert data["focus_system"]["current_priority"] == 95
    assert [t["title"] for t in data["focus_tasks"]] == ["high task"]


def test_upcoming_and_flagged_buckets():
    sid = _make_system("S", 50)
    today = date.today()
    overdue = (today - timedelta(days=2)).isoformat()
    soon = (today + timedelta(days=3)).isoformat()
    far = (today + timedelta(days=30)).isoformat()

    client.post("/tasks", json={"system_id": sid, "title": "overdue", "deadline": overdue})
    client.post("/tasks", json={"system_id": sid, "title": "soon", "deadline": soon})
    client.post("/tasks", json={"system_id": sid, "title": "far", "deadline": far})
    client.post("/tasks", json={"system_id": sid, "title": "blocked", "status": "blocked"})

    data = client.get("/dashboard/today").json()
    upcoming_titles = [t["title"] for t in data["upcoming_deadlines"]]
    flagged_titles = {t["title"] for t in data["flagged"]}

    assert "soon" in upcoming_titles
    assert "far" not in upcoming_titles  # outside 7-day window
    assert "overdue" in flagged_titles  # past deadline
    assert "blocked" in flagged_titles  # blocked status


def test_check_in_marks_tasks_done_and_records_history():
    sid = _make_system("S", 50)
    t1 = client.post("/tasks", json={"system_id": sid, "title": "t1"}).json()["id"]
    t2 = client.post("/tasks", json={"system_id": sid, "title": "t2"}).json()["id"]

    r = client.post(
        "/check-ins",
        json={"notes": "wrapped up t1", "completed_task_ids": [t1]},
    )
    assert r.status_code == 201
    assert r.json()["completed_task_ids"] == [t1]

    # t1 now done, t2 still open
    assert client.get(f"/tasks/{t1}").json()["status"] == "done"
    assert client.get(f"/tasks/{t2}").json()["status"] == "todo"

    # the completed task drops out of the dashboard's open buckets
    data = client.get("/dashboard/today").json()
    assert "t1" not in [t["title"] for t in data["focus_tasks"]]


def test_empty_dashboard_has_no_focus():
    data = client.get("/dashboard/today").json()
    assert data["focus_system"] is None
    assert data["focus_tasks"] == []
