"""End-of-day check-ins. Records what was completed and closes those tasks."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import CheckIn, Task, WorkStatus
from app.schemas import CheckInCreate, CheckInRead
from app.services import emit_event, finalize_sks_for_item

router = APIRouter(prefix="/check-ins", tags=["check-ins"])


@router.get("", response_model=list[CheckInRead])
def list_check_ins(db: Session = Depends(get_db)):
    stmt = select(CheckIn).order_by(CheckIn.day.desc(), CheckIn.id.desc())
    return db.execute(stmt).scalars().all()


@router.post("", response_model=CheckInRead, status_code=201)
def create_check_in(payload: CheckInCreate, db: Session = Depends(get_db)):
    # Mark the reported tasks as done (only ones that exist).
    completed: list[int] = []
    for task_id in payload.completed_task_ids:
        task = db.get(Task, task_id)
        if task is not None:
            was_done = task.status == WorkStatus.done
            task.status = WorkStatus.done
            if not was_done:
                finalize_sks_for_item(db, task)
            completed.append(task_id)

    check_in = CheckIn(
        day=payload.day or date.today(),
        notes=payload.notes,
        completed_task_ids=completed,
    )
    db.add(check_in)
    db.commit()
    db.refresh(check_in)
    emit_event(
        "check_in.created",
        {"check_in_id": check_in.id, "completed_task_ids": completed},
    )
    return check_in
