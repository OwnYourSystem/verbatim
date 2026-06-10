"""Reports — weekly, monthly, on-demand, and the morning briefing."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import reports
from app.db import get_db
from app.schemas import Report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/weekly", response_model=Report)
def weekly(db: Session = Depends(get_db)):
    return reports.weekly_report(db)


@router.get("/monthly", response_model=Report)
def monthly(db: Session = Depends(get_db)):
    return reports.monthly_report(db)


@router.get("/on-demand", response_model=Report)
def on_demand(db: Session = Depends(get_db)):
    return reports.on_demand_report(db)


@router.get("/morning-briefing", response_model=Report)
def morning_briefing(db: Session = Depends(get_db)):
    return reports.morning_briefing(db)
