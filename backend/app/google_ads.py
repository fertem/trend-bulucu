"""Google Ads API entegrasyonu — Keyword Planner üzerinden mutlak arama hacmi.

Kullanılan endpoint:
    POST https://googleads.googleapis.com/{version}/customers/{customer_id}:generateKeywordHistoricalMetrics

OAuth refresh_token + developer_token gerekir. .env'de yoksa fonksiyonlar
RuntimeError fırlatır; çağıran taraf settings.has_google_ads ile kontrol etmeli.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Iterable

import httpx
from sqlalchemy.orm import Session

from .config import settings
from .models import KeywordVolume

logger = logging.getLogger(__name__)

CACHE_TTL_DAYS = 7
TOKEN_URL = "https://oauth2.googleapis.com/token"
_access_token_cache: dict[str, str | datetime] = {"token": "", "expires_at": datetime.utcnow()}


def _refresh_access_token() -> str:
    """OAuth refresh_token'ı kullanarak yeni access_token al."""
    now = datetime.utcnow()
    cached = _access_token_cache.get("token")
    expires_at = _access_token_cache.get("expires_at")
    if cached and isinstance(expires_at, datetime) and expires_at > now:
        return str(cached)

    if not settings.has_google_ads:
        raise RuntimeError("Google Ads ayarları eksik (.env)")

    resp = httpx.post(
        TOKEN_URL,
        data={
            "client_id": settings.google_ads_client_id,
            "client_secret": settings.google_ads_client_secret,
            "refresh_token": settings.google_ads_refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=20.0,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"OAuth refresh başarısız: {resp.status_code} {resp.text}")

    data = resp.json()
    access_token = data["access_token"]
    expires_in = int(data.get("expires_in", 3500))
    _access_token_cache["token"] = access_token
    _access_token_cache["expires_at"] = now + timedelta(seconds=expires_in - 60)
    return access_token


def fetch_keyword_metrics(keywords: list[str]) -> dict[str, dict]:
    """Tek API çağrısı ile birden çok kelime için historical metrics getir."""
    if not keywords:
        return {}

    access_token = _refresh_access_token()

    customer_id = settings.google_ads_customer_id.replace("-", "").strip()
    url = (
        f"https://googleads.googleapis.com/{settings.google_ads_api_version}"
        f"/customers/{customer_id}:generateKeywordHistoricalMetrics"
    )

    headers = {
        "Authorization": f"Bearer {access_token}",
        "developer-token": settings.google_ads_developer_token,
        "Content-Type": "application/json",
    }
    if settings.google_ads_login_customer_id:
        headers["login-customer-id"] = settings.google_ads_login_customer_id.replace("-", "").strip()

    body = {
        "keywords": keywords,
        "language": f"languageConstants/{settings.google_ads_language_id}",
        "geoTargetConstants": [f"geoTargetConstants/{settings.google_ads_geo_target_id}"],
        "keywordPlanNetwork": "GOOGLE_SEARCH",
        "includeAdultKeywords": False,
    }

    try:
        resp = httpx.post(url, headers=headers, json=body, timeout=30.0)
    except httpx.HTTPError as e:
        raise RuntimeError(f"Ads API çağrısı başarısız: {e}")

    if resp.status_code != 200:
        raise RuntimeError(f"Ads API hatası: {resp.status_code} {resp.text[:500]}")

    data = resp.json()
    out: dict[str, dict] = {}

    for r in data.get("results", []):
        text = (r.get("text") or "").lower()
        m = r.get("keywordMetrics") or {}
        if not text or not m:
            continue

        avg = int(m.get("avgMonthlySearches", 0) or 0)
        comp = m.get("competition", "UNSPECIFIED")
        comp_idx = int(m.get("competitionIndex", 0) or 0)
        low_micros = int(m.get("lowTopOfPageBidMicros", 0) or 0)
        high_micros = int(m.get("highTopOfPageBidMicros", 0) or 0)

        # Son 3 ayın ortalaması (mevsimsellik için daha güncel)
        msv = m.get("monthlySearchVolumes") or []
        last_3 = msv[-3:] if msv else []
        last_3_avg = int(
            sum(int(x.get("monthlySearches", 0) or 0) for x in last_3) / len(last_3)
        ) if last_3 else avg

        out[text] = {
            "avg_monthly_searches": avg,
            "competition": comp,
            "competition_index": comp_idx,
            "low_top_of_page_bid": low_micros / 1_000_000.0,
            "high_top_of_page_bid": high_micros / 1_000_000.0,
            "last_3m_avg": last_3_avg,
        }
    return out


def upsert_volume(db: Session, keyword: str, metrics: dict) -> None:
    existing = db.query(KeywordVolume).filter(KeywordVolume.keyword == keyword).one_or_none()
    if existing:
        existing.avg_monthly_searches = metrics["avg_monthly_searches"]
        existing.competition = metrics["competition"]
        existing.competition_index = metrics["competition_index"]
        existing.low_top_of_page_bid = metrics["low_top_of_page_bid"]
        existing.high_top_of_page_bid = metrics["high_top_of_page_bid"]
        existing.last_3m_avg = metrics["last_3m_avg"]
        existing.fetched_at = datetime.utcnow()
    else:
        db.add(KeywordVolume(
            keyword=keyword,
            **metrics,
            fetched_at=datetime.utcnow(),
        ))
    db.commit()


def refresh_volumes(db: Session, keywords: Iterable[str], force: bool = False) -> dict:
    """Eski olanları (>7 gün) Google'dan yeniden çek."""
    if not settings.has_google_ads:
        return {"status": "disabled", "updated": 0}

    cutoff = datetime.utcnow() - timedelta(days=CACHE_TTL_DAYS)

    to_fetch: list[str] = []
    for kw in keywords:
        kw = kw.lower().strip()
        if not kw:
            continue
        existing = db.query(KeywordVolume).filter(KeywordVolume.keyword == kw).one_or_none()
        if force or not existing or existing.fetched_at < cutoff:
            to_fetch.append(kw)

    if not to_fetch:
        return {"status": "fresh", "updated": 0, "skipped": "all cached <7d"}

    # Ads API tek çağrıda 10K'a kadar destekler — bizimki ufak
    try:
        results = fetch_keyword_metrics(to_fetch)
    except Exception as e:
        logger.exception("Ads volume fetch failed: %s", e)
        return {"status": "error", "error": str(e), "updated": 0}

    for kw in to_fetch:
        m = results.get(kw)
        if not m:
            # Google bu kelime için veri döndürmediyse 0 kaydet ki tekrar deneme yapılmasın
            upsert_volume(db, kw, {
                "avg_monthly_searches": 0,
                "competition": "UNSPECIFIED",
                "competition_index": 0,
                "low_top_of_page_bid": 0.0,
                "high_top_of_page_bid": 0.0,
                "last_3m_avg": 0,
            })
        else:
            upsert_volume(db, kw, m)

    return {"status": "ok", "updated": len(to_fetch)}


def get_volumes_dict(db: Session) -> dict[str, dict]:
    """Tüm cache'i sözlük olarak döner."""
    rows = db.query(KeywordVolume).all()
    return {
        r.keyword: {
            "avg_monthly_searches": r.avg_monthly_searches,
            "last_3m_avg": r.last_3m_avg,
            "competition": r.competition,
            "competition_index": r.competition_index,
            "low_bid": r.low_top_of_page_bid,
            "high_bid": r.high_top_of_page_bid,
            "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None,
        }
        for r in rows
    }
