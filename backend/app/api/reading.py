"""Check Out ASAP — reading items saved for later."""
from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ReadingItem
from app.schemas import ReadingItemCreate, ReadingItemRead, ReadingItemUpdate

router = APIRouter(prefix="/reading-items", tags=["reading"])


@router.get("", response_model=list[ReadingItemRead])
def list_items(archived: bool = False, db: Session = Depends(get_db)):
    return (
        db.query(ReadingItem)
        .filter(ReadingItem.is_checked == archived)
        .order_by(ReadingItem.created_at.desc())
        .all()
    )


@router.post("", response_model=ReadingItemRead, status_code=201)
def create_item(body: ReadingItemCreate, db: Session = Depends(get_db)):
    item = ReadingItem(**body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=ReadingItemRead)
def update_item(item_id: int, body: ReadingItemUpdate, db: Session = Depends(get_db)):
    item = db.get(ReadingItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    data = body.model_dump(exclude_none=True)
    if data.get("is_checked") and not item.is_checked:
        item.checked_at = datetime.now(UTC)
    for field, val in data.items():
        setattr(item, field, val)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(ReadingItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    db.delete(item)
    db.commit()
