"""Report generation — deterministic, plain-language, computed from data.

Weekly / monthly / on-demand reports plus the morning briefing. Each report is
a set of text sections PLUS structured charts (bar / pie / waterfall) the
frontend renders. Hours budgeting (dedicated vs spent vs remaining) is surfaced
so the user can see how much time is left and adjust.
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import System, SystemStatus, WorkStatus
from app.services import build_today, get_current_priority, spent_hours_for

# Cosmos signal palette (kept in sync with the frontend tokens).
C_OK = "#00e5a0"
C_WARN = "#f5a623"
C_CRIT = "#ff4b6e"
C_IDLE = "#6b82b5"
C_UI = "#7c3aed"


def _active_systems(db: Session) -> list[System]:
    stmt = select(System).where(System.status == SystemStatus.active).order_by(System.name)
    return list(db.execute(stmt).scalars().all())


def _system_stats(db: Session, system: System, today: date) -> dict:
    tasks = system.tasks
    total = len(tasks)
    done = sum(1 for t in tasks if t.status == WorkStatus.done)
    open_tasks = [t for t in tasks if t.status != WorkStatus.done]
    overdue = [t for t in open_tasks if t.deadline and t.deadline < today]
    blocked = [t for t in open_tasks if t.status == WorkStatus.blocked]
    in_progress = [t for t in open_tasks if t.status == WorkStatus.in_progress]

    dedicated = round(sum(t.dedicated_hours or 0.0 for t in tasks), 2)
    spent = round(sum(spent_hours_for(t) for t in tasks), 2)
    return {
        "system": system,
        "priority": get_current_priority(db, system.id) or 0,
        "total": total,
        "done": done,
        "open": len(open_tasks),
        "in_progress": len(in_progress),
        "blocked": blocked,
        "overdue": overdue,
        "completion": round(100 * done / total) if total else 0,
        "dedicated_hours": dedicated,
        "spent_hours": spent,
        "remaining_hours": round(dedicated - spent, 2),
    }


def _report(
    type_: str,
    title: str,
    today: date,
    summary: str,
    sections: list[dict],
    charts: list[dict] | None = None,
) -> dict:
    return {
        "type": type_,
        "title": title,
        "generated_at": today.isoformat(),
        "summary": summary,
        "sections": sections,
        "charts": charts or [],
    }


def _completion_bar(stats: list[dict]) -> dict:
    def _c(pct: int) -> str:
        return C_OK if pct >= 80 else C_WARN if pct >= 40 else C_CRIT

    return {
        "type": "bar",
        "title": "Completion by system",
        "unit": "%",
        "points": [
            {"label": s["system"].name, "value": s["completion"], "color": _c(s["completion"])}
            for s in stats
        ],
    }


def _status_pie(stats: list[dict]) -> dict:
    done = sum(s["done"] for s in stats)
    in_prog = sum(s["in_progress"] for s in stats)
    blocked = sum(len(s["blocked"]) for s in stats)
    todo = sum(s["open"] - s["in_progress"] - len(s["blocked"]) for s in stats)
    return {
        "type": "pie",
        "title": "Task status mix",
        "unit": "tasks",
        "points": [
            {"label": "Done", "value": done, "color": C_OK},
            {"label": "In progress", "value": in_prog, "color": C_UI},
            {"label": "To do", "value": max(todo, 0), "color": C_IDLE},
            {"label": "Blocked", "value": blocked, "color": C_CRIT},
        ],
    }


def _hours_waterfall(stats: list[dict]) -> dict:
    """Budget → spent → remaining as a waterfall of hours."""
    dedicated = round(sum(s["dedicated_hours"] for s in stats), 2)
    spent = round(sum(s["spent_hours"] for s in stats), 2)
    remaining = round(dedicated - spent, 2)
    return {
        "type": "waterfall",
        "title": "Hours: budget vs spent vs remaining",
        "unit": "h",
        "points": [
            {"label": "Dedicated", "value": dedicated, "color": C_IDLE},
            {"label": "Spent", "value": -spent, "color": C_WARN},
            {
                "label": "Remaining",
                "value": remaining,
                "color": C_OK if remaining >= 0 else C_CRIT,
            },
        ],
    }


def _hours_by_system_bar(stats: list[dict]) -> dict:
    """Grouped bar: dedicated (value) vs spent (secondary) per system."""
    return {
        "type": "bar",
        "title": "Hours dedicated vs spent",
        "unit": "h",
        "points": [
            {
                "label": s["system"].name,
                "value": s["dedicated_hours"],
                "secondary": s["spent_hours"],
                "color": C_UI,
            }
            for s in stats
        ],
    }


def weekly_report(db: Session, today: date | None = None) -> dict:
    today = today or date.today()
    horizon = today + timedelta(days=7)
    systems = _active_systems(db)
    stats = [_system_stats(db, s, today) for s in systems]

    completed = sum(s["done"] for s in stats)
    behind: list[str] = []
    coming: list[str] = []
    per_system: list[str] = []

    for s in stats:
        sys = s["system"]
        per_system.append(
            f"{sys.name}: {s['done']}/{s['total']} done ({s['completion']}%), "
            f"{s['open']} open, priority {s['priority']}, "
            f"{s['remaining_hours']:g}h left of {s['dedicated_hours']:g}h"
        )
        for t in s["overdue"]:
            behind.append(f"{sys.name} — {t.title} (was due {t.deadline})")
        for t in sys.tasks:
            if t.status != WorkStatus.done and t.deadline and today <= t.deadline <= horizon:
                coming.append(f"{sys.name} — {t.title} (due {t.deadline})")

    summary = (
        f"{completed} task(s) completed across {len(systems)} active system(s). "
        f"{len(behind)} item(s) behind, {len(coming)} due in the next 7 days."
    )
    return _report(
        "weekly",
        "Weekly report",
        today,
        summary,
        [
            {"heading": "By system", "items": per_system or ["No active systems."]},
            {"heading": "Behind", "items": behind or ["Nothing behind."]},
            {"heading": "Coming next week", "items": coming or ["Nothing due soon."]},
        ],
        charts=[
            _completion_bar(stats),
            _status_pie(stats),
            _hours_waterfall(stats),
        ]
        if stats
        else [],
    )


def monthly_report(db: Session, today: date | None = None) -> dict:
    today = today or date.today()
    systems = _active_systems(db)
    stats = sorted(
        (_system_stats(db, s, today) for s in systems),
        key=lambda s: s["priority"],
        reverse=True,
    )

    progress: list[str] = []
    missed: list[str] = []
    for s in stats:
        sys = s["system"]
        progress.append(
            f"{sys.name} (priority {s['priority']}): {s['completion']}% complete "
            f"({s['done']}/{s['total']}), {s['spent_hours']:g}h spent"
        )
        for t in s["overdue"]:
            missed.append(f"{sys.name} — {t.title} (due {t.deadline})")

    total_done = sum(s["done"] for s in stats)
    total_all = sum(s["total"] for s in stats)
    overall = round(100 * total_done / total_all) if total_all else 0
    summary = (
        f"Overall completion {overall}% ({total_done}/{total_all}). "
        f"{len(missed)} missed item(s). Review priorities for next month."
    )
    return _report(
        "monthly",
        "Monthly review",
        today,
        summary,
        [
            {"heading": "System progress (by priority)", "items": progress or ["No systems."]},
            {"heading": "Missed items", "items": missed or ["None missed."]},
            {
                "heading": "Next month",
                "items": ["Set or adjust each system's priority for the new month."],
            },
        ],
        charts=[
            _completion_bar(stats),
            _hours_by_system_bar(stats),
            _status_pie(stats),
        ]
        if stats
        else [],
    )


def on_demand_report(db: Session, today: date | None = None) -> dict:
    today = today or date.today()
    systems = _active_systems(db)
    stats = [_system_stats(db, s, today) for s in systems]

    status_lines = [
        f"{s['system'].name}: {s['open']} open / {s['done']} done "
        f"({s['completion']}%){'  ⚠ blocked' if s['blocked'] else ''}"
        for s in stats
    ]
    overdue = [
        f"{s['system'].name} — {t.title} (due {t.deadline})"
        for s in stats
        for t in s["overdue"]
    ]
    hours_lines = [
        f"{s['system'].name}: {s['spent_hours']:g}h spent / {s['dedicated_hours']:g}h "
        f"budget → {s['remaining_hours']:g}h left"
        for s in stats
    ]
    summary = f"{len(systems)} active system(s); {len(overdue)} overdue item(s)."
    return _report(
        "on_demand",
        "Status report",
        today,
        summary,
        [
            {"heading": "Status by system", "items": status_lines or ["No active systems."]},
            {"heading": "Hours budget", "items": hours_lines or ["No hours tracked."]},
            {"heading": "Overdue", "items": overdue or ["Nothing overdue."]},
        ],
        charts=[
            _hours_waterfall(stats),
            _hours_by_system_bar(stats),
            _status_pie(stats),
        ]
        if stats
        else [],
    )


def morning_briefing(db: Session, today: date | None = None) -> dict:
    today = today or date.today()
    data = build_today(db, today)

    focus = data["focus_system"]
    focus_line = (
        f"Focus: {focus.name}" if focus is not None else "No focus system set."
    )
    due_today = [
        f"{t.title} (due {t.deadline})"
        for t in data["upcoming_deadlines"]
        if t.deadline == today
    ]
    summary = (
        f"{focus_line}. {len(data['upcoming_deadlines'])} upcoming, "
        f"{len(data['flagged'])} flagged."
    )
    return _report(
        "morning_briefing",
        f"Good morning — {today.isoformat()}",
        today,
        summary,
        [
            {"heading": "Today's focus", "items": [focus_line]},
            {"heading": "Due today", "items": due_today or ["Nothing due today."]},
            {
                "heading": "Flagged",
                "items": [f"{t.title}" for t in data["flagged"]] or ["Nothing flagged."],
            },
        ],
    )
