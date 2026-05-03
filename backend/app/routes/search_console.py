from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import search_console as sc
from ..auth import require_admin
from ..db import get_db


router = APIRouter(prefix="/api/sc", tags=["search-console"], dependencies=[Depends(require_admin)])


class SetSiteIn(BaseModel):
    site_url: str


@router.get("/status")
def status(db: Annotated[Session, Depends(get_db)]):
    return sc.status_dict(db)


@router.get("/list-sites")
def list_available_sites():
    """OAuth'lı kullanıcının doğrulanmış sitelerini listele."""
    try:
        return {"sites": sc.list_sites()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/set-site")
def set_site(body: SetSiteIn):
    """Hangi sitenin verisini çekeceğimizi .env'ye yaz (manuel restart gerekli)."""
    import re
    from pathlib import Path

    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if not env_path.exists():
        raise HTTPException(status_code=500, detail=".env bulunamadı")

    text = env_path.read_text(encoding="utf-8")
    if re.search(r"^SEARCH_CONSOLE_SITE_URL=.*$", text, re.MULTILINE):
        text = re.sub(r"^SEARCH_CONSOLE_SITE_URL=.*$", f"SEARCH_CONSOLE_SITE_URL={body.site_url}", text, flags=re.MULTILINE)
    else:
        text += f"\nSEARCH_CONSOLE_SITE_URL={body.site_url}\n"
    env_path.write_text(text, encoding="utf-8")

    return {"status": "ok", "site_url": body.site_url, "note": "Backend'i yeniden başlat"}


@router.post("/sync")
def trigger_sync(db: Annotated[Session, Depends(get_db)], days: int = Query(28, ge=7, le=90)):
    return sc.sync_recent(db, days=days)


@router.get("/queries")
def get_top_queries(db: Annotated[Session, Depends(get_db)], limit: int = Query(25, ge=1, le=100)):
    return sc.top_queries(db, limit=limit)


@router.get("/opportunities")
def get_opportunities(db: Annotated[Session, Depends(get_db)], limit: int = Query(25, ge=1, le=100)):
    return sc.opportunities(db, limit=limit)


@router.get("/page2")
def get_page2(db: Annotated[Session, Depends(get_db)], limit: int = Query(25, ge=1, le=100)):
    return sc.page2_keywords(db, limit=limit)


@router.get("/movers")
def get_movers(db: Annotated[Session, Depends(get_db)], limit: int = Query(25, ge=1, le=100)):
    return sc.movers(db, limit=limit)


@router.get("/keyword/{keyword}")
def keyword_data(keyword: str, db: Annotated[Session, Depends(get_db)]):
    """Bir takip kelimesinin SC pozisyon/CTR verisini bul."""
    result = sc.keyword_for_query(db, keyword)
    if not result:
        raise HTTPException(status_code=404, detail="Bu kelime için SC verisi yok")
    return result
