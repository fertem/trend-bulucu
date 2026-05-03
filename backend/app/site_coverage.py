"""Lokal site içerik kapsama analizi.

Settings.site_path ile belirtilen klasörü tarar (Next.js app/, app/blog/),
mevcut içerikleri DB'ye kaydeder, takip edilen trend kelimelerle
karşılaştırıp "eksik içerik fırsatları" çıkarır. Marka URL'si Settings'ten okunur.
"""
from __future__ import annotations

import logging
import re
import unicodedata
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from .config import settings
from .models import ContentGapHistory, Keyword, RisingQuery, SiteContent
from .seeds import categorize

logger = logging.getLogger(__name__)


# Sistem klasörleri ve içerik olmayan rotalar
SKIP_DIRS = {
    "api", "components", "hooks", "data", "admin", "node_modules",
    ".next", ".turbo", "public", "lib", "scripts",
}

# Çok kısa veya anlamsız klasörler de atlansın
NON_CONTENT_NAMES = {
    "error", "loading", "not-found", "layout", "page",
    "globals.css", "favicon.ico", "robots.txt", "sitemap.xml",
}


# ─── Normalizasyon ─────────────────────────────────────────────────────────

def _strip_accents(s: str) -> str:
    """Türkçe karakterleri ASCII'ye çevir."""
    s = s.replace("İ", "I").replace("ı", "i").replace("ğ", "g").replace("Ğ", "G")
    s = s.replace("ş", "s").replace("Ş", "S").replace("ç", "c").replace("Ç", "C")
    s = s.replace("ü", "u").replace("Ü", "U").replace("ö", "o").replace("Ö", "O")
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return s


STOPWORDS = {
    "ve", "icin", "ile", "bir", "bu", "su", "o", "da", "de",
    "mi", "mu", "mu", "mü", "ne", "ya", "ki", "ama",
    "the", "and", "or", "in", "on", "at", "to", "of",
}


# Generic gürültü filtresi — sektör dışı yaygın aramalar
# (Üniversite sınavı, sertifika programları vb. — kullanıcı isterse override edebilir)
NOISE_TOKENS = {
    "auzef", "aof", "aöf", "ata", "dgs", "lolonolo",
    "lisans", "yuksek", "lisansustu", "sinav", "vize", "final",
    "soru", "sorular", "cevap", "cevaplari", "cikmis",
    "taban", "puan", "puanlari", "siralama",
    "uzmanligi", "uzmanlik", "sertifika", "sertifikasi",
    "kpss", "ales", "yds",
}


def _is_noise_keyword(keyword: str) -> bool:
    """Hedef kitle dışı (üniversite sınavı vb.) kelimeleri filtrele."""
    tokens = _tokenize(keyword)
    return bool(tokens & NOISE_TOKENS)


def _tokenize(text: str) -> set[str]:
    """Kelimeyi normalize edip anlamlı token set'i döner."""
    if not text:
        return set()
    t = _strip_accents(text).lower()
    t = re.sub(r"[^a-z0-9\s-]", " ", t)
    t = t.replace("-", " ")
    tokens = {w for w in t.split() if len(w) >= 3 and w not in STOPWORDS}
    return tokens


# ─── Dosya tarama ──────────────────────────────────────────────────────────

_METADATA_TITLE_RE = re.compile(r"title:\s*[\"'`]([^\"'`]+)[\"'`]", re.IGNORECASE)
_METADATA_DESC_RE = re.compile(r"description:\s*[\"'`]([^\"'`]+)[\"'`]", re.IGNORECASE)
_METADATA_KEYWORDS_RE = re.compile(r"keywords:\s*[\"'`]([^\"'`]+)[\"'`]", re.IGNORECASE)


def _read_metadata(page_file: Path) -> dict:
    """page.tsx dosyasından title/description/keywords çek (regex; AST değil)."""
    try:
        # İlk 6 KB yeter — metadata genelde dosya başında
        text = page_file.read_text(encoding="utf-8", errors="ignore")[:6000]
    except Exception:
        return {}

    out = {}
    if m := _METADATA_TITLE_RE.search(text):
        out["title"] = m.group(1).strip()
    if m := _METADATA_DESC_RE.search(text):
        out["description"] = m.group(1).strip()
    if m := _METADATA_KEYWORDS_RE.search(text):
        out["keywords"] = m.group(1).strip()
    return out


def _is_content_dir(path: Path) -> bool:
    if not path.is_dir():
        return False
    name = path.name
    if name.startswith(".") or name.startswith("_") or name.startswith("("):
        return False
    if name.startswith("[") and name.endswith("]"):  # dynamic routes
        return False
    if name in SKIP_DIRS or name in NON_CONTENT_NAMES:
        return False
    # page.tsx olmalı
    return (path / "page.tsx").exists() or (path / "page.jsx").exists()


def scan_site(db: Session) -> dict:
    """Lokal next.js sitesini tarar, SiteContent tablosunu günceller."""
    from . import app_settings as _app_settings
    site_path = _app_settings.get(db, "site_path") or settings.kod_org_path
    brand_url = (_app_settings.get(db, "brand_url") or "").rstrip("/")

    if not site_path:
        return {"status": "disabled", "message": "Site yolu tanımlı değil (Ayarlar)"}

    root = Path(site_path)
    app_dir = root / "app"
    if not app_dir.exists():
        return {"status": "error", "message": f"Site bulunamadı: {app_dir}"}

    found: list[dict] = []

    # Top-level pages (örn. cocuklar-icin-kodlama, 6-yas-kodlama, scratch-mi-python-mu)
    for p in app_dir.iterdir():
        if not _is_content_dir(p):
            continue
        if p.name == "blog":
            continue
        page_file = p / "page.tsx" if (p / "page.tsx").exists() else p / "page.jsx"
        meta = _read_metadata(page_file)
        found.append({
            "slug": p.name,
            "type": "page",
            "title": meta.get("title"),
            "description": meta.get("description"),
            "keywords": meta.get("keywords"),
            "url": f"{brand_url}/{p.name}" if brand_url else f"/{p.name}",
        })

    # Blog posts
    blog_dir = app_dir / "blog"
    if blog_dir.exists():
        for p in blog_dir.iterdir():
            if not _is_content_dir(p):
                continue
            page_file = p / "page.tsx" if (p / "page.tsx").exists() else p / "page.jsx"
            meta = _read_metadata(page_file)
            found.append({
                "slug": p.name,
                "type": "blog",
                "title": meta.get("title"),
                "description": meta.get("description"),
                "keywords": meta.get("keywords"),
                "url": f"{brand_url}/blog/{p.name}" if brand_url else f"/blog/{p.name}",
            })

    # DB güncelleme (upsert)
    now = datetime.utcnow()
    added, updated = 0, 0
    seen_slugs = {f["slug"] for f in found}

    for f in found:
        existing = db.query(SiteContent).filter(SiteContent.slug == f["slug"]).one_or_none()
        if existing:
            existing.type = f["type"]
            existing.title = f.get("title")
            existing.description = f.get("description")
            existing.keywords_text = f.get("keywords")
            existing.url = f.get("url")
            existing.scanned_at = now
            updated += 1
        else:
            db.add(SiteContent(
                slug=f["slug"],
                type=f["type"],
                title=f.get("title"),
                description=f.get("description"),
                keywords_text=f.get("keywords"),
                url=f.get("url"),
                scanned_at=now,
            ))
            added += 1

    # Artık olmayan içerikleri sil (slug filesystem'de yoksa)
    removed = 0
    for sc in db.query(SiteContent).all():
        if sc.slug not in seen_slugs:
            db.delete(sc)
            removed += 1

    db.commit()
    return {
        "status": "ok",
        "total": len(found),
        "blog": sum(1 for f in found if f["type"] == "blog"),
        "page": sum(1 for f in found if f["type"] == "page"),
        "added": added,
        "updated": updated,
        "removed": removed,
    }


# ─── Coverage matching ──────────────────────────────────────────────────────

def _content_corpus(sc: SiteContent) -> set[str]:
    """Bir içeriğin tüm aranabilir tokenlarını topla."""
    parts = [sc.slug]
    if sc.title:
        parts.append(sc.title)
    if sc.description:
        parts.append(sc.description)
    if sc.keywords_text:
        parts.append(sc.keywords_text)
    return _tokenize(" ".join(parts))


def coverage_score(keyword: str, contents: list[SiteContent]) -> tuple[float, SiteContent | None]:
    """Bir kelimenin sitede en iyi eşleşme skorunu döner (0-1)."""
    kw_tokens = _tokenize(keyword)
    if not kw_tokens:
        return 0.0, None

    best_score = 0.0
    best_match: SiteContent | None = None

    for sc in contents:
        ct = _content_corpus(sc)
        if not ct:
            continue
        intersection = kw_tokens & ct
        score = len(intersection) / len(kw_tokens)
        if score > best_score:
            best_score = score
            best_match = sc

    return best_score, best_match


COVERED_THRESHOLD = 0.6


def content_gaps(db: Session, min_growth: float = 0.0, limit: int = 30) -> list[dict]:
    """Takip edilen kelimeler + yükselen alakalı sorgulardan
    sitede karşılığı olmayan/zayıf olanları sıralı döner.
    """
    contents = db.query(SiteContent).all()
    if not contents:
        return []

    # 1) Aktif takip kelimeleri
    pool: dict[str, dict] = {}
    from . import analytics
    for s in analytics.latest_scores(db):
        pool[s.keyword] = {
            "keyword": s.keyword,
            "category": s.category,
            "growth_pct": s.growth_pct,
            "avg_last_7": s.avg_last_7,
            "is_hot": s.is_hot,
            "source": "tracked",
        }

    # 2) Rising queries (Pytrends'in alakalı önerileri) — hâlâ takipte olmasa da fırsat
    rising_rows = (
        db.query(RisingQuery)
        .order_by(RisingQuery.collected_at.desc(), RisingQuery.growth.desc())
        .limit(80)
        .all()
    )
    for r in rising_rows:
        kw = r.rising_keyword.lower().strip()
        if not kw or len(kw) < 4 or kw in pool:
            continue
        cat = categorize(kw)
        if cat == "Diğer":
            continue
        pool[kw] = {
            "keyword": kw,
            "category": cat,
            "growth_pct": float(r.growth or 0),
            "avg_last_7": 0.0,
            "is_hot": False,
            "source": "rising",
        }

    # Kapsama hesapla
    gaps: list[dict] = []
    for kw, info in pool.items():
        if info["growth_pct"] < min_growth and info["source"] == "rising":
            continue
        if _is_noise_keyword(kw):
            continue
        score, match = coverage_score(kw, contents)
        info["coverage_score"] = round(score, 2)
        info["best_match_slug"] = match.slug if match else None
        info["best_match_title"] = match.title if match else None
        info["best_match_url"] = match.url if match else None
        info["is_gap"] = score < COVERED_THRESHOLD

        # Öncelik skoru: yüksek hacim/büyüme + düşük kapsam
        priority = (info["avg_last_7"] + max(0, info["growth_pct"]) * 0.3) * (1 - score)
        info["priority"] = round(priority, 2)
        gaps.append(info)

    gaps = [g for g in gaps if g["is_gap"]]
    gaps.sort(key=lambda x: x["priority"], reverse=True)
    return gaps[:limit]


def update_gap_history(db: Session) -> dict:
    """Mevcut gap'leri history tablosuna upsert et. Eski kayıtlar silinmez."""
    current = content_gaps(db, limit=200)
    now = datetime.utcnow()
    current_keywords = set()
    added, updated = 0, 0

    for g in current:
        kw = g["keyword"]
        current_keywords.add(kw)
        existing = db.query(ContentGapHistory).filter(ContentGapHistory.keyword == kw).one_or_none()

        if existing:
            existing.last_detected_at = now
            existing.times_detected = (existing.times_detected or 0) + 1
            existing.coverage_score = g["coverage_score"]
            existing.growth_pct = g["growth_pct"]
            existing.avg_last_7 = g["avg_last_7"]
            existing.priority = g["priority"]
            existing.peak_priority = max(existing.peak_priority or 0, g["priority"])
            existing.best_match_slug = g.get("best_match_slug")
            existing.best_match_title = g.get("best_match_title")
            existing.best_match_url = g.get("best_match_url")
            existing.category = g.get("category") or existing.category
            existing.source = g.get("source", existing.source)
            existing.is_currently_trending = True
            updated += 1
        else:
            db.add(ContentGapHistory(
                keyword=kw,
                category=g.get("category"),
                source=g.get("source", "tracked"),
                first_detected_at=now,
                last_detected_at=now,
                times_detected=1,
                coverage_score=g["coverage_score"],
                growth_pct=g["growth_pct"],
                avg_last_7=g["avg_last_7"],
                priority=g["priority"],
                peak_priority=g["priority"],
                best_match_slug=g.get("best_match_slug"),
                best_match_title=g.get("best_match_title"),
                best_match_url=g.get("best_match_url"),
                is_currently_trending=True,
                status="new",
            ))
            added += 1

    # Bugün tespit edilmeyenleri sadece "şu an trend değil" olarak işaretle (silme!)
    not_trending = (
        db.query(ContentGapHistory)
        .filter(ContentGapHistory.status.in_(["new", "in_progress"]))
        .all()
    )
    marked_stale = 0
    for h in not_trending:
        if h.keyword not in current_keywords and h.is_currently_trending:
            h.is_currently_trending = False
            marked_stale += 1

    db.commit()
    return {
        "added": added,
        "updated": updated,
        "marked_stale": marked_stale,
        "total_in_history": db.query(ContentGapHistory).count(),
    }


def get_gap_history(db: Session, status: str | None = None, limit: int = 100) -> list[dict]:
    """Tüm geçmişten filtrelenmiş gap listesini döner."""
    q = db.query(ContentGapHistory)
    if status and status != "all":
        q = q.filter(ContentGapHistory.status == status)
    q = q.order_by(
        ContentGapHistory.is_currently_trending.desc(),
        ContentGapHistory.priority.desc(),
        ContentGapHistory.last_detected_at.desc(),
    ).limit(limit)

    rows = q.all()
    out = []
    for h in rows:
        out.append({
            "id": h.id,
            "keyword": h.keyword,
            "category": h.category,
            "source": h.source,
            "first_detected_at": h.first_detected_at.isoformat() if h.first_detected_at else None,
            "last_detected_at": h.last_detected_at.isoformat() if h.last_detected_at else None,
            "times_detected": h.times_detected,
            "coverage_score": h.coverage_score,
            "growth_pct": h.growth_pct,
            "avg_last_7": h.avg_last_7,
            "priority": h.priority,
            "peak_priority": h.peak_priority,
            "best_match_slug": h.best_match_slug,
            "best_match_title": h.best_match_title,
            "best_match_url": h.best_match_url,
            "is_currently_trending": h.is_currently_trending,
            "status": h.status,
            "addressed_url": h.addressed_url,
            "notes": h.notes,
            "addressed_at": h.addressed_at.isoformat() if h.addressed_at else None,
        })
    return out


def update_gap_status(db: Session, gap_id: int, status: str,
                      addressed_url: str | None = None, notes: str | None = None) -> dict | None:
    valid = {"new", "in_progress", "addressed", "dismissed"}
    if status not in valid:
        return None

    h = db.query(ContentGapHistory).filter(ContentGapHistory.id == gap_id).one_or_none()
    if not h:
        return None

    h.status = status
    h.status_updated_at = datetime.utcnow()
    if addressed_url is not None:
        h.addressed_url = addressed_url
    if notes is not None:
        h.notes = notes
    if status == "addressed":
        h.addressed_at = datetime.utcnow()
    db.commit()

    return {
        "id": h.id,
        "keyword": h.keyword,
        "status": h.status,
        "addressed_url": h.addressed_url,
        "notes": h.notes,
    }


def gap_status_counts(db: Session) -> dict:
    """Her status için kaç gap var?"""
    out = {"new": 0, "in_progress": 0, "addressed": 0, "dismissed": 0, "total": 0}
    for h in db.query(ContentGapHistory).all():
        out["total"] += 1
        if h.status in out:
            out[h.status] += 1
    return out


def list_content(db: Session) -> list[dict]:
    rows = db.query(SiteContent).order_by(SiteContent.type.desc(), SiteContent.slug.asc()).all()
    return [
        {
            "slug": r.slug,
            "type": r.type,
            "title": r.title,
            "url": r.url,
            "scanned_at": r.scanned_at.isoformat() if r.scanned_at else None,
        }
        for r in rows
    ]
