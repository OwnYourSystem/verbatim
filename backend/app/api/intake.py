"""AI intake interview — define a new System one question at a time, then commit."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.intake import get_intake
from app.db import get_db
from app.models import Subtask, System, Task
from app.schemas import IntakeCommit, IntakeStep, IntakeStepRequest, SystemRead

router = APIRouter(prefix="/intake", tags=["intake"])


@router.post("/next", response_model=IntakeStep)
def intake_next(payload: IntakeStepRequest):
    """Given the answers so far, return the next question or a final proposal."""
    history = [a.model_dump() for a in payload.history]
    result = get_intake().next_step(history)
    return IntakeStep.model_validate(result)


@router.post("/commit", response_model=SystemRead, status_code=201)
def intake_commit(payload: IntakeCommit, db: Session = Depends(get_db)):
    """Persist the user-approved proposal as a System with its Tasks/Subtasks."""
    system = System(**payload.system.model_dump())
    db.add(system)
    db.flush()  # assign system.id

    for position, t in enumerate(payload.tasks):
        task = Task(
            system_id=system.id,
            title=t.title,
            deadline=t.deadline,
            position=position,
        )
        db.add(task)
        db.flush()
        for sub_pos, st in enumerate(t.subtasks):
            db.add(Subtask(task_id=task.id, title=st.title, position=sub_pos))

    db.commit()
    db.refresh(system)
    return SystemRead.model_validate(system)
