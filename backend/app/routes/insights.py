"""Akıllı katman: Fırsat Skoru v2 + aksiyon akışı."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import insights
from ..auth import require_admin
from ..db import get_db

router = APIRouter(prefix="/api/insights", tags=["insights"], dependencies=[Depends(require_admin)])


@router.get("/opportunities")
def opportunities_v2(
    limit: int = Query(30, ge=1, le=200),
    action: str | None = Query(None, description="write|optimize|maintain|watch|track"),
    fresh: bool = Query(False, description="Önbelleği atla"),
    db: Session = Depends(get_db),
):
    items = insights.compute_opportunities_v2(db, use_cache=not fresh)
    if action:
        items = [i for i in items if i["action"] == action]
    counts: dict[str, int] = {}
    for i in insights.compute_opportunities_v2(db):
        counts[i["action"]] = counts.get(i["action"], 0) + 1
    return {"items": items[:limit], "total": len(items), "action_counts": counts}


@router.get("/actions")
def actions(
    limit: int = Query(10, ge=1, le=50),
    include_done: bool = Query(False),
    db: Session = Depends(get_db),
):
    return insights.get_actions(db, limit=limit, include_done=include_done)


class ActionStateIn(BaseModel):
    status: str  # open | done | snoozed
    snooze_days: int = 7


@router.post("/actions/{action_id}/state")
def set_state(action_id: str, body: ActionStateIn, db: Session = Depends(get_db)):
    try:
        return insights.set_action_state(db, action_id, body.status, body.snooze_days)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/refresh")
def refresh(db: Session = Depends(get_db)):
    insights.invalidate_cache()
    items = insights.compute_opportunities_v2(db, use_cache=False)
    return {"status": "ok", "count": len(items)}
