"""Trend Intelligence Dashboard — FastAPI girişi."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db, SessionLocal
from .collector import ensure_seed_keywords
from .scheduler import start_scheduler, stop_scheduler
from . import app_settings as _app_settings
from .routes import auth as auth_routes
from .routes import trends as trends_routes
from .routes import admin as admin_routes
from .routes import ai as ai_routes
from .routes import seasonality as seasonality_routes
from .routes import content as content_routes
from .routes import search_console as sc_routes
from .routes import system as system_routes
from .routes import settings as settings_routes
from .routes import publish as publish_routes


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        # İlk çalıştırma — boş DB ise kullanıcı UI'dan kurulum yapacak
        # Mevcut kullanıcılar için: env'deki KOD_ORG_PATH varsa Settings'e yaz
        if settings.kod_org_path and not _app_settings.get(db, "site_path"):
            _app_settings.set_value(db, "site_path", settings.kod_org_path)
        # Seed'leri sadece eski kullanıcılar için zorla — yeni kurulumlarda boş kalsın
        existing_keywords = db.query(__import__("app.models", fromlist=["Keyword"]).Keyword).count()
        if existing_keywords > 0:
            ensure_seed_keywords(db)
    finally:
        db.close()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Trend Intelligence Dashboard",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_routes.router)
app.include_router(trends_routes.router)
app.include_router(admin_routes.router)
app.include_router(ai_routes.router)
app.include_router(seasonality_routes.router)
app.include_router(content_routes.router)
app.include_router(sc_routes.router)
app.include_router(system_routes.router)
app.include_router(settings_routes.router)
app.include_router(publish_routes.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "has_ai": settings.has_ai}
