"""Pytrends tabanlı veri toplayıcı.

Rate limit dostu: kelimeler arası gecikme + exponential backoff + tek başarısızlıkta atla.
"""
from __future__ import annotations

import logging
import random
import time
from datetime import datetime, timedelta
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


# How long to refuse new collection runs after a Google rate-limit block
RATE_LIMIT_COOLDOWN = timedelta(hours=1)


class RateLimitError(Exception):
    """Google has blocked our IP — /sorry/ redirect or repeated 429."""

    def __init__(self, message: str = "Google rate limit (429) — IP geçici bloklu"):
        super().__init__(message)


def _is_rate_limit(exc: Exception) -> bool:
    """Detect Google's /sorry/ redirect or 'too many 429' response."""
    msg = str(exc).lower()
    return (
        "/sorry/" in msg
        or "too many 429" in msg
        or "429" in msg and "google.com" in msg
    )


def get_cooldown_status() -> dict:
    """Check if THE most recent run was rate-limited within RATE_LIMIT_COOLDOWN.

    Bug fix: önceden 'en son rate_limited run' aranıyordu — eğer o run'dan
    sonra başarılı bir run yapıldıysa bile cooldown aktif görünüyordu.
    Şimdi: en son run'a bak, rate-limit'liyse VE cooldown süresi içindeyse blokla.
    """
    db = SessionLocal()
    try:
        last = (
            db.query(CollectionRun)
            .order_by(CollectionRun.id.desc())
            .first()
        )
        if not last:
            return {"blocked": False}
        # Sadece son run rate_limited statüsünde ise (failed bile yetmez)
        if last.status != "rate_limited":
            return {"blocked": False}
        ended = last.finished_at or last.started_at
        if not ended:
            return {"blocked": False}
        if isinstance(ended, str):
            ended = datetime.fromisoformat(ended)
        elapsed = datetime.utcnow() - ended
        if elapsed >= RATE_LIMIT_COOLDOWN:
            return {"blocked": False}
        remaining = RATE_LIMIT_COOLDOWN - elapsed
        return {
            "blocked": True,
            "blocked_at": ended.isoformat(),
            "remaining_seconds": int(remaining.total_seconds()),
            "retry_at": (ended + RATE_LIMIT_COOLDOWN).isoformat(),
        }
    finally:
        db.close()


# Browser-like User-Agent — pytrends'in default'u sadece accept-language
# gönderiyor, Google bunu bot olarak algılayıp 429 yapıyordu.
_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Dest": "document",
}


def _warm_up_cookies() -> dict[str, str]:
    """trends.google.com homepage'i ziyaret edip NID cookie al.

    Pytrends 4.9.2 doğrudan API'ye gidiyor, browser warm-up yapmıyor.
    Google bunu bot olarak algılayıp her isteğe 429 dönüyor. Önce homepage'i
    ziyaret ederek gerçek bir kullanıcı oturumu başlatıyoruz, sonra elde
    ettiğimiz NID cookie'yi pytrends session'ına enjekte ediyoruz.
    """
    import httpx
    geo = settings.pytrends_geo or "TR"
    hl = (settings.pytrends_hl or "tr-TR").split("-")[0]
    try:
        with httpx.Client(headers=_BROWSER_HEADERS, timeout=10.0, follow_redirects=True) as client:
            r = client.get(f"https://trends.google.com/?geo={geo}&hl={hl}")
            if r.status_code != 200:
                logger.warning("[warm-up] homepage status %d — cookie alamadık", r.status_code)
                return {}
            cookies = {k: v for k, v in client.cookies.items()}
            logger.info("[warm-up] cookies: %s", list(cookies.keys()))
            return cookies
    except Exception as e:
        logger.warning("[warm-up] başarısız: %s", e)
        return {}


def _new_client() -> TrendReq:
    """Pytrends client + browser-like UA + warm-up cookies (NID).

    Önce trends.google.com homepage'i ziyaret edip NID cookie alıyoruz,
    sonra pytrends client'ı bu cookie'lerle başlatıyoruz. Bu olmadan
    Google direkt 429 dönüyor.
    """
    cookies = _warm_up_cookies()
    client = TrendReq(
        hl=settings.pytrends_hl,
        tz=180,  # Turkey is UTC+3 (180 minutes)
        timeout=(10, 30),
        retries=2,
        backoff_factor=0.5,
        requests_args={"headers": _BROWSER_HEADERS},
    )
    # NID cookie'yi pytrends'in session'ına enjekte et
    if cookies:
        try:
            client.cookies = cookies
        except Exception as e:
            logger.warning("[warm-up] cookie enjekte hatası: %s", e)
    return client


def ensure_seed_keywords(db: Session) -> None:
    for kw in SEED_KEYWORDS:
        existing = db.query(Keyword).filter(Keyword.keyword == kw).one_or_none()
        if not existing:
            db.add(Keyword(keyword=kw, category=_app_settings.categorize_keyword(db, kw), is_seed=True, is_active=True))
    db.commit()


def _backoff_call(fn, *args, **kwargs):
    """Exponential backoff: 4s → 8s → 16s, max_retries times.

    If the error is Google's /sorry/ rate-limit page we ABORT immediately
    (no point retrying — the IP is blocked).
    """
    last_err: Exception | None = None
    for attempt in range(settings.max_retries):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            last_err = e
            if _is_rate_limit(e):
                logger.error("pytrends RATE-LIMITED (attempt %d): aborting — %s", attempt + 1, str(e)[:200])
                raise RateLimitError() from e
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
    # Pre-flight: respect cooldown if we were recently rate-limited
    cd = get_cooldown_status()
    if cd.get("blocked"):
        logger.warning("collect_all aborted — rate-limit cooldown (%ds remaining)", cd.get("remaining_seconds"))
        return {
            "status": "rate_limited",
            "error": "Google IP geçici bloklu — cooldown sürüyor",
            "retry_at": cd.get("retry_at"),
            "remaining_seconds": cd.get("remaining_seconds"),
        }

    db: Session = SessionLocal()
    run = CollectionRun(started_at=datetime.utcnow(), status="running")
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
        rate_limited = False

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
            except RateLimitError as e:
                # IP blocked — abort the whole run immediately. No point hammering.
                rate_limited = True
                logger.error("[%d/%d] RATE LIMIT: aborting collection", idx + 1, len(keywords))
                run.error = "Google rate limit (429) — IP geçici bloklu, ~1 saat bekleyin"
                break
            except Exception as e:
                failed += 1
                logger.error("[%d/%d] FAIL: %s — %s", idx + 1, len(keywords), kw, e)

            # Live progress update — UI sees current succeeded/failed counts
            run.keywords_succeeded = succeeded
            run.keywords_failed = failed
            db.commit()

            if idx < len(keywords) - 1:
                # Jittered delay so requests look less robotic
                base = max(2, settings.request_delay_seconds)
                jitter = random.uniform(0, base * 0.5)
                time.sleep(base + jitter)

        run.keywords_succeeded = succeeded
        run.keywords_failed = failed
        run.finished_at = datetime.utcnow()
        if rate_limited:
            run.status = "rate_limited"
        elif failed == 0 and succeeded > 0:
            run.status = "success"
        elif succeeded > 0:
            run.status = "partial"
        else:
            run.status = "failed"
            if not run.error:
                run.error = "Hiçbir kelime için veri çekilemedi"
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
