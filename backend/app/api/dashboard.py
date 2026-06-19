"""Dashboard — the 'today' view (rule-based daily focus)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Task
from app.schemas import SubtaskRead, SystemRead, TaskRead, TodayView
from app.services import build_today, computed_fields, get_current_priority

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/today", response_model=TodayView)
def today(db: Session = Depends(get_db)):
    data = build_today(db)

    focus_system = None
    if data["focus_system"] is not None:
        focus_system = SystemRead.model_validate(data["focus_system"])
        focus_system.current_priority = get_current_priority(db, data["focus_system"].id)

    def _task_read(t: Task) -> TaskRead:
        extra = computed_fields(t)
        extra["system_name"] = t.system.name if t.system else None
        return TaskRead.model_validate(t).model_copy(update=extra)

    def _subtask_read(st) -> SubtaskRead:
        r = SubtaskRead.model_validate(st)
        for k, v in computed_fields(st).items():
            setattr(r, k, v)
        return r

    return TodayView(
        day=data["day"],
        focus_system=focus_system,
        focus_tasks=[_task_read(t) for t in data["focus_tasks"]],
        focus_subtasks=[_subtask_read(st) for st in data["focus_subtasks"]],
        upcoming_deadlines=[_task_read(t) for t in data["upcoming_deadlines"]],
        flagged=[_task_read(t) for t in data["flagged"]],
    )
