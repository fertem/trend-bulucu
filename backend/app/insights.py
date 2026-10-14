"""Akıllı katman: açıklanabilir Fırsat Skoru v2 + "Bugün ne yapmalı" aksiyon akışı.

Skor v2 (0-100) beş bileşenden oluşur, her biri "neden" kodlarıyla açıklanır:
    momentum     (0-35)  7 günlük büyüme ivmesi (ölü kelimeler 0)
    demand       (0-25)  gerçek hacim (Google Ads) yoksa Trends ilgisi
    seo          (0-20)  Search Console konumu: sayfa 2 ve CTR açığı = hızlı kazanç
    coverage     (0-10)  sitede karşılığı yoksa yazma fırsatı
    seasonality  (0-10)  yaklaşan mevsimsel zirve

Aksiyon kuralları bu skoru + GSC + anomali + cannibalization verisini birleştirip
öncelik sıralı, tek tıkla gidilebilen bir yapılacaklar listesi üretir.
"""
from __future__ import annotations

import hashlib
import math
import time
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import analytics, search_console, site_coverage, seasonality
from .models import (
    ActionState,
    HistoricalPoint,
    Keyword,
    KeywordVolume,
    SiteContent,
    TimeSeriesPoint,
)

# ── Ağırlıklar ────────────────────────────────────────────────────────────
W_MOMENTUM = 35
W_DEMAND = 25
W_SEO = 20
W_COVERAGE = 10
W_SEASON = 10

DEAD_INTEREST = 3.0          # avg_last_7 bunun altındaysa ivme sayılmaz
FALLING_PCT = -30.0          # bu kadar düşüş = "izle"
STALE_DAYS = 3               # son veri bundan eskiyse güven düşer

CACHE_TTL = 300              # sn — skor v2 hesaplaması 5 dk önbelleklenir
_cache: dict = {"at": 0.0, "items": None}


def invalidate_cache() -> None:
    _cache["at"] = 0.0
    _cache["items"] = None


# ── Yardımcılar ───────────────────────────────────────────────────────────

def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _last_dates(db: Session) -> dict[str, datetime]:
    rows = (
        db.query(TimeSeriesPoint.keyword, func.max(TimeSeriesPoint.date))
        .group_by(TimeSeriesPoint.keyword)
        .all()
    )
    return {k: d for k, d in rows if d is not None}


def _momentum_windows(db: Session, last_dates: dict[str, datetime]) -> dict[str, tuple[float, float]]:
    """Her kelime için (son 7 gün ort., önceki 7 gün ort.) — kelimenin kendi son
    veri tarihine göre. Takvime göre bakılsaydı toplama birkaç gün aksadığında
    her şey 0 görünürdü; bayatlık ayrıca 'confidence' ile raporlanır."""
    if not last_dates:
        return {}
    oldest_needed = min(last_dates.values()) - timedelta(days=14)
    rows = (
        db.query(TimeSeriesPoint.keyword, TimeSeriesPoint.date, TimeSeriesPoint.interest)
        .filter(TimeSeriesPoint.date >= oldest_needed)
        .all()
    )
    buckets: dict[str, list[tuple[datetime, float]]] = {}
    for k, d, v in rows:
        buckets.setdefault(k, []).append((d, float(v or 0)))
    out: dict[str, tuple[float, float]] = {}
    for k, pts in buckets.items():
        last = last_dates.get(k)
        if not last:
            continue
        cut1 = last - timedelta(days=7)
        cut2 = last - timedelta(days=14)
        recent = [v for d, v in pts if cut1 < d <= last]
        prev = [v for d, v in pts if cut2 < d <= cut1]
        a = sum(recent) / len(recent) if recent else 0.0
        b = sum(prev) / len(prev) if prev else 0.0
        out[k] = (a, b)
    return out


def _sc_index(db: Session) -> list[dict]:
    """GSC satırları (28g) — bulanık eşleşme için bellekte."""
    try:
        from .models import SearchConsoleQuery
        rows = db.query(SearchConsoleQuery).filter(SearchConsoleQuery.period_days == 28).all()
    except Exception:
        return []
    out = []
    for r in rows:
        toks = site_coverage._tokenize(r.query or "")
        if not toks:
            continue
        out.append({"tokens": toks, "row": r})
    return out


def _sc_match(index: list[dict], keyword: str) -> dict | None:
    """Önce birebir, yoksa kelimenin tüm token'larını içeren en çok gösterimli sorgu."""
    kw = (keyword or "").lower().strip()
    kt = site_coverage._tokenize(kw)
    if not kt:
        return None
    exact = [e for e in index if (e["row"].query or "").lower().strip() == kw]
    cands = exact or [e for e in index if kt <= e["tokens"]]
    if not cands:
        return None
    best = max(cands, key=lambda e: (e["row"].impressions or 0, e["row"].clicks or 0))
    return search_console._row_dict(best["row"])


def _historical_keywords(db: Session) -> set[str]:
    return {k for (k,) in db.query(HistoricalPoint.keyword).distinct().all()}


def _peak_info(db: Session, keyword: str, now: datetime) -> dict | None:
    """Mevsimsel profil varsa: zirve ayı, zirveye kalan ay, bu ayın lift'i."""
    profile = seasonality.keyword_monthly_profile(db, keyword)
    if not profile:
        return None
    months = [(m, p["mean"]) for m, p in profile.items() if p]
    if len(months) < 6:
        return None
    peak_month = max(months, key=lambda x: x[1])[0]
    cur = now.month
    months_to_peak = (peak_month - cur) % 12
    cur_profile = profile.get(cur)
    lift = cur_profile["lift_pct"] if cur_profile else 0.0
    peak_lift = profile[peak_month]["lift_pct"] if profile.get(peak_month) else 0.0
    return {
        "peak_month": peak_month,
        "months_to_peak": months_to_peak,
        "lift_pct": lift,
        "peak_lift_pct": peak_lift,
    }


# ── Skor v2 ───────────────────────────────────────────────────────────────

def compute_opportunities_v2(db: Session, use_cache: bool = True) -> list[dict]:
    if use_cache and _cache["items"] is not None and time.time() - _cache["at"] < CACHE_TTL:
        return _cache["items"]

    now = datetime.utcnow()
    scores = analytics.latest_scores(db)
    if not scores:
        return []

    vols = {v.keyword: v for v in db.query(KeywordVolume).all()}
    has_ads = any(v.avg_monthly_searches for v in vols.values())
    contents = db.query(SiteContent).all()
    site_scanned = len(contents) > 0
    sc_configured = search_console.has_data(db)
    last_dates = _last_dates(db)
    windows = _momentum_windows(db, last_dates)
    sc_index = _sc_index(db) if sc_configured else []
    hist_keywords = _historical_keywords(db)

    items: list[dict] = []
    for s in scores:
        kw = s.keyword
        reasons: list[dict] = []
        comp: dict[str, dict] = {}
        metrics: dict = {
            "growth_pct": round(s.growth_pct or 0.0, 1),
            "avg_last_7": round(s.avg_last_7 or 0.0, 1),
            "avg_prev_7": round(s.avg_prev_7 or 0.0, 1),
            "volume_monthly": None,
            "sc_position": None,
            "sc_impressions": None,
            "sc_ctr": None,
            "sc_page": None,
            "coverage_score": None,
            "best_match_slug": None,
            "peak_month": None,
            "months_to_peak": None,
            "lift_pct": None,
        }

        # Kelimenin kendi son 14 günü (takvimden bağımsız); yoksa kayıtlı skor
        if kw in windows:
            avg7, prev7 = windows[kw]
        else:
            avg7, prev7 = (s.avg_last_7 or 0.0), (s.avg_prev_7 or 0.0)
        if prev7 > 0:
            growth = ((avg7 - prev7) / prev7) * 100.0
        elif avg7 > 0:
            growth = 100.0
        else:
            growth = 0.0
        is_hot = growth >= 50 and avg7 >= 5
        no_data = avg7 == 0 and prev7 == 0
        metrics.update({"growth_pct": round(growth, 1), "avg_last_7": round(avg7, 1), "avg_prev_7": round(prev7, 1)})

        # 1) Momentum
        if no_data:
            momentum = 0.0
            reasons.append({"code": "no_data", "params": {}})
        elif avg7 < DEAD_INTEREST:
            momentum = 0.0
            reasons.append({"code": "low_interest", "params": {"value": round(avg7, 1)}})
        elif growth <= FALLING_PCT:
            momentum = 0.0
            reasons.append({"code": "growth_down", "params": {"pct": round(growth)}})
        else:
            momentum = W_MOMENTUM * _clamp(growth / 100.0, 0.0, 1.0)
            if growth >= 20:
                reasons.append({"code": "growth_up", "params": {"pct": round(growth)}})
            if is_hot:
                reasons.append({"code": "hot", "params": {}})
        comp["momentum"] = {"value": round(momentum, 1), "max": W_MOMENTUM}

        # 2) Talep
        v = vols.get(kw)
        if v and v.avg_monthly_searches:
            vol = int(v.avg_monthly_searches)
            metrics["volume_monthly"] = vol
            demand = W_DEMAND * _clamp(math.log10(vol + 1) / 5.0, 0.0, 1.0)
            if vol >= 1000:
                reasons.append({"code": "volume", "params": {"n": vol}})
        else:
            demand = W_DEMAND * _clamp(avg7 / 60.0, 0.0, 1.0)
        comp["demand"] = {"value": round(demand, 1), "max": W_DEMAND}

        # 3) SEO (Search Console)
        sc = _sc_match(sc_index, kw) if sc_configured else None
        if sc:
            pos = sc["position"] or 0.0
            imp = sc["impressions"] or 0
            ctr = sc["ctr"] or 0.0
            metrics.update({"sc_position": pos, "sc_impressions": imp, "sc_ctr": ctr, "sc_page": sc.get("page")})
            if 11 <= pos <= 20:
                seo = 20.0
                reasons.append({"code": "sc_page2", "params": {"pos": round(pos, 1)}})
            elif 4 <= pos < 11:
                seo = 14.0
                reasons.append({"code": "sc_near_top", "params": {"pos": round(pos, 1)}})
            elif pos > 20:
                seo = 9.0
                reasons.append({"code": "sc_deep", "params": {"pos": round(pos, 1)}})
            else:
                seo = 4.0
                reasons.append({"code": "sc_top", "params": {"pos": round(pos, 1)}})
            expected_ctr = max(0.005, 0.30 / (pos ** 1.2)) if pos > 0 else 0.0
            if imp >= 50 and expected_ctr - ctr > 0.02:
                seo = min(float(W_SEO), seo + 4.0)
                reasons.append({"code": "sc_ctr_gap", "params": {"impressions": imp, "ctr": round(ctr * 100, 1)}})
        elif sc_configured:
            seo = 6.0
            reasons.append({"code": "sc_absent", "params": {}})
        else:
            seo = 8.0
        comp["seo"] = {"value": round(seo, 1), "max": W_SEO}

        # 4) Kapsam
        cov = None
        if site_scanned:
            cov, best = site_coverage.coverage_score(kw, contents)
            metrics["coverage_score"] = round(cov, 2)
            metrics["best_match_slug"] = best.slug if best else None
            if cov < 0.3:
                coverage = float(W_COVERAGE)
                reasons.append({"code": "not_covered", "params": {}})
            elif cov < site_coverage.COVERED_THRESHOLD:
                coverage = 7.0
                reasons.append({"code": "thin_coverage", "params": {"pct": round(cov * 100)}})
            else:
                coverage = 3.0
                reasons.append({"code": "covered", "params": {"slug": metrics["best_match_slug"] or ""}})
        else:
            coverage = 5.0
        comp["coverage"] = {"value": round(coverage, 1), "max": W_COVERAGE}

        # 5) Mevsimsellik
        peak = _peak_info(db, kw, now) if kw in hist_keywords else None
        season = 4.0
        if peak:
            metrics.update({
                "peak_month": peak["peak_month"],
                "months_to_peak": peak["months_to_peak"],
                "lift_pct": round(peak["lift_pct"], 1),
            })
            mtp = peak["months_to_peak"]
            if peak["peak_lift_pct"] < 15:
                season = 3.0  # belirgin mevsimsellik yok
            elif 1 <= mtp <= 3:
                season = float(W_SEASON)
                reasons.append({"code": "peak_soon", "params": {"month": peak["peak_month"], "months": mtp}})
            elif mtp == 0:
                season = 6.0
                reasons.append({"code": "peak_now", "params": {"month": peak["peak_month"]}})
            elif peak["lift_pct"] < -20:
                season = 0.0
                reasons.append({"code": "off_season", "params": {"month": peak["peak_month"]}})
            else:
                season = 3.0
        comp["seasonality"] = {"value": round(season, 1), "max": W_SEASON}

        # Toplam + güven
        total = momentum + demand + seo + coverage + season
        confidence = "high"
        last = last_dates.get(kw)
        if no_data:
            total = 0.0
            confidence = "low"
        elif not last or (now - last).days > STALE_DAYS:
            confidence = "low" if not last else "medium"
            total *= 0.85
            reasons.append({"code": "stale_data", "params": {"days": (now - last).days if last else None}})
        score = round(_clamp(total, 0.0, 100.0))

        # Önerilen aksiyon
        sc_pos = metrics["sc_position"]
        if no_data:
            action = "track"
        elif growth <= -40 and prev7 >= 10:
            action = "watch"
        elif cov is not None and cov < site_coverage.COVERED_THRESHOLD and (score >= 45 or season >= W_SEASON):
            action = "write"
        elif sc_pos is not None and 4 <= sc_pos <= 20:
            action = "optimize"
        elif sc_pos is not None and sc_pos < 4:
            action = "maintain"
        elif cov is not None and cov < site_coverage.COVERED_THRESHOLD:
            action = "write"
        else:
            action = "track"

        items.append({
            "keyword": kw,
            "category": s.category,
            "score": score,
            "action": action,
            "confidence": confidence,
            "components": comp,
            "reasons": reasons,
            "metrics": metrics,
            "is_hot": is_hot,
            "data_sources": {"ads": has_ads, "search_console": sc_configured, "site": site_scanned, "historical": kw in hist_keywords},
        })

    items.sort(key=lambda x: (x["score"], x["metrics"]["growth_pct"]), reverse=True)
    _cache["items"] = items
    _cache["at"] = time.time()
    return items


# ── Aksiyon akışı ─────────────────────────────────────────────────────────

ACTION_LIMITS = {"title_ctr": 6, "page2_push": 6, "write_gap": 6, "seasonal_prep": 4, "falling": 3, "cannibalization": 4, "spike": 3}


def _action_id(kind: str, key: str) -> str:
    return hashlib.sha1(f"{kind}|{key.lower().strip()}".encode("utf-8")).hexdigest()[:12]


def build_actions(db: Session) -> list[dict]:
    """Kural tabanlı aksiyon adayları (durum birleştirilmeden)."""
    out: list[dict] = []

    def add(kind: str, key: str, priority: float, params: dict, href: str, keyword: str | None = None):
        out.append({
            "id": _action_id(kind, key),
            "type": kind,
            "priority": round(_clamp(priority, 0, 100)),
            "keyword": keyword if keyword is not None else key,
            "params": params,
            "href": href,
        })

    def explorer(kw: str) -> str:
        from urllib.parse import quote
        return f"/explorer?q={quote(kw)}"

    # 1) Başlık/CTR fırsatı (GSC)
    try:
        for r in search_console.opportunities(db, limit=ACTION_LIMITS["title_ctr"]):
            add("title_ctr", r["query"], 50 + min(45, r["potential_clicks"]),
                {"impressions": r["impressions"], "ctr": round(r["ctr"] * 100, 1), "position": r["position"],
                 "potential_clicks": r["potential_clicks"], "page": r.get("page")},
                explorer(r["query"]))
    except Exception:
        pass

    # 2) Sayfa 2'den it (GSC)
    try:
        for r in search_console.page2_keywords(db, limit=ACTION_LIMITS["page2_push"]):
            add("page2_push", r["query"], 40 + min(40, r["impressions"] / 5),
                {"position": r["position"], "impressions": r["impressions"], "page": r.get("page")},
                explorer(r["query"]))
    except Exception:
        pass

    # 3-5) Skor v2 türevleri
    v2 = compute_opportunities_v2(db)
    writes = [i for i in v2 if i["action"] == "write" and i["score"] >= 40][:ACTION_LIMITS["write_gap"]]
    for i in writes:
        add("write_gap", i["keyword"], i["score"],
            {"score": i["score"], "growth_pct": i["metrics"]["growth_pct"]},
            explorer(i["keyword"]))

    seasonal = [i for i in v2 if i["metrics"]["months_to_peak"] in (1, 2, 3)
                and (i["metrics"]["coverage_score"] is None or i["metrics"]["coverage_score"] < site_coverage.COVERED_THRESHOLD)]
    seasonal.sort(key=lambda i: (i["metrics"]["months_to_peak"], -i["score"]))
    for i in seasonal[:ACTION_LIMITS["seasonal_prep"]]:
        mtp = i["metrics"]["months_to_peak"]
        add("seasonal_prep", i["keyword"], 55 + (3 - mtp) * 10,
            {"month": i["metrics"]["peak_month"], "months": mtp, "score": i["score"]},
            explorer(i["keyword"]))

    falling = [i for i in v2 if i["metrics"]["growth_pct"] <= -40 and i["metrics"]["avg_prev_7"] >= 10]
    falling.sort(key=lambda i: i["metrics"]["growth_pct"])
    for i in falling[:ACTION_LIMITS["falling"]]:
        add("falling", i["keyword"], 35, {"pct": round(i["metrics"]["growth_pct"])}, explorer(i["keyword"]))

    # 6) Cannibalization (GSC)
    try:
        for c in analytics.detect_cannibalization(db)[:ACTION_LIMITS["cannibalization"]]:
            add("cannibalization", c["query"], 45,
                {"page_count": c["page_count"], "pages": [p["page"] for p in c["pages"][:3]]},
                "/seo")
    except Exception:
        pass

    # 7) Ani sıçrama (anomali)
    try:
        for a in analytics.all_anomalies(db)[:ACTION_LIMITS["spike"]]:
            if a["z_score"] >= 2.5:
                add("spike", a["keyword"], 50 + min(30, a["z_score"] * 5),
                    {"z": round(a["z_score"], 1), "last_value": round(a["last_value"])},
                    explorer(a["keyword"]))
    except Exception:
        pass

    # Aynı kelime için birden çok aksiyon → en yüksek öncelikli kalsın
    best: dict[str, dict] = {}
    for a in out:
        k = a["keyword"].lower().strip()
        if k not in best or a["priority"] > best[k]["priority"]:
            best[k] = a
    result = list(best.values())
    result.sort(key=lambda a: a["priority"], reverse=True)
    return result


def get_actions(db: Session, limit: int = 10, include_done: bool = False) -> dict:
    now = datetime.utcnow()
    candidates = build_actions(db)
    states = {s.action_id: s for s in db.query(ActionState).all()}

    visible: list[dict] = []
    counts = {"open": 0, "done": 0, "snoozed": 0}
    for a in candidates:
        st = states.get(a["id"])
        status = "open"
        if st:
            if st.status == "done":
                status = "done"
            elif st.status == "snoozed" and st.snooze_until and st.snooze_until > now:
                status = "snoozed"
        counts[status] += 1
        a["status"] = status
        if status == "open" or include_done:
            visible.append(a)

    return {"items": visible[:limit], "counts": counts, "total_candidates": len(candidates)}


def set_action_state(db: Session, action_id: str, status: str, snooze_days: int = 7) -> dict:
    if status not in ("open", "done", "snoozed"):
        raise ValueError("status open|done|snoozed olmalı")
    st = db.query(ActionState).filter(ActionState.action_id == action_id).one_or_none()
    if not st:
        st = ActionState(action_id=action_id)
        db.add(st)
    st.status = status
    st.updated_at = datetime.utcnow()
    st.snooze_until = datetime.utcnow() + timedelta(days=snooze_days) if status == "snoozed" else None
    db.commit()
    return {"action_id": action_id, "status": status, "snooze_until": st.snooze_until.isoformat() if st.snooze_until else None}
