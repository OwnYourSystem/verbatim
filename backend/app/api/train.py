"""MindTrain — persist wagon order and castle goals."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import TrainConfig
from app.schemas import TrainConfigRead, TrainConfigUpdate

router = APIRouter(prefix="/train-config", tags=["train"])


def _get_or_create(db: Session) -> TrainConfig:
    cfg = db.query(TrainConfig).first()
    if not cfg:
        cfg = TrainConfig(wagon_order=[], goal_1=None, goal_2=None, goal_3=None)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@router.get("", response_model=TrainConfigRead)
def get_config(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.put("", response_model=TrainConfigRead)
def update_config(body: TrainConfigUpdate, db: Session = Depends(get_db)):
    cfg = _get_or_create(db)
    if body.wagon_order is not None:
        cfg.wagon_order = body.wagon_order
    # Allow clearing goals with "" (empty string treated as null)
    for field in ("goal_1", "goal_2", "goal_3"):
        val = getattr(body, field)
        if val is not None:
            setattr(cfg, field, val or None)
    db.commit()
    db.refresh(cfg)
    return cfg
