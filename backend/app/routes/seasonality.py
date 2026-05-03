import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import collector, seasonality as seasonality_module
from ..auth import require_admin
from ..db import get_db
from ..models import HistoricalPoint, Keyword
from ..seeds import categorize


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/seasonality", tags=["seasonality"], dependencies=[Depends(require_admin)])


@router.get("/status")
def status(db: Annotated[Session, Depends(get_db)]):
    from ..models import HistoricalRun
    last_run = (
        db.query(HistoricalRun)
        .filter(HistoricalRun.status.in_(["success", "partial"]))
        .order_by(HistoricalRun.finished_at.desc())
        .first()
    )
    return {
        "has_data": seasonality_module.has_historical_data(db),
        "last_fetched_at": last_run.finished_at.isoformat() if last_run and last_run.finished_at else None,
        "last_run_status": last_run.status if last_run else None,
    }


@router.get("/outlook")
def monthly_outlook(
    db: Annotated[Session, Depends(get_db)],
    month: int | None = Query(None, ge=1, le=12),
):
    """Bu ay (veya verilen ay) için tarihsel öne çıkanlar."""
    return seasonality_module.current_month_outlook(db, month)


@router.get("/keyword/{keyword}/profile")
def keyword_profile(keyword: str, db: Annotated[Session, Depends(get_db)]):
    """Kelime bazında 12-aylık profil."""
    profile = seasonality_module.keyword_monthly_profile(db, keyword)
    if not profile:
        raise HTTPException(status_code=404, detail="Bu kelime için tarihsel veri yok")
    return profile


@router.get("/keyword/{keyword}/yoy")
def keyword_yoy(keyword: str, db: Annotated[Session, Depends(get_db)]):
    """Yıl-ay zaman serisi."""
    rows = seasonality_module.keyword_yoy(db, keyword)
    if not rows:
        raise HTTPException(status_code=404, detail="Tarihsel veri yok")
    return rows


class ResearchIn(BaseModel):
    keyword: str
    add_to_tracking: bool = False


@router.post("/research")
def research_keyword(body: ResearchIn, db: Annotated[Session, Depends(get_db)]):
    """Arbitrary bir kelime için 5 yıllık veriyi anlık çek + analiz döndür.

    Pytrends rate limit'i nedeniyle ~5-10 saniye sürebilir.
    add_to_tracking=true ise Keyword tablosuna da ekler (günlük toplama dahil).
    """
    kw = (body.keyword or "").strip().lower()
    if not kw or len(kw) < 3:
        raise HTTPException(status_code=400, detail="Anahtar kelime en az 3 karakter olmalı")

    existing = db.query(HistoricalPoint).filter(HistoricalPoint.keyword == kw).first()

    if not existing:
        try:
            client = collector._new_client()
            df = collector._backoff_call(collector.fetch_historical, client, kw)
            n = collector.save_historical(db, kw, df)
            logger.info("[research] %s -> %d points", kw, n)
        except Exception as e:
            logger.exception("[research] failed for %s", kw)
            raise HTTPException(status_code=502, detail=f"Pytrends'den veri alınamadı: {e}")

    if body.add_to_tracking:
        kobj = db.query(Keyword).filter(Keyword.keyword == kw).one_or_none()
        if not kobj:
            db.add(Keyword(keyword=kw, category=categorize(kw), is_seed=False, is_active=True))
            db.commit()

    profile = seasonality_module.keyword_monthly_profile(db, kw)
    yoy = seasonality_module.keyword_yoy(db, kw)
    vs = seasonality_module.keyword_this_vs_history(db, kw)

    if not profile:
        raise HTTPException(status_code=404, detail="Bu kelime için Google Trends'de yeterli veri yok")

    return {
        "keyword": kw,
        "profile": profile,
        "yoy": yoy,
        "this_vs_history": vs,
        "tracking": body.add_to_tracking,
    }


@router.get("/keyword/{keyword}/this-vs-history")
def keyword_this_vs_history(
    keyword: str,
    db: Annotated[Session, Depends(get_db)],
    month: int | None = Query(None, ge=1, le=12),
):
    """Bu yılın bu ayı vs 5 yıl ortalaması."""
    result = seasonality_module.keyword_this_vs_history(db, keyword, month)
    if not result:
        raise HTTPException(status_code=404, detail="Yeterli tarihsel veri yok")
    return result
