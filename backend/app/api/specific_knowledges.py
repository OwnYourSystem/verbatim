"""Specific Knowledge — CRUD + AI suggestion endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.llm import suggest_sk
from app.db import get_db
from app.models import SKRating, SpecificKnowledge, Subtask, Task, WorkStatus
from app.schemas import (
    SKCreate,
    SKFocusTask,
    SKRead,
    SKSuggestRequest,
    SKSuggestResponse,
    SKUpdate,
)

router = APIRouter(prefix="/specific-knowledges", tags=["specific-knowledge"])


def _get_universe_and_counts(db: Session) -> tuple[set[int], dict[int, int], dict[int, int]]:
    """Return (universe_ids, completed_counts, task_counts) for all SKs.

    An SK enters the Universe (and counts a completion) when any Task or Subtask
    it is associated with is marked done.
    """
    universe: set[int] = set()
    completed: dict[int, int] = {}
    total: dict[int, int] = {}

    for item in (*db.query(Task).all(), *db.query(Subtask).all()):
        for sk in item.specific_knowledges:
            total[sk.id] = total.get(sk.id, 0) + 1
            if item.status == WorkStatus.done:
                completed[sk.id] = completed.get(sk.id, 0) + 1
                universe.add(sk.id)

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


# Sort order for the rating: hottest (rarest) first.
_RATING_RANK = {SKRating.hot: 0, SKRating.warm: 1, SKRating.cold: 2}


@router.get("", response_model=list[SKRead])
def list_sks(db: Session = Depends(get_db)):
    universe, completed, total = _get_universe_and_counts(db)
    sks = db.query(SpecificKnowledge).all()
    sks.sort(key=lambda sk: (_RATING_RANK.get(sk.rating, 1), sk.name.lower()))
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
    data = body.model_dump(exclude_none=True)
    # A manual rating change is an override → lock it so completion won't redo it,
    # unless the caller explicitly says otherwise.
    if "rating" in data and "rating_finalized" not in data:
        data["rating_finalized"] = True
    for field, val in data.items():
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


_OPEN_STATUSES = (WorkStatus.todo, WorkStatus.in_progress)


@router.get("/{sk_id}/focus-tasks", response_model=list[SKFocusTask])
def focus_tasks(sk_id: int, db: Session = Depends(get_db)):
    """Open tasks/subtasks tied to this Specific Knowledge — the Focus
    Timer's task picker: pick the knowledge, then pick which of its open
    work items to spend the timer on."""
    sk = db.get(SpecificKnowledge, sk_id)
    if not sk:
        raise HTTPException(404, "SK not found")

    items: list[SKFocusTask] = []
    for t in sk.tasks:
        if t.status not in _OPEN_STATUSES:
            continue
        items.append(
            SKFocusTask(
                kind="task",
                id=t.id,
                title=t.title,
                system_name=t.system.name if t.system else None,
                status=t.status,
                priority=t.priority,
            )
        )
    for st in sk.subtasks:
        if st.status not in _OPEN_STATUSES:
            continue
        items.append(
            SKFocusTask(
                kind="subtask",
                id=st.id,
                title=st.title,
                system_name=st.task.system.name if st.task and st.task.system else None,
                parent_task_title=st.task.title if st.task else None,
                status=st.status,
                priority=st.priority,
            )
        )
    items.sort(key=lambda i: i.priority)
    return items
