"""Mevsimsel yayın takvimi."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import calendar_plan
from ..auth import require_admin
from ..db import get_db

router = APIRouter(prefix="/api/calendar", tags=["calendar"], dependencies=[Depends(require_admin)])


@router.get("")
def get_calendar(months: int = Query(12, ge=1, le=24), db: Session = Depends(get_db)):
    return calendar_plan.build_calendar(db, months=months)
