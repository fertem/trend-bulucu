"""Akıllı uyarılar + bildirim."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import alerts, notify
from ..auth import require_admin
from ..db import get_db

router = APIRouter(prefix="/api/alerts", tags=["alerts"], dependencies=[Depends(require_admin)])


@router.get("")
def list_alerts(
    severity: str | None = Query(None, description="critical|warn|info"),
    status: str | None = Query(None, description="new|seen|muted"),
    include_inactive: bool = Query(False),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    data = alerts.list_alerts(db, severity=severity, status=status, include_inactive=include_inactive, limit=limit)
    data["notify"] = {
        "configured": notify.is_configured(),
        "telegram": notify.has_telegram(),
        "slack": notify.has_slack(),
        "min_severity": notify.min_severity(),
    }
    return data


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    return alerts.summary(db)


class StateIn(BaseModel):
    status: str  # new | seen | muted
    mute_days: int = 7


@router.post("/{alert_id}/state")
def set_state(alert_id: str, body: StateIn, db: Session = Depends(get_db)):
    try:
        return alerts.set_state(db, alert_id, body.status, body.mute_days)
    except KeyError:
        raise HTTPException(status_code=404, detail="Uyarı bulunamadı")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/mark-all-seen")
def mark_all_seen(db: Session = Depends(get_db)):
    return {"updated": alerts.mark_all_seen(db)}


@router.post("/generate")
def generate(notify_new: bool = Query(True), db: Session = Depends(get_db)):
    result = alerts.generate_and_notify(db) if notify_new else alerts.generate(db)
    result["new_count"] = len(result["new"])
    result.pop("new", None)
    return result
