"""Tests for the Product Development (Scrum) feature — migration 0010."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.db import Base, get_db
from app.main import app as fastapi_app

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


@pytest.fixture()
def client():
    return TestClient(fastapi_app)


@pytest.fixture()
def pain_project(client):
    """Create a Pain + PainProject and return the project id."""
    pain = client.post("/pains", json={"title": "Test pain", "area": "ai"}).json()
    proj = client.post(
        f"/pains/{pain['id']}/project",
        json={"name": "My Product", "problem_statement": "Solve the test problem"},
    ).json()
    return proj["project"]["id"]


class TestStories:
    def test_create_and_list_story(self, client, pain_project):
        r = client.post(
            f"/product-dev/projects/{pain_project}/stories",
            json={"title": "As a user I want X", "story_type": "story", "points": 3},
        )
        assert r.status_code == 201
        s = r.json()
        assert s["title"] == "As a user I want X"
        assert s["status"] == "backlog"
        assert s["points"] == 3

        stories = client.get(f"/product-dev/projects/{pain_project}/stories").json()
        assert len(stories) == 1

    def test_update_story_status(self, client, pain_project):
        s = client.post(
            f"/product-dev/projects/{pain_project}/stories",
            json={"title": "Fix bug #1", "story_type": "bug"},
        ).json()
        r = client.patch(f"/product-dev/stories/{s['id']}", json={"status": "done"})
        assert r.status_code == 200
        assert r.json()["status"] == "done"

    def test_delete_story(self, client, pain_project):
        s = client.post(
            f"/product-dev/projects/{pain_project}/stories",
            json={"title": "Temp story"},
        ).json()
        client.delete(f"/product-dev/stories/{s['id']}")
        assert client.get(f"/product-dev/projects/{pain_project}/stories").json() == []


class TestSprints:
    def test_create_sprint(self, client, pain_project):
        r = client.post(
            f"/product-dev/projects/{pain_project}/sprints",
            json={"goal": "Ship MVP"},
        )
        assert r.status_code == 201
        sp = r.json()
        assert sp["number"] == 1
        assert sp["status"] == "planning"

    def test_sprint_numbers_auto_increment(self, client, pain_project):
        client.post(f"/product-dev/projects/{pain_project}/sprints", json={})
        client.post(f"/product-dev/projects/{pain_project}/sprints", json={})
        sprints = client.get(f"/product-dev/projects/{pain_project}/sprints").json()
        assert [s["number"] for s in sprints] == [1, 2]

    def test_activate_sprint_closes_previous(self, client, pain_project):
        sp1 = client.post(f"/product-dev/projects/{pain_project}/sprints", json={}).json()
        sp2 = client.post(f"/product-dev/projects/{pain_project}/sprints", json={}).json()
        client.patch(f"/product-dev/sprints/{sp1['id']}", json={"status": "active"})
        # Activating sp2 should auto-move sp1 to review
        client.patch(f"/product-dev/sprints/{sp2['id']}", json={"status": "active"})
        sprints = client.get(f"/product-dev/projects/{pain_project}/sprints").json()
        by_id = {s["id"]: s for s in sprints}
        assert by_id[sp1["id"]]["status"] == "review"
        assert by_id[sp2["id"]]["status"] == "active"


class TestStorySprintFlow:
    def test_assign_story_to_sprint_sets_todo(self, client, pain_project):
        s = client.post(
            f"/product-dev/projects/{pain_project}/stories",
            json={"title": "Story A"},
        ).json()
        sp = client.post(
            f"/product-dev/projects/{pain_project}/sprints",
            json={"goal": "Sprint 1"},
        ).json()
        r = client.patch(
            f"/product-dev/stories/{s['id']}",
            json={"sprint_id": sp["id"]},
        )
        assert r.json()["status"] == "todo"

    def test_remove_from_sprint_resets_to_backlog(self, client, pain_project):
        s = client.post(
            f"/product-dev/projects/{pain_project}/stories",
            json={"title": "Story B"},
        ).json()
        sp = client.post(f"/product-dev/projects/{pain_project}/sprints", json={}).json()
        client.patch(f"/product-dev/stories/{s['id']}", json={"sprint_id": sp["id"]})
        r = client.patch(f"/product-dev/stories/{s['id']}", json={"sprint_id": None})
        assert r.json()["status"] == "backlog"
        assert r.json()["sprint_id"] is None

    def test_project_list_shows_counts(self, client, pain_project):
        client.post(f"/product-dev/projects/{pain_project}/stories", json={"title": "A"})
        s = client.post(f"/product-dev/projects/{pain_project}/stories", json={"title": "B"}).json()
        client.patch(f"/product-dev/stories/{s['id']}", json={"status": "done"})
        projs = client.get("/product-dev/projects").json()
        p = next(x for x in projs if x["id"] == pain_project)
        assert p["story_count"] == 2
        assert p["done_count"] == 1
