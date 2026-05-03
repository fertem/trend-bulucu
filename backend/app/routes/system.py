"""Sistem durum/tazelik endpoint'i — tüm veri kaynaklarının son güncelleme tarihi."""
import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import require_admin
from ..db import SessionLocal, get_db
from ..models import (
    CollectionRun,
    HistoricalRun,
    KeywordVolume,
    SearchConsoleSync,
    SiteContent,
    TrendScore,
    ContentGapHistory,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/system", tags=["system"], dependencies=[Depends(require_admin)])


def _full_refresh():
    """Daily scheduler ile aynı pipeline — manuel tetikleme için."""
    from .. import collector, analytics, search_console, site_coverage

    logger.info("[refresh-all] starting...")
    try:
        result = collector.collect_all()
        logger.info("[refresh-all] pytrends: %s", result)
    except Exception as e:
        logger.exception("[refresh-all] pytrends failed: %s", e)

    db = SessionLocal()
    try:
        n = analytics.recompute_all_scores(db)
        logger.info("[refresh-all] recomputed %d scores", n)
    except Exception as e:
        logger.warning("[refresh-all] score recompute failed: %s", e)
    finally:
        db.close()

    db = SessionLocal()
    try:
        gap = site_coverage.update_gap_history(db)
        logger.info("[refresh-all] gaps: %s", gap)
    except Exception as e:
        logger.warning("[refresh-all] gap refresh failed: %s", e)
    finally:
        db.close()

    db = SessionLocal()
    try:
        sc = search_console.sync_recent(db, days=28)
        logger.info("[refresh-all] sc: %s", sc)
    except Exception as e:
        logger.warning("[refresh-all] sc sync failed: %s", e)
    finally:
        db.close()

    logger.info("[refresh-all] done")


@router.get("/setup-status")
def setup_status(db: Annotated[Session, Depends(get_db)]):
    """Kurulum kontrol listesinin durumu — her adım için done/pending."""
    from .. import app_settings as _app_settings
    from ..config import settings as env_settings
    from ..models import Keyword, SearchConsoleQuery
    from .. import search_console

    # 1. Marka bilgileri
    brand_name = _app_settings.get(db, "brand_name")
    brand_desc = _app_settings.get(db, "brand_description")
    brand_done = bool(brand_name and brand_desc)

    # 2. AI anahtarı
    ai_done = bool(env_settings.anthropic_api_key or env_settings.openai_api_key)

    # 3. Tohum kelimeler (en az 5)
    keyword_count = db.query(Keyword).filter(Keyword.is_active == True).count()
    keywords_done = keyword_count >= 5

    # 4. Kategoriler (en az 3)
    cat_count = len(_app_settings.list_categories(db))
    categories_done = cat_count >= 3

    # 5. İlk veri çekimi
    last_run = (
        db.query(CollectionRun)
        .filter(CollectionRun.status.in_(["success", "partial"]))
        .first()
    )
    first_collection_done = last_run is not None

    # 6. Site yolu (opsiyonel ama önerilen)
    site_path = _app_settings.get(db, "site_path") or env_settings.kod_org_path
    site_path_done = bool(site_path) and len(site_path) > 0

    # 7. Site taraması
    site_scanned_done = db.query(SiteContent).count() > 0

    # 8. Search Console (opsiyonel)
    gsc_configured = bool(env_settings.search_console_site_url)
    gsc_synced = search_console.has_data(db)

    # 9. Google Ads (opsiyonel)
    ads_done = env_settings.has_google_ads

    steps = [
        {
            "id": "brand",
            "title": "Marka bilgilerini gir",
            "description": "AI'nın senin bağlamına özel öneriler vermesi için",
            "done": brand_done,
            "required": True,
            "action_url": "/settings",
            "action_label": "Ayarlar → Marka",
        },
        {
            "id": "ai",
            "title": "AI anahtarı ekle (OpenAI veya Anthropic)",
            "description": "AI özetleri, içerik üretimi, kelime önerileri için",
            "done": ai_done,
            "required": True,
            "action_url": "/settings",
            "action_label": "Ayarlar → API",
        },
        {
            "id": "categories",
            "title": "Kategorileri tanımla",
            "description": "Kelime gruplaması için (en az 3)",
            "done": categories_done,
            "required": True,
            "action_url": "/settings",
            "action_label": "Ayarlar → Kategori",
            "current_count": cat_count,
            "target_count": 3,
        },
        {
            "id": "keywords",
            "title": "Tohum kelimeler ekle",
            "description": "Takip edilecek arama terimleri (en az 5)",
            "done": keywords_done,
            "required": True,
            "action_url": "/admin",
            "action_label": "Yönetim → AI Öneri",
            "current_count": keyword_count,
            "target_count": 5,
        },
        {
            "id": "first_collection",
            "title": "İlk veri çekimini yap",
            "description": "Pytrends'ten son 30 gün verisi çek",
            "done": first_collection_done,
            "required": True,
            "action_url": "/",
            "action_label": "Genel Bakış → Tümünü Güncelle",
        },
        {
            "id": "site_path",
            "title": "Site yolunu belirle",
            "description": "İçerik boşluğu analizi için sitenin lokal kaynak kodu klasörü",
            "done": site_path_done,
            "required": False,
            "action_url": "/settings",
            "action_label": "Ayarlar → Site",
        },
        {
            "id": "site_scan",
            "title": "Siteni tara",
            "description": "Mevcut sayfaları çıkar (içerik boşluğu için)",
            "done": site_scanned_done,
            "required": False,
            "action_url": "/",
            "action_label": "Genel Bakış → İçerik Boşluğu → Siteyi Tara",
            "depends_on": "site_path",
        },
        {
            "id": "gsc",
            "title": "Search Console bağla",
            "description": "Gerçek pozisyon, CTR, tıklama verisi (ücretsiz, ~30 dk)",
            "done": gsc_configured and gsc_synced,
            "required": False,
            "action_url": "/",
            "action_label": "Genel Bakış → Search Console kartı",
            "doc_link": "/docs/INTEGRATIONS.md#google-search-console",
        },
        {
            "id": "ads",
            "title": "Google Ads Keyword Planner bağla",
            "description": "Gerçek aylık arama hacmi (ücretsiz, ~1-2 gün onay)",
            "done": ads_done,
            "required": False,
            "action_url": "/settings",
            "action_label": "Ayarlar → API",
            "doc_link": "/docs/INTEGRATIONS.md#google-ads-keyword-planner",
        },
    ]

    required_total = sum(1 for s in steps if s["required"])
    required_done = sum(1 for s in steps if s["required"] and s["done"])
    optional_total = sum(1 for s in steps if not s["required"])
    optional_done = sum(1 for s in steps if not s["required"] and s["done"])

    return {
        "steps": steps,
        "required_done": required_done,
        "required_total": required_total,
        "optional_done": optional_done,
        "optional_total": optional_total,
        "fully_setup": required_done == required_total,
    }


@router.post("/refresh-all")
def refresh_all(bg: BackgroundTasks):
    """Tüm veri kaynaklarını tek seferde yenile (Pytrends + skor + gap + GSC)."""
    bg.add_task(_full_refresh)
    return {
        "status": "queued",
        "message": "Tüm veri kaynakları arka planda yenileniyor. ~5-10 dakika sürer. "
                   "İlerlemeyi tazelik barından izleyebilirsin.",
    }


def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


@router.get("/freshness")
def freshness(db: Annotated[Session, Depends(get_db)]):
    """Tüm veri kaynaklarının son güncelleme zamanlarını döndürür."""

    last_collect = (
        db.query(CollectionRun)
        .filter(CollectionRun.status.in_(["success", "partial"]))
        .order_by(CollectionRun.finished_at.desc())
        .first()
    )

    last_historical = (
        db.query(HistoricalRun)
        .filter(HistoricalRun.status.in_(["success", "partial"]))
        .order_by(HistoricalRun.finished_at.desc())
        .first()
    )

    last_score_at = db.query(func.max(TrendScore.computed_at)).scalar()

    last_site_scan = db.query(func.max(SiteContent.scanned_at)).scalar()

    last_volume_fetch = db.query(func.max(KeywordVolume.fetched_at)).scalar()

    last_gsc = (
        db.query(SearchConsoleSync)
        .order_by(SearchConsoleSync.started_at.desc())
        .first()
    )

    last_gap = db.query(func.max(ContentGapHistory.last_detected_at)).scalar()

    return {
        "trends_last_collected": _iso(last_collect.finished_at) if last_collect else None,
        "trends_last_run_status": last_collect.status if last_collect else None,
        "trends_succeeded": last_collect.keywords_succeeded if last_collect else 0,
        "trends_attempted": last_collect.keywords_attempted if last_collect else 0,

        "historical_last_fetched": _iso(last_historical.finished_at) if last_historical else None,
        "historical_succeeded": last_historical.keywords_succeeded if last_historical else 0,

        "scores_last_computed": _iso(last_score_at),

        "site_last_scanned": _iso(last_site_scan),

        "ads_volumes_last_fetched": _iso(last_volume_fetch),

        "gsc_last_synced": _iso(last_gsc.started_at) if last_gsc else None,
        "gsc_last_status": last_gsc.status if last_gsc else None,
        "gsc_imported_rows": last_gsc.rows_imported if last_gsc else 0,

        "content_gaps_last_refresh": _iso(last_gap),
    }
