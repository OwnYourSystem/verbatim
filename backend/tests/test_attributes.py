"""CR-1 tests: full task/subtask attributes, time logging, hours budget."""
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
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


def _system() -> int:
    return client.post("/systems", json={"name": "S"}).json()["id"]


def test_task_carries_all_attributes_and_is_editable():
    sid = _system()
    due = (date.today() + timedelta(days=5)).isoformat()
    t = client.post(
        "/tasks",
        json={
            "system_id": sid,
            "title": "Build auth",
            "description": "JWT login",
            "priority": 1,
            "deadline": due,
            "dedicated_hours": 10,
            "data_exposure_concern": True,
            "last_checkpoint": "Development",
            "required_demo": True,
        },
    ).json()
    assert t["priority"] == 1
    assert t["dedicated_hours"] == 10
    assert t["data_exposure_concern"] is True
    assert t["last_checkpoint"] == "Development"
    assert t["required_demo"] is True
    assert t["time_left_days"] == 5
    assert t["remaining_hours"] == 10

    # Every attribute is editable.
    upd = client.patch(
        f"/tasks/{t['id']}",
        json={"priority": 3, "last_checkpoint": "Testing", "data_exposure_concern": False},
    ).json()
    assert upd["priority"] == 3
    assert upd["last_checkpoint"] == "Testing"
    assert upd["data_exposure_concern"] is False


def test_subtask_has_same_attributes():
    sid = _system()
    tid = client.post("/tasks", json={"system_id": sid, "title": "T"}).json()["id"]
    st = client.post(
        "/subtasks",
        json={
            "task_id": tid,
            "title": "Sub",
            "priority": 2,
            "dedicated_hours": 4,
            "required_demo": True,
            "last_checkpoint": "Staging",
        },
    ).json()
    assert st["priority"] == 2
    assert st["dedicated_hours"] == 4
    assert st["required_demo"] is True
    assert st["last_checkpoint"] == "Staging"


def test_time_logging_reduces_remaining_hours():
    sid = _system()
    tid = client.post(
        "/tasks", json={"system_id": sid, "title": "T", "dedicated_hours": 8}
    ).json()["id"]

    client.post("/time-logs", json={"task_id": tid, "hours": 3})
    client.post("/time-logs", json={"task_id": tid, "hours": 2.5})

    t = client.get(f"/tasks/{tid}").json()
    assert t["spent_hours"] == 5.5
    assert t["remaining_hours"] == 2.5

    logs = client.get(f"/time-logs?task_id={tid}").json()
    assert len(logs) == 2


def test_reports_include_charts_and_hours():
    sid = _system()
    tid = client.post(
        "/tasks", json={"system_id": sid, "title": "T", "dedicated_hours": 10}
    ).json()["id"]
    client.post("/time-logs", json={"task_id": tid, "hours": 4})

    report = client.get("/reports/on-demand").json()
    assert "charts" in report and len(report["charts"]) >= 1
    types = {c["type"] for c in report["charts"]}
    assert {"waterfall", "bar", "pie"} & types
