"""Domain services: priority computation and the change-event hook.

The change-event hook is where Part B (the AI brain) plugs in. For now it just
logs; later it will debounce events and route them to the orchestrator agent so
the responsible specialist can propose a rebalance.
"""
from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Priority, Subtask

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
