from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import analytics, google_ads
from ..auth import require_admin
from ..collector import collect_all, collect_historical_all
from ..config import settings
from ..db import SessionLocal, get_db
from ..models import CollectionRun, HistoricalRun, Keyword
from ..seeds import categorize


router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _run_collection_then_score():
    collect_all()
    db = SessionLocal()
    try:
        analytics.recompute_all_scores(db)
    finally:
        db.close()


@router.post("/collect")
def trigger_collect(bg: BackgroundTasks):
    bg.add_task(_run_collection_then_score)
    return {"status": "queued", "message": "Toplama arka planda başladı. Birkaç dakika sürer."}


@router.post("/recompute-scores")
def recompute_scores(db: Annotated[Session, Depends(get_db)]):
    n = analytics.recompute_all_scores(db)
    return {"recomputed": n}


class AddKeywordsIn(BaseModel):
    keywords: list[str]


@router.post("/keywords")
def add_keywords(body: AddKeywordsIn, db: Annotated[Session, Depends(get_db)]):
    """AI önerilen veya manuel girilen kelimeleri takip listesine ekler."""
    added = []
    skipped = []
    for raw in body.keywords:
        kw = (raw or "").strip().lower()
        if not kw or len(kw) < 3:
            skipped.append(raw)
            continue
        existing = db.query(Keyword).filter(Keyword.keyword == kw).one_or_none()
        if existing:
            skipped.append(kw)
            continue
        db.add(Keyword(keyword=kw, category=categorize(kw), is_seed=False, is_active=True))
        added.append(kw)
    db.commit()
    return {"added": added, "skipped": skipped}


@router.delete("/keywords/{keyword}")
def remove_keyword(keyword: str, db: Annotated[Session, Depends(get_db)]):
    kw = db.query(Keyword).filter(Keyword.keyword == keyword).one_or_none()
    if not kw:
        return {"removed": False}
    kw.is_active = False
    db.commit()
    return {"removed": True}


@router.post("/refresh-volumes")
def refresh_volumes(db: Annotated[Session, Depends(get_db)], force: bool = False):
    """Google Ads Keyword Planner'dan tüm aktif kelimeler için hacim tazele."""
    if not settings.has_google_ads:
        return {"status": "disabled", "message": "Google Ads .env'de yapılandırılmamış"}
    keywords = [k.keyword for k in db.query(Keyword).filter(Keyword.is_active == True).all()]
    return google_ads.refresh_volumes(db, keywords, force=force)


@router.get("/ads-status")
def ads_status():
    return {"configured": settings.has_google_ads}


@router.post("/collect-historical")
def trigger_historical(bg: BackgroundTasks):
    """5 yıllık veri çekimini arka planda başlat (~3-5 dk)."""
    bg.add_task(collect_historical_all)
    return {"status": "queued", "message": "5 yıllık veri arka planda çekiliyor. Pytrends rate limit dostu (~3-5 dk)."}


@router.get("/historical-runs")
def historical_runs(db: Annotated[Session, Depends(get_db)]):
    rows = db.query(HistoricalRun).order_by(HistoricalRun.started_at.desc()).limit(10).all()
    return [
        {
            "id": r.id,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "attempted": r.keywords_attempted,
            "succeeded": r.keywords_succeeded,
            "failed": r.keywords_failed,
            "status": r.status,
        }
        for r in rows
    ]


@router.get("/runs")
def list_runs(db: Annotated[Session, Depends(get_db)]):
    rows = db.query(CollectionRun).order_by(CollectionRun.started_at.desc()).limit(20).all()
    return [
        {
            "id": r.id,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "attempted": r.keywords_attempted,
            "succeeded": r.keywords_succeeded,
            "failed": r.keywords_failed,
            "status": r.status,
            "error": r.error,
        }
        for r in rows
    ]


@router.get("/current-run")
def current_run(db: Annotated[Session, Depends(get_db)]):
    """Live progress + cooldown info for the freshness banner."""
    from .. import collector
    last = (
        db.query(CollectionRun)
        .order_by(CollectionRun.started_at.desc())
        .first()
    )
    cooldown = collector.get_cooldown_status()
    if not last:
        return {"run": None, "cooldown": cooldown}
    return {
        "run": {
            "id": last.id,
            "status": last.status,
            "attempted": last.keywords_attempted,
            "succeeded": last.keywords_succeeded,
            "failed": last.keywords_failed,
            "started_at": last.started_at.isoformat() if last.started_at else None,
            "finished_at": last.finished_at.isoformat() if last.finished_at else None,
            "error": last.error,
        },
        "cooldown": cooldown,
    }
