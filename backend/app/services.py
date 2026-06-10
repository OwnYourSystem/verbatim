"""Domain services: priority computation and the change-event hook.

The change-event hook is where Part B (the AI brain) plugs in. For now it just
logs; later it will debounce events and route them to the orchestrator agent so
the responsible specialist can propose a rebalance.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Priority, Subtask, System, SystemStatus, Task, WorkStatus

logger = logging.getLogger("mindanchor.events")


def current_year_month(today: date | None = None) -> tuple[int, int]:
    today = today or date.today()
    return today.year, today.month


def get_current_priority(db: Session, system_id: int) -> int | None:
    """Return the System's priority score for the current month, if set."""
    year, month = current_year_month()
    stmt = select(Priority.score).where(
        Priority.system_id == system_id,
        Priority.year == year,
        Priority.month == month,
    )
    return db.execute(stmt).scalar_one_or_none()


def get_inherited_priority(db: Session, subtask: Subtask) -> int | None:
    """A subtask inherits its parent System's current monthly priority."""
    system_id = subtask.task.system_id if subtask.task else None
    if system_id is None:
        return None
    return get_current_priority(db, system_id)


def emit_event(event_type: str, payload: dict) -> None:
    """Domain change-event hook. Part B subscribes here for rebalancing.

    Kept intentionally side-effect-free (log only) until the agent layer lands,
    so the skeleton stays fully usable without any AI configured.
    """
    logger.info("event=%s payload=%s", event_type, payload)


# ---------------------------------------------------------------------------
# Rule-based daily focus (Phase 3). Deterministic — no AI. The AI brain in
# Part B will later refine this; the rules here keep the app usable today.
# ---------------------------------------------------------------------------

UPCOMING_WINDOW_DAYS = 7
OPEN_STATUSES = (WorkStatus.todo, WorkStatus.in_progress, WorkStatus.blocked)


def _task_sort_key(task: Task) -> tuple[int, date]:
    """Earlier deadline first; tasks without a deadline sort last."""
    return (0, task.deadline) if task.deadline else (1, date.max)


def _open_tasks(db: Session) -> list[Task]:
    stmt = select(Task).where(Task.status != WorkStatus.done)
    return list(db.execute(stmt).scalars().all())


def choose_focus_system(db: Session, today: date | None = None) -> System | None:
    """Pick the primary System for today: the active System with open work and
    the highest current-month priority. Ties broken by the nearest deadline."""
    today = today or date.today()
    open_by_system: dict[int, list[Task]] = {}
    for task in _open_tasks(db):
        open_by_system.setdefault(task.system_id, []).append(task)

    best: tuple[int, date, System] | None = None  # (-priority, nearest_deadline, system)
    for system_id, tasks in open_by_system.items():
        system = db.get(System, system_id)
        if system is None or system.status != SystemStatus.active:
            continue
        priority = get_current_priority(db, system_id) or 0
        nearest = min((t.deadline for t in tasks if t.deadline), default=date.max)
        candidate = (-priority, nearest, system)
        if best is None or candidate[:2] < best[:2]:
            best = candidate
    return best[2] if best else None


def build_today(db: Session, today: date | None = None) -> dict:
    """Aggregate the dashboard 'today' view."""
    today = today or date.today()
    horizon = today + timedelta(days=UPCOMING_WINDOW_DAYS)

    focus_system = choose_focus_system(db, today)
    focus_tasks: list[Task] = []
    if focus_system is not None:
        focus_tasks = sorted(
            (t for t in focus_system.tasks if t.status != WorkStatus.done),
            key=_task_sort_key,
        )

    open_tasks = _open_tasks(db)
    upcoming = sorted(
        (t for t in open_tasks if t.deadline and today <= t.deadline <= horizon),
        key=_task_sort_key,
    )
    flagged = sorted(
        (
            t
            for t in open_tasks
            if (t.deadline and t.deadline < today) or t.status == WorkStatus.blocked
        ),
        key=_task_sort_key,
    )

    return {
        "day": today,
        "focus_system": focus_system,
        "focus_tasks": focus_tasks,
        "upcoming_deadlines": upcoming,
        "flagged": flagged,
    }
