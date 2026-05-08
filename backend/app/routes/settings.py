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
    "SERPAPI_KEY", "APIFY_API_TOKEN",
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
    "SERPAPI_KEY", "APIFY_API_TOKEN",
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
    # Strip surrounding quotes/whitespace on path-like fields so that copy-pasted
    # values (e.g. "C:\Users\..." with quotes) save cleanly.
    cleaned = dict(body.updates)
    for key in ("site_path", "brand_url"):
        if key in cleaned and isinstance(cleaned[key], str):
            v = cleaned[key].strip()
            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                v = v[1:-1].strip()
            cleaned[key] = v
    result = app_settings.set_many(db, cleaned)
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


# ─── API Key validation ─────────────────────────────────────────────────────

class TestKeyIn(BaseModel):
    provider: str  # "anthropic" | "openai" | "google_ads" | "search_console"


@router.post("/test-key")
def test_api_key(body: TestKeyIn):
    """Test if the configured API key for a provider actually works.

    Returns: {ok: bool, message: str, detail?: str}
    """
    provider = body.provider
    if provider == "anthropic":
        if not env_settings.anthropic_api_key:
            return {"ok": False, "message": "Anthropic anahtarı tanımlı değil"}
        try:
            from anthropic import Anthropic
            client = Anthropic(api_key=env_settings.anthropic_api_key)
            # Minimal probe: 1-token completion
            client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1,
                messages=[{"role": "user", "content": "ok"}],
            )
            return {"ok": True, "message": "✓ Anthropic Claude erişilebilir"}
        except Exception as e:
            msg = str(e)[:200]
            hint = ""
            if "401" in msg or "authentication" in msg.lower() or "invalid" in msg.lower():
                hint = " — Anahtar geçersiz veya iptal edilmiş"
            elif "credit" in msg.lower() or "quota" in msg.lower() or "billing" in msg.lower():
                hint = " — Hesap kredi/kota sorunu"
            return {"ok": False, "message": "Anthropic test başarısız", "detail": msg + hint}

    if provider == "openai":
        if not env_settings.openai_api_key:
            return {"ok": False, "message": "OpenAI anahtarı tanımlı değil"}
        try:
            from openai import OpenAI
            client = OpenAI(api_key=env_settings.openai_api_key)
            # Minimal probe: list models (1 call, no tokens spent)
            models = client.models.list()
            count = sum(1 for _ in models.data[:3])
            return {"ok": True, "message": f"✓ OpenAI erişilebilir ({count}+ model var)"}
        except Exception as e:
            msg = str(e)[:200]
            hint = ""
            if "401" in msg or "invalid" in msg.lower() or "authentication" in msg.lower():
                hint = " — Anahtar geçersiz"
            elif "quota" in msg.lower() or "billing" in msg.lower():
                hint = " — Kota/billing sorunu"
            return {"ok": False, "message": "OpenAI test başarısız", "detail": msg + hint}

    if provider == "serpapi":
        from .. import serpapi_collector
        return serpapi_collector.test_connection()

    if provider == "apify":
        from .. import apify_collector
        return apify_collector.test_connection()

    if provider == "google_ads":
        if not env_settings.has_google_ads:
            return {"ok": False, "message": "Google Ads .env'de yapılandırılmamış"}
        try:
            from .. import google_ads
            # Token refresh = effective auth check (no quota cost)
            google_ads._refresh_access_token()
            return {"ok": True, "message": f"✓ Google Ads OAuth çalışıyor (customer: {env_settings.google_ads_customer_id})"}
        except Exception as e:
            msg = str(e)[:200]
            hint = ""
            if "invalid_grant" in msg.lower():
                hint = " — Refresh token süresi dolmuş, OAuth'u yenile"
            elif "invalid_client" in msg.lower():
                hint = " — Client ID/Secret hatalı"
            return {"ok": False, "message": "Google Ads test başarısız", "detail": msg + hint}

    if provider == "search_console":
        try:
            from .. import search_console
            sites = search_console.list_sites()
            if sites:
                count = len(sites)
                return {"ok": True, "message": f"✓ Search Console erişilebilir ({count} site doğrulanmış)"}
            return {"ok": True, "message": "Search Console erişilebilir ama doğrulanmış site yok"}
        except Exception as e:
            msg = str(e)[:200]
            hint = ""
            if "credentials" in msg.lower() or "oauth" in msg.lower():
                hint = " — OAuth credentials.json eksik veya scope yetersiz"
            return {"ok": False, "message": "Search Console test başarısız", "detail": msg + hint}

    raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")


# ─── Site path validation ─────────────────────────────────────────────────


class TestSitePathIn(BaseModel):
    path: str | None = None  # if not provided, uses currently-saved DB value


@router.post("/test-site-path")
def test_site_path(body: TestSitePathIn, db: Annotated[Session, Depends(get_db)]):
    """Verify a local site path exists and looks like a Next.js / blog folder."""
    path_str = (body.path or "").strip()
    if not path_str:
        path_str = app_settings.get(db, "site_path") or env_settings.kod_org_path or ""

    # Strip surrounding quotes — common copy-paste artifact
    path_str = path_str.strip()
    if (path_str.startswith('"') and path_str.endswith('"')) or (path_str.startswith("'") and path_str.endswith("'")):
        path_str = path_str[1:-1].strip()

    if not path_str:
        return {"ok": False, "message": "Site yolu boş — önce bir yol gir"}

    p = Path(path_str)
    if not p.exists():
        return {
            "ok": False,
            "message": "Bu yol mevcut değil",
            "detail": f"Filesystem'de bulunamadı: {path_str}",
        }
    if not p.is_dir():
        return {
            "ok": False,
            "message": "Yol bir dizin değil (dosya gözüküyor)",
            "detail": str(p),
        }

    app_dir = p / "app"
    blog_dir = p / "app" / "blog"
    has_app = app_dir.exists() and app_dir.is_dir()
    has_blog = blog_dir.exists() and blog_dir.is_dir()

    if not has_app:
        # Hâlâ kullanılabilir olabilir — markdown blog vb. için
        return {
            "ok": True,
            "message": "Yol mevcut ama 'app/' klasörü yok",
            "detail": "Next.js projesi gibi durmuyor. Markdown blog ise sorun değil; site tarayıcı tüm .md / .mdx dosyalarını arar.",
            "warning": True,
        }

    # Count subfolders for a quick estimate
    try:
        page_count = sum(1 for d in app_dir.iterdir() if d.is_dir() and not d.name.startswith("(") and not d.name.startswith("_"))
    except PermissionError:
        return {"ok": False, "message": "Klasöre erişim izni yok", "detail": str(p)}

    blog_count = 0
    if has_blog:
        try:
            blog_count = sum(1 for d in blog_dir.iterdir() if d.is_dir() and not d.name.startswith("(") and not d.name.startswith("_"))
        except Exception:
            pass

    msg = f"✓ Yol geçerli — {page_count} sayfa"
    if blog_count > 0:
        msg += f" + {blog_count} blog post"
    return {"ok": True, "message": msg, "detail": str(p)}


# ─── Health check / connection status ───────────────────────────────────────

@router.get("/health")
def health_check(db: Annotated[Session, Depends(get_db)]):
    """Settings ana ekranında her entegrasyon için doluluk + durum.

    Test çağrıları YAPMAZ — sadece config var mı diye bakar (hızlı).
    """
    from ..models import Keyword, Category, SiteContent, SearchConsoleQuery, KeywordVolume

    brand_name = app_settings.get(db, "brand_name") or ""
    brand_desc = app_settings.get(db, "brand_description") or ""
    site_path = app_settings.get(db, "site_path") or env_settings.kod_org_path or ""

    cat_count = db.query(Category).count()
    kw_count = db.query(Keyword).filter(Keyword.is_active == True).count()
    site_indexed = db.query(SiteContent).count()
    sc_query_count = db.query(SearchConsoleQuery).count()
    ads_volume_count = db.query(KeywordVolume).count()

    items = [
        {
            "id": "brand",
            "label": "Marka bilgileri",
            "status": "ok" if (brand_name and brand_desc) else "missing",
            "detail": brand_name or "tanımlı değil",
            "action_url": "/settings",
            "tab": "brand",
        },
        {
            "id": "ai",
            "label": "AI sağlayıcı",
            "status": (
                "ok" if (env_settings.anthropic_api_key or env_settings.openai_api_key)
                else "missing"
            ),
            "detail": (
                "Anthropic + OpenAI" if env_settings.anthropic_api_key and env_settings.openai_api_key
                else "Anthropic" if env_settings.anthropic_api_key
                else "OpenAI" if env_settings.openai_api_key
                else "anahtar yok"
            ),
            "action_url": "/settings",
            "tab": "api",
        },
        {
            "id": "categories",
            "label": "Kategoriler",
            "status": "ok" if cat_count >= 3 else ("partial" if cat_count > 0 else "missing"),
            "detail": f"{cat_count} tanımlı" if cat_count else "yok",
            "action_url": "/settings",
            "tab": "categories",
        },
        {
            "id": "keywords",
            "label": "Takip kelimeleri",
            "status": "ok" if kw_count >= 5 else ("partial" if kw_count > 0 else "missing"),
            "detail": f"{kw_count} aktif" if kw_count else "yok",
            "action_url": "/admin",
            "tab": None,
        },
        {
            "id": "site_path",
            "label": "Site yolu",
            "status": "ok" if site_path else "optional",
            "detail": site_path[-40:] if site_path else "tanımlı değil (içerik boşluğu için)",
            "action_url": "/settings",
            "tab": "site",
        },
        {
            "id": "site_scan",
            "label": "Site taraması",
            "status": "ok" if site_indexed > 0 else ("optional" if not site_path else "missing"),
            "detail": f"{site_indexed} sayfa indexli" if site_indexed else ("site yolu yok" if not site_path else "henüz taranmadı"),
            "action_url": "/",
            "tab": None,
        },
        {
            "id": "google_ads",
            "label": "Google Ads",
            "status": (
                "ok" if (env_settings.has_google_ads and ads_volume_count > 0)
                else "partial" if env_settings.has_google_ads
                else "optional"
            ),
            "detail": (
                f"{ads_volume_count} kelime için hacim verisi"
                if ads_volume_count > 0
                else f"yapılandırıldı ama veri yok — Yönetim → \"Hacmi Güncelle\""
                if env_settings.has_google_ads
                else "bağlı değil — opsiyonel (gerçek arama hacmi için, OAuth gerekir)"
            ),
            "action_url": "/admin" if (env_settings.has_google_ads and ads_volume_count == 0) else "/settings",
            "tab": "api" if not env_settings.has_google_ads else None,
            "optional": True,
        },
        {
            "id": "search_console",
            "label": "Search Console",
            "status": (
                "ok" if (env_settings.search_console_site_url and sc_query_count > 0)
                else "partial" if env_settings.search_console_site_url
                else "optional"
            ),
            "detail": (
                f"{sc_query_count} sorgu • {env_settings.search_console_site_url}"
                if (env_settings.search_console_site_url and sc_query_count > 0)
                else f"{env_settings.search_console_site_url} (henüz veri yok — Genel Bakış'tan sync)"
                if env_settings.search_console_site_url
                else "bağlı değil — opsiyonel (gerçek SEO pozisyon/CTR için)"
            ),
            "action_url": "/settings",
            "tab": "api",
            "optional": True,
        },
    ]

    required_ok = sum(1 for it in items if it["id"] in {"brand", "ai", "categories", "keywords"} and it["status"] == "ok")
    optional_ok = sum(1 for it in items if it["status"] == "ok") - required_ok

    return {
        "items": items,
        "required_ok": required_ok,
        "required_total": 4,
        "optional_ok": optional_ok,
        "fully_setup": required_ok == 4,
    }
