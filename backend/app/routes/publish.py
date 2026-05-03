"""Yayınlama route'ları — WordPress + Ghost."""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import publisher, app_settings
from ..auth import require_admin
from ..db import get_db


router = APIRouter(prefix="/api/publish", tags=["publish"], dependencies=[Depends(require_admin)])


class PublishIn(BaseModel):
    platform: Literal["wordpress", "ghost"]
    title: str
    markdown: str
    slug: str | None = None
    excerpt: str | None = None
    feature_image: str | None = None
    tags: list[str] = []
    status: Literal["draft", "publish", "publish_now"] = "draft"


class TestConnectionIn(BaseModel):
    platform: Literal["wordpress", "ghost"]


def _get_creds(db: Session, platform: str) -> dict:
    if platform == "wordpress":
        return {
            "site_url": app_settings.get(db, "wp_site_url"),
            "username": app_settings.get(db, "wp_username"),
            "app_password": app_settings.get(db, "wp_app_password"),
        }
    if platform == "ghost":
        return {
            "site_url": app_settings.get(db, "ghost_site_url"),
            "admin_api_key": app_settings.get(db, "ghost_admin_api_key"),
        }
    raise HTTPException(status_code=400, detail="Bilinmeyen platform")


@router.get("/status")
def status(db: Annotated[Session, Depends(get_db)]):
    """Hangi platformlar yapılandırılmış göster."""
    return {
        "wordpress": {
            "configured": bool(
                app_settings.get(db, "wp_site_url")
                and app_settings.get(db, "wp_username")
                and app_settings.get(db, "wp_app_password")
            ),
            "site_url": app_settings.get(db, "wp_site_url"),
        },
        "ghost": {
            "configured": bool(
                app_settings.get(db, "ghost_site_url")
                and app_settings.get(db, "ghost_admin_api_key")
            ),
            "site_url": app_settings.get(db, "ghost_site_url"),
        },
    }


@router.post("/test")
def test_connection(body: TestConnectionIn, db: Annotated[Session, Depends(get_db)]):
    creds = _get_creds(db, body.platform)
    if body.platform == "wordpress":
        if not all(creds.values()):
            raise HTTPException(status_code=400, detail="WordPress ayarları eksik")
        return publisher.wp_test_connection(**creds)
    else:
        if not all(creds.values()):
            raise HTTPException(status_code=400, detail="Ghost ayarları eksik")
        return publisher.ghost_test_connection(**creds)


@router.post("/post")
def publish_post(body: PublishIn, db: Annotated[Session, Depends(get_db)]):
    """AI tarafından üretilmiş yazıyı CMS'e gönder."""
    creds = _get_creds(db, body.platform)
    if not all(creds.values()):
        raise HTTPException(status_code=400, detail=f"{body.platform} ayarları eksik")

    html = publisher.markdown_to_html(body.markdown)
    status = "publish" if body.status == "publish_now" else (body.status if body.status != "publish" else "publish")
    if body.status == "publish":
        status = "publish"

    try:
        if body.platform == "wordpress":
            result = publisher.wp_publish(
                creds["site_url"], creds["username"], creds["app_password"],
                title=body.title, content_html=html,
                slug=body.slug, status=status, excerpt=body.excerpt,
                featured_image_url=body.feature_image, tags=body.tags or None,
            )
        else:
            result = publisher.ghost_publish(
                creds["site_url"], creds["admin_api_key"],
                title=body.title, html=html,
                slug=body.slug, status=status, excerpt=body.excerpt,
                feature_image=body.feature_image, tags=body.tags or None,
            )
        return {"ok": True, "platform": body.platform, **result}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


class CMSConfigIn(BaseModel):
    platform: Literal["wordpress", "ghost"]
    site_url: str
    # WordPress
    username: str = ""
    app_password: str = ""
    # Ghost
    admin_api_key: str = ""


@router.put("/config")
def save_config(body: CMSConfigIn, db: Annotated[Session, Depends(get_db)]):
    """CMS bağlantı bilgilerini Settings'e yaz."""
    if body.platform == "wordpress":
        app_settings.set_value(db, "wp_site_url", body.site_url)
        if body.username:
            app_settings.set_value(db, "wp_username", body.username)
        if body.app_password:
            app_settings.set_value(db, "wp_app_password", body.app_password)
    else:
        app_settings.set_value(db, "ghost_site_url", body.site_url)
        if body.admin_api_key:
            app_settings.set_value(db, "ghost_admin_api_key", body.admin_api_key)
    return {"ok": True, "platform": body.platform}
