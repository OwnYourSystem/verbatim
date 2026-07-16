"""Tests for the Focus Timer feature: finding a Specific Knowledge's open
tasks, logging time against a knowledge, and the Today page's Achievements
aggregation."""
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


def _make_system() -> int:
    return client.post("/systems", json={"name": "S"}).json()["id"]


def _make_sk(name: str) -> int:
    return client.post("/specific-knowledges", json={"name": name}).json()["id"]


# ── Focus-tasks endpoint ─────────────────────────────────────────────────────


def test_focus_tasks_lists_only_open_work_tied_to_the_sk():
    sid = _make_system()
    sk = _make_sk("Terraform modules")

    open_task = client.post(
        "/tasks", json={"system_id": sid, "title": "open task", "sk_ids": [sk]}
    ).json()
    done_task = client.post(
        "/tasks",
        json={"system_id": sid, "title": "done task", "sk_ids": [sk], "status": "done"},
    ).json()
    unrelated_task = client.post("/tasks", json={"system_id": sid, "title": "unrelated"}).json()

    parent = client.post("/tasks", json={"system_id": sid, "title": "parent"}).json()
    open_subtask = client.post(
        "/subtasks", json={"task_id": parent["id"], "title": "open subtask", "sk_ids": [sk]}
    ).json()

    items = client.get(f"/specific-knowledges/{sk}/focus-tasks").json()
    ids_by_kind = {(i["kind"], i["id"]) for i in items}

    assert ("task", open_task["id"]) in ids_by_kind
    assert ("subtask", open_subtask["id"]) in ids_by_kind
    assert ("task", done_task["id"]) not in ids_by_kind  # done work excluded
    assert ("task", unrelated_task["id"]) not in ids_by_kind  # not linked to this SK

    subtask_item = next(i for i in items if i["kind"] == "subtask")
    assert subtask_item["parent_task_title"] == "parent"


def test_focus_tasks_404_for_missing_sk():
    r = client.get("/specific-knowledges/999/focus-tasks")
    assert r.status_code == 404


# ── Logging time against a Specific Knowledge ───────────────────────────────


def test_time_log_accepts_sk_id():
    sid = _make_system()
    sk = _make_sk("Kubernetes operators")
    task = client.post("/tasks", json={"system_id": sid, "title": "t", "sk_ids": [sk]}).json()

    r = client.post(
        "/time-logs",
        json={"task_id": task["id"], "sk_id": sk, "hours": 0.75, "note": "focus session"},
    )
    assert r.status_code == 201
    assert r.json()["sk_id"] == sk


def test_time_log_rejects_unknown_sk_id():
    sid = _make_system()
    task = client.post("/tasks", json={"system_id": sid, "title": "t"}).json()

    r = client.post("/time-logs", json={"task_id": task["id"], "sk_id": 999, "hours": 0.5})
    assert r.status_code == 404


# ── Achievements on the Today page ──────────────────────────────────────────


def test_achievements_aggregate_todays_sk_time_only():
    sid = _make_system()
    sk_a = _make_sk("Rust async runtimes")
    sk_b = _make_sk("Postgres query planning")
    task = client.post("/tasks", json={"system_id": sid, "title": "t"}).json()
    task_id = task["id"]

    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    def log(sk_id: int | None, hours: float, day: str) -> None:
        body = {"task_id": task_id, "hours": hours, "day": day}
        if sk_id is not None:
            body["sk_id"] = sk_id
        client.post("/time-logs", json=body)

    # Two sessions today on SK A — should sum to 1.0h.
    log(sk_a, 0.25, today)
    log(sk_a, 0.75, today)
    # One session today on SK B.
    log(sk_b, 0.5, today)
    # A session on SK A but yesterday — must not count toward today's total.
    log(sk_a, 5.0, yesterday)
    # A manual time log with no sk_id — must not appear as an achievement.
    log(None, 2.0, today)

    achievements = {a["sk_id"]: a for a in client.get("/dashboard/today").json()["achievements"]}

    assert achievements[sk_a]["hours"] == 1.0
    assert achievements[sk_a]["sk_name"] == "Rust async runtimes"
    assert achievements[sk_b]["hours"] == 0.5
    assert len(achievements) == 2


def test_no_achievements_key_stays_empty_list_when_nothing_logged():
    assert client.get("/dashboard/today").json()["achievements"] == []
