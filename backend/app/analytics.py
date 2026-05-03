"""Trend skor / fırsat skoru / kategorize / forecast / anomali hesaplamaları."""
from __future__ import annotations

from datetime import datetime, timedelta
from statistics import mean, stdev

from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import Keyword, RisingQuery, TimeSeriesPoint, TrendScore
from .seeds import categorize


HOT_THRESHOLD_PCT = 50.0
ANOMALY_Z_THRESHOLD = 2.0


def _avg_in_window(db: Session, keyword: str, start: datetime, end: datetime) -> float:
    val = (
        db.query(func.avg(TimeSeriesPoint.interest))
        .filter(TimeSeriesPoint.keyword == keyword)
        .filter(TimeSeriesPoint.date >= start)
        .filter(TimeSeriesPoint.date < end)
        .scalar()
    )
    return float(val or 0)


def compute_keyword_score(db: Session, keyword: str) -> TrendScore:
    now = datetime.utcnow()
    last_7_start = now - timedelta(days=7)
    prev_7_start = now - timedelta(days=14)

    avg_last_7 = _avg_in_window(db, keyword, last_7_start, now)
    avg_prev_7 = _avg_in_window(db, keyword, prev_7_start, last_7_start)

    if avg_prev_7 > 0:
        growth = ((avg_last_7 - avg_prev_7) / avg_prev_7) * 100.0
    elif avg_last_7 > 0:
        growth = 100.0
    else:
        growth = 0.0

    is_hot = growth >= HOT_THRESHOLD_PCT and avg_last_7 >= 5

    if avg_last_7 > 0:
        scarcity = max(0.0, 1.0 - (avg_last_7 / 100.0))
        opportunity = max(0.0, growth) * 0.5 + scarcity * 50.0
    else:
        opportunity = 0.0

    kw_obj = db.query(Keyword).filter(Keyword.keyword == keyword).one_or_none()
    category = (kw_obj.category if kw_obj and kw_obj.category else categorize(keyword))

    score = TrendScore(
        keyword=keyword,
        computed_at=now,
        avg_last_7=round(avg_last_7, 2),
        avg_prev_7=round(avg_prev_7, 2),
        growth_pct=round(growth, 2),
        is_hot=is_hot,
        opportunity_score=round(opportunity, 2),
        category=category,
    )
    db.add(score)
    db.commit()
    db.refresh(score)
    return score


def recompute_all_scores(db: Session) -> int:
    keywords = db.query(Keyword).filter(Keyword.is_active == True).all()
    count = 0
    for k in keywords:
        compute_keyword_score(db, k.keyword)
        count += 1
    return count


def latest_scores(db: Session) -> list[TrendScore]:
    subq = (
        db.query(TrendScore.keyword, func.max(TrendScore.computed_at).label("mx"))
        .group_by(TrendScore.keyword)
        .subquery()
    )
    rows = (
        db.query(TrendScore)
        .join(subq, (TrendScore.keyword == subq.c.keyword) & (TrendScore.computed_at == subq.c.mx))
        .all()
    )
    return rows


def top_trending(db: Session, limit: int = 10) -> list[TrendScore]:
    rows = latest_scores(db)
    rows.sort(key=lambda r: r.avg_last_7, reverse=True)
    return rows[:limit]


def top_rising(db: Session, limit: int = 10) -> list[TrendScore]:
    rows = latest_scores(db)
    rows = [r for r in rows if r.growth_pct > 0]
    rows.sort(key=lambda r: r.growth_pct, reverse=True)
    return rows[:limit]


def hot_alerts(db: Session) -> list[TrendScore]:
    rows = latest_scores(db)
    rows = [r for r in rows if r.is_hot]
    rows.sort(key=lambda r: r.growth_pct, reverse=True)
    return rows


def opportunities(db: Session, limit: int = 20) -> list[TrendScore]:
    rows = latest_scores(db)
    rows.sort(key=lambda r: r.opportunity_score, reverse=True)
    return rows[:limit]


def by_category(db: Session) -> dict[str, list[TrendScore]]:
    rows = latest_scores(db)
    out: dict[str, list[TrendScore]] = {}
    for r in rows:
        out.setdefault(r.category or "Diğer", []).append(r)
    for cat in out:
        out[cat].sort(key=lambda r: r.avg_last_7, reverse=True)
    return out


def keyword_timeseries(db: Session, keyword: str) -> list[TimeSeriesPoint]:
    return (
        db.query(TimeSeriesPoint)
        .filter(TimeSeriesPoint.keyword == keyword)
        .order_by(TimeSeriesPoint.date.asc())
        .all()
    )


def keyword_rising(db: Session, keyword: str, limit: int = 20) -> list[RisingQuery]:
    return (
        db.query(RisingQuery)
        .filter(RisingQuery.parent_keyword == keyword)
        .order_by(RisingQuery.collected_at.desc(), RisingQuery.growth.desc())
        .limit(limit)
        .all()
    )


# ─── Cannibalization Detection ──────────────────────────────────────────────

def detect_cannibalization(db: Session) -> list[dict]:
    """Aynı sorgu için birden fazla sayfan ranking yapıyor mu? (SEO'da kötü).

    Search Console verisine bakar: aynı query → birden fazla page varsa cannibalization.
    """
    from .models import SearchConsoleQuery
    from collections import defaultdict

    rows = (
        db.query(SearchConsoleQuery)
        .filter(SearchConsoleQuery.period_days == 28)
        .filter(SearchConsoleQuery.page.isnot(None))
        .filter(SearchConsoleQuery.impressions >= 10)
        .all()
    )

    by_query: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_query[r.query].append({
            "page": r.page,
            "clicks": r.clicks,
            "impressions": r.impressions,
            "ctr": r.ctr,
            "position": r.position,
        })

    cannibalized = []
    for query, pages in by_query.items():
        if len(pages) < 2:
            continue
        # Pozisyon farkı çok azsa rekabet ediyorlar
        positions = sorted([p["position"] for p in pages])
        if positions[1] - positions[0] > 20:
            continue  # ikinci sayfa çok geride, rekabet değil
        pages.sort(key=lambda p: p["position"])
        cannibalized.append({
            "query": query,
            "page_count": len(pages),
            "pages": pages,
            "best_position": pages[0]["position"],
            "best_page": pages[0]["page"],
            "total_impressions": sum(p["impressions"] for p in pages),
            "total_clicks": sum(p["clicks"] for p in pages),
            "severity": "high" if len(pages) >= 3 else "medium",
        })

    cannibalized.sort(key=lambda c: c["total_impressions"], reverse=True)
    return cannibalized


def topic_authority_scores(db: Session, clusters: list[dict] | None = None) -> list[dict]:
    """Her cluster için authority skoru: kaç kelime kapsanıyor + ortalama performans."""
    from .models import SearchConsoleQuery, SiteContent
    from . import site_coverage

    if not clusters:
        return []

    contents = db.query(SiteContent).all()
    sc_by_query: dict[str, dict] = {}
    for r in db.query(SearchConsoleQuery).filter(SearchConsoleQuery.period_days == 28).all():
        sc_by_query[r.query] = {"position": r.position, "clicks": r.clicks, "impressions": r.impressions}

    out = []
    for cluster in clusters:
        kws = cluster.get("keywords", [])
        if not kws:
            continue
        covered = 0
        total_clicks = 0
        positions = []
        for kw in kws:
            cov_score, _ = site_coverage.coverage_score(kw, contents)
            if cov_score >= 0.5:
                covered += 1
            sc = sc_by_query.get(kw)
            if sc:
                total_clicks += sc["clicks"]
                if sc["position"] > 0:
                    positions.append(sc["position"])

        coverage_pct = (covered / len(kws)) * 100 if kws else 0
        avg_position = sum(positions) / len(positions) if positions else 0
        # Authority: kapsama × ranking gücü (düşük pozisyon = iyi)
        if avg_position > 0:
            position_score = max(0, 100 - avg_position * 5)  # pos 1=95, pos 10=50, pos 20=0
        else:
            position_score = 0
        authority = round(coverage_pct * 0.4 + position_score * 0.6, 1)

        out.append({
            "cluster": cluster["name"],
            "theme": cluster.get("theme", ""),
            "size": len(kws),
            "covered": covered,
            "coverage_pct": round(coverage_pct, 1),
            "avg_position": round(avg_position, 1) if avg_position else None,
            "total_clicks": total_clicks,
            "authority_score": authority,
            "verdict": "strong" if authority >= 60 else "medium" if authority >= 30 else "weak",
        })
    out.sort(key=lambda x: x["authority_score"], reverse=True)
    return out


# ─── SMART: Pattern correlation ─────────────────────────────────────────────

def correlated_keywords(db: Session, keyword: str, top_n: int = 8) -> list[dict]:
    """Aynı trend şeklini gösteren takipteki kelimeleri bul (Pearson korelasyon).

    Son 30 günü hizalanmış noktalar üzerinden hesaplar.
    """
    target_points = (
        db.query(TimeSeriesPoint)
        .filter(TimeSeriesPoint.keyword == keyword)
        .order_by(TimeSeriesPoint.date.desc())
        .limit(60)
        .all()
    )
    if len(target_points) < 7:
        return []

    target_by_date = {p.date.date().isoformat(): p.interest for p in target_points}

    others = (
        db.query(Keyword)
        .filter(Keyword.is_active == True, Keyword.keyword != keyword)
        .all()
    )

    results = []
    for k in others:
        pts = (
            db.query(TimeSeriesPoint)
            .filter(TimeSeriesPoint.keyword == k.keyword)
            .order_by(TimeSeriesPoint.date.desc())
            .limit(60)
            .all()
        )
        if len(pts) < 7:
            continue

        # Aynı tarihler için eşleştirme
        their_by_date = {p.date.date().isoformat(): p.interest for p in pts}
        common = sorted(set(target_by_date.keys()) & set(their_by_date.keys()))
        if len(common) < 7:
            continue

        x = [target_by_date[d] for d in common]
        y = [their_by_date[d] for d in common]

        # Pearson r
        n = len(x)
        mean_x = sum(x) / n
        mean_y = sum(y) / n
        cov = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
        var_x = sum((xi - mean_x) ** 2 for xi in x)
        var_y = sum((yi - mean_y) ** 2 for yi in y)
        denom = (var_x * var_y) ** 0.5
        if denom == 0:
            continue
        r = cov / denom

        if abs(r) < 0.25:  # çok zayıf olanları at
            continue

        results.append({
            "keyword": k.keyword,
            "category": k.category,
            "correlation": round(r, 3),
            "direction": "pozitif" if r > 0 else "negatif",
            "data_points": n,
        })

    results.sort(key=lambda x: abs(x["correlation"]), reverse=True)
    return results[:top_n]


# ─── SMART: Forecast ────────────────────────────────────────────────────────

def forecast_keyword(db: Session, keyword: str, days: int = 7) -> list[dict]:
    """Basit linear regression ile son 14 günden sonraki N günü tahmin et."""
    points = keyword_timeseries(db, keyword)
    if len(points) < 7:
        return []

    recent = points[-14:] if len(points) >= 14 else points
    x = list(range(len(recent)))
    y = [p.interest for p in recent]
    n = len(x)
    mean_x = sum(x) / n
    mean_y = sum(y) / n

    num = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
    den = sum((x[i] - mean_x) ** 2 for i in range(n))
    slope = num / den if den else 0.0
    intercept = mean_y - slope * mean_x

    last_date = recent[-1].date
    out = []
    for i in range(1, days + 1):
        future_x = n - 1 + i
        pred = max(0.0, min(100.0, intercept + slope * future_x))
        out.append({
            "date": (last_date + timedelta(days=i)).isoformat(),
            "predicted": round(pred, 2),
        })
    return out


def seasonality_aware_forecast(db: Session, keyword: str, days: int = 30) -> list[dict]:
    """Mevsimsellik + son trend kombinasyonu (linear regression'dan çok daha iyi).

    Algoritma:
    - Son 14 gün: trend taban değeri
    - 5 yıllık aylık profilden mevsimsel çarpan
    - Hedef gün: baseline × (target_month_avg / current_month_avg)
    - Confidence band: ±%20
    """
    from .seasonality import keyword_monthly_profile

    points = keyword_timeseries(db, keyword)
    if len(points) < 7:
        return []

    profile = keyword_monthly_profile(db, keyword)
    last_date = points[-1].date

    # Son 14 günün ortalaması — trend baseline
    recent = points[-14:] if len(points) >= 14 else points
    baseline = sum(p.interest for p in recent) / len(recent)

    cur_month = last_date.month
    cur_month_avg = (profile.get(cur_month) or {}).get("mean") if profile else None

    out = []
    for i in range(1, days + 1):
        future_date = last_date + timedelta(days=i)
        target_month = future_date.month

        # Hem cur_month hem target_month için anlamlı tarihsel veri olmalı
        # (en az ~5 üstü ortalama). Yoksa seasonal multiplier güvenilmez → düz baseline.
        if profile and cur_month_avg and cur_month_avg >= 5.0:
            target_month_avg = (profile.get(target_month) or {}).get("mean")
            if target_month_avg is not None and target_month_avg >= 1.0:
                seasonal_mult = target_month_avg / cur_month_avg
                # Aşırı uçlardan koru (örn. yeni kelimelerde tek ay zirve yapmış olabilir)
                seasonal_mult = max(0.3, min(3.0, seasonal_mult))
            else:
                seasonal_mult = 1.0
        else:
            seasonal_mult = 1.0

        predicted = max(0.0, min(100.0, baseline * seasonal_mult))
        # Geleceğe gittikçe belirsizlik artar
        uncertainty = 0.15 + (i / days) * 0.15  # %15 → %30
        low = max(0.0, predicted * (1 - uncertainty))
        high = min(100.0, predicted * (1 + uncertainty))

        out.append({
            "date": future_date.isoformat(),
            "predicted": round(predicted, 2),
            "confidence_low": round(low, 2),
            "confidence_high": round(high, 2),
            "seasonal_mult": round(seasonal_mult, 2),
        })
    return out


# ─── SMART: Anomaly detection ────────────────────────────────────────────────

def detect_anomaly(db: Session, keyword: str) -> dict:
    """Son nokta tarihsel ortalamadan kaç std uzakta?"""
    points = keyword_timeseries(db, keyword)
    if len(points) < 7:
        return {"is_anomaly": False, "z_score": 0.0, "last_value": 0.0}

    history = [p.interest for p in points[:-1]]
    last = points[-1].interest

    if len(history) < 2:
        return {"is_anomaly": False, "z_score": 0.0, "last_value": last}

    m = mean(history)
    try:
        s = stdev(history)
    except Exception:
        s = 0
    z = (last - m) / s if s > 0 else 0.0

    return {
        "is_anomaly": abs(z) >= ANOMALY_Z_THRESHOLD and last >= 10,
        "z_score": round(z, 2),
        "last_value": last,
        "history_mean": round(m, 2),
    }


def all_anomalies(db: Session) -> list[dict]:
    """Tüm aktif kelimelerin anomali skoru."""
    keywords = db.query(Keyword).filter(Keyword.is_active == True).all()
    out = []
    for k in keywords:
        a = detect_anomaly(db, k.keyword)
        if a["is_anomaly"]:
            out.append({"keyword": k.keyword, "category": k.category, **a})
    out.sort(key=lambda x: abs(x["z_score"]), reverse=True)
    return out
