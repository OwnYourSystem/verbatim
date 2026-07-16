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

from app.models import (
    Priority,
    SKRating,
    Subtask,
    System,
    SystemStatus,
    Task,
    WorkStatus,
)

logger = logging.getLogger("mindanchor.events")


# ---------------------------------------------------------------------------
# Specific-Knowledge rating finalization (decision: AI suggests at setup,
# finalizes on Complete, user can override).
# ---------------------------------------------------------------------------
def finalize_sks_for_item(db: Session, item: Task | Subtask) -> None:
    """When a Task/Subtask is completed, lock in the AI's uniqueness judgement
    for each attached Specific Knowledge that the user hasn't already finalized.

    Re-runs the AI rater (HOT/WARM/COLD) on the work item's title + description.
    Best-effort and offline-safe: the stub rater is used when no API key is set,
    so this never blocks completion. A user override (`rating_finalized=True`)
    is respected and left untouched.
    """
    # Imported here to avoid a circular import (agents.llm imports config only).
    from app.agents.llm import suggest_sk

    for sk in item.specific_knowledges:
        if sk.rating_finalized:
            continue
        try:
            result = suggest_sk(item.title, item.description or "")
            sk.rating = SKRating(result["rating"])
            sk.ai_justification = result.get("justification") or sk.ai_justification
        except Exception:
            logger.warning("SK finalize failed for sk=%s; keeping prior rating", sk.id)
        sk.rating_finalized = True


def current_year_month(today: date | None = None) -> tuple[int, int]:
    today = today or date.today()
    return today.year, today.month


# ---------------------------------------------------------------------------
# Hours budgeting & schedule pressure (CR-1 §4). `dedicated_hours` is the plan;
# spent hours are summed from TimeLog rows; the difference is what's left.
# ---------------------------------------------------------------------------
def spent_hours_for(item: Task | Subtask) -> float:
    return round(sum(log.hours for log in item.time_logs), 2)


def time_left_days(deadline: date | None, today: date | None = None) -> int | None:
    if deadline is None:
        return None
    today = today or date.today()
    return (deadline - today).days


def computed_fields(item: Task | Subtask, today: date | None = None) -> dict:
    """The server-computed read-only fields shared by Task and Subtask reads."""
    spent = spent_hours_for(item)
    return {
        "spent_hours": spent,
        "remaining_hours": round((item.dedicated_hours or 0.0) - spent, 2),
        "time_left_days": time_left_days(item.deadline, today),
    }


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
FOCUS_STATUSES = (WorkStatus.todo, WorkStatus.in_progress)
OPEN_STATUSES = (WorkStatus.todo, WorkStatus.in_progress, WorkStatus.blocked)
FOCUS_PRIORITY = 1  # P1 = highest


def _task_sort_key(task: Task) -> tuple[int, int, date]:
    """Manual drag-order first (all tasks default to position=0, so this is a
    no-op until the user reorders), then earlier deadline; tasks without a
    deadline sort last."""
    return (task.position, 0, task.deadline) if task.deadline else (task.position, 1, date.max)


def _priority_sort_key(task: Task) -> tuple[int, int, date]:
    """P1 (highest) first, then earlier deadline; no-deadline sorts last."""
    has_deadline = 0 if task.deadline else 1
    return (task.priority, has_deadline, task.deadline or date.max)


def _open_tasks(db: Session) -> list[Task]:
    stmt = select(Task).where(Task.status != WorkStatus.done)
    return list(db.execute(stmt).scalars().all())


def choose_focus_tasks(db: Session) -> list[Task]:
    """Return all P1 tasks in Todo or In-Progress across all active systems.

    Sorted by nearest deadline first (no deadline sorts last).
    Falls back to the lowest priority number available if no P1 tasks exist.
    """
    stmt = (
        select(Task)
        .join(Task.system)
        .where(
            Task.status.in_([WorkStatus.todo, WorkStatus.in_progress]),
            System.status == SystemStatus.active,
        )
    )
    candidates = list(db.execute(stmt).scalars().all())
    if not candidates:
        return []

    # Find the highest priority level actually present (lowest number = highest priority)
    best_priority = min(t.priority for t in candidates)
    focus = [t for t in candidates if t.priority == best_priority]
    return sorted(focus, key=_task_sort_key)


def choose_focus_system(db: Session, today: date | None = None) -> System | None:
    """Return the system of the first P1 focus task, for display context."""
    tasks = choose_focus_tasks(db)
    if not tasks:
        return None
    return db.get(System, tasks[0].system_id)


def build_today(db: Session, today: date | None = None) -> dict:
    """Aggregate the dashboard 'today' view."""
    today = today or date.today()
    horizon = today + timedelta(days=UPCOMING_WINDOW_DAYS)

    focus_tasks = choose_focus_tasks(db)
    focus_system = db.get(System, focus_tasks[0].system_id) if focus_tasks else None

    # Show ALL open subtasks of focus tasks — subtasks inherit their ordering from
    # the parent task's priority; they are not selected independently.
    focus_task_ids = {t.id for t in focus_tasks}
    focus_subtasks: list = []
    if focus_task_ids:
        stmt_sub = select(Subtask).where(
            Subtask.task_id.in_(focus_task_ids),
            Subtask.status.in_([WorkStatus.todo, WorkStatus.in_progress]),
        )
        focus_subtasks = list(db.execute(stmt_sub).scalars().all())

    open_tasks = _open_tasks(db)
    upcoming = sorted(
        (t for t in open_tasks if t.deadline and today <= t.deadline <= horizon),
        key=_task_sort_key,
    )
    flagged = sorted(
        (
            t
            for t in open_tasks
            if t.flagged
            or (t.deadline and t.deadline < today)
            or t.status == WorkStatus.blocked
        ),
        key=_priority_sort_key,
    )

    return {
        "day": today,
        "focus_system": focus_system,
        "focus_tasks": focus_tasks,
        "focus_subtasks": focus_subtasks,
        "upcoming_deadlines": upcoming,
        "flagged": flagged,
    }
