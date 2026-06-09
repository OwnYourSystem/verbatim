"""Agent programs (role instruction files) and agent-to-System assignments.

CRUD only in Phase 2. The execution layer (orchestrator + specialists) is Part B.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AgentAssignment, AgentProgram, System
from app.schemas import (
    AgentAssignmentCreate,
    AgentAssignmentRead,
    AgentAssignmentUpdate,
    AgentProgramCreate,
    AgentProgramRead,
    AgentProgramUpdate,
)

router = APIRouter(tags=["agents"])


# ---- Agent programs ----
@router.get("/agent-programs", response_model=list[AgentProgramRead])
def list_programs(db: Session = Depends(get_db)):
    return db.execute(select(AgentProgram).order_by(AgentProgram.name)).scalars().all()


@router.post("/agent-programs", response_model=AgentProgramRead, status_code=201)
def create_program(payload: AgentProgramCreate, db: Session = Depends(get_db)):
    program = AgentProgram(**payload.model_dump())
    db.add(program)
    db.commit()
    db.refresh(program)
    return program


@router.patch("/agent-programs/{program_id}", response_model=AgentProgramRead)
def update_program(
    program_id: int, payload: AgentProgramUpdate, db: Session = Depends(get_db)
):
    program = db.get(AgentProgram, program_id)
    if not program:
        raise HTTPException(404, "Agent program not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(program, key, value)
    db.commit()
    db.refresh(program)
    return program


@router.delete("/agent-programs/{program_id}", status_code=204)
def delete_program(program_id: int, db: Session = Depends(get_db)):
    program = db.get(AgentProgram, program_id)
    if not program:
        raise HTTPException(404, "Agent program not found")
    db.delete(program)
    db.commit()


# ---- Assignments ----
@router.get("/agent-assignments", response_model=list[AgentAssignmentRead])
def list_assignments(db: Session = Depends(get_db)):
    return db.execute(select(AgentAssignment)).scalars().all()


@router.put("/agent-assignments", response_model=AgentAssignmentRead)
def assign_agent(payload: AgentAssignmentCreate, db: Session = Depends(get_db)):
    """Assign (or reassign) an agent to a System. One agent per System."""
    if not db.get(System, payload.system_id):
        raise HTTPException(404, "System not found")
    if payload.program_id is not None and not db.get(AgentProgram, payload.program_id):
        raise HTTPException(404, "Agent program not found")

    existing = db.execute(
        select(AgentAssignment).where(AgentAssignment.system_id == payload.system_id)
    ).scalar_one_or_none()

    if existing:
        existing.agent_name = payload.agent_name
        existing.program_id = payload.program_id
        assignment = existing
    else:
        assignment = AgentAssignment(**payload.model_dump())
        db.add(assignment)

    db.commit()
    db.refresh(assignment)
    return assignment


@router.patch("/agent-assignments/{assignment_id}", response_model=AgentAssignmentRead)
def update_assignment(
    assignment_id: int, payload: AgentAssignmentUpdate, db: Session = Depends(get_db)
):
    assignment = db.get(AgentAssignment, assignment_id)
    if not assignment:
        raise HTTPException(404, "Assignment not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("program_id") is not None and not db.get(AgentProgram, data["program_id"]):
        raise HTTPException(404, "Agent program not found")
    for key, value in data.items():
        setattr(assignment, key, value)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete("/agent-assignments/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    assignment = db.get(AgentAssignment, assignment_id)
    if not assignment:
        raise HTTPException(404, "Assignment not found")
    db.delete(assignment)
    db.commit()
