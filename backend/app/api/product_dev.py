"""Product Development — Scrum sprints and user stories on top of PainProjects."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import PainProject, ProductSprint, SprintStatus, StoryItem, StoryStatus
from app.schemas import (
    ProductProjectRead,
    SprintCreate,
    SprintRead,
    SprintUpdate,
    StoryCreate,
    StoryRead,
    StoryUpdate,
)

router = APIRouter(prefix="/product-dev", tags=["product-dev"])


def _sprint_read(sprint: ProductSprint) -> SprintRead:
    stories = sprint.stories
    return SprintRead(
        id=sprint.id,
        pain_project_id=sprint.pain_project_id,
        number=sprint.number,
        goal=sprint.goal,
        start_date=sprint.start_date.isoformat() if sprint.start_date else None,
        end_date=sprint.end_date.isoformat() if sprint.end_date else None,
        status=sprint.status,
        story_count=len(stories),
        done_count=sum(1 for s in stories if s.status == StoryStatus.done),
        created_at=sprint.created_at,
        updated_at=sprint.updated_at,
    )


def _project_read(proj: PainProject) -> ProductProjectRead:
    stories = proj.stories
    active = next((sp for sp in proj.sprints if sp.status == SprintStatus.active), None)
    return ProductProjectRead(
        id=proj.id,
        pain_id=proj.pain_id,
        name=proj.name,
        problem_statement=proj.problem_statement,
        target_audience=proj.target_audience,
        monetization_model=proj.monetization_model,
        phase=proj.phase,
        system_id=proj.system_id,
        story_count=len(stories),
        done_count=sum(1 for s in stories if s.status == StoryStatus.done),
        active_sprint=_sprint_read(active) if active else None,
        created_at=proj.created_at,
        updated_at=proj.updated_at,
    )


# ── Projects ──────────────────────────────────────────────────────────────────

@router.get("/projects", response_model=list[ProductProjectRead])
def list_projects(db: Session = Depends(get_db)):
    projs = db.query(PainProject).order_by(PainProject.created_at.desc()).all()
    return [_project_read(p) for p in projs]


@router.get("/projects/{project_id}", response_model=ProductProjectRead)
def get_project(project_id: int, db: Session = Depends(get_db)):
    proj = db.get(PainProject, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    return _project_read(proj)


# ── Stories ───────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/stories", response_model=list[StoryRead])
def list_stories(project_id: int, db: Session = Depends(get_db)):
    proj = db.get(PainProject, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    return [
        StoryRead.model_validate(s)
        for s in sorted(proj.stories, key=lambda s: (s.priority, s.id))
    ]


@router.post("/projects/{project_id}/stories", response_model=StoryRead, status_code=201)
def create_story(project_id: int, body: StoryCreate, db: Session = Depends(get_db)):
    proj = db.get(PainProject, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    story = StoryItem(pain_project_id=project_id, **body.model_dump())
    db.add(story)
    db.commit()
    db.refresh(story)
    return StoryRead.model_validate(story)


@router.patch("/stories/{story_id}", response_model=StoryRead)
def update_story(story_id: int, body: StoryUpdate, db: Session = Depends(get_db)):
    story = db.get(StoryItem, story_id)
    if not story:
        raise HTTPException(404, "Story not found")
    # Use exclude_unset so sprint_id=None is distinguishable from "not provided"
    data = body.model_dump(exclude_unset=True)
    # Assigning to a sprint → auto-promote from backlog to todo
    if data.get("sprint_id") is not None:
        if story.status == StoryStatus.backlog:
            story.status = StoryStatus.todo
    # Removing from sprint (explicitly null) → reset to backlog unless done
    elif "sprint_id" in data and data["sprint_id"] is None:
        if story.status != StoryStatus.done:
            story.status = StoryStatus.backlog
    for field, val in data.items():
        setattr(story, field, val)
    db.commit()
    db.refresh(story)
    return StoryRead.model_validate(story)


@router.delete("/stories/{story_id}", status_code=204)
def delete_story(story_id: int, db: Session = Depends(get_db)):
    story = db.get(StoryItem, story_id)
    if not story:
        raise HTTPException(404, "Story not found")
    db.delete(story)
    db.commit()


# ── Sprints ───────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/sprints", response_model=list[SprintRead])
def list_sprints(project_id: int, db: Session = Depends(get_db)):
    proj = db.get(PainProject, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    return [_sprint_read(sp) for sp in proj.sprints]


@router.post("/projects/{project_id}/sprints", response_model=SprintRead, status_code=201)
def create_sprint(project_id: int, body: SprintCreate, db: Session = Depends(get_db)):
    proj = db.get(PainProject, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    next_num = (max((sp.number for sp in proj.sprints), default=0) + 1)
    sprint = ProductSprint(
        pain_project_id=project_id,
        number=next_num,
        goal=body.goal,
    )
    db.add(sprint)
    db.commit()
    db.refresh(sprint)
    return _sprint_read(sprint)


@router.patch("/sprints/{sprint_id}", response_model=SprintRead)
def update_sprint(sprint_id: int, body: SprintUpdate, db: Session = Depends(get_db)):
    sprint = db.get(ProductSprint, sprint_id)
    if not sprint:
        raise HTTPException(404, "Sprint not found")
    data = body.model_dump(exclude_none=True)
    # Enforce one active sprint per project
    if data.get("status") == SprintStatus.active:
        for other in sprint.project.sprints:
            if other.id != sprint_id and other.status == SprintStatus.active:
                other.status = SprintStatus.review
    for field, val in data.items():
        setattr(sprint, field, val)
    db.commit()
    db.refresh(sprint)
    return _sprint_read(sprint)
