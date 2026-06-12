"""AI intake interview — define a new System one question at a time, then commit."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.intake import get_intake
from app.db import get_db
from app.models import FocusBlock, Subtask, System, Task
from app.schemas import IntakeCommit, IntakeStep, IntakeStepRequest, SystemRead

router = APIRouter(prefix="/intake", tags=["intake"])

# Attributes shared by proposed tasks/subtasks that map straight onto the model.
_WI_ATTRS = (
    "description",
    "status",
    "priority",
    "deadline",
    "dedicated_hours",
    "data_exposure_concern",
    "last_checkpoint",
    "required_demo",
)


@router.post("/next", response_model=IntakeStep)
def intake_next(payload: IntakeStepRequest):
    """Given the answers so far, return the next question or a final proposal."""
    history = [a.model_dump() for a in payload.history]
    result = get_intake().next_step(history)
    return IntakeStep.model_validate(result)


@router.post("/commit", response_model=SystemRead, status_code=201)
def intake_commit(payload: IntakeCommit, db: Session = Depends(get_db)):
    """Persist the approved proposal as a System with fully-attributed Tasks and
    Subtasks, and seed the calendar with a focus block for each dated task."""
    system = System(**payload.system.model_dump())
    db.add(system)
    db.flush()  # assign system.id

    for position, t in enumerate(payload.tasks):
        task = Task(
            system_id=system.id,
            title=t.title,
            position=position,
            **{f: getattr(t, f) for f in _WI_ATTRS},
        )
        db.add(task)
        db.flush()
        # Calendar gets every dated task (CR-1 §9).
        if task.deadline is not None:
            db.add(
                FocusBlock(
                    day=task.deadline,
                    system_id=system.id,
                    task_id=task.id,
                    note=f"Deadline: {task.title}",
                )
            )
        for sub_pos, st in enumerate(t.subtasks):
            db.add(
                Subtask(
                    task_id=task.id,
                    position=sub_pos,
                    **{f: getattr(st, f) for f in _WI_ATTRS},
                    title=st.title,
                )
            )

    db.commit()
    db.refresh(system)
    return SystemRead.model_validate(system)
