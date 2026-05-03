"""Ayarlar ve kategoriler için API endpoint'leri."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import app_settings
from ..auth import require_admin
from ..config import settings as env_settings
from ..db import get_db


router = APIRouter(prefix="/api/settings", tags=["settings"], dependencies=[Depends(require_admin)])

ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"

# .env'de UI'dan değiştirilebilen anahtarlar
ENV_EDITABLE_KEYS = {
    "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "AI_PROVIDER",
    "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID",
    "GOOGLE_ADS_LOGIN_CUSTOMER_ID", "GOOGLE_ADS_API_VERSION",
    "GOOGLE_ADS_LANGUAGE_ID", "GOOGLE_ADS_GEO_TARGET_ID",
    "SEARCH_CONSOLE_SITE_URL",
    "ADMIN_PASSWORD", "JWT_SECRET",
    "PYTRENDS_GEO", "PYTRENDS_HL", "PYTRENDS_TIMEFRAME",
    "REQUEST_DELAY_SECONDS", "MAX_RETRIES",
    "COLLECT_HOUR", "COLLECT_MINUTE", "TIMEZONE",
}

# Maskelenecek hassas anahtarlar
SENSITIVE_KEYS = {
    "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
    "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "ADMIN_PASSWORD", "JWT_SECRET",
}


def _mask(value: str) -> str:
    if not value or len(value) < 8:
        return "***"
    return f"{value[:4]}…{value[-4:]}"


# ─── App Settings (DB) ──────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    updates: dict[str, str]


@router.get("")
def get_settings(db: Annotated[Session, Depends(get_db)]):
    """Tüm ayarları döndürür. configured=false ise UI ilk-kurulum gösterir."""
    return {
        "settings": app_settings.get_all(db),
        "configured": app_settings.is_configured(db),
    }


@router.put("")
def update_settings(body: SettingsUpdate, db: Annotated[Session, Depends(get_db)]):
    result = app_settings.set_many(db, body.updates)
    return {"settings": result, "configured": app_settings.is_configured(db)}


@router.post("/mark-configured")
def mark_configured(db: Annotated[Session, Depends(get_db)]):
    app_settings.mark_configured(db)
    return {"configured": True}


# ─── Categories (DB) ────────────────────────────────────────────────────────

class CategoryIn(BaseModel):
    name: str
    triggers: str = ""
    color: str | None = None


@router.get("/categories")
def list_categories(db: Annotated[Session, Depends(get_db)]):
    return app_settings.list_categories(db)


@router.post("/categories")
def add_category(body: CategoryIn, db: Annotated[Session, Depends(get_db)]):
    return app_settings.add_category(db, body.name, body.triggers, body.color)


@router.delete("/categories/{cat_id}")
def remove_category(cat_id: int, db: Annotated[Session, Depends(get_db)]):
    ok = app_settings.delete_category(db, cat_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Kategori bulunamadı")
    return {"removed": True}


class TemplateIn(BaseModel):
    template: str  # education | ecommerce | saas | content


@router.post("/categories/load-template")
def load_template(body: TemplateIn, db: Annotated[Session, Depends(get_db)]):
    if body.template not in app_settings.DEFAULT_CATEGORY_TEMPLATES:
        raise HTTPException(status_code=400, detail="Geçersiz şablon")
    added = app_settings.load_template(db, body.template)
    return {"added": added, "template": body.template}


@router.get("/category-templates")
def list_templates():
    return {
        name: items
        for name, items in app_settings.DEFAULT_CATEGORY_TEMPLATES.items()
    }


# ─── .env Editor (API anahtarları) ──────────────────────────────────────────

@router.get("/env")
def get_env_view():
    """Mevcut .env değerlerini maskelenmiş şekilde döndürür."""
    if not ENV_PATH.exists():
        return {"items": {}}

    items: dict[str, dict] = {}
    text = ENV_PATH.read_text(encoding="utf-8")
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip()
        if k not in ENV_EDITABLE_KEYS:
            continue
        items[k] = {
            "value": _mask(v) if (k in SENSITIVE_KEYS and v) else v,
            "is_set": bool(v),
            "is_sensitive": k in SENSITIVE_KEYS,
        }
    # Tanımlanmamış olanları boş ekle
    for k in ENV_EDITABLE_KEYS:
        if k not in items:
            items[k] = {
                "value": "",
                "is_set": False,
                "is_sensitive": k in SENSITIVE_KEYS,
            }
    return {"items": items}


class EnvUpdate(BaseModel):
    updates: dict[str, str]


@router.put("/env")
def update_env(body: EnvUpdate):
    """Sadece izin verilen .env anahtarlarını günceller. Restart gerekir."""
    if not ENV_PATH.exists():
        raise HTTPException(status_code=500, detail=".env dosyası yok")

    text = ENV_PATH.read_text(encoding="utf-8")
    written = []
    skipped = []

    for k, v in body.updates.items():
        if k not in ENV_EDITABLE_KEYS:
            skipped.append(k)
            continue
        # Boş string gönderilirse silmiş gibi muamele et (ama satırı tut)
        pattern = re.compile(rf"^{re.escape(k)}=.*$", re.MULTILINE)
        if pattern.search(text):
            text = pattern.sub(f"{k}={v}", text)
        else:
            text += f"\n{k}={v}"
        written.append(k)

    ENV_PATH.write_text(text, encoding="utf-8")

    # .env dosyası değiştirildi → settings nesnesini yeniden yükle
    # Restart gerektirmeden anahtarlar hemen aktif olur.
    from ..config import reload_settings
    try:
        changed = reload_settings()
        scheduler_keys = {"COLLECT_HOUR", "COLLECT_MINUTE", "TIMEZONE"}
        needs_restart = any(k in scheduler_keys for k in written)
    except Exception as e:
        return {
            "written": written,
            "skipped": skipped,
            "note": f"Kaydedildi ama reload basarisiz: {e}. Manuel restart gerekebilir.",
        }

    return {
        "written": written,
        "skipped": skipped,
        "reloaded": True,
        "needs_restart": needs_restart,
        "note": (
            "Zamanlayıcı ayarı değişti, scheduler için backend restart gerekli."
            if needs_restart
            else "✓ Anahtarlar hemen aktif — restart gerek yok."
        ),
    }
