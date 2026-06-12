"""Orchestrator — routes a change to the right System's specialist agent,
turns the agent's output into a stored RebalanceProposal (pending), and applies
proposals once the user approves them.

Design: event-triggered, human-gated. The agent only ever *proposes*.
"""
from __future__ import annotations

from datetime import UTC, date, datetime

from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.llm import LLMClient, get_llm
from app.models import (
    AgentAssignment,
    FocusBlock,
    ProposalStatus,
    RebalanceProposal,
    Subtask,
    System,
    Task,
    WorkStatus,
)
from app.schemas import ProposalAction
from app.services import computed_fields, emit_event, get_current_priority

_action_list_adapter = TypeAdapter(list[ProposalAction])

# Attributes the scrum master is allowed to set on a task/subtask via actions.
_ATTR_FIELDS = (
    "description",
    "status",
    "priority",
    "deadline",
    "dedicated_hours",
    "data_exposure_concern",
    "last_checkpoint",
    "required_demo",
)


def build_context(db: Session, system: System) -> dict:
    """The read-only snapshot handed to the specialist agent."""
    assignment = db.execute(
        select(AgentAssignment).where(AgentAssignment.system_id == system.id)
    ).scalar_one_or_none()
    program = assignment.program.content if (assignment and assignment.program) else None

    open_tasks = []
    for t in sorted(system.tasks, key=lambda t: t.position):
        if t.status == WorkStatus.done:
            continue
        comp = computed_fields(t)
        open_tasks.append(
            {
                "id": t.id,
                "title": t.title,
                "status": str(t.status),
                "priority": t.priority,
                "deadline": t.deadline.isoformat() if t.deadline else None,
                "position": t.position,
                "dedicated_hours": t.dedicated_hours,
                "spent_hours": comp["spent_hours"],
                "remaining_hours": comp["remaining_hours"],
                "time_left_days": comp["time_left_days"],
                "last_checkpoint": t.last_checkpoint,
                "required_demo": t.required_demo,
                "data_exposure_concern": t.data_exposure_concern,
                "subtasks": [
                    {"id": s.id, "title": s.title, "status": str(s.status)}
                    for s in sorted(t.subtasks, key=lambda s: s.position)
                ],
            }
        )
    return {
        "system": {"id": system.id, "name": system.name, "status": str(system.status)},
        "current_priority": get_current_priority(db, system.id),
        "program": program,
        "open_tasks": open_tasks,
    }


def _apply_attrs(item: Task | Subtask, action: dict) -> None:
    for field in _ATTR_FIELDS:
        if field in action and action[field] is not None:
            value = action[field]
            if field == "deadline" and isinstance(value, str):
                value = date.fromisoformat(value)
            setattr(item, field, value)


def propose_for_system(
    db: Session,
    system_id: int,
    trigger: str = "manual",
    llm: LLMClient | None = None,
) -> RebalanceProposal:
    """Run the specialist agent for one System and store a pending proposal."""
    system = db.get(System, system_id)
    if system is None:
        raise ValueError(f"System {system_id} not found")

    llm = llm or get_llm()
    context = build_context(db, system)
    result = llm.propose(context)

    # Validate the agent's actions; drop anything malformed rather than trust it.
    try:
        validated = _action_list_adapter.validate_python(result.get("actions", []))
        # mode="json" so dates serialise to ISO strings for the JSON column.
        actions = [a.model_dump(mode="json") for a in validated]
    except ValidationError:
        actions = []

    proposal = RebalanceProposal(
        system_id=system_id,
        trigger=trigger,
        summary=str(result.get("summary", "")),
        actions=actions,
        status=ProposalStatus.pending,
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    emit_event(
        "rebalance.proposed",
        {"proposal_id": proposal.id, "system_id": system_id, "trigger": trigger},
    )
    return proposal


def apply_proposal(db: Session, proposal: RebalanceProposal) -> None:
    """Apply an approved proposal's actions. Only touches its own System.

    Supports the full scrum-master toolkit: reorder, add_pretask, add_task,
    update_task, add_subtask, schedule (calendar), and insight (no-op record).
    """
    system = db.get(System, proposal.system_id)
    if system is None:
        return
    own_task_ids = {t.id for t in system.tasks}

    for action in proposal.actions:
        kind = action.get("type")

        if kind == "reorder":
            tid = action.get("task_id")
            if tid in own_task_ids:
                task = db.get(Task, tid)
                if task is not None:
                    task.position = int(action.get("position", task.position))

        elif kind in ("add_pretask", "add_task"):
            existing = [t.position for t in system.tasks]
            if kind == "add_pretask":
                position = (min(existing) - 1) if existing else 0
            else:
                position = (max(existing) + 1) if existing else 0
            task = Task(
                system_id=proposal.system_id,
                title=str(action.get("title", "New task")),
                position=position,
            )
            _apply_attrs(task, action)
            db.add(task)

        elif kind == "update_task":
            tid = action.get("task_id")
            if tid in own_task_ids:
                task = db.get(Task, tid)
                if task is not None:
                    if action.get("title"):
                        task.title = str(action["title"])
                    _apply_attrs(task, action)

        elif kind == "add_subtask":
            tid = action.get("task_id")
            if tid in own_task_ids:
                parent = db.get(Task, tid)
                if parent is not None:
                    positions = [s.position for s in parent.subtasks]
                    sub = Subtask(
                        task_id=parent.id,
                        title=str(action.get("title", "New subtask")),
                        position=(max(positions) + 1) if positions else 0,
                    )
                    _apply_attrs(sub, action)
                    db.add(sub)

        elif kind == "schedule":
            tid = action.get("task_id")
            day_value = action.get("day")
            if tid in own_task_ids and day_value:
                db.add(
                    FocusBlock(
                        day=date.fromisoformat(day_value)
                        if isinstance(day_value, str)
                        else day_value,
                        system_id=proposal.system_id,
                        task_id=tid,
                        note=action.get("note") or "Scheduled by scrum master",
                    )
                )

        # "insight" actions are informational only — nothing to apply.


def decide_proposal(
    db: Session, proposal: RebalanceProposal, approve: bool
) -> RebalanceProposal:
    if proposal.status == ProposalStatus.pending:
        if approve:
            apply_proposal(db, proposal)
            proposal.status = ProposalStatus.approved
        else:
            proposal.status = ProposalStatus.rejected
        proposal.decided_at = datetime.now(UTC)
        db.commit()
        db.refresh(proposal)
        emit_event(
            "rebalance.decided",
            {"proposal_id": proposal.id, "approved": approve},
        )
    return proposal
