"""SerpAPI Google Trends adapter — pytrends'in modern, güvenilir alternatifi.

SerpAPI:
- Resmi API + paid proxy backend (rate-limit'siz)
- Free tier: 250 sorgu/ay
- Pricing: $50/ay → 5K sorgu (büyürken)
- https://serpapi.com/google-trends-api

NOT: SerpAPI'da bir keyword için TIMESERIES + RELATED_QUERIES ayrı
sorgular sayılır (data_type parametresi farklı). Free tier'ı verimli
kullanmak için sadece TIMESERIES çekiyoruz; related queries ihtiyaç
olursa ayrı çağrı.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

import pandas as pd

from .config import settings

logger = logging.getLogger(__name__)


def is_available() -> bool:
    return bool(settings.serpapi_key)


def _timeframe_to_serpapi(tf: str) -> str:
    """Pytrends timeframe → SerpAPI 'date' parametresi.

    Pytrends ve SerpAPI aynı format'ı kullanıyor: 'today 1-m', 'today 5-y'.
    """
    return tf or "today 1-m"


def fetch_keyword(_client_unused, keyword: str, *, fetch_related: bool = True) -> dict:
    """Tek kelime için interest_over_time (+ opsiyonel related_queries).

    Aynı çıktı şekli (pytrends ile drop-in uyumlu):
        {"interest_over_time": pd.DataFrame, "related_queries": {kw: {"top": df, "rising": df}}}

    fetch_related=False → sadece TIMESERIES çağrısı (1 sorgu, free tier dostu).
    fetch_related=True  → +1 RELATED_QUERIES çağrısı (2 sorgu/keyword).
    """
    from serpapi import GoogleSearch

    if not is_available():
        raise RuntimeError("SERPAPI_KEY tanımlı değil")

    geo = settings.pytrends_geo or "TR"
    date_range = _timeframe_to_serpapi(settings.pytrends_timeframe)

    # 1) Timeseries
    params = {
        "engine": "google_trends",
        "q": keyword,
        "geo": geo,
        "date": date_range,
        "data_type": "TIMESERIES",
        "api_key": settings.serpapi_key,
    }
    logger.info("[serpapi] TIMESERIES '%s' geo=%s date=%s", keyword, geo, date_range)
    search = GoogleSearch(params)
    res = search.get_dict()

    if res.get("error"):
        raise RuntimeError(f"SerpAPI hata: {res['error']}")

    timeline = (res.get("interest_over_time") or {}).get("timeline_data") or []
    iot_rows = []
    for point in timeline:
        ts = point.get("timestamp")
        if not ts:
            continue
        try:
            d = datetime.utcfromtimestamp(int(ts))
        except (ValueError, TypeError):
            continue
        values = point.get("values") or []
        v = values[0].get("extracted_value", 0) if values else 0
        iot_rows.append({"date": d, keyword: float(v), "isPartial": False})

    iot_df = pd.DataFrame(iot_rows)
    if not iot_df.empty:
        iot_df = iot_df.set_index("date")

    related = {keyword: {"top": pd.DataFrame(columns=["query", "value"]),
                         "rising": pd.DataFrame(columns=["query", "value"])}}
    related_topics = {"top": [], "rising": []}

    if fetch_related:
        # 2) Related queries
        try:
            params_q = {**params, "data_type": "RELATED_QUERIES"}
            rq_res = GoogleSearch(params_q).get_dict()
            if not rq_res.get("error"):
                rq = rq_res.get("related_queries") or {}
                top = rq.get("top") or []
                rising = rq.get("rising") or []
                top_df = pd.DataFrame(
                    [{"query": r.get("query"), "value": r.get("extracted_value", 0)} for r in top]
                ) if top else pd.DataFrame(columns=["query", "value"])
                rising_df = pd.DataFrame(
                    [{"query": r.get("query"), "value": r.get("extracted_value", 0)} for r in rising]
                ) if rising else pd.DataFrame(columns=["query", "value"])
                related = {keyword: {"top": top_df, "rising": rising_df}}
        except Exception as e:
            logger.warning("[serpapi] related_queries failed for '%s': %s", keyword, e)

        # 3) Related topics (bonus, pytrends'te yok)
        try:
            params_t = {**params, "data_type": "RELATED_TOPICS"}
            rt_res = GoogleSearch(params_t).get_dict()
            if not rt_res.get("error"):
                rt = rt_res.get("related_topics") or {}
                related_topics = {
                    "top": [
                        {"title": t.get("topic", {}).get("title"),
                         "type": t.get("topic", {}).get("type"),
                         "value": t.get("extracted_value", 0)}
                        for t in (rt.get("top") or [])
                    ],
                    "rising": [
                        {"title": t.get("topic", {}).get("title"),
                         "type": t.get("topic", {}).get("type"),
                         "value": t.get("extracted_value", 0)}
                        for t in (rt.get("rising") or [])
                    ],
                }
        except Exception as e:
            logger.warning("[serpapi] related_topics failed for '%s': %s", keyword, e)

    logger.info(
        "[serpapi] '%s' OK: %d timeseries, %d top, %d rising",
        keyword, len(iot_df),
        len(related[keyword]["top"]),
        len(related[keyword]["rising"]),
    )

    return {
        "interest_over_time": iot_df,
        "related_queries": related,
        "related_topics": related_topics,
    }


def test_connection() -> dict:
    """Kotayı kontrol et — minimal bir TIMESERIES sorgusuyla."""
    if not is_available():
        return {"ok": False, "message": "SERPAPI_KEY tanımlı değil"}
    try:
        from serpapi import GoogleSearch
        # Account info endpoint — sorgu sayılmıyor
        params = {"api_key": settings.serpapi_key}
        # SerpAPI'de account endpoint farklı — direct HTTP kullan
        import httpx
        r = httpx.get(
            "https://serpapi.com/account",
            params={"api_key": settings.serpapi_key},
            timeout=10.0,
        )
        if r.status_code != 200:
            return {"ok": False, "message": f"SerpAPI auth başarısız: HTTP {r.status_code}"}
        d = r.json()
        plan = d.get("plan_name") or "unknown"
        used = d.get("this_month_usage") or d.get("searches_per_month_used") or 0
        limit = d.get("plan_searches_left") or 0
        total = d.get("searches_per_month") or 250
        return {
            "ok": True,
            "message": f"✓ SerpAPI bağlı: {plan} planı",
            "plan": plan,
            "used_this_month": used,
            "remaining": limit,
            "total_per_month": total,
        }
    except Exception as e:
        return {"ok": False, "message": "SerpAPI test başarısız", "detail": str(e)[:200]}
