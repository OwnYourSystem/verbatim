"""Dashboard — the 'today' view (rule-based daily focus)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import SystemRead, TaskRead, TodayView
from app.services import build_today, get_current_priority

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/today", response_model=TodayView)
def today(db: Session = Depends(get_db)):
    data = build_today(db)

    focus_system = None
    if data["focus_system"] is not None:
        focus_system = SystemRead.model_validate(data["focus_system"])
        focus_system.current_priority = get_current_priority(db, data["focus_system"].id)

    return TodayView(
        day=data["day"],
        focus_system=focus_system,
        focus_tasks=[TaskRead.model_validate(t) for t in data["focus_tasks"]],
        upcoming_deadlines=[TaskRead.model_validate(t) for t in data["upcoming_deadlines"]],
        flagged=[TaskRead.model_validate(t) for t in data["flagged"]],
    )
