"""Calendar — focus blocks across days."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import FocusBlock, System, Task
from app.schemas import FocusBlockCreate, FocusBlockRead, FocusBlockUpdate
from app.services import emit_event

router = APIRouter(prefix="/focus-blocks", tags=["calendar"])


def _block_read(db: Session, block: FocusBlock) -> FocusBlockRead:
    data = FocusBlockRead.model_validate(block)
    if block.task_id is not None:
        task = db.get(Task, block.task_id)
        data.task_title = task.title if task else None
    if block.system_id is not None:
        system = db.get(System, block.system_id)
        data.system_name = system.name if system else None
    return data


@router.get("", response_model=list[FocusBlockRead])
def list_focus_blocks(
    start: date | None = None,
    end: date | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(FocusBlock)
    if start is not None:
        stmt = stmt.where(FocusBlock.day >= start)
    if end is not None:
        stmt = stmt.where(FocusBlock.day <= end)
    stmt = stmt.order_by(FocusBlock.day, FocusBlock.start_time)
    return [_block_read(db, b) for b in db.execute(stmt).scalars().all()]


@router.post("", response_model=FocusBlockRead, status_code=201)
def create_focus_block(payload: FocusBlockCreate, db: Session = Depends(get_db)):
    block = FocusBlock(**payload.model_dump())
    db.add(block)
    db.commit()
    db.refresh(block)
    emit_event("focus_block.created", {"focus_block_id": block.id, "day": str(block.day)})
    return _block_read(db, block)


@router.patch("/{block_id}", response_model=FocusBlockRead)
def update_focus_block(
    block_id: int, payload: FocusBlockUpdate, db: Session = Depends(get_db)
):
    block = db.get(FocusBlock, block_id)
    if not block:
        raise HTTPException(404, "Focus block not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(block, key, value)
    db.commit()
    db.refresh(block)
    emit_event("focus_block.updated", {"focus_block_id": block.id})
    return _block_read(db, block)


@router.delete("/{block_id}", status_code=204)
def delete_focus_block(block_id: int, db: Session = Depends(get_db)):
    block = db.get(FocusBlock, block_id)
    if not block:
        raise HTTPException(404, "Focus block not found")
    db.delete(block)
    db.commit()
    emit_event("focus_block.deleted", {"focus_block_id": block_id})
