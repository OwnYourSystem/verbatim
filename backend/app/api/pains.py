"""Wall of Pains — pain discovery, project definition, system creation."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.llm import assist_project, discover_pains
from app.db import get_db
from app.models import Pain, PainProject, System
from app.schemas import (
    AIProjectAssist,
    PainCreate,
    PainDiscoveryItem,
    PainProjectCreate,
    PainProjectUpdate,
    PainRead,
)

router = APIRouter(prefix="/pains", tags=["pains"])


def _enrich(pain: Pain, db: Session) -> PainRead:
    r = PainRead.model_validate(pain)
    if pain.project and pain.project.system_id:
        sys = db.get(System, pain.project.system_id)
        if sys and r.project:
            r.project.system_name = sys.name
    return r


@router.get("", response_model=list[PainRead])
def list_pains(area: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Pain)
    if area and area != "all":
        q = q.filter(Pain.area == area)
    return [_enrich(p, db) for p in q.order_by(Pain.created_at.desc()).all()]


@router.post("", response_model=PainRead, status_code=201)
def create_pain(body: PainCreate, db: Session = Depends(get_db)):
    pain = Pain(**body.model_dump())
    db.add(pain)
    db.commit()
    db.refresh(pain)
    return _enrich(pain, db)


@router.delete("/{pain_id}", status_code=204)
def delete_pain(pain_id: int, db: Session = Depends(get_db)):
    pain = db.get(Pain, pain_id)
    if not pain:
        raise HTTPException(404, "Pain not found")
    db.delete(pain)
    db.commit()


@router.post("/discover", response_model=list[PainDiscoveryItem])
def discover(area: str = "all"):
    return discover_pains(area)


@router.post("/{pain_id}/project", response_model=PainRead, status_code=201)
def create_project(pain_id: int, body: PainProjectCreate, db: Session = Depends(get_db)):
    pain = db.get(Pain, pain_id)
    if not pain:
        raise HTTPException(404, "Pain not found")
    if pain.project:
        raise HTTPException(409, "Project already exists — use PATCH to update")
    proj = PainProject(pain_id=pain_id, **body.model_dump())
    db.add(proj)
    db.commit()
    db.refresh(pain)
    return _enrich(pain, db)


@router.patch("/{pain_id}/project", response_model=PainRead)
def update_project(pain_id: int, body: PainProjectUpdate, db: Session = Depends(get_db)):
    pain = db.get(Pain, pain_id)
    if not pain or not pain.project:
        raise HTTPException(404, "Pain or project not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(pain.project, field, val)
    db.commit()
    db.refresh(pain)
    return _enrich(pain, db)


@router.post("/{pain_id}/assist-project", response_model=AIProjectAssist)
def ai_assist(pain_id: int, db: Session = Depends(get_db)):
    pain = db.get(Pain, pain_id)
    if not pain:
        raise HTTPException(404, "Pain not found")
    return assist_project(pain.title, pain.description or "")


@router.post("/{pain_id}/create-system", response_model=PainRead)
def create_system_from_project(pain_id: int, db: Session = Depends(get_db)):
    pain = db.get(Pain, pain_id)
    if not pain or not pain.project:
        raise HTTPException(400, "Pain has no project defined yet")
    proj = pain.project
    sys = System(
        name=proj.name,
        description=proj.problem_statement,
        purpose=proj.problem_statement,
        goals=(
            f"Monetize via {proj.monetization_model or 'product'}. "
            f"Target: {proj.target_audience or 'TBD'}."
        ),
    )
    db.add(sys)
    db.flush()
    proj.system_id = sys.id
    db.commit()
    db.refresh(pain)
    return _enrich(pain, db)
