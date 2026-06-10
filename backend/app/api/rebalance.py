"""Rebalance proposals — the propose → approve workflow for the AI brain."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.orchestrator import decide_proposal, propose_for_system
from app.db import get_db
from app.models import ProposalStatus, RebalanceProposal, System
from app.schemas import RebalanceProposalRead

router = APIRouter(tags=["rebalance"])


@router.post(
    "/systems/{system_id}/rebalance",
    response_model=RebalanceProposalRead,
    status_code=201,
)
def request_rebalance(system_id: int, db: Session = Depends(get_db)):
    """Ask the System's specialist agent to propose a new plan (does not apply it)."""
    if not db.get(System, system_id):
        raise HTTPException(404, "System not found")
    return propose_for_system(db, system_id, trigger="manual")


@router.get("/rebalance-proposals", response_model=list[RebalanceProposalRead])
def list_proposals(
    status: ProposalStatus | None = None,
    system_id: int | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(RebalanceProposal)
    if status is not None:
        stmt = stmt.where(RebalanceProposal.status == status)
    if system_id is not None:
        stmt = stmt.where(RebalanceProposal.system_id == system_id)
    stmt = stmt.order_by(RebalanceProposal.created_at.desc(), RebalanceProposal.id.desc())
    return db.execute(stmt).scalars().all()


@router.get("/rebalance-proposals/{proposal_id}", response_model=RebalanceProposalRead)
def get_proposal(proposal_id: int, db: Session = Depends(get_db)):
    proposal = db.get(RebalanceProposal, proposal_id)
    if not proposal:
        raise HTTPException(404, "Proposal not found")
    return proposal


@router.post("/rebalance-proposals/{proposal_id}/approve", response_model=RebalanceProposalRead)
def approve_proposal(proposal_id: int, db: Session = Depends(get_db)):
    proposal = db.get(RebalanceProposal, proposal_id)
    if not proposal:
        raise HTTPException(404, "Proposal not found")
    if proposal.status != ProposalStatus.pending:
        raise HTTPException(409, f"Proposal already {proposal.status}")
    return decide_proposal(db, proposal, approve=True)


@router.post("/rebalance-proposals/{proposal_id}/reject", response_model=RebalanceProposalRead)
def reject_proposal(proposal_id: int, db: Session = Depends(get_db)):
    proposal = db.get(RebalanceProposal, proposal_id)
    if not proposal:
        raise HTTPException(404, "Proposal not found")
    if proposal.status != ProposalStatus.pending:
        raise HTTPException(409, f"Proposal already {proposal.status}")
    return decide_proposal(db, proposal, approve=False)
