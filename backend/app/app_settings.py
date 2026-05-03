"""Genel uygulama ayarları — DB tabanlı (markaya/projeye özel).

API anahtarları .env'de kalır (güvenlik). Bu sınıf marka, site yolu, kategoriler
gibi mutable konfigürasyonları yönetir.
"""
from __future__ import annotations

from typing import Any
from sqlalchemy.orm import Session

from .models import AppSetting, Category


# Varsayılan boş değerler — ilk kurulumda kullanıcı doldurur
DEFAULTS: dict[str, str] = {
    "brand_name": "",
    "brand_url": "",
    "brand_description": "",
    "target_audience": "",
    "industry": "",  # "education" | "ecommerce" | "saas" | "content" | "other"
    "geo_target": "TR",
    "language": "tr-TR",
    "site_path": "",  # filesystem path for content gap analysis
    "configured": "false",  # ilk kurulum tamam mı?
}


# Türkçe SEO/içerik üreticiler için varsayılan kategori şablonları
DEFAULT_CATEGORY_TEMPLATES: dict[str, list[dict]] = {
    "education": [
        {"name": "Eğitim", "triggers": "eğitim,ders,kurs,okul,öğretmen,ödev,sınav,müfredat"},
        {"name": "Çocuk Gelişimi", "triggers": "çocuk gelişim,bebek,yaş çocuk,ergen,ergenlik"},
        {"name": "Online Öğrenme", "triggers": "online ders,uzaktan eğitim,e-öğrenme,canlı ders"},
        {"name": "Ebeveynlik", "triggers": "anne,baba,ebeveyn,veli"},
        {"name": "Akademik", "triggers": "matematik,fen,türkçe,ingilizce,sosyal,coğrafya"},
    ],
    "ecommerce": [
        {"name": "Ürün", "triggers": "ürün,fiyat,satın al,sipariş,marka,model"},
        {"name": "İndirim", "triggers": "indirim,kampanya,ucuz,fırsat,promosyon"},
        {"name": "Karşılaştırma", "triggers": "vs,karşılaştırma,en iyi,hangisi,inceleme"},
        {"name": "Yorum", "triggers": "yorum,tavsiye,kullanıcı yorumu,deneyim"},
    ],
    "saas": [
        {"name": "Yazılım", "triggers": "yazılım,uygulama,araç,platform,sistem"},
        {"name": "Karşılaştırma", "triggers": "alternatif,vs,karşılaştırma,en iyi"},
        {"name": "How-to", "triggers": "nasıl,nasıl yapılır,rehber,başlangıç"},
        {"name": "Fiyatlandırma", "triggers": "fiyat,ücret,paket,abonelik,deneme sürümü"},
    ],
    "content": [
        {"name": "Rehber", "triggers": "rehber,nasıl,nedir,başlangıç,temel"},
        {"name": "Liste", "triggers": "en iyi,top,liste,öneriler"},
        {"name": "İnceleme", "triggers": "inceleme,deneyim,test,değerlendirme"},
        {"name": "Haber", "triggers": "yeni,güncelleme,duyuru,2026"},
    ],
}


# AI prompt'larında kullanılacak generic fallback metin (settings boşsa)
GENERIC_BRAND_FALLBACK = {
    "brand_name": "Bu site",
    "brand_description": "içerik/SEO odaklı bir Türkçe site",
    "target_audience": "Türkiye'deki kullanıcılar",
}


def get(db: Session, key: str, default: str = "") -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).one_or_none()
    if row and row.value is not None:
        return row.value
    return DEFAULTS.get(key, default)


def get_all(db: Session) -> dict[str, str]:
    rows = db.query(AppSetting).all()
    out = dict(DEFAULTS)
    for r in rows:
        out[r.key] = r.value or ""
    return out


def set_value(db: Session, key: str, value: str) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == key).one_or_none()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))
    db.commit()


def set_many(db: Session, updates: dict[str, str]) -> dict[str, str]:
    for k, v in updates.items():
        set_value(db, k, v)
    return get_all(db)


def is_configured(db: Session) -> bool:
    return get(db, "configured") == "true" and bool(get(db, "brand_name"))


def mark_configured(db: Session) -> None:
    set_value(db, "configured", "true")


# AI prompt'ları için yardımcılar

def brand_context(db: Session) -> dict[str, str]:
    """AI prompt'larında kullanılan marka bağlamı."""
    name = get(db, "brand_name") or GENERIC_BRAND_FALLBACK["brand_name"]
    desc = get(db, "brand_description") or GENERIC_BRAND_FALLBACK["brand_description"]
    audience = get(db, "target_audience") or GENERIC_BRAND_FALLBACK["target_audience"]
    return {
        "brand_name": name,
        "brand_description": desc,
        "target_audience": audience,
        "brand_url": get(db, "brand_url"),
    }


# Kategoriler

def list_categories(db: Session) -> list[dict]:
    rows = db.query(Category).order_by(Category.sort_order.asc(), Category.name.asc()).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "triggers": [t.strip() for t in (c.triggers or "").split(",") if t.strip()],
            "triggers_csv": c.triggers or "",
            "color": c.color,
            "sort_order": c.sort_order,
        }
        for c in rows
    ]


def add_category(db: Session, name: str, triggers: str = "", color: str | None = None) -> dict:
    name = (name or "").strip()
    if not name:
        return {}
    existing = db.query(Category).filter(Category.name == name).one_or_none()
    if existing:
        existing.triggers = triggers
        if color is not None:
            existing.color = color
    else:
        db.add(Category(name=name, triggers=triggers, color=color))
    db.commit()
    return next((c for c in list_categories(db) if c["name"] == name), {})


def delete_category(db: Session, category_id: int) -> bool:
    row = db.query(Category).filter(Category.id == category_id).one_or_none()
    if not row:
        return False
    db.delete(row)
    db.commit()
    return True


def load_template(db: Session, template_name: str) -> int:
    """Hazır kategori şablonu yükle (mevcutları silmeden)."""
    items = DEFAULT_CATEGORY_TEMPLATES.get(template_name, [])
    added = 0
    for it in items:
        existing = db.query(Category).filter(Category.name == it["name"]).one_or_none()
        if not existing:
            db.add(Category(name=it["name"], triggers=it["triggers"]))
            added += 1
    db.commit()
    return added


def categorize_keyword(db: Session, keyword: str) -> str:
    """Kelimeyi DB kategorilerine göre eşleştir."""
    if not keyword:
        return "Diğer"
    kw = keyword.lower()
    cats = db.query(Category).all()
    for c in cats:
        for trigger in (c.triggers or "").split(","):
            t = trigger.strip().lower()
            if t and t in kw:
                return c.name
    return "Diğer"
