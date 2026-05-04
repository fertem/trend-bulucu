from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import ai as ai_module
from .. import analytics
from .. import app_settings
from .. import seasonality as seasonality_module
from .. import search_console as sc_module
from ..auth import require_admin
from ..config import settings
from ..db import get_db
from ..models import Keyword, RisingQuery


router = APIRouter(prefix="/api/ai", tags=["ai"], dependencies=[Depends(require_admin)])


class KeywordIn(BaseModel):
    keyword: str


class BrandDetectIn(BaseModel):
    brand_name: str
    brand_description: str
    brand_url: str = ""


class BrandSuggestIn(BaseModel):
    brand_name: str
    brand_description: str
    target_audience: str = ""
    count: int = 15


class ArticleIn(BaseModel):
    keyword: str
    category: str | None = None
    related_queries: list[str] | None = None


class ArticleFullIn(BaseModel):
    keyword: str
    outline: dict
    tone: str = "bilgilendirici, sıcak, satıcı değil"


class ChatIn(BaseModel):
    messages: list[dict]  # [{"role":"user","content":"..."}, {"role":"assistant","content":"..."}]


class CoverImageIn(BaseModel):
    keyword: str
    prompt_hint: str = ""
    style: str = "modern, minimalist, vibrant"


class SchemaIn(BaseModel):
    keyword: str
    outline: dict


class RefreshPostIn(BaseModel):
    slug: str
    title: str
    keyword: str


class IntentBatchIn(BaseModel):
    keywords: list[str]


class KDIn(BaseModel):
    keyword: str
    category: str | None = None


class PAAIn(BaseModel):
    keyword: str
    count: int = 20


class EditArticleIn(BaseModel):
    markdown: str
    instruction: str


class ScorecardIn(BaseModel):
    keyword: str
    markdown: str
    outline: dict | None = None


class InternalLinksIn(BaseModel):
    keyword: str
    markdown: str


def _score_dict(s):
    return {
        "keyword": s.keyword,
        "category": s.category,
        "avg_last_7": s.avg_last_7,
        "avg_prev_7": s.avg_prev_7,
        "growth_pct": s.growth_pct,
        "is_hot": s.is_hot,
        "opportunity_score": s.opportunity_score,
    }


def _ensure_ai():
    if not settings.has_ai:
        raise HTTPException(status_code=503, detail="AI sağlayıcı yapılandırılmamış")


@router.post("/insight")
def insight(body: KeywordIn, db: Annotated[Session, Depends(get_db)]):
    _ensure_ai()
    latest = analytics.latest_scores(db)
    score = next((s for s in latest if s.keyword == body.keyword), None)
    if not score:
        raise HTTPException(status_code=404, detail="Bu kelime için skor yok")

    rising = (
        db.query(RisingQuery)
        .filter(RisingQuery.parent_keyword == body.keyword)
        .order_by(RisingQuery.collected_at.desc(), RisingQuery.growth.desc())
        .limit(8)
        .all()
    )
    related = [r.rising_keyword for r in rising]

    brand = app_settings.brand_context(db)
    try:
        text = ai_module.explain_trend(body.keyword, score.growth_pct, score.avg_last_7, related, brand=brand)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")
    return {"keyword": body.keyword, "insight": text}


@router.post("/content-ideas")
def content_ideas(body: KeywordIn, db: Annotated[Session, Depends(get_db)]):
    _ensure_ai()
    latest = analytics.latest_scores(db)
    score = next((s for s in latest if s.keyword == body.keyword), None)
    category = score.category if score else None

    brand = app_settings.brand_context(db)
    try:
        text = ai_module.content_ideas(body.keyword, category, brand=brand)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")
    return {"keyword": body.keyword, "ideas": text}


@router.post("/digest")
def weekly_digest(
    db: Annotated[Session, Depends(get_db)],
    period: str = "weekly",
):
    """Tüm veriyi (Trends + Search Console) sentezleyip AI özeti döndürür.

    period: daily | weekly | monthly | yearly — zaman kapsamını ayarlar.
            yearly periyodunda yıllık projeksiyon verisi de eklenir.
    """
    _ensure_ai()
    if period not in ("daily", "weekly", "monthly", "yearly"):
        raise HTTPException(status_code=400, detail="invalid period")

    top = [_score_dict(s) for s in analytics.top_trending(db, limit=10)]
    rising = [_score_dict(s) for s in analytics.top_rising(db, limit=10)]
    hot = [_score_dict(s) for s in analytics.hot_alerts(db)]
    opps = [_score_dict(s) for s in analytics.opportunities(db, limit=10)]

    if not top:
        raise HTTPException(status_code=404, detail="Henüz veri yok — önce toplama yap")

    sc_summary = None
    if sc_module.has_data(db):
        sc_summary = {
            "top_queries": sc_module.top_queries(db, limit=12),
            "opportunities": sc_module.opportunities(db, limit=8),
            "page2": sc_module.page2_keywords(db, limit=8),
            "movers": sc_module.movers(db, limit=8),
        }

    # Yıllık periyot için projeksiyon verisi ekle (top 8 keyword için)
    projections = None
    if period == "yearly":
        from .. import seasonality as _seas
        if _seas.has_historical_data(db):
            projs = []
            for s in top[:8]:
                p = _seas.yearly_projection(db, s["keyword"])
                if p and not p.get("insufficient_data"):
                    projs.append(p)
            if projs:
                projections = projs

    brand = app_settings.brand_context(db)
    try:
        result = ai_module.weekly_digest(
            top, rising, hot, opps,
            sc_summary=sc_summary, brand=brand,
            period=period, projections=projections,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")
    result["has_sc_data"] = sc_summary is not None
    result["period"] = period
    result["has_projections"] = bool(projections)
    return result


@router.post("/deep-analysis")
def deep_analysis(body: KeywordIn, db: Annotated[Session, Depends(get_db)]):
    """Kelime bazında derin AI analizi — tarihsel + güncel + tahmin + aksiyon."""
    _ensure_ai()
    kw = body.keyword.lower().strip()

    latest = analytics.latest_scores(db)
    score = next((s for s in latest if s.keyword == kw), None)

    profile = seasonality_module.keyword_monthly_profile(db, kw)
    yoy = seasonality_module.keyword_yoy(db, kw)
    vs = seasonality_module.keyword_this_vs_history(db, kw)

    if not profile:
        raise HTTPException(status_code=404, detail="Bu kelime için 5 yıllık veri yok — önce çek")

    # GSC verisi varsa al
    sc_data = sc_module.keyword_for_query(db, kw) if sc_module.has_data(db) else None

    brand = app_settings.brand_context(db)
    try:
        result = ai_module.deep_keyword_analysis(
            keyword=kw,
            profile=profile,
            yoy=yoy,
            vs_history=vs,
            recent_growth_pct=score.growth_pct if score else 0.0,
            category=score.category if score else None,
            sc_data=sc_data,
            brand=brand,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")
    return {"keyword": kw, "has_sc_data": sc_data is not None, **result}


@router.post("/content-brief")
def content_brief(body: KeywordIn, db: Annotated[Session, Depends(get_db)]):
    """Detaylı içerik brief'i — H2/H3 outline + sosyal hook'lar."""
    _ensure_ai()
    kw = body.keyword.lower().strip()

    latest = analytics.latest_scores(db)
    score = next((s for s in latest if s.keyword == kw), None)

    profile = seasonality_module.keyword_monthly_profile(db, kw)
    peak_name = None
    if profile:
        valid = [(m, p) for m, p in profile.items() if p]
        if valid:
            peak = max(valid, key=lambda x: x[1]["mean"])
            peak_name = peak[1].get("month_name")

    brand = app_settings.brand_context(db)
    try:
        result = ai_module.content_brief(
            keyword=kw,
            category=score.category if score else None,
            monthly_peak_month=peak_name,
            brand=brand,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")
    return {"keyword": kw, **result}


@router.post("/similar-keywords")
def similar_keywords(body: KeywordIn, db: Annotated[Session, Depends(get_db)]):
    """AI bir kelimeye benzer 10 kelime önerir (eş anlamlı / yan kavram / soru / vs.)."""
    _ensure_ai()
    kw = body.keyword.lower().strip()
    latest = analytics.latest_scores(db)
    score = next((s for s in latest if s.keyword == kw), None)
    category = score.category if score else None

    current = [k.keyword for k in db.query(Keyword).filter(Keyword.is_active == True).all()]
    brand = app_settings.brand_context(db)
    try:
        result = ai_module.find_similar_keywords(kw, category, current, brand=brand)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")
    return result


@router.post("/long-tail")
def long_tail(body: KeywordIn, db: Annotated[Session, Depends(get_db)]):
    """Bir kelimeden uzun-kuyruk varyantlar üret (soru, yaş, karşılaştırma, modifier)."""
    _ensure_ai()
    brand = app_settings.brand_context(db)
    try:
        result = ai_module.long_tail_variants(body.keyword.strip(), brand=brand)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")
    return result


# ─── Search Intent + KD + PAA ──────────────────────────────────────────────

@router.post("/search-intent")
def search_intent(body: IntentBatchIn, db: Annotated[Session, Depends(get_db)]):
    """Birden çok kelimeyi search intent kategorilerine sınıflandır."""
    _ensure_ai()
    brand = app_settings.brand_context(db)
    if not body.keywords:
        return {"items": []}
    try:
        return ai_module.classify_search_intent(body.keywords[:60], brand=brand)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")


@router.post("/keyword-difficulty")
def keyword_difficulty(body: KDIn, db: Annotated[Session, Depends(get_db)]):
    """Bir kelimenin SEO ranking zorluğunu tahmin et."""
    _ensure_ai()
    kw = body.keyword.lower().strip()
    brand = app_settings.brand_context(db)

    # GSC verisi varsa al
    sc_data = None
    if sc_module.has_data(db):
        sc_data = sc_module.keyword_for_query(db, kw)

    # Volume varsa al
    from ..models import KeywordVolume
    vol_row = db.query(KeywordVolume).filter(KeywordVolume.keyword == kw).one_or_none()
    volume = vol_row.avg_monthly_searches if vol_row else None

    try:
        return ai_module.estimate_keyword_difficulty(
            kw, sc_data=sc_data, volume_monthly=volume,
            category=body.category, brand=brand,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")


@router.post("/paa")
def paa(body: PAAIn, db: Annotated[Session, Depends(get_db)]):
    """People Also Ask — bir kelimeden 20 soru üret."""
    _ensure_ai()
    brand = app_settings.brand_context(db)
    try:
        return ai_module.people_also_ask(body.keyword, count=body.count, brand=brand)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")


# ─── AI Article Editor + Scorecard + Internal Links ────────────────────────

@router.post("/article/edit")
def article_edit(body: EditArticleIn, db: Annotated[Session, Depends(get_db)]):
    """Mevcut yazıyı AI ile düzenle (chat-like editing)."""
    _ensure_ai()
    if not body.markdown or not body.instruction:
        raise HTTPException(status_code=400, detail="markdown ve instruction zorunlu")
    brand = app_settings.brand_context(db)
    try:
        return ai_module.edit_article(body.markdown, body.instruction, brand=brand)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")


@router.post("/article/scorecard")
def article_scorecard(body: ScorecardIn, db: Annotated[Session, Depends(get_db)]):
    """Yazının SEO açısından puanı (0-100) + iyileştirme önerileri."""
    _ensure_ai()
    brand = app_settings.brand_context(db)
    try:
        return ai_module.seo_scorecard(body.keyword, body.markdown, body.outline, brand=brand)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Scorecard başarısız: {e}")


@router.post("/article/internal-links")
def article_internal_links(body: InternalLinksIn, db: Annotated[Session, Depends(get_db)]):
    """Yazıya sitedeki sayfalardan internal link önerisi."""
    _ensure_ai()
    brand = app_settings.brand_context(db)

    from ..models import SiteContent
    pages = [
        {
            "slug": p.slug,
            "title": p.title,
            "url": p.url,
            "description": p.description,
        }
        for p in db.query(SiteContent).all()
    ]
    if not pages:
        return {"suggestions": [], "message": "Önce siteyi tara (İçerik Boşluğu kartı)"}

    try:
        return ai_module.suggest_internal_links(body.keyword, body.markdown, pages, brand=brand)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")


# ─── Setup wizard endpoints ────────────────────────────────────────────────

@router.post("/setup/detect-industry")
def setup_detect_industry(body: BrandDetectIn):
    """Marka tarifinden sektör + öneri çıkar."""
    _ensure_ai()
    try:
        return ai_module.detect_industry(body.brand_name, body.brand_description, body.brand_url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")


@router.post("/setup/suggest-keywords")
def setup_suggest_keywords(body: BrandSuggestIn):
    """Marka için tohum kelime önerisi."""
    _ensure_ai()
    try:
        return ai_module.suggest_seed_keywords_from_brand(
            body.brand_name, body.brand_description, body.target_audience, body.count
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")


@router.post("/setup/suggest-categories")
def setup_suggest_categories(body: BrandDetectIn):
    """Marka için özel kategori önerisi."""
    _ensure_ai()
    try:
        return ai_module.suggest_categories_from_brand(body.brand_name, body.brand_description)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")


# ─── Article writer endpoints ──────────────────────────────────────────────

@router.post("/article/outline")
def article_outline(body: ArticleIn, db: Annotated[Session, Depends(get_db)]):
    """Bir kelime için tam yazı taslağı."""
    _ensure_ai()
    brand = app_settings.brand_context(db)

    related = body.related_queries
    if related is None:
        rising = (
            db.query(RisingQuery)
            .filter(RisingQuery.parent_keyword == body.keyword.lower())
            .order_by(RisingQuery.collected_at.desc())
            .limit(8)
            .all()
        )
        related = [r.rising_keyword for r in rising]

    try:
        return ai_module.article_outline(body.keyword, brand=brand, category=body.category,
                                         related_queries=related)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")


@router.post("/article/write")
def article_write(body: ArticleFullIn, db: Annotated[Session, Depends(get_db)]):
    """Outline'dan tam markdown yazı üret."""
    _ensure_ai()
    brand = app_settings.brand_context(db)
    try:
        markdown = ai_module.article_full_text(body.keyword, body.outline, brand=brand, tone=body.tone)
        return {"keyword": body.keyword, "markdown": markdown, "length": len(markdown)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")


@router.post("/article/social")
def article_social(body: ArticleFullIn, db: Annotated[Session, Depends(get_db)]):
    """Yazı için sosyal medya paketi."""
    _ensure_ai()
    brand = app_settings.brand_context(db)
    try:
        return ai_module.article_social_pack(body.keyword, body.outline, brand=brand)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")


# ─── AI Discovery Pipeline ─────────────────────────────────────────────────

class DiscoveryIn(BaseModel):
    count: int = 10
    fetch_trends: bool = True
    compare_with_site: bool = True


@router.post("/discovery")
def ai_discovery(body: DiscoveryIn, db: Annotated[Session, Depends(get_db)]):
    """Tek seferde: AI keyword üret → Pytrends'ten verisini çek → Site sayfalarıyla karşılaştır → sırala.

    Sonuç: her bir öneri için trend verisi + coverage skoru + önerilen aksiyon.
    """
    _ensure_ai()
    brand = app_settings.brand_context(db)
    if not brand.get("brand_name") or brand["brand_name"] == "Bu site":
        raise HTTPException(status_code=400, detail="Önce marka bilgilerini doldur (Ayarlar → Marka)")

    # 1. AI'dan keyword listesi
    try:
        suggestions = ai_module.suggest_seed_keywords_from_brand(
            brand["brand_name"],
            brand.get("brand_description", ""),
            brand.get("target_audience", ""),
            count=body.count,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI önerisi başarısız: {e}")

    candidates = suggestions.get("keywords", [])
    if not candidates:
        return {"items": [], "message": "AI öneri üretemedi."}

    # 2. Pytrends'ten verisini çek + 3. site ile karşılaştır
    from .. import collector, site_coverage
    from ..models import HistoricalPoint, SiteContent

    contents = db.query(SiteContent).all()
    client = collector._new_client() if body.fetch_trends else None

    results = []
    for s in candidates:
        kw = s["keyword"].lower().strip()
        item = {
            "keyword": kw,
            "type": s.get("type", ""),
            "ai_reason": s.get("reason", ""),
        }

        # Trend verisi (zaten varsa skip)
        if body.fetch_trends:
            existing_hist = db.query(HistoricalPoint).filter(HistoricalPoint.keyword == kw).first()
            if not existing_hist and client:
                try:
                    df = collector._backoff_call(collector.fetch_historical, client, kw)
                    collector.save_historical(db, kw, df)
                except Exception:
                    pass

            # Profile + recent
            from ..seasonality import keyword_monthly_profile
            profile = keyword_monthly_profile(db, kw)
            if profile:
                # Bu ayki ortalama
                from datetime import datetime as _dt
                m = _dt.utcnow().month
                cur = profile.get(m) or profile.get(str(m))
                if cur:
                    item["trend_current_month_avg"] = cur["mean"]
                    item["trend_lift_pct"] = cur["lift_pct"]
                    item["trend_peak_month"] = cur.get("month_name")

                # Yıllık ortalama
                all_means = [p["mean"] for p in profile.values() if p]
                item["trend_annual_avg"] = round(sum(all_means) / len(all_means), 1) if all_means else 0
            else:
                item["trend_current_month_avg"] = None
                item["trend_annual_avg"] = None

        # Site coverage
        if body.compare_with_site and contents:
            score, match = site_coverage.coverage_score(kw, contents)
            item["coverage_score"] = round(score, 2)
            item["best_match_slug"] = match.slug if match else None
            item["best_match_url"] = match.url if match else None
        else:
            item["coverage_score"] = 0.0
            item["best_match_slug"] = None
            item["best_match_url"] = None

        # Önerilen aksiyon
        cov = item["coverage_score"]
        annual = item.get("trend_annual_avg") or 0
        if cov < 0.3 and annual > 10:
            item["suggested_action"] = "write"  # Yaz
            item["action_label"] = "Yazı yaz"
            item["priority"] = round(annual * (1 - cov), 1)
        elif cov < 0.6 and annual > 5:
            item["suggested_action"] = "track"  # Takibe al
            item["action_label"] = "Takibe al"
            item["priority"] = round(annual * (1 - cov) * 0.6, 1)
        else:
            item["suggested_action"] = "skip"
            item["action_label"] = "Atla"
            item["priority"] = 0

        results.append(item)

    # Sırala
    results.sort(key=lambda x: x["priority"], reverse=True)
    return {"items": results, "brand": brand["brand_name"]}


# ─── AI Chat ───────────────────────────────────────────────────────────────

@router.post("/chat")
def chat(body: ChatIn, db: Annotated[Session, Depends(get_db)]):
    """Veri-aware AI sohbet. Kullanıcı doğrudan verisiyle konuşsun."""
    _ensure_ai()
    if not body.messages:
        raise HTTPException(status_code=400, detail="messages boş olamaz")

    brand = app_settings.brand_context(db)

    # Context derle: top trending, hot, GSC, gaps
    context = {}
    try:
        context["top_trending"] = [_score_dict(s) for s in analytics.top_trending(db, limit=10)]
        context["hot_alerts"] = [_score_dict(s) for s in analytics.hot_alerts(db)]
    except Exception:
        pass

    if sc_module.has_data(db):
        try:
            context["gsc_top"] = sc_module.top_queries(db, limit=8)
            context["gsc_opportunities"] = sc_module.opportunities(db, limit=5)
        except Exception:
            pass

    try:
        from .. import site_coverage
        gaps_raw = site_coverage.content_gaps(db, limit=8)
        context["content_gaps"] = gaps_raw
    except Exception:
        pass

    try:
        outlook = seasonality_module.current_month_outlook(db)
        context["seasonality_now"] = {
            "month_name": outlook.get("target_month_name"),
            "by_lift": outlook.get("by_lift", []),
        }
    except Exception:
        pass

    try:
        text = ai_module.chat_with_data(body.messages, context, brand=brand)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI sohbet başarısız: {e}")
    return {"role": "assistant", "content": text}


@router.post("/chat/stream")
def chat_stream(body: ChatIn, db: Annotated[Session, Depends(get_db)]):
    """Streaming AI chat — token token akar (SSE)."""
    _ensure_ai()
    if not body.messages:
        raise HTTPException(status_code=400, detail="messages boş olamaz")

    brand = app_settings.brand_context(db)

    # Context derle
    context = {}
    try:
        context["top_trending"] = [_score_dict(s) for s in analytics.top_trending(db, limit=10)]
        context["hot_alerts"] = [_score_dict(s) for s in analytics.hot_alerts(db)]
    except Exception:
        pass
    if sc_module.has_data(db):
        try:
            context["gsc_top"] = sc_module.top_queries(db, limit=8)
            context["gsc_opportunities"] = sc_module.opportunities(db, limit=5)
        except Exception:
            pass
    try:
        from .. import site_coverage
        context["content_gaps"] = site_coverage.content_gaps(db, limit=8)
    except Exception:
        pass
    try:
        outlook = seasonality_module.current_month_outlook(db)
        context["seasonality_now"] = {
            "month_name": outlook.get("target_month_name"),
            "by_lift": outlook.get("by_lift", []),
        }
    except Exception:
        pass

    def event_stream():
        try:
            for chunk in ai_module.chat_with_data_stream(body.messages, context, brand=brand):
                # SSE format: "data: <json>\n\n"
                import json as _json
                payload = _json.dumps({"delta": chunk})
                yield f"data: {payload}\n\n"
            yield "data: {\"done\": true}\n\n"
        except Exception as e:
            import json as _json
            yield f"data: {_json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── DALL-E Cover Image ─────────────────────────────────────────────────────

@router.post("/cover-image")
def generate_cover(body: CoverImageIn):
    """DALL-E 3 ile blog kapak görseli üret. OpenAI key gerekli."""
    _ensure_ai()
    try:
        url = ai_module.cover_image(body.prompt_hint, body.keyword, body.style)
        return {"url": url, "keyword": body.keyword}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Görsel üretimi başarısız: {e}")


# ─── Schema.org ─────────────────────────────────────────────────────────────

@router.post("/schema")
def schema(body: SchemaIn, db: Annotated[Session, Depends(get_db)]):
    """Article + FAQ + HowTo schema.org JSON-LD üret (AI gerektirmez, programatik)."""
    brand = app_settings.brand_context(db)
    try:
        result = ai_module.schema_markup(body.keyword, body.outline, brand=brand)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Schema üretimi başarısız: {e}")


# ─── Refresh Existing Post ──────────────────────────────────────────────────

@router.post("/refresh-post")
def refresh_post(body: RefreshPostIn, db: Annotated[Session, Depends(get_db)]):
    """Mevcut bir blog yazısı için AI revizyon önerisi."""
    _ensure_ai()
    brand = app_settings.brand_context(db)

    # GSC datası varsa al
    gsc_data = None
    if sc_module.has_data(db):
        gsc_data = sc_module.keyword_for_query(db, body.keyword)

    # Yükselen ilgili sorgular
    rising = (
        db.query(RisingQuery)
        .filter(RisingQuery.parent_keyword == body.keyword.lower())
        .order_by(RisingQuery.collected_at.desc())
        .limit(8)
        .all()
    )
    related_rising = [r.rising_keyword for r in rising]

    try:
        result = ai_module.refresh_existing_post(
            body.slug, body.title, body.keyword,
            gsc_data=gsc_data, related_rising=related_rising, brand=brand,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Refresh analizi başarısız: {e}")
    return result


# ─── Topic Clustering + Authority + Cannibalization ────────────────────────

@router.post("/clusters/build")
def build_clusters(db: Annotated[Session, Depends(get_db)]):
    """Takip edilen kelimeleri AI ile semantik kümeler. Sonucu DB'de saklar (cache)."""
    _ensure_ai()
    brand = app_settings.brand_context(db)
    keywords = [k.keyword for k in db.query(Keyword).filter(Keyword.is_active == True).all()]
    if len(keywords) < 3:
        raise HTTPException(status_code=400, detail="En az 3 takip kelimesi gerekli")

    try:
        result = ai_module.cluster_keywords_ai(keywords, brand=brand)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cluster başarısız: {e}")

    # Sonucu Settings'te sakla (basit serileştirme)
    import json as _json
    app_settings.set_value(db, "_clusters_cache", _json.dumps(result.get("clusters", [])))

    return result


@router.get("/clusters")
def get_clusters(db: Annotated[Session, Depends(get_db)]):
    """Cache'lenmiş cluster sonuçları."""
    import json as _json
    raw = app_settings.get(db, "_clusters_cache")
    if not raw:
        return {"clusters": []}
    try:
        return {"clusters": _json.loads(raw)}
    except Exception:
        return {"clusters": []}


@router.get("/topic-authority")
def topic_authority(db: Annotated[Session, Depends(get_db)]):
    """Her cluster için authority skoru."""
    import json as _json
    raw = app_settings.get(db, "_clusters_cache")
    clusters = []
    if raw:
        try:
            clusters = _json.loads(raw)
        except Exception:
            pass

    if not clusters:
        return {"clusters": [], "message": "Önce 'Cluster Oluştur' ile kümeleme yap"}

    return {"clusters": analytics.topic_authority_scores(db, clusters)}


@router.get("/cannibalization")
def cannibalization(db: Annotated[Session, Depends(get_db)]):
    """Search Console'da aynı sorguya birden fazla sayfa cevap veriyor mu?"""
    if not sc_module.has_data(db):
        return {"items": [], "message": "Önce Search Console verisi senkronize et"}
    return {"items": analytics.detect_cannibalization(db)}


@router.post("/seasonal-outlook")
def seasonal_outlook(db: Annotated[Session, Depends(get_db)], month: int | None = None):
    """5 yıllık veriye dayalı bu ay tahmini."""
    _ensure_ai()
    if not seasonality_module.has_historical_data(db):
        raise HTTPException(status_code=404, detail="Önce 5 yıllık veriyi çek (Yönetim → 5 Yıllık Veri)")

    outlook = seasonality_module.current_month_outlook(db, month)
    brand = app_settings.brand_context(db)
    try:
        result = ai_module.seasonal_outlook_insight(
            outlook["target_month_name"],
            outlook["by_lift"],
            outlook["by_volume"],
            brand=brand,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")
    return {
        "month": outlook["target_month"],
        "month_name": outlook["target_month_name"],
        **result,
    }


@router.post("/suggest-keywords")
def suggest_keywords(db: Annotated[Session, Depends(get_db)]):
    """Mevcut yükselen aramalardan AI yeni kelime önerileri çıkarır."""
    _ensure_ai()

    current = [k.keyword for k in db.query(Keyword).filter(Keyword.is_active == True).all()]

    rising_rows = (
        db.query(RisingQuery)
        .order_by(RisingQuery.collected_at.desc(), RisingQuery.growth.desc())
        .limit(60)
        .all()
    )
    rising_pool = list({r.rising_keyword for r in rising_rows})

    cats = [k.category for k in db.query(Keyword).filter(Keyword.is_active == True).all() if k.category]

    brand = app_settings.brand_context(db)
    try:
        result = ai_module.suggest_new_keywords(rising_pool, current, cats, brand=brand)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI çağrısı başarısız: {e}")
    return result
