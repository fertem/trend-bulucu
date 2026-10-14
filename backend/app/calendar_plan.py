"""Mevsimsel yayın takvimi.

5 yıllık tarihsel veriden her kelimenin zirve ayını çıkarır, zirveden 4 hafta önce
"en geç yayınla" tarihi önerir ve sitedeki kapsama göre yaz / güncelle der.
Belirgin mevsimselliği olmayan kelimeler (zirve lift < %15) dışarıda kalır.
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.orm import Session

from . import insights, seasonality, site_coverage
from .models import HistoricalPoint, Keyword, SiteContent

MIN_PEAK_LIFT = 15.0       # % — bunun altı "mevsimsel değil"
SECONDARY_MIN_LIFT = 15.0
LEAD_DAYS = 28             # zirveden ne kadar önce yayınlanmalı (indekslenme payı)


def _add_months(y: int, m: int, n: int) -> tuple[int, int]:
    idx = (y * 12 + (m - 1)) + n
    return idx // 12, idx % 12 + 1


def _next_occurrence(month: int, today: date) -> date:
    """Verilen ayın bir sonraki (bu ay dahil) 1'i."""
    y = today.year if month >= today.month else today.year + 1
    return date(y, month, 1)


def keyword_season(db: Session, keyword: str) -> dict | None:
    profile = seasonality.keyword_monthly_profile(db, keyword)
    if not profile:
        return None
    months = [(m, p) for m, p in profile.items() if p]
    if len(months) < 6:
        return None
    peak_m, peak_p = max(months, key=lambda x: x[1]["mean"])
    if peak_p["lift_pct"] < MIN_PEAK_LIFT:
        return None
    # İkincil zirve: ana zirveye bitişik olmayan, lift ≥ eşik olan en yüksek ay
    secondary = None
    for m, p in sorted(months, key=lambda x: x[1]["mean"], reverse=True):
        if m == peak_m:
            continue
        if abs(m - peak_m) in (1, 11):
            continue
        if p["lift_pct"] >= SECONDARY_MIN_LIFT:
            secondary = {"month": m, "lift_pct": p["lift_pct"]}
        break
    # Düşük sezon: en düşük ay
    low_m, low_p = min(months, key=lambda x: x[1]["mean"])
    return {
        "peak_month": peak_m,
        "peak_lift_pct": round(peak_p["lift_pct"], 1),
        "peak_mean": peak_p["mean"],
        "secondary": secondary,
        "low_month": low_m,
        "low_lift_pct": round(low_p["lift_pct"], 1),
        "years": len({y["year"] for y in peak_p.get("years", [])}),
    }


def build_calendar(db: Session, months: int = 12, today: date | None = None) -> dict:
    today = today or date.today()
    hist_keywords = {k for (k,) in db.query(HistoricalPoint.keyword).distinct().all()}
    tracked = {k.keyword: k for k in db.query(Keyword).filter(Keyword.is_active == True).all()}  # noqa: E712
    contents = db.query(SiteContent).all()
    site_scanned = len(contents) > 0
    scores = {i["keyword"]: i for i in insights.compute_opportunities_v2(db)}

    entries: list[dict] = []
    for kw in sorted(hist_keywords):
        season = keyword_season(db, kw)
        if not season:
            continue
        k = tracked.get(kw)
        cov = None
        slug = None
        if site_scanned:
            cov, best = site_coverage.coverage_score(kw, contents)
            slug = best.slug if best else None
        action = "write" if (cov is None or cov < site_coverage.COVERED_THRESHOLD) else "refresh"
        sc = scores.get(kw)

        peaks = [{"month": season["peak_month"], "lift_pct": season["peak_lift_pct"], "primary": True}]
        if season["secondary"]:
            peaks.append({"month": season["secondary"]["month"], "lift_pct": season["secondary"]["lift_pct"], "primary": False})

        for pk in peaks:
            peak_date = _next_occurrence(pk["month"], today)
            publish_by = peak_date - timedelta(days=LEAD_DAYS)
            late = publish_by < today
            # Takvimde "harekete geçme" ayı: yayın tarihi geçmişse bu ay
            slot = today if late else publish_by
            entries.append({
                "keyword": kw,
                "category": k.category if k else None,
                "peak_month": pk["month"],
                "peak_lift_pct": pk["lift_pct"],
                "primary": pk["primary"],
                "peak_date": peak_date.isoformat(),
                "publish_by": publish_by.isoformat(),
                "late": late,
                "days_left": (publish_by - today).days,
                "action": action,
                "coverage_score": round(cov, 2) if cov is not None else None,
                "best_match_slug": slug,
                "score": sc["score"] if sc else None,
                "low_month": season["low_month"],
                "years": season["years"],
                "_slot": (slot.year, slot.month),
            })

    # Aylara grupla
    grid = []
    y, m = today.year, today.month
    by_slot: dict[tuple[int, int], list[dict]] = {}
    for e in entries:
        by_slot.setdefault(e.pop("_slot"), []).append(e)
    for i in range(months):
        yy, mm = _add_months(y, m, i)
        items = by_slot.get((yy, mm), [])
        items.sort(key=lambda e: (-(e["score"] or 0), -e["peak_lift_pct"]))
        grid.append({"year": yy, "month": mm, "is_current": i == 0, "items": items})

    return {
        "today": today.isoformat(),
        "lead_days": LEAD_DAYS,
        "min_peak_lift": MIN_PEAK_LIFT,
        "months": grid,
        "total_items": len(entries),
        "seasonal_keywords": len({e["keyword"] for e in entries}),
        "historical_keywords": len(hist_keywords),
        "site_scanned": site_scanned,
    }
