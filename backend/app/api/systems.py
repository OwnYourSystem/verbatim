"""Systems and their monthly priorities."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Priority, System
from app.schemas import (
    PriorityCreate,
    PriorityRead,
    SystemCreate,
    SystemRead,
    SystemUpdate,
)
from app.services import emit_event, get_current_priority

router = APIRouter(prefix="/systems", tags=["systems"])


def _to_read(db: Session, system: System) -> SystemRead:
    data = SystemRead.model_validate(system)
    data.current_priority = get_current_priority(db, system.id)
    return data


@router.get("", response_model=list[SystemRead])
def list_systems(db: Session = Depends(get_db)):
    systems = db.execute(select(System).order_by(System.name)).scalars().all()
    return [_to_read(db, s) for s in systems]


@router.post("", response_model=SystemRead, status_code=201)
def create_system(payload: SystemCreate, db: Session = Depends(get_db)):
    system = System(**payload.model_dump())
    db.add(system)
    db.commit()
    db.refresh(system)
    emit_event("system.created", {"system_id": system.id})
    return _to_read(db, system)


@router.get("/{system_id}", response_model=SystemRead)
def get_system(system_id: int, db: Session = Depends(get_db)):
    system = db.get(System, system_id)
    if not system:
        raise HTTPException(404, "System not found")
    return _to_read(db, system)


@router.patch("/{system_id}", response_model=SystemRead)
def update_system(system_id: int, payload: SystemUpdate, db: Session = Depends(get_db)):
    system = db.get(System, system_id)
    if not system:
        raise HTTPException(404, "System not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(system, key, value)
    db.commit()
    db.refresh(system)
    emit_event("system.updated", {"system_id": system.id})
    return _to_read(db, system)


@router.delete("/{system_id}", status_code=204)
def delete_system(system_id: int, db: Session = Depends(get_db)):
    system = db.get(System, system_id)
    if not system:
        raise HTTPException(404, "System not found")
    db.delete(system)
    db.commit()
    emit_event("system.deleted", {"system_id": system_id})


# ---- Priorities (nested under systems) ----
@router.get("/{system_id}/priorities", response_model=list[PriorityRead])
def list_priorities(system_id: int, db: Session = Depends(get_db)):
    if not db.get(System, system_id):
        raise HTTPException(404, "System not found")
    stmt = (
        select(Priority)
        .where(Priority.system_id == system_id)
        .order_by(Priority.year.desc(), Priority.month.desc())
    )
    return db.execute(stmt).scalars().all()


@router.put("/{system_id}/priorities", response_model=PriorityRead)
def set_priority(system_id: int, payload: PriorityCreate, db: Session = Depends(get_db)):
    """Set (or update) the priority for a System in a given month."""
    if payload.system_id != system_id:
        raise HTTPException(400, "system_id mismatch between path and body")
    if not db.get(System, system_id):
        raise HTTPException(404, "System not found")

    existing = db.execute(
        select(Priority).where(
            Priority.system_id == system_id,
            Priority.year == payload.year,
            Priority.month == payload.month,
        )
    ).scalar_one_or_none()

    if existing:
        existing.score = payload.score
        priority = existing
    else:
        priority = Priority(**payload.model_dump())
        db.add(priority)

    db.commit()
    db.refresh(priority)
    emit_event(
        "priority.set",
        {
            "system_id": system_id,
            "year": payload.year,
            "month": payload.month,
            "score": payload.score,
        },
    )
    return priority
