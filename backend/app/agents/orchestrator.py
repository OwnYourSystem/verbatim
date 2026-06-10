"""Orchestrator — routes a change to the right System's specialist agent,
turns the agent's output into a stored RebalanceProposal (pending), and applies
proposals once the user approves them.

Design: event-triggered, human-gated. The agent only ever *proposes*.
"""
from __future__ import annotations

from datetime import UTC, datetime

from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.llm import LLMClient, get_llm
from app.models import (
    AgentAssignment,
    ProposalStatus,
    RebalanceProposal,
    System,
    Task,
    WorkStatus,
)
from app.schemas import ProposalAction
from app.services import emit_event, get_current_priority

_action_list_adapter = TypeAdapter(list[ProposalAction])


def build_context(db: Session, system: System) -> dict:
    """The read-only snapshot handed to the specialist agent."""
    assignment = db.execute(
        select(AgentAssignment).where(AgentAssignment.system_id == system.id)
    ).scalar_one_or_none()
    program = assignment.program.content if (assignment and assignment.program) else None

    open_tasks = [
        {
            "id": t.id,
            "title": t.title,
            "status": str(t.status),
            "deadline": t.deadline.isoformat() if t.deadline else None,
            "position": t.position,
        }
        for t in sorted(system.tasks, key=lambda t: t.position)
        if t.status != WorkStatus.done
    ]
    return {
        "system": {"id": system.id, "name": system.name, "status": str(system.status)},
        "current_priority": get_current_priority(db, system.id),
        "program": program,
        "open_tasks": open_tasks,
    }


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
        actions = [a.model_dump() for a in validated]
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
    """Apply an approved proposal's actions. Only touches tasks in its System."""
    system = db.get(System, proposal.system_id)
    if system is None:
        return
    own_task_ids = {t.id for t in system.tasks}

    for action in proposal.actions:
        if action.get("type") == "reorder":
            tid = action.get("task_id")
            if tid in own_task_ids:
                task = db.get(Task, tid)
                if task is not None:
                    task.position = int(action.get("position", task.position))
        elif action.get("type") == "add_pretask":
            existing = [t.position for t in system.tasks]
            front = (min(existing) - 1) if existing else 0
            db.add(
                Task(
                    system_id=proposal.system_id,
                    title=str(action.get("title", "Pre-task")),
                    position=front,
                )
            )


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
