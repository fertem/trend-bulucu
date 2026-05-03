"""Google Search Console API entegrasyonu.

Endpoint: https://searchconsole.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query
Auth: OAuth refresh_token (Ads ile aynı flow, webmasters.readonly scope dahil).

Önemli: refresh_token Ads ile paylaşılıyor — kullanıcının setup_google_ads.py'yi
yeni scope'larla yeniden çalıştırması gerekti.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from urllib.parse import quote

import httpx
from sqlalchemy.orm import Session

from .config import settings
from .models import SearchConsoleQuery, SearchConsoleSync

logger = logging.getLogger(__name__)

TOKEN_URL = "https://oauth2.googleapis.com/token"
SC_BASE = "https://searchconsole.googleapis.com/webmasters/v3"

_token_cache: dict[str, str | datetime] = {"token": "", "expires_at": datetime.utcnow()}


def _refresh_access_token() -> str:
    """Cached access token (Ads ile aynı OAuth — refresh_token webmasters scope'unu da içermeli)."""
    now = datetime.utcnow()
    if _token_cache.get("token") and isinstance(_token_cache.get("expires_at"), datetime):
        if _token_cache["expires_at"] > now:
            return str(_token_cache["token"])

    if not (settings.google_ads_client_id and settings.google_ads_client_secret and settings.google_ads_refresh_token):
        raise RuntimeError("OAuth ayarları eksik (.env)")

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
    _token_cache["token"] = data["access_token"]
    _token_cache["expires_at"] = now + timedelta(seconds=int(data.get("expires_in", 3500)) - 60)
    return data["access_token"]


def list_sites() -> list[dict]:
    """Kullanıcının doğrulanmış sitelerini listele."""
    token = _refresh_access_token()
    resp = httpx.get(
        f"{SC_BASE}/sites",
        headers={"Authorization": f"Bearer {token}"},
        timeout=20.0,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Site listesi alınamadı: {resp.status_code} {resp.text[:300]}")
    data = resp.json()
    return [
        {"url": s.get("siteUrl"), "permission": s.get("permissionLevel")}
        for s in data.get("siteEntry", [])
    ]


def query_search_analytics(
    start_date: str,
    end_date: str,
    dimensions: list[str] | None = None,
    row_limit: int = 1000,
) -> list[dict]:
    """SC searchAnalytics.query — sorgu/sayfa/tarih boyutlarıyla."""
    if not settings.search_console_site_url:
        raise RuntimeError("SEARCH_CONSOLE_SITE_URL .env'de tanımlı değil")

    token = _refresh_access_token()
    site = quote(settings.search_console_site_url, safe="")
    url = f"{SC_BASE}/sites/{site}/searchAnalytics/query"

    body = {
        "startDate": start_date,
        "endDate": end_date,
        "dimensions": dimensions or ["query"],
        "rowLimit": row_limit,
    }
    resp = httpx.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=body,
        timeout=30.0,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"SC sorgu başarısız: {resp.status_code} {resp.text[:300]}")

    rows = resp.json().get("rows", [])
    return rows


def sync_recent(db: Session, days: int = 28) -> dict:
    """Son N günü çek + history tablosunu güncelle."""
    if not settings.search_console_site_url:
        return {"status": "disabled", "message": "SEARCH_CONSOLE_SITE_URL boş"}

    run = SearchConsoleSync(started_at=datetime.utcnow(), period_days=days)
    db.add(run)
    db.commit()
    db.refresh(run)

    today = date.today()
    end = today - timedelta(days=2)  # SC verisinde 1-2 gün gecikme var
    start = end - timedelta(days=days - 1)

    # Önceki dönem (karşılaştırma için)
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=days - 1)

    try:
        # Bu dönem (sorgu+sayfa boyutuyla)
        cur_rows = query_search_analytics(
            start.isoformat(), end.isoformat(),
            dimensions=["query", "page"],
            row_limit=1000,
        )
        # Önceki dönem (sadece sorgu — karşılaştırma için aggregate)
        prev_rows = query_search_analytics(
            prev_start.isoformat(), prev_end.isoformat(),
            dimensions=["query"],
            row_limit=1000,
        )
        prev_by_query: dict[str, dict] = {
            r["keys"][0]: {
                "clicks": int(r.get("clicks") or 0),
                "impressions": int(r.get("impressions") or 0),
                "position": float(r.get("position") or 0),
            }
            for r in prev_rows
        }

        now = datetime.utcnow()
        # Eski dönemi temizle (aynı period için, hep son snapshot kullansın)
        db.query(SearchConsoleQuery).filter(
            SearchConsoleQuery.period_days == days
        ).delete(synchronize_session=False)
        db.commit()

        imported = 0
        for r in cur_rows:
            keys = r.get("keys", [])
            q = keys[0] if len(keys) > 0 else ""
            p = keys[1] if len(keys) > 1 else None
            if not q:
                continue
            prev = prev_by_query.get(q)
            db.add(SearchConsoleQuery(
                query=q,
                page=p,
                period_days=days,
                fetched_at=now,
                clicks=int(r.get("clicks") or 0),
                impressions=int(r.get("impressions") or 0),
                ctr=float(r.get("ctr") or 0),
                position=float(r.get("position") or 0),
                prev_clicks=prev["clicks"] if prev else None,
                prev_impressions=prev["impressions"] if prev else None,
                prev_position=prev["position"] if prev else None,
            ))
            imported += 1

        db.commit()
        run.rows_imported = imported
        run.finished_at = datetime.utcnow()
        run.status = "success"
        db.commit()

        return {"status": "ok", "imported": imported, "period_start": start.isoformat(), "period_end": end.isoformat()}
    except Exception as e:
        run.status = "failed"
        run.error = str(e)
        run.finished_at = datetime.utcnow()
        db.commit()
        logger.exception("[sc] sync failed: %s", e)
        return {"status": "error", "error": str(e)}


# ─── Analytics ─────────────────────────────────────────────────────────────

def has_data(db: Session) -> bool:
    return db.query(SearchConsoleQuery).first() is not None


def top_queries(db: Session, limit: int = 25) -> list[dict]:
    rows = (
        db.query(SearchConsoleQuery)
        .filter(SearchConsoleQuery.period_days == 28)
        .order_by(SearchConsoleQuery.clicks.desc())
        .limit(limit)
        .all()
    )
    return [_row_dict(r) for r in rows]


def opportunities(db: Session, limit: int = 25) -> list[dict]:
    """Yüksek impression + düşük CTR (başlık iyileştirme fırsatı)."""
    rows = (
        db.query(SearchConsoleQuery)
        .filter(SearchConsoleQuery.period_days == 28)
        .filter(SearchConsoleQuery.impressions >= 50)  # gürültü filtresi
        .all()
    )
    out = []
    for r in rows:
        # Beklenen CTR pozisyona göre (kabaca: 1=30%, 5=8%, 10=3%, 20=1%)
        expected_ctr = max(0.005, 0.30 / (r.position ** 1.2)) if r.position > 0 else 0
        ctr_gap = expected_ctr - r.ctr
        if ctr_gap > 0.02:  # %2'den fazla gap
            d = _row_dict(r)
            d["expected_ctr"] = round(expected_ctr, 4)
            d["ctr_gap"] = round(ctr_gap, 4)
            d["potential_clicks"] = int(r.impressions * ctr_gap)
            out.append(d)
    out.sort(key=lambda x: x["potential_clicks"], reverse=True)
    return out[:limit]


def page2_keywords(db: Session, limit: int = 25) -> list[dict]:
    """Pozisyon 11-20 arası — küçük itmeyle ilk sayfaya çıkabilecekler."""
    rows = (
        db.query(SearchConsoleQuery)
        .filter(SearchConsoleQuery.period_days == 28)
        .filter(SearchConsoleQuery.position >= 11, SearchConsoleQuery.position <= 20)
        .filter(SearchConsoleQuery.impressions >= 20)
        .order_by(SearchConsoleQuery.impressions.desc())
        .limit(limit)
        .all()
    )
    return [_row_dict(r) for r in rows]


def movers(db: Session, min_impressions: int = 30, limit: int = 25) -> list[dict]:
    """Pozisyon değişimi (önceki dönemle karşılaştırma)."""
    rows = (
        db.query(SearchConsoleQuery)
        .filter(SearchConsoleQuery.period_days == 28)
        .filter(SearchConsoleQuery.prev_position.isnot(None))
        .filter(SearchConsoleQuery.impressions >= min_impressions)
        .all()
    )
    out = []
    for r in rows:
        # Pozisyonda azalma = iyi (1 daha iyi 5'ten)
        delta = (r.prev_position or 0) - r.position
        if abs(delta) < 0.5:
            continue
        d = _row_dict(r)
        d["position_delta"] = round(delta, 1)
        d["direction"] = "up" if delta > 0 else "down"
        out.append(d)
    out.sort(key=lambda x: abs(x["position_delta"]), reverse=True)
    return out[:limit]


def keyword_for_query(db: Session, query: str) -> dict | None:
    """Bir takip kelimesinin SC verisinde hangi pozisyonda olduğunu bul."""
    q = (query or "").lower().strip()
    if not q:
        return None
    row = (
        db.query(SearchConsoleQuery)
        .filter(SearchConsoleQuery.period_days == 28)
        .filter(SearchConsoleQuery.query == q)
        .order_by(SearchConsoleQuery.clicks.desc())
        .first()
    )
    if not row:
        return None
    return _row_dict(row)


def _row_dict(r: SearchConsoleQuery) -> dict:
    return {
        "query": r.query,
        "page": r.page,
        "clicks": r.clicks,
        "impressions": r.impressions,
        "ctr": round(r.ctr, 4),
        "position": round(r.position, 1),
        "prev_clicks": r.prev_clicks,
        "prev_impressions": r.prev_impressions,
        "prev_position": round(r.prev_position, 1) if r.prev_position is not None else None,
    }


def status_dict(db: Session) -> dict:
    last_sync = (
        db.query(SearchConsoleSync)
        .order_by(SearchConsoleSync.started_at.desc())
        .first()
    )
    return {
        "site_configured": bool(settings.search_console_site_url),
        "site_url": settings.search_console_site_url,
        "row_count": db.query(SearchConsoleQuery).count(),
        "last_sync_at": last_sync.started_at.isoformat() if last_sync and last_sync.started_at else None,
        "last_sync_status": last_sync.status if last_sync else None,
        "last_sync_imported": last_sync.rows_imported if last_sync else 0,
    }
