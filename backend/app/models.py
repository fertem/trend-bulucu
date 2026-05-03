from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, UniqueConstraint, Index
from .db import Base


class Keyword(Base):
    __tablename__ = "trends_keywords"

    id = Column(Integer, primary_key=True)
    keyword = Column(String, unique=True, nullable=False, index=True)
    category = Column(String, nullable=True, index=True)
    is_seed = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_collected_at = Column(DateTime, nullable=True)


class TimeSeriesPoint(Base):
    __tablename__ = "trends_timeseries"

    id = Column(Integer, primary_key=True)
    keyword = Column(String, nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True)
    interest = Column(Float, nullable=False)
    is_partial = Column(Boolean, default=False)

    __table_args__ = (
        UniqueConstraint("keyword", "date", name="uq_keyword_date"),
        Index("ix_keyword_date", "keyword", "date"),
    )


class RelatedQuery(Base):
    __tablename__ = "trends_related"

    id = Column(Integer, primary_key=True)
    parent_keyword = Column(String, nullable=False, index=True)
    related_keyword = Column(String, nullable=False, index=True)
    score = Column(Float, default=0)
    type = Column(String, default="top")  # top | rising
    collected_at = Column(DateTime, default=datetime.utcnow)


class RisingQuery(Base):
    __tablename__ = "trends_rising"

    id = Column(Integer, primary_key=True)
    parent_keyword = Column(String, nullable=False, index=True)
    rising_keyword = Column(String, nullable=False, index=True)
    growth = Column(Float, default=0)
    collected_at = Column(DateTime, default=datetime.utcnow)


class TrendScore(Base):
    """Daily computed score for each keyword."""
    __tablename__ = "trends_scores"

    id = Column(Integer, primary_key=True)
    keyword = Column(String, nullable=False, index=True)
    computed_at = Column(DateTime, default=datetime.utcnow, index=True)
    avg_last_7 = Column(Float, default=0)
    avg_prev_7 = Column(Float, default=0)
    growth_pct = Column(Float, default=0)
    is_hot = Column(Boolean, default=False)
    opportunity_score = Column(Float, default=0)
    category = Column(String, nullable=True)


class HistoricalPoint(Base):
    """5 yıllık haftalık veri — mevsimsellik analizi için."""
    __tablename__ = "trends_historical"

    id = Column(Integer, primary_key=True)
    keyword = Column(String, nullable=False, index=True)
    week_date = Column(DateTime, nullable=False, index=True)
    interest = Column(Float, nullable=False)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)  # 1-12

    __table_args__ = (
        UniqueConstraint("keyword", "week_date", name="uq_hist_keyword_date"),
        Index("ix_hist_kw_year_month", "keyword", "year", "month"),
    )


class HistoricalRun(Base):
    """5y collection run kayıtları."""
    __tablename__ = "trends_historical_runs"

    id = Column(Integer, primary_key=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    keywords_attempted = Column(Integer, default=0)
    keywords_succeeded = Column(Integer, default=0)
    keywords_failed = Column(Integer, default=0)
    status = Column(String, default="running")
    error = Column(String, nullable=True)


class KeywordVolume(Base):
    """Google Ads Keyword Planner'dan çekilen mutlak hacim."""
    __tablename__ = "trends_volume"

    id = Column(Integer, primary_key=True)
    keyword = Column(String, unique=True, nullable=False, index=True)
    avg_monthly_searches = Column(Integer, default=0)
    competition = Column(String, nullable=True)  # LOW | MEDIUM | HIGH | UNSPECIFIED
    competition_index = Column(Integer, default=0)  # 0-100
    low_top_of_page_bid = Column(Float, default=0)  # TL cinsinden (micros / 1M ile çarpılmaz, ham USD micros)
    high_top_of_page_bid = Column(Float, default=0)
    fetched_at = Column(DateTime, default=datetime.utcnow)
    last_3m_avg = Column(Integer, default=0)


class SearchConsoleQuery(Base):
    """Google Search Console — sorgu bazında pozisyon/CTR/tıklama snapshotları."""
    __tablename__ = "sc_queries"

    id = Column(Integer, primary_key=True)
    query = Column(String, nullable=False, index=True)
    page = Column(String, nullable=True, index=True)
    period_days = Column(Integer, default=28)
    fetched_at = Column(DateTime, default=datetime.utcnow, index=True)

    clicks = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    ctr = Column(Float, default=0)
    position = Column(Float, default=0)

    # Önceki dönem ile karşılaştırma için
    prev_clicks = Column(Integer, nullable=True)
    prev_impressions = Column(Integer, nullable=True)
    prev_position = Column(Float, nullable=True)

    __table_args__ = (
        UniqueConstraint("query", "page", "period_days", "fetched_at", name="uq_sc_query"),
    )


class SearchConsoleSync(Base):
    __tablename__ = "sc_syncs"

    id = Column(Integer, primary_key=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    rows_imported = Column(Integer, default=0)
    period_days = Column(Integer, default=28)
    status = Column(String, default="running")
    error = Column(String, nullable=True)


class ContentGapHistory(Base):
    """İçerik fırsatlarının tarihsel kaydı.
    Bir kelime bir kez tespit edilince burada kalır; günlük güncelleme
    sadece son durumu yeniler, eski fırsatlar silinmez.
    """
    __tablename__ = "content_gaps_history"

    id = Column(Integer, primary_key=True)
    keyword = Column(String, unique=True, nullable=False, index=True)
    category = Column(String, nullable=True)
    source = Column(String, default="tracked")  # tracked | rising

    first_detected_at = Column(DateTime, default=datetime.utcnow)
    last_detected_at = Column(DateTime, default=datetime.utcnow)
    times_detected = Column(Integer, default=1)

    coverage_score = Column(Float, default=0)
    growth_pct = Column(Float, default=0)
    avg_last_7 = Column(Float, default=0)
    priority = Column(Float, default=0)
    peak_priority = Column(Float, default=0)
    best_match_slug = Column(String, nullable=True)
    best_match_title = Column(String, nullable=True)
    best_match_url = Column(String, nullable=True)

    is_currently_trending = Column(Boolean, default=True)
    status = Column(String, default="new", index=True)  # new | in_progress | addressed | dismissed
    addressed_url = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    addressed_at = Column(DateTime, nullable=True)
    status_updated_at = Column(DateTime, nullable=True)


class SiteContent(Base):
    """Sitenizde var olan içerik (blog post / landing page)."""
    __tablename__ = "site_content"

    id = Column(Integer, primary_key=True)
    slug = Column(String, unique=True, nullable=False, index=True)
    type = Column(String, default="page")  # blog | page
    title = Column(String, nullable=True)
    description = Column(String, nullable=True)
    keywords_text = Column(String, nullable=True)  # metadata.keywords
    url = Column(String, nullable=True)
    scanned_at = Column(DateTime, default=datetime.utcnow)


class AppSetting(Base):
    """Genel uygulama ayarları — key/value. Marka bilgisi, site yolu, vs."""
    __tablename__ = "app_settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Category(Base):
    """Kelime kategorileri — kullanıcı tanımlı."""
    __tablename__ = "trend_categories"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    triggers = Column(String, nullable=True)  # virgülle ayrılmış tetikleyici kelimeler
    color = Column(String, nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class CollectionRun(Base):
    __tablename__ = "trends_runs"

    id = Column(Integer, primary_key=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    keywords_attempted = Column(Integer, default=0)
    keywords_succeeded = Column(Integer, default=0)
    keywords_failed = Column(Integer, default=0)
    status = Column(String, default="running")  # running | success | partial | failed
    error = Column(String, nullable=True)
