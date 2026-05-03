"""Tohum kelimeler ve kategori eşleştirme — DB tabanlı (Settings/Category).

Eski hardcoded SEED_KEYWORDS ve CATEGORY_RULES kaldırıldı.
- Tohum kelimeler: kullanıcı UI'dan ekler (Onboarding wizard veya Yönetim)
- Kategoriler: trend_categories tablosu (UI'da yönetilir)
- Fallback kategorize: app_settings.categorize_keyword(db, keyword)
"""
from __future__ import annotations

# Geriye dönük uyumluluk — eski kullanıcılar için boş liste, yeni kurulumlar zaten boş başlıyor
SEED_KEYWORDS: list[str] = []


def categorize(keyword: str) -> str:
    """Eski API uyumluluğu için. Yeni kod app_settings.categorize_keyword kullanmalı.
    DB context'i olmadan çağrılırsa "Diğer" döner (collector.py legacy import için)."""
    return "Diğer"
