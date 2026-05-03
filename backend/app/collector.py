"""Pytrends tabanlı veri toplayıcı.

Rate limit dostu: kelimeler arası gecikme + exponential backoff + tek başarısızlıkta atla.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Iterable

import pandas as pd
from pytrends.request import TrendReq
from sqlalchemy.orm import Session

from . import google_ads
from .config import settings
from .db import SessionLocal
from .models import (
    CollectionRun,
    HistoricalPoint,
    HistoricalRun,
    Keyword,
    RelatedQuery,
    RisingQuery,
    TimeSeriesPoint,
)
from . import app_settings as _app_settings
from .seeds import SEED_KEYWORDS

logger = logging.getLogger(__name__)


def _new_client() -> TrendReq:
    return TrendReq(
        hl=settings.pytrends_hl,
        tz=180,  # Turkey is UTC+3 (180 minutes)
        timeout=(10, 30),
        retries=2,
        backoff_factor=0.5,
    )


def ensure_seed_keywords(db: Session) -> None:
    for kw in SEED_KEYWORDS:
        existing = db.query(Keyword).filter(Keyword.keyword == kw).one_or_none()
        if not existing:
            db.add(Keyword(keyword=kw, category=_app_settings.categorize_keyword(db, kw), is_seed=True, is_active=True))
    db.commit()


def _backoff_call(fn, *args, **kwargs):
    """Exponential backoff: 4s → 8s → 16s, max_retries times."""
    last_err: Exception | None = None
    for attempt in range(settings.max_retries):
        try:
            return fn(*args, **kwargs)
        except Exception as e:  # pytrends throws generic Exception/ResponseError
            last_err = e
            wait = (2 ** (attempt + 2))
            logger.warning("pytrends call failed (attempt %d): %s — sleeping %ds", attempt + 1, e, wait)
            time.sleep(wait)
    raise last_err if last_err else RuntimeError("backoff exhausted")


def fetch_keyword(client: TrendReq, keyword: str) -> dict:
    """Tek kelime için interest_over_time + related_queries döndürür."""
    client.build_payload(
        kw_list=[keyword],
        cat=0,
        timeframe=settings.pytrends_timeframe,
        geo=settings.pytrends_geo,
        gprop="",
    )
    iot: pd.DataFrame = client.interest_over_time()
    related = {}
    try:
        related = client.related_queries() or {}
    except Exception as e:
        logger.warning("related_queries failed for '%s': %s", keyword, e)

    return {"interest_over_time": iot, "related_queries": related}


def save_timeseries(db: Session, keyword: str, df: pd.DataFrame) -> int:
    if df is None or df.empty or keyword not in df.columns:
        return 0
    saved = 0
    for date, row in df.iterrows():
        is_partial = bool(row.get("isPartial", False))
        value = float(row[keyword])
        existing = (
            db.query(TimeSeriesPoint)
            .filter(TimeSeriesPoint.keyword == keyword, TimeSeriesPoint.date == date)
            .one_or_none()
        )
        if existing:
            existing.interest = value
            existing.is_partial = is_partial
        else:
            db.add(TimeSeriesPoint(
                keyword=keyword,
                date=date.to_pydatetime() if hasattr(date, "to_pydatetime") else date,
                interest=value,
                is_partial=is_partial,
            ))
            saved += 1
    db.commit()
    return saved


def save_related(db: Session, parent: str, related_payload: dict) -> int:
    block = related_payload.get(parent) or {}
    saved = 0
    now = datetime.utcnow()

    top_df = block.get("top")
    if top_df is not None and not top_df.empty:
        for _, row in top_df.iterrows():
            db.add(RelatedQuery(
                parent_keyword=parent,
                related_keyword=str(row["query"]),
                score=float(row.get("value", 0) or 0),
                type="top",
                collected_at=now,
            ))
            saved += 1

    rising_df = block.get("rising")
    if rising_df is not None and not rising_df.empty:
        for _, row in rising_df.iterrows():
            db.add(RisingQuery(
                parent_keyword=parent,
                rising_keyword=str(row["query"]),
                growth=float(row.get("value", 0) or 0),
                collected_at=now,
            ))
            saved += 1

    db.commit()
    return saved


def expand_dynamic_keywords(db: Session, parent: str, related_payload: dict, max_new: int = 3) -> int:
    """Yükselen alakalı kelimeleri ana takip listesine ekler (kategori uyumlu olanları)."""
    block = related_payload.get(parent) or {}
    rising_df = block.get("rising")
    if rising_df is None or rising_df.empty:
        return 0

    added = 0
    for _, row in rising_df.iterrows():
        if added >= max_new:
            break
        new_kw = str(row["query"]).strip().lower()
        if not new_kw or len(new_kw) < 3:
            continue
        cat = _app_settings.categorize_keyword(db, new_kw)
        existing = db.query(Keyword).filter(Keyword.keyword == new_kw).one_or_none()
        if existing:
            continue
        db.add(Keyword(keyword=new_kw, category=cat, is_seed=False, is_active=True))
        added += 1

    if added:
        db.commit()
    return added


def fetch_historical(client: TrendReq, keyword: str) -> pd.DataFrame:
    """5 yıllık haftalık veri (today 5-y)."""
    client.build_payload(
        kw_list=[keyword],
        cat=0,
        timeframe="today 5-y",
        geo=settings.pytrends_geo,
        gprop="",
    )
    return client.interest_over_time()


def save_historical(db: Session, keyword: str, df: pd.DataFrame) -> int:
    if df is None or df.empty or keyword not in df.columns:
        return 0
    saved = 0
    for date, row in df.iterrows():
        d = date.to_pydatetime() if hasattr(date, "to_pydatetime") else date
        value = float(row[keyword])
        existing = (
            db.query(HistoricalPoint)
            .filter(HistoricalPoint.keyword == keyword, HistoricalPoint.week_date == d)
            .one_or_none()
        )
        if existing:
            existing.interest = value
        else:
            db.add(HistoricalPoint(
                keyword=keyword,
                week_date=d,
                interest=value,
                year=d.year,
                month=d.month,
            ))
            saved += 1
    db.commit()
    return saved


def collect_historical_all() -> dict:
    """Tüm aktif kelimeler için 5 yıllık veriyi çek (tek seferlik, ~3-5 dk)."""
    db: Session = SessionLocal()
    run = HistoricalRun(started_at=datetime.utcnow())
    db.add(run)
    db.commit()
    db.refresh(run)

    try:
        active = db.query(Keyword).filter(Keyword.is_active == True).all()
        keywords = [k.keyword for k in active]
        run.keywords_attempted = len(keywords)
        db.commit()

        client = _new_client()
        succeeded, failed = 0, 0

        for idx, kw in enumerate(keywords):
            try:
                df = _backoff_call(fetch_historical, client, kw)
                n = save_historical(db, kw, df)
                succeeded += 1
                logger.info("[hist %d/%d] OK: %s (%d nokta)", idx + 1, len(keywords), kw, n)
            except Exception as e:
                failed += 1
                logger.error("[hist %d/%d] FAIL: %s — %s", idx + 1, len(keywords), kw, e)

            if idx < len(keywords) - 1:
                time.sleep(settings.request_delay_seconds + 1)  # historical biraz daha yavaş

        run.keywords_succeeded = succeeded
        run.keywords_failed = failed
        run.finished_at = datetime.utcnow()
        run.status = "success" if failed == 0 else ("partial" if succeeded > 0 else "failed")
        db.commit()
        return {
            "run_id": run.id,
            "attempted": run.keywords_attempted,
            "succeeded": succeeded,
            "failed": failed,
            "status": run.status,
        }
    except Exception as e:
        run.status = "failed"
        run.error = str(e)
        run.finished_at = datetime.utcnow()
        db.commit()
        raise
    finally:
        db.close()


def collect_all(extra_keywords: Iterable[str] | None = None) -> dict:
    """Aktif tüm kelimeler için tam veri toplama döngüsü."""
    db: Session = SessionLocal()
    run = CollectionRun(started_at=datetime.utcnow())
    db.add(run)
    db.commit()
    db.refresh(run)

    try:
        ensure_seed_keywords(db)

        active = db.query(Keyword).filter(Keyword.is_active == True).all()
        keywords = [k.keyword for k in active]
        if extra_keywords:
            for ek in extra_keywords:
                if ek not in keywords:
                    keywords.append(ek)

        run.keywords_attempted = len(keywords)
        db.commit()

        client = _new_client()
        succeeded, failed = 0, 0

        for idx, kw in enumerate(keywords):
            try:
                payload = _backoff_call(fetch_keyword, client, kw)
                save_timeseries(db, kw, payload["interest_over_time"])
                save_related(db, kw, payload["related_queries"])
                expand_dynamic_keywords(db, kw, payload["related_queries"])

                kobj = db.query(Keyword).filter(Keyword.keyword == kw).one_or_none()
                if kobj:
                    kobj.last_collected_at = datetime.utcnow()
                    if not kobj.category:
                        kobj.category = _app_settings.categorize_keyword(db, kw)
                    db.commit()

                succeeded += 1
                logger.info("[%d/%d] OK: %s", idx + 1, len(keywords), kw)
            except Exception as e:
                failed += 1
                logger.error("[%d/%d] FAIL: %s — %s", idx + 1, len(keywords), kw, e)

            if idx < len(keywords) - 1:
                time.sleep(settings.request_delay_seconds)

        run.keywords_succeeded = succeeded
        run.keywords_failed = failed
        run.finished_at = datetime.utcnow()
        if failed == 0:
            run.status = "success"
        elif succeeded > 0:
            run.status = "partial"
        else:
            run.status = "failed"
        db.commit()

        # Google Ads volume verisini güncelle (yapılandırılmışsa)
        if settings.has_google_ads:
            try:
                # Toplama sonrası tüm aktif kelimelerin hacmini tazele (cache TTL'ye göre)
                active_after = db.query(Keyword).filter(Keyword.is_active == True).all()
                vol_result = google_ads.refresh_volumes(db, [k.keyword for k in active_after])
                logger.info("[ads] volume refresh: %s", vol_result)
            except Exception as e:
                logger.warning("[ads] volume refresh failed: %s", e)

        return {
            "run_id": run.id,
            "attempted": run.keywords_attempted,
            "succeeded": succeeded,
            "failed": failed,
            "status": run.status,
        }
    except Exception as e:
        run.status = "failed"
        run.error = str(e)
        run.finished_at = datetime.utcnow()
        db.commit()
        raise
    finally:
        db.close()
