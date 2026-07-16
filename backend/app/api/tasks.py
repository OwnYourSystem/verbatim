"""Tasks, Subtasks, and time logging.

Every attribute is editable via PATCH. Reads include server-computed
spent/remaining hours and days-left-until-deadline.
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import SpecificKnowledge, Subtask, System, Task, TimeLog, WorkStatus
from app.schemas import (
    SubtaskCreate,
    SubtaskRead,
    SubtaskUpdate,
    TaskCreate,
    TaskRead,
    TaskUpdate,
    TimeLogCreate,
    TimeLogRead,
)
from app.services import (
    computed_fields,
    emit_event,
    finalize_sks_for_item,
    get_inherited_priority,
)

router = APIRouter(tags=["tasks"])


def _apply_sk_ids(db: Session, item: Task | Subtask, sk_ids: list[int]) -> None:
    """Replace the work item's Specific-Knowledge associations with `sk_ids`."""
    sks = (
        db.query(SpecificKnowledge)
        .filter(SpecificKnowledge.id.in_(sk_ids))
        .all()
        if sk_ids
        else []
    )
    item.specific_knowledges = sks


# ---- read builders (attach computed fields) ----
def _task_read(task: Task) -> TaskRead:
    extra = computed_fields(task)
    extra["system_name"] = task.system.name if task.system else None
    return TaskRead.model_validate(task).model_copy(update=extra)


def _subtask_read(db: Session, subtask: Subtask) -> SubtaskRead:
    data = SubtaskRead.model_validate(subtask).model_copy(update=computed_fields(subtask))
    data.inherited_priority = get_inherited_priority(db, subtask)
    return data


# ---- Tasks ----
@router.get("/tasks", response_model=list[TaskRead])
def list_tasks(system_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(Task)
    if system_id is not None:
        stmt = stmt.where(Task.system_id == system_id)
    stmt = stmt.order_by(Task.position, Task.id)
    return [_task_read(t) for t in db.execute(stmt).scalars().all()]


@router.post("/tasks", response_model=TaskRead, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    if not db.get(System, payload.system_id):
        raise HTTPException(404, "System not found")
    data = payload.model_dump()
    sk_ids = data.pop("sk_ids", [])
    task = Task(**data)
    _apply_sk_ids(db, task, sk_ids)
    db.add(task)
    db.commit()
    db.refresh(task)
    if task.status == WorkStatus.done:
        finalize_sks_for_item(db, task)
        db.commit()
        db.refresh(task)
    emit_event("task.created", {"task_id": task.id, "system_id": task.system_id})
    return _task_read(task)


@router.get("/tasks/{task_id}", response_model=TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return _task_read(task)


@router.patch("/tasks/{task_id}", response_model=TaskRead)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    data = payload.model_dump(exclude_unset=True)
    if "system_id" in data and not db.get(System, data["system_id"]):
        raise HTTPException(404, "Target system not found")
    was_done = task.status == WorkStatus.done
    sk_ids = data.pop("sk_ids", None)
    for key, value in data.items():
        setattr(task, key, value)
    if sk_ids is not None:
        _apply_sk_ids(db, task, sk_ids)
    # Completing the task finalizes its SK ratings (AI locks in uniqueness).
    if task.status == WorkStatus.done and not was_done:
        finalize_sks_for_item(db, task)
    db.commit()
    db.refresh(task)
    emit_event("task.updated", {"task_id": task.id, "system_id": task.system_id})
    return _task_read(task)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    system_id = task.system_id
    db.delete(task)
    db.commit()
    emit_event("task.deleted", {"task_id": task_id, "system_id": system_id})


# ---- Subtasks ----
@router.get("/subtasks", response_model=list[SubtaskRead])
def list_subtasks(task_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(Subtask)
    if task_id is not None:
        stmt = stmt.where(Subtask.task_id == task_id)
    stmt = stmt.order_by(Subtask.position, Subtask.id)
    subtasks = db.execute(stmt).scalars().all()
    return [_subtask_read(db, s) for s in subtasks]


@router.post("/subtasks", response_model=SubtaskRead, status_code=201)
def create_subtask(payload: SubtaskCreate, db: Session = Depends(get_db)):
    parent = db.get(Task, payload.task_id)
    if not parent:
        raise HTTPException(404, "Parent task not found")
    data = payload.model_dump()
    sk_ids = data.pop("sk_ids", [])
    subtask = Subtask(**data)
    _apply_sk_ids(db, subtask, sk_ids)
    db.add(subtask)
    db.commit()
    db.refresh(subtask)
    if subtask.status == WorkStatus.done:
        finalize_sks_for_item(db, subtask)
        db.commit()
        db.refresh(subtask)
    emit_event("subtask.created", {"subtask_id": subtask.id, "task_id": subtask.task_id})
    return _subtask_read(db, subtask)


@router.patch("/subtasks/{subtask_id}", response_model=SubtaskRead)
def update_subtask(subtask_id: int, payload: SubtaskUpdate, db: Session = Depends(get_db)):
    subtask = db.get(Subtask, subtask_id)
    if not subtask:
        raise HTTPException(404, "Subtask not found")
    data = payload.model_dump(exclude_unset=True)
    if "task_id" in data and not db.get(Task, data["task_id"]):
        raise HTTPException(404, "Target task not found")
    was_done = subtask.status == WorkStatus.done
    sk_ids = data.pop("sk_ids", None)
    for key, value in data.items():
        setattr(subtask, key, value)
    if sk_ids is not None:
        _apply_sk_ids(db, subtask, sk_ids)
    if subtask.status == WorkStatus.done and not was_done:
        finalize_sks_for_item(db, subtask)
    db.commit()
    db.refresh(subtask)
    emit_event("subtask.updated", {"subtask_id": subtask.id, "task_id": subtask.task_id})
    return _subtask_read(db, subtask)


@router.delete("/subtasks/{subtask_id}", status_code=204)
def delete_subtask(subtask_id: int, db: Session = Depends(get_db)):
    subtask = db.get(Subtask, subtask_id)
    if not subtask:
        raise HTTPException(404, "Subtask not found")
    task_id = subtask.task_id
    db.delete(subtask)
    db.commit()
    emit_event("subtask.deleted", {"subtask_id": subtask_id, "task_id": task_id})


# ---- Time logs (records hours spent; the Report layer reports the difference) ----
@router.get("/time-logs", response_model=list[TimeLogRead])
def list_time_logs(
    task_id: int | None = None,
    subtask_id: int | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(TimeLog)
    if task_id is not None:
        stmt = stmt.where(TimeLog.task_id == task_id)
    if subtask_id is not None:
        stmt = stmt.where(TimeLog.subtask_id == subtask_id)
    stmt = stmt.order_by(TimeLog.day.desc(), TimeLog.id.desc())
    return db.execute(stmt).scalars().all()


@router.post("/time-logs", response_model=TimeLogRead, status_code=201)
def create_time_log(payload: TimeLogCreate, db: Session = Depends(get_db)):
    if payload.task_id is None and payload.subtask_id is None:
        raise HTTPException(422, "A time log must target a task or a subtask")
    if payload.task_id is not None and not db.get(Task, payload.task_id):
        raise HTTPException(404, "Task not found")
    if payload.subtask_id is not None and not db.get(Subtask, payload.subtask_id):
        raise HTTPException(404, "Subtask not found")
    if payload.sk_id is not None and not db.get(SpecificKnowledge, payload.sk_id):
        raise HTTPException(404, "Specific Knowledge not found")
    log = TimeLog(
        task_id=payload.task_id,
        subtask_id=payload.subtask_id,
        sk_id=payload.sk_id,
        hours=payload.hours,
        day=payload.day or date.today(),
        note=payload.note,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    emit_event("time.logged", {"task_id": log.task_id, "subtask_id": log.subtask_id})
    return log


@router.delete("/time-logs/{log_id}", status_code=204)
def delete_time_log(log_id: int, db: Session = Depends(get_db)):
    log = db.get(TimeLog, log_id)
    if not log:
        raise HTTPException(404, "Time log not found")
    db.delete(log)
    db.commit()
