from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import site_coverage
from ..auth import require_admin
from ..config import settings
from ..db import get_db


router = APIRouter(prefix="/api/content", tags=["content"], dependencies=[Depends(require_admin)])


class StatusUpdate(BaseModel):
    status: Literal["new", "in_progress", "addressed", "dismissed"]
    addressed_url: Optional[str] = None
    notes: Optional[str] = None


@router.get("/status")
def status(db: Annotated[Session, Depends(get_db)]):
    from ..models import SiteContent
    from sqlalchemy import func
    count = db.query(SiteContent).count()
    last_scan = db.query(func.max(SiteContent.scanned_at)).scalar()
    return {
        "configured": bool(settings.kod_org_path),
        "kod_org_path": settings.kod_org_path,
        "content_count": count,
        "last_scanned_at": last_scan.isoformat() if last_scan else None,
    }


@router.post("/scan")
def scan(db: Annotated[Session, Depends(get_db)]):
    """Sitenin dosya sistemini tara, içerik listesini güncelle."""
    return site_coverage.scan_site(db)


@router.get("/list")
def list_content(db: Annotated[Session, Depends(get_db)]):
    return site_coverage.list_content(db)


@router.get("/gaps/live")
def gaps_live(
    db: Annotated[Session, Depends(get_db)],
    min_growth: float = Query(0.0, ge=-100, le=10000),
    limit: int = Query(30, ge=1, le=100),
):
    """Anlık (canlı) hesaplama — geçmişe yazmaz."""
    return site_coverage.content_gaps(db, min_growth=min_growth, limit=limit)


@router.get("/gaps")
def gaps_history(
    db: Annotated[Session, Depends(get_db)],
    status: str = Query("all", description="all | new | in_progress | addressed | dismissed"),
    limit: int = Query(100, ge=1, le=500),
):
    """Geçmiş kayıtlardan içerik fırsatları — günlük güncellenir, kayıp olmaz."""
    return site_coverage.get_gap_history(db, status=status, limit=limit)


@router.get("/gaps/counts")
def gap_counts(db: Annotated[Session, Depends(get_db)]):
    return site_coverage.gap_status_counts(db)


@router.post("/gaps/refresh")
def refresh_gaps(db: Annotated[Session, Depends(get_db)]):
    """Anlık hesaplama yapıp history tablosunu güncelle (yeni gap'ler eklenir, eskiler silinmez)."""
    return site_coverage.update_gap_history(db)


@router.patch("/gaps/{gap_id}/status")
def set_gap_status(gap_id: int, body: StatusUpdate, db: Annotated[Session, Depends(get_db)]):
    """Bir fırsatın durumunu işaretle: new / in_progress / addressed / dismissed."""
    result = site_coverage.update_gap_status(
        db, gap_id, body.status,
        addressed_url=body.addressed_url, notes=body.notes,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Gap bulunamadı veya geçersiz status")
    return result
