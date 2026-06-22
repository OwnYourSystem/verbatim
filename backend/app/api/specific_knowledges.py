"""Specific Knowledge — CRUD + AI suggestion endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.llm import suggest_sk
from app.db import get_db
from app.models import SpecificKnowledge, Subtask, Task, WorkStatus
from app.schemas import SKCreate, SKRead, SKSuggestRequest, SKSuggestResponse, SKUpdate

router = APIRouter(prefix="/specific-knowledges", tags=["specific-knowledge"])


def _get_universe_and_counts(db: Session) -> tuple[set[int], dict[int, int], dict[int, int]]:
    """Return (universe_ids, completed_counts, task_counts) for all SKs."""
    universe: set[int] = set()
    completed: dict[int, int] = {}
    total: dict[int, int] = {}

    for task in db.query(Task).all():
        for sk_id in task.sk_ids or []:
            total[sk_id] = total.get(sk_id, 0) + 1
            if task.status == WorkStatus.done:
                completed[sk_id] = completed.get(sk_id, 0) + 1
                universe.add(sk_id)

    for subtask in db.query(Subtask).all():
        for sk_id in subtask.sk_ids or []:
            total[sk_id] = total.get(sk_id, 0) + 1
            if subtask.status == WorkStatus.done:
                completed[sk_id] = completed.get(sk_id, 0) + 1
                universe.add(sk_id)

    return universe, completed, total


def _enrich(
    sk: SpecificKnowledge,
    universe: set[int],
    completed: dict[int, int],
    total: dict[int, int],
) -> SKRead:
    r = SKRead.model_validate(sk)
    r.in_universe = sk.id in universe
    r.completed_count = completed.get(sk.id, 0)
    r.task_count = total.get(sk.id, 0)
    return r


@router.get("", response_model=list[SKRead])
def list_sks(db: Session = Depends(get_db)):
    universe, completed, total = _get_universe_and_counts(db)
    sks = db.query(SpecificKnowledge).order_by(SpecificKnowledge.temperature.desc()).all()
    return [_enrich(sk, universe, completed, total) for sk in sks]


@router.post("", response_model=SKRead, status_code=201)
def create_sk(body: SKCreate, db: Session = Depends(get_db)):
    existing = db.query(SpecificKnowledge).filter(SpecificKnowledge.name == body.name).first()
    if existing:
        universe, completed, total = _get_universe_and_counts(db)
        return _enrich(existing, universe, completed, total)
    sk = SpecificKnowledge(**body.model_dump())
    db.add(sk)
    db.commit()
    db.refresh(sk)
    universe, completed, total = _get_universe_and_counts(db)
    return _enrich(sk, universe, completed, total)


@router.put("/{sk_id}", response_model=SKRead)
def update_sk(sk_id: int, body: SKUpdate, db: Session = Depends(get_db)):
    sk = db.get(SpecificKnowledge, sk_id)
    if not sk:
        raise HTTPException(404, "SK not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(sk, field, val)
    db.commit()
    db.refresh(sk)
    universe, completed, total = _get_universe_and_counts(db)
    return _enrich(sk, universe, completed, total)


@router.delete("/{sk_id}", status_code=204)
def delete_sk(sk_id: int, db: Session = Depends(get_db)):
    sk = db.get(SpecificKnowledge, sk_id)
    if not sk:
        raise HTTPException(404, "SK not found")
    db.delete(sk)
    db.commit()


@router.post("/suggest", response_model=SKSuggestResponse)
def suggest(body: SKSuggestRequest):
    result = suggest_sk(body.title, body.description or "")
    return SKSuggestResponse(**result)
