"""Tests for the AI intake interview (StubIntake — offline, no key/network)."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  register tables / avoid name shadowing
from app.agents.intake import QUESTIONS
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


def test_asks_one_question_at_a_time_then_proposes():
    history: list[dict] = []
    # Walk the full interview, answering each question.
    for _ in QUESTIONS:
        step = client.post("/intake/next", json={"history": history}).json()
        assert step["done"] is False
        assert step["question"]
        history.append({"question": step["question"], "answer": "an answer"})

    # After all questions, we get a proposal.
    final = client.post("/intake/next", json={"history": history}).json()
    assert final["done"] is True
    assert final["proposal"]["system"]["name"]
    assert len(final["proposal"]["tasks"]) > 0


def test_first_question_is_the_name():
    step = client.post("/intake/next", json={"history": []}).json()
    assert step["done"] is False
    assert "name" in step["question"].lower()


def test_commit_persists_system_tasks_and_subtasks():
    proposal = {
        "system": {
            "name": "Claude Master",
            "purpose": "Run AI consulting",
            "goals": "Ship MVPs",
        },
        "tasks": [
            {
                "title": "Define scope",
                "subtasks": [{"title": "List deliverables"}, {"title": "Note limits"}],
            },
            {"title": "Plan first deliverable", "subtasks": []},
        ],
    }
    r = client.post("/intake/commit", json=proposal)
    assert r.status_code == 201
    sid = r.json()["id"]
    assert r.json()["name"] == "Claude Master"

    tasks = client.get(f"/tasks?system_id={sid}").json()
    assert [t["title"] for t in tasks] == ["Define scope", "Plan first deliverable"]

    # Positions assigned in order; subtasks attached to the first task.
    first_task_id = tasks[0]["id"]
    subs = client.get(f"/subtasks?task_id={first_task_id}").json()
    assert {s["title"] for s in subs} == {"List deliverables", "Note limits"}
