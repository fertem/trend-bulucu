"""Apify Google Trends Scraper adapter — pytrends'in modern alternatifi.

Apify proxy havuzunu + bot-detection bypass'ı kendi içinde halleder.
Aynı fonksiyon imzalarını sunar (fetch_keyword), pytrends ile drop-in
değişim olarak kullanılabilir.

Pricing: $0.09 / 1000 sonuç, aylık $5 ücretsiz kredi → 41 keyword günlük
toplama ~$0.10/ay = $5'lik krediden bedavaya çalışır.

Actor: apify/google-trends-scraper
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

import pandas as pd

from .config import settings

logger = logging.getLogger(__name__)

ACTOR_ID = "apify/google-trends-scraper"


def is_available() -> bool:
    return bool(settings.apify_api_token)


def _client():
    """Lazy import — apify_client opsiyonel paket."""
    if not is_available():
        raise RuntimeError("APIFY_API_TOKEN tanımlı değil")
    from apify_client import ApifyClient
    return ApifyClient(settings.apify_api_token)


def _timeframe_to_apify(timeframe: str) -> str:
    """Pytrends timeframe → Apify 'timeRange' parametresi.

    Pytrends: 'today 1-m', 'today 5-y', 'today 12-m'
    Apify accepts: 'today 1-m', 'today 12-m', 'today 5-y', 'now 7-d', etc.
    Aynı format, doğrudan geçer.
    """
    return timeframe or "today 1-m"


def fetch_keyword(_client_unused, keyword: str) -> dict:
    """Tek kelime için interest_over_time + related_queries.

    Çıktı pytrends.fetch_keyword ile AYNI şekilde:
        {
          "interest_over_time": pd.DataFrame (date index, keyword sütunu),
          "related_queries": {keyword: {"top": df, "rising": df}}
        }

    NOT: İlk parametre pytrends client'ı (bizim `_new_client()` döndürüsü).
    Apify client'ını kendi içimizde kuruyoruz, bu parametre kullanılmıyor —
    pytrends ile drop-in uyumluluk için imza korundu.
    """
    client = _client()

    geo = settings.pytrends_geo or "TR"
    timeframe = _timeframe_to_apify(settings.pytrends_timeframe)

    run_input = {
        "searchTerms": [keyword],
        "geo": geo,
        "timeRange": timeframe,
        # Boş = "All categories" (Apify için "0" yerine "" kullan)
        "category": "",
        "language": (settings.pytrends_hl or "tr-TR").split("-")[0],
    }

    logger.info("[apify] fetch '%s' geo=%s timeframe=%s", keyword, geo, timeframe)
    actor = client.actor(ACTOR_ID)
    run = actor.call(run_input=run_input, wait_secs=180)
    if not run or run.get("status") != "SUCCEEDED":
        raise RuntimeError(f"Apify run failed: status={run.get('status') if run else 'no-run'}")

    dataset_id = run.get("defaultDatasetId")
    if not dataset_id:
        raise RuntimeError("Apify run succeeded but no dataset returned")

    items = list(client.dataset(dataset_id).iterate_items())
    if not items:
        logger.warning("[apify] no items for '%s'", keyword)
        return {"interest_over_time": pd.DataFrame(), "related_queries": {}}

    item = items[0]

    # 1) interest_over_time → DataFrame
    timeline = item.get("interestOverTime_timelineData") or []
    iot_rows = []
    for point in timeline:
        ts = point.get("time")
        val = point.get("value", [0])
        if not ts:
            continue
        try:
            d = datetime.utcfromtimestamp(int(ts))
        except (ValueError, TypeError):
            continue
        v = val[0] if isinstance(val, list) and val else 0
        iot_rows.append({"date": d, keyword: float(v), "isPartial": False})

    iot_df = pd.DataFrame(iot_rows)
    if not iot_df.empty:
        iot_df = iot_df.set_index("date")

    # 2) related_queries → pytrends-shape dict
    top_rows = item.get("relatedQueries_top") or []
    rising_rows = item.get("relatedQueries_rising") or []

    top_df = (
        pd.DataFrame([{"query": r.get("query"), "value": r.get("value", 0)} for r in top_rows])
        if top_rows else pd.DataFrame(columns=["query", "value"])
    )
    rising_df = (
        pd.DataFrame([{"query": r.get("query"), "value": r.get("value", 0)} for r in rising_rows])
        if rising_rows else pd.DataFrame(columns=["query", "value"])
    )

    related = {keyword: {"top": top_df, "rising": rising_df}}

    # 3) related_topics → pytrends'te yok, Apify'ın bonus'u
    # "python" arandığında "Programming language" gibi geniş konular döner.
    # İçerik fırsatları için altın değerinde.
    topics_top = item.get("relatedTopics_top") or []
    topics_rising = item.get("relatedTopics_rising") or []
    related_topics = {
        "top": [
            {
                "title": r.get("title") or r.get("topic_title"),
                "type": r.get("type") or r.get("topic_type"),
                "value": r.get("value", 0),
            }
            for r in topics_top
        ],
        "rising": [
            {
                "title": r.get("title") or r.get("topic_title"),
                "type": r.get("type") or r.get("topic_type"),
                "value": r.get("value", 0),
            }
            for r in topics_rising
        ],
    }

    # 4) Coğrafi dağılım: Türkiye'de hangi ilde/bölgede daha çok aratılıyor?
    interest_by_region = []
    for region_field in ("interestBySubregion", "interestByRegion", "interestByCity"):
        rows = item.get(region_field) or []
        for r in rows:
            val = r.get("value", [0])
            v = val[0] if isinstance(val, list) and val else 0
            interest_by_region.append({
                "geo_code": r.get("geoCode"),
                "geo_name": r.get("geoName"),
                "value": v,
                "level": region_field.replace("interestBy", "").lower(),
            })

    logger.info(
        "[apify] '%s' OK: %d timeseries, %d top-q, %d rising-q, %d top-topics, %d regions",
        keyword, len(iot_df), len(top_df), len(rising_df),
        len(related_topics["top"]), len(interest_by_region),
    )

    return {
        "interest_over_time": iot_df,
        "related_queries": related,
        # Bonus zenginlikler — pytrends'te yok:
        "related_topics": related_topics,
        "interest_by_region": interest_by_region,
    }


def test_connection() -> dict:
    """API token'ı doğrula — minimal bir actor info çağrısı."""
    if not is_available():
        return {"ok": False, "message": "APIFY_API_TOKEN tanımlı değil"}
    try:
        client = _client()
        # User info - en hafif endpoint
        user = client.user().get()
        return {
            "ok": True,
            "message": f"✓ Apify bağlı: {user.get('username')} ({user.get('email')})",
            "plan": user.get("plan"),
            "credits_remaining": user.get("plan", {}).get("freePlanCreditsLeft"),
        }
    except Exception as e:
        return {"ok": False, "message": "Apify test başarısız", "detail": str(e)[:200]}
