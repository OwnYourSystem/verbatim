"""Tests for the report generators (deterministic, offline)."""
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


def _seed():
    sid = client.post("/systems", json={"name": "S"}).json()["id"]
    today = date.today()
    client.put(
        f"/systems/{sid}/priorities",
        json={"system_id": sid, "year": today.year, "month": today.month, "score": 80},
    )
    overdue = (today - timedelta(days=1)).isoformat()
    soon = (today + timedelta(days=2)).isoformat()
    t_done = client.post("/tasks", json={"system_id": sid, "title": "done one"}).json()["id"]
    client.patch(f"/tasks/{t_done}", json={"status": "done"})
    client.post("/tasks", json={"system_id": sid, "title": "late", "deadline": overdue})
    client.post("/tasks", json={"system_id": sid, "title": "soon", "deadline": soon})
    return sid


def test_weekly_report_structure_and_content():
    _seed()
    r = client.get("/reports/weekly").json()
    assert r["type"] == "weekly"
    headings = {s["heading"] for s in r["sections"]}
    assert {"By system", "Behind", "Coming next week"} <= headings
    behind = next(s for s in r["sections"] if s["heading"] == "Behind")["items"]
    assert any("late" in i for i in behind)
    coming = next(s for s in r["sections"] if s["heading"] == "Coming next week")["items"]
    assert any("soon" in i for i in coming)


def test_monthly_report_completion():
    _seed()
    r = client.get("/reports/monthly").json()
    assert r["type"] == "monthly"
    # 1 of 3 tasks done → 33% overall mentioned in summary.
    assert "33%" in r["summary"] or "33" in r["summary"]


def test_on_demand_lists_overdue():
    _seed()
    r = client.get("/reports/on-demand").json()
    overdue = next(s for s in r["sections"] if s["heading"] == "Overdue")["items"]
    assert any("late" in i for i in overdue)


def test_morning_briefing_has_focus():
    _seed()
    r = client.get("/reports/morning-briefing").json()
    assert r["type"] == "morning_briefing"
    focus = next(s for s in r["sections"] if s["heading"] == "Today's focus")["items"]
    assert any("S" in i for i in focus)


def test_reports_on_empty_db_do_not_error():
    paths = [
        "/reports/weekly",
        "/reports/monthly",
        "/reports/on-demand",
        "/reports/morning-briefing",
    ]
    for path in paths:
        assert client.get(path).status_code == 200
