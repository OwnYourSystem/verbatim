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
from app.models import Subtask, System, Task, TimeLog
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
from app.services import computed_fields, emit_event, get_inherited_priority

router = APIRouter(tags=["tasks"])


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
    task = Task(**payload.model_dump())
    db.add(task)
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
    for key, value in data.items():
        setattr(task, key, value)
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
    subtask = Subtask(**payload.model_dump())
    db.add(subtask)
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
    for key, value in data.items():
        setattr(subtask, key, value)
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
    log = TimeLog(
        task_id=payload.task_id,
        subtask_id=payload.subtask_id,
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
