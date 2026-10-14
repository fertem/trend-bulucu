"""Akıllı uyarılar: önem dereceli, tekrarsız, sebepli; isteğe bağlı Telegram/Slack bildirimi.

Türler:
    hot                   ani yükseliş (kelimenin kendi son 7 günü)
    falling               belirgin düşüş
    spike                 tarihsel ortalamadan ≥2.5σ sapma (anomali)
    seasonal_peak_ahead   mevsimsel zirveye 1-2 ay kaldı
    sc_drop               Search Console'da pozisyon ≥3 geriledi

Her uyarının kimliği tür+kelime'den türetilir: aynı uyarı her gün yeniden
üretilmez, sadece last_seen / parametreleri güncellenir. Kullanıcı "gördüm"
veya "sustur" diyebilir; susturulan uyarı süresi dolana kadar gizlenir.
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from . import analytics, insights, notify, search_console
from .models import Alert

logger = logging.getLogger(__name__)

SEVERITY_RANK = {"critical": 3, "warn": 2, "info": 1}
ACTIVE_WINDOW_DAYS = 14


def _alert_id(kind: str, key: str) -> str:
    return hashlib.sha1(f"{kind}|{key.lower().strip()}".encode("utf-8")).hexdigest()[:12]


def _explorer(kw: str) -> str:
    from urllib.parse import quote
    return f"/explorer?q={quote(kw)}"


# ── Aday üretimi ──────────────────────────────────────────────────────────

def build_candidates(db: Session) -> list[dict]:
    out: list[dict] = []

    def add(kind: str, keyword: str, severity: str, params: dict, href: str):
        out.append({
            "id": _alert_id(kind, keyword),
            "type": kind,
            "keyword": keyword,
            "severity": severity,
            "params": params,
            "href": href,
        })

    v2 = insights.compute_opportunities_v2(db)

    for i in v2:
        m = i["metrics"]
        g = m["growth_pct"]
        a7 = m["avg_last_7"]
        p7 = m["avg_prev_7"]
        kw = i["keyword"]

        # Yükseliş
        if g >= 50 and a7 >= 5:
            sev = "critical" if (g >= 100 and a7 >= 20) else "warn"
            add("hot", kw, sev, {"pct": round(g), "avg7": round(a7), "coverage": m["coverage_score"]}, _explorer(kw))

        # Düşüş
        if g <= -40 and p7 >= 10:
            sev = "warn" if g <= -60 else "info"
            add("falling", kw, sev, {"pct": round(g), "avg7": round(a7), "prev7": round(p7)}, _explorer(kw))

        # Mevsimsel zirve yaklaşıyor
        mtp = m["months_to_peak"]
        if mtp in (1, 2) and (m["coverage_score"] is None or m["coverage_score"] < 0.6):
            add("seasonal_peak_ahead", kw, "warn" if mtp == 1 else "info",
                {"month": m["peak_month"], "months": mtp, "coverage": m["coverage_score"]}, _explorer(kw))

    # Anomali (ani sıçrama)
    try:
        for a in analytics.all_anomalies(db):
            z = a["z_score"]
            if z >= 2.5:
                add("spike", a["keyword"], "critical" if z >= 3.5 else "warn",
                    {"z": round(z, 1), "last_value": round(a["last_value"]), "mean": round(a.get("history_mean", 0))},
                    _explorer(a["keyword"]))
    except Exception as e:
        logger.warning("anomaly alerts failed: %s", e)

    # Search Console pozisyon kaybı
    try:
        for r in search_console.movers(db, min_impressions=30, limit=50):
            if r["direction"] == "down" and abs(r["position_delta"]) >= 3:
                d = abs(r["position_delta"])
                add("sc_drop", r["query"], "critical" if d >= 5 else "warn",
                    {"from": r["prev_position"], "to": r["position"], "delta": round(d, 1),
                     "impressions": r["impressions"], "page": r.get("page")},
                    _explorer(r["query"]))
    except Exception as e:
        logger.warning("sc_drop alerts failed: %s", e)

    # Aynı tür+kelime bir kez
    seen: dict[str, dict] = {}
    for c in out:
        if c["id"] not in seen or SEVERITY_RANK[c["severity"]] > SEVERITY_RANK[seen[c["id"]]["severity"]]:
            seen[c["id"]] = c
    return list(seen.values())


# ── Üretim + saklama ──────────────────────────────────────────────────────

def generate(db: Session) -> dict:
    """Adayları üret, tabloya upsert et. Yeni (ilk kez görülen) uyarıları döner."""
    now = datetime.utcnow()
    candidates = build_candidates(db)
    existing = {a.id: a for a in db.query(Alert).all()}

    new_alerts: list[Alert] = []
    current_ids = set()
    for c in candidates:
        current_ids.add(c["id"])
        a = existing.get(c["id"])
        if a is None:
            a = Alert(
                id=c["id"], type=c["type"], keyword=c["keyword"], severity=c["severity"],
                params=json.dumps(c["params"], ensure_ascii=False), href=c["href"],
                first_seen=now, last_seen=now, status="new", active=True,
            )
            db.add(a)
            new_alerts.append(a)
        else:
            escalated = SEVERITY_RANK[c["severity"]] > SEVERITY_RANK.get(a.severity, 0)
            a.severity = c["severity"]
            a.params = json.dumps(c["params"], ensure_ascii=False)
            a.href = c["href"]
            a.last_seen = now
            # 3 günden uzun süredir pasifti ve yeniden ortaya çıktı → yeniden "new"
            if not a.active and a.status != "muted":
                a.status = "new"
                new_alerts.append(a)
            elif escalated and a.status == "seen":
                a.status = "new"
                new_alerts.append(a)
            a.active = True
            # Susturma süresi dolduysa kaldır
            if a.status == "muted" and a.mute_until and a.mute_until <= now:
                a.status = "seen"
                a.mute_until = None

    for aid, a in existing.items():
        if aid not in current_ids and a.active:
            a.active = False

    db.commit()
    return {
        "candidates": len(candidates),
        "new": [_to_dict(a) for a in new_alerts],
        "generated_at": now.isoformat(),
    }


def generate_and_notify(db: Session) -> dict:
    result = generate(db)
    sent = None
    new_items = [a for a in result["new"] if a["status"] != "muted"]
    if new_items and notify.is_configured():
        min_rank = SEVERITY_RANK.get(notify.min_severity(), 2)
        to_send = [a for a in new_items if SEVERITY_RANK[a["severity"]] >= min_rank]
        if to_send:
            try:
                sent = notify.send(notify.format_alerts(to_send))
            except Exception as e:
                logger.warning("notification failed: %s", e)
                sent = {"error": str(e)}
    result["notified"] = sent
    return result


# ── Okuma / durum ─────────────────────────────────────────────────────────

def _to_dict(a: Alert) -> dict:
    try:
        params = json.loads(a.params or "{}")
    except Exception:
        params = {}
    return {
        "id": a.id,
        "type": a.type,
        "keyword": a.keyword,
        "severity": a.severity,
        "params": params,
        "href": a.href,
        "first_seen": a.first_seen.isoformat() if a.first_seen else None,
        "last_seen": a.last_seen.isoformat() if a.last_seen else None,
        "status": a.status,
        "mute_until": a.mute_until.isoformat() if a.mute_until else None,
        "active": bool(a.active),
    }


def list_alerts(db: Session, severity: str | None = None, status: str | None = None,
                include_inactive: bool = False, limit: int = 100) -> dict:
    now = datetime.utcnow()
    q = db.query(Alert)
    if not include_inactive:
        q = q.filter(Alert.active == True)  # noqa: E712
    rows = q.all()
    items = []
    for a in rows:
        # Susturma süresi dolmuşsa görünür hale getir
        if a.status == "muted" and a.mute_until and a.mute_until <= now:
            a.status = "seen"
            a.mute_until = None
        if severity and a.severity != severity:
            continue
        if status and a.status != status:
            continue
        items.append(_to_dict(a))
    db.commit()
    items.sort(key=lambda x: (x["status"] == "muted", -SEVERITY_RANK.get(x["severity"], 0), x["last_seen"] or ""), reverse=False)
    return {"items": items[:limit], "counts": summary(db)}


def summary(db: Session) -> dict:
    rows = db.query(Alert).filter(Alert.active == True).all()  # noqa: E712
    now = datetime.utcnow()
    out = {"new": 0, "seen": 0, "muted": 0, "critical": 0, "warn": 0, "info": 0, "total": 0}
    for a in rows:
        st = a.status
        if st == "muted" and a.mute_until and a.mute_until <= now:
            st = "seen"
        out["total"] += 1
        out[st] = out.get(st, 0) + 1
        if st != "muted":
            out[a.severity] = out.get(a.severity, 0) + 1
    last = db.query(Alert.last_seen).order_by(Alert.last_seen.desc()).first()
    out["last_generated_at"] = last[0].isoformat() if last and last[0] else None
    return out


def set_state(db: Session, alert_id: str, status: str, mute_days: int = 7) -> dict:
    if status not in ("new", "seen", "muted"):
        raise ValueError("status new|seen|muted olmalı")
    a = db.query(Alert).filter(Alert.id == alert_id).one_or_none()
    if not a:
        raise KeyError(alert_id)
    a.status = status
    a.mute_until = datetime.utcnow() + timedelta(days=mute_days) if status == "muted" else None
    db.commit()
    return _to_dict(a)


def mark_all_seen(db: Session) -> int:
    rows = db.query(Alert).filter(Alert.status == "new").all()
    for a in rows:
        a.status = "seen"
    db.commit()
    return len(rows)
