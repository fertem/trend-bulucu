"""5 yıllık veri üzerinden mevsimsellik analizleri.

- Aylık profil: her ay için 5 yılın ortalama / medyanı
- Yıldan yıla karşılaştırma
- Mevsimsel "lift": bir kelimenin belirli ayda yıllık ortalamadan ne kadar yüksek aratıldığı
- Ay tahmini: bu ay tarihsel olarak nasıl olur?
"""
from __future__ import annotations

from datetime import datetime
from statistics import mean, median, stdev
from collections import defaultdict

from sqlalchemy.orm import Session

from .models import HistoricalPoint, Keyword


TURKISH_MONTHS = [
    "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
]


def _quantile(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    pos = (len(s) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(s) - 1)
    frac = pos - lo
    return s[lo] * (1 - frac) + s[hi] * frac


def has_historical_data(db: Session) -> bool:
    return db.query(HistoricalPoint).first() is not None


def keyword_monthly_profile(db: Session, keyword: str) -> dict:
    """Her ay (1-12) için: ortalama, medyan, p25, p75 + son 5 yılın değerleri."""
    rows = (
        db.query(HistoricalPoint)
        .filter(HistoricalPoint.keyword == keyword)
        .all()
    )
    if not rows:
        return {}

    by_month: dict[int, list[float]] = defaultdict(list)
    by_month_year: dict[tuple[int, int], list[float]] = defaultdict(list)
    for r in rows:
        by_month[r.month].append(r.interest)
        by_month_year[(r.year, r.month)].append(r.interest)

    profile = {}
    annual_avg = mean([v for vals in by_month.values() for v in vals]) if by_month else 0.0

    for m in range(1, 13):
        vals = by_month.get(m, [])
        if not vals:
            profile[m] = None
            continue

        m_avg = mean(vals)
        years_data = []
        for (yr, mo), yr_vals in by_month_year.items():
            if mo == m:
                years_data.append({"year": yr, "interest": round(mean(yr_vals), 1)})
        years_data.sort(key=lambda x: x["year"])

        lift_pct = ((m_avg / annual_avg) - 1.0) * 100.0 if annual_avg > 0 else 0.0

        profile[m] = {
            "month": m,
            "month_name": TURKISH_MONTHS[m],
            "mean": round(m_avg, 1),
            "median": round(median(vals), 1),
            "p25": round(_quantile(vals, 0.25), 1),
            "p75": round(_quantile(vals, 0.75), 1),
            "lift_pct": round(lift_pct, 1),
            "years": years_data,
        }
    return profile


def keyword_yoy(db: Session, keyword: str) -> list[dict]:
    """Yıl-ay matrisi: [{year: 2022, month: 1, interest: 45.2}, ...]"""
    rows = (
        db.query(HistoricalPoint)
        .filter(HistoricalPoint.keyword == keyword)
        .all()
    )
    if not rows:
        return []

    by_ym: dict[tuple[int, int], list[float]] = defaultdict(list)
    for r in rows:
        by_ym[(r.year, r.month)].append(r.interest)

    return [
        {"year": y, "month": m, "interest": round(mean(v), 1)}
        for (y, m), v in sorted(by_ym.items())
    ]


def current_month_outlook(db: Session, target_month: int | None = None) -> dict:
    """Bu ay için tarihsel öne çıkanları döner.

    Her aktif kelime için:
    - bu ayın 5 yıllık ortalaması (mean)
    - lift_pct (yıllık ortalamadan ne kadar yüksek)
    - peak_month (yılın hangi ayında zirvede olduğu)
    """
    if target_month is None:
        target_month = datetime.utcnow().month

    keywords = db.query(Keyword).filter(Keyword.is_active == True).all()
    out = []

    for k in keywords:
        profile = keyword_monthly_profile(db, k.keyword)
        if not profile:
            continue
        cur = profile.get(target_month)
        if not cur:
            continue

        valid_months = [(m, p) for m, p in profile.items() if p]
        peak = max(valid_months, key=lambda x: x[1]["mean"])[0] if valid_months else None
        trough = min(valid_months, key=lambda x: x[1]["mean"])[0] if valid_months else None

        out.append({
            "keyword": k.keyword,
            "category": k.category,
            "month_avg": cur["mean"],
            "month_median": cur["median"],
            "lift_pct": cur["lift_pct"],
            "peak_month": peak,
            "peak_month_name": TURKISH_MONTHS[peak] if peak else None,
            "trough_month": trough,
            "is_seasonal_peak": peak == target_month,
            "years": cur["years"],
        })

    return {
        "target_month": target_month,
        "target_month_name": TURKISH_MONTHS[target_month],
        "by_lift": sorted(out, key=lambda x: x["lift_pct"], reverse=True),
        "by_volume": sorted(out, key=lambda x: x["month_avg"], reverse=True),
    }


def keyword_this_vs_history(db: Session, keyword: str, target_month: int | None = None) -> dict | None:
    """Bu yılın bu ayı vs tarihsel ortalama."""
    if target_month is None:
        target_month = datetime.utcnow().month
    cur_year = datetime.utcnow().year

    profile = keyword_monthly_profile(db, keyword)
    if not profile or not profile.get(target_month):
        return None

    p = profile[target_month]
    this_year = next((y["interest"] for y in p["years"] if y["year"] == cur_year), None)
    last_year = next((y["interest"] for y in p["years"] if y["year"] == cur_year - 1), None)
    history_avg = p["mean"]

    delta_vs_avg = ((this_year / history_avg) - 1.0) * 100.0 if (this_year is not None and history_avg > 0) else None
    delta_vs_last = ((this_year / last_year) - 1.0) * 100.0 if (this_year is not None and last_year and last_year > 0) else None

    return {
        "keyword": keyword,
        "target_month": target_month,
        "target_month_name": TURKISH_MONTHS[target_month],
        "this_year": this_year,
        "last_year": last_year,
        "history_5y_avg": history_avg,
        "delta_vs_history_pct": round(delta_vs_avg, 1) if delta_vs_avg is not None else None,
        "delta_vs_last_year_pct": round(delta_vs_last, 1) if delta_vs_last is not None else None,
    }


def _linear_regression(xs: list[float], ys: list[float]) -> tuple[float, float, float]:
    """Simple OLS: returns (slope, intercept, rmse). Requires len >= 2."""
    n = len(xs)
    if n < 2:
        return 0.0, ys[0] if ys else 0.0, 0.0
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = sum((x - mx) ** 2 for x in xs) or 1e-9
    slope = num / den
    intercept = my - slope * mx
    residuals = [y - (slope * x + intercept) for x, y in zip(xs, ys)]
    rmse = (sum(r * r for r in residuals) / n) ** 0.5
    return slope, intercept, rmse


def yearly_projection(db: Session, keyword: str, target_month: int | None = None) -> dict | None:
    """Geçmiş yılların aynı ayındaki değerlere bakarak gelecek yıl için projeksiyon.

    Lineer regresyon (yıl → değer) + RMSE bandı + CAGR.
    """
    if target_month is None:
        target_month = datetime.utcnow().month

    yoy = keyword_yoy(db, keyword)
    if not yoy:
        return None

    by_year: dict[int, list[float]] = defaultdict(list)
    for p in yoy:
        if p["month"] == target_month:
            by_year[p["year"]].append(p["interest"])

    if len(by_year) < 2:
        return {
            "keyword": keyword,
            "target_month": target_month,
            "target_month_name": TURKISH_MONTHS[target_month],
            "history": [{"year": y, "value": round(mean(v), 1)} for y, v in sorted(by_year.items())],
            "insufficient_data": True,
        }

    history = sorted([(y, mean(v)) for y, v in by_year.items()])
    years = [float(y) for y, _ in history]
    values = [v for _, v in history]
    next_year = int(years[-1]) + 1

    slope, intercept, rmse = _linear_regression(years, values)
    predicted = slope * next_year + intercept
    lo = max(0.0, predicted - 2 * rmse)
    hi = min(100.0, predicted + 2 * rmse)

    n_periods = years[-1] - years[0]
    cagr = None
    if n_periods >= 1 and values[0] > 0:
        cagr = ((values[-1] / values[0]) ** (1.0 / n_periods) - 1.0) * 100.0

    if slope > 0.5:
        direction = "rising"
    elif slope < -0.5:
        direction = "falling"
    else:
        direction = "flat"

    return {
        "keyword": keyword,
        "target_month": target_month,
        "target_month_name": TURKISH_MONTHS[target_month],
        "history": [{"year": int(y), "value": round(v, 1)} for y, v in history],
        "next_year": next_year,
        "predicted": round(predicted, 1),
        "predicted_low": round(lo, 1),
        "predicted_high": round(hi, 1),
        "rmse": round(rmse, 2),
        "slope_per_year": round(slope, 2),
        "cagr_pct": round(cagr, 1) if cagr is not None else None,
        "direction": direction,
        "insufficient_data": False,
    }

