import csv
import io
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .. import analytics, google_ads
from ..auth import require_admin
from ..db import get_db
from ..models import Keyword, KeywordVolume, RelatedQuery, RisingQuery


router = APIRouter(prefix="/api/trends", tags=["trends"], dependencies=[Depends(require_admin)])


def _volumes_index(db) -> dict[str, KeywordVolume]:
    return {v.keyword: v for v in db.query(KeywordVolume).all()}


def _score_dict(s, vols: dict | None = None):
    out = {
        "keyword": s.keyword,
        "category": s.category,
        "avg_last_7": s.avg_last_7,
        "avg_prev_7": s.avg_prev_7,
        "growth_pct": s.growth_pct,
        "is_hot": s.is_hot,
        "opportunity_score": s.opportunity_score,
        "computed_at": s.computed_at.isoformat() if s.computed_at else None,
    }
    if vols is not None:
        v = vols.get(s.keyword)
        if v:
            out["volume_monthly"] = v.avg_monthly_searches
            out["volume_recent"] = v.last_3m_avg
            out["competition"] = v.competition
            out["competition_index"] = v.competition_index
            out["bid_low"] = v.low_top_of_page_bid
            out["bid_high"] = v.high_top_of_page_bid
        else:
            out["volume_monthly"] = None
            out["volume_recent"] = None
    return out


@router.get("/overview")
def overview(db: Annotated[Session, Depends(get_db)]):
    top = analytics.top_trending(db, limit=10)
    rising = analytics.top_rising(db, limit=10)
    hot = analytics.hot_alerts(db)
    total_keywords = db.query(Keyword).filter(Keyword.is_active == True).count()
    vols = _volumes_index(db)
    return {
        "total_keywords": total_keywords,
        "hot_count": len(hot),
        "has_volumes": len(vols) > 0,
        "top": [_score_dict(s, vols) for s in top],
        "rising": [_score_dict(s, vols) for s in rising],
        "alerts": [_score_dict(s, vols) for s in hot[:5]],
    }


@router.get("/keyword/{keyword}")
def keyword_detail(keyword: str, db: Annotated[Session, Depends(get_db)]):
    points = analytics.keyword_timeseries(db, keyword)
    if not points:
        raise HTTPException(status_code=404, detail="Veri yok — bu kelime için henüz toplama yapılmamış")

    rising = analytics.keyword_rising(db, keyword)
    related_top = (
        db.query(RelatedQuery)
        .filter(RelatedQuery.parent_keyword == keyword, RelatedQuery.type == "top")
        .order_by(RelatedQuery.collected_at.desc(), RelatedQuery.score.desc())
        .limit(20)
        .all()
    )

    latest = analytics.latest_scores(db)
    score = next((s for s in latest if s.keyword == keyword), None)

    forecast = analytics.forecast_keyword(db, keyword, days=7)
    smart_forecast = analytics.seasonality_aware_forecast(db, keyword, days=30)
    anomaly = analytics.detect_anomaly(db, keyword)
    correlated = analytics.correlated_keywords(db, keyword, top_n=8)
    vols = _volumes_index(db)

    return {
        "keyword": keyword,
        "score": _score_dict(score, vols) if score else None,
        "timeseries": [
            {"date": p.date.isoformat(), "interest": p.interest, "is_partial": p.is_partial}
            for p in points
        ],
        "forecast": forecast,
        "smart_forecast": smart_forecast,
        "correlated": correlated,
        "anomaly": anomaly,
        "rising": [{"keyword": r.rising_keyword, "growth": r.growth} for r in rising],
        "related_top": [{"keyword": r.related_keyword, "score": r.score} for r in related_top],
    }


@router.get("/anomalies")
def anomalies(db: Annotated[Session, Depends(get_db)]):
    return analytics.all_anomalies(db)


@router.get("/keywords")
def list_keywords(db: Annotated[Session, Depends(get_db)]):
    rows = db.query(Keyword).filter(Keyword.is_active == True).order_by(Keyword.keyword.asc()).all()
    return [
        {
            "keyword": k.keyword,
            "category": k.category,
            "is_seed": k.is_seed,
            "last_collected_at": k.last_collected_at.isoformat() if k.last_collected_at else None,
        }
        for k in rows
    ]


@router.get("/opportunities")
def opportunities(
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(20, ge=1, le=100),
):
    rows = analytics.opportunities(db, limit=limit)
    vols = _volumes_index(db)
    return [_score_dict(s, vols) for s in rows]


@router.get("/categories")
def categories(db: Annotated[Session, Depends(get_db)]):
    grouped = analytics.by_category(db)
    vols = _volumes_index(db)
    return {
        cat: [_score_dict(s, vols) for s in rows]
        for cat, rows in grouped.items()
    }


@router.get("/alerts")
def alerts(db: Annotated[Session, Depends(get_db)]):
    rows = analytics.hot_alerts(db)
    vols = _volumes_index(db)
    return [_score_dict(s, vols) for s in rows]


@router.get("/export.csv")
def export_csv(db: Annotated[Session, Depends(get_db)]):
    rows = analytics.latest_scores(db)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "keyword", "category", "avg_last_7", "avg_prev_7", "growth_pct",
        "is_hot", "opportunity_score", "computed_at",
    ])
    for s in rows:
        writer.writerow([
            s.keyword, s.category or "", s.avg_last_7, s.avg_prev_7, s.growth_pct,
            int(bool(s.is_hot)), s.opportunity_score,
            s.computed_at.isoformat() if s.computed_at else "",
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=trends_export.csv"},
    )
