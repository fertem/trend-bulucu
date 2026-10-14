"""Telegram / Slack bildirimleri (opsiyonel).

.env:
    TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   → Telegram Bot API sendMessage
    SLACK_WEBHOOK_URL                      → Slack Incoming Webhook
    NOTIFY_MIN_SEVERITY                    → info | warn | critical (varsayılan warn)
"""
from __future__ import annotations

import logging

import httpx

from .config import settings

logger = logging.getLogger(__name__)

TURKISH_MONTHS = {1: "Ocak", 2: "Şubat", 3: "Mart", 4: "Nisan", 5: "Mayıs", 6: "Haziran",
                  7: "Temmuz", 8: "Ağustos", 9: "Eylül", 10: "Ekim", 11: "Kasım", 12: "Aralık"}

SEV_ICON = {"critical": "🔴", "warn": "🟠", "info": "🔵"}
TYPE_LABEL = {
    "hot": "Yükseliş",
    "falling": "Düşüş",
    "spike": "Ani sıçrama",
    "seasonal_peak_ahead": "Zirve yaklaşıyor",
    "sc_drop": "Pozisyon kaybı",
}


def has_telegram() -> bool:
    return bool(settings.telegram_bot_token and settings.telegram_chat_id)


def has_slack() -> bool:
    return bool(settings.slack_webhook_url)


def is_configured() -> bool:
    return has_telegram() or has_slack()


def min_severity() -> str:
    v = (settings.notify_min_severity or "warn").lower().strip()
    return v if v in ("info", "warn", "critical") else "warn"


def describe(a: dict) -> str:
    p = a.get("params") or {}
    t = a.get("type")
    if t == "hot":
        return f"+%{p.get('pct')} büyüme (ilgi {p.get('avg7')})"
    if t == "falling":
        return f"%{p.get('pct')} düşüş ({p.get('prev7')} → {p.get('avg7')})"
    if t == "spike":
        return f"{p.get('z')}σ sapma, şu an {p.get('last_value')}"
    if t == "seasonal_peak_ahead":
        return f"zirve {TURKISH_MONTHS.get(p.get('month'), p.get('month'))}, {p.get('months')} ay kaldı"
    if t == "sc_drop":
        return f"pozisyon {p.get('from')} → {p.get('to')} ({p.get('impressions')} gösterim)"
    return ""


def format_alerts(alerts: list[dict], title: str = "Trend Paneli — yeni uyarılar") -> str:
    lines = [f"📣 {title}", ""]
    for a in sorted(alerts, key=lambda x: {"critical": 0, "warn": 1, "info": 2}.get(x["severity"], 3)):
        lines.append(f"{SEV_ICON.get(a['severity'], '•')} {TYPE_LABEL.get(a['type'], a['type'])}: {a['keyword']} — {describe(a)}")
    base = (settings.app_base_url or "").rstrip("/")
    if base:
        lines += ["", f"Panel: {base.replace(':8000', ':3000')}/alerts"]
    return "\n".join(lines)


def send_telegram(text: str) -> dict:
    if not has_telegram():
        return {"ok": False, "error": "Telegram yapılandırılmamış"}
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    r = httpx.post(url, json={"chat_id": settings.telegram_chat_id, "text": text, "disable_web_page_preview": True}, timeout=15.0)
    if r.status_code != 200:
        return {"ok": False, "error": f"{r.status_code} {r.text[:200]}"}
    return {"ok": True}


def send_slack(text: str) -> dict:
    if not has_slack():
        return {"ok": False, "error": "Slack yapılandırılmamış"}
    r = httpx.post(settings.slack_webhook_url, json={"text": text}, timeout=15.0)
    if r.status_code != 200:
        return {"ok": False, "error": f"{r.status_code} {r.text[:200]}"}
    return {"ok": True}


def send(text: str) -> dict:
    """Yapılandırılmış tüm kanallara gönder; kanal başına sonuç döner."""
    out: dict = {}
    if has_telegram():
        try:
            out["telegram"] = send_telegram(text)
        except Exception as e:
            out["telegram"] = {"ok": False, "error": str(e)[:200]}
    if has_slack():
        try:
            out["slack"] = send_slack(text)
        except Exception as e:
            out["slack"] = {"ok": False, "error": str(e)[:200]}
    if not out:
        out["none"] = {"ok": False, "error": "Hiçbir kanal yapılandırılmamış"}
    return out
