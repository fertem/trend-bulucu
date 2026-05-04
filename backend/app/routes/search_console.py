import logging
import re
import secrets
import time
from pathlib import Path
from typing import Annotated
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import search_console as sc
from ..auth import require_admin
from ..config import settings as env_settings
from ..db import get_db


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sc", tags=["search-console"], dependencies=[Depends(require_admin)])

# Public router: callback'a Google bizim JWT'mizi göndermez. State token ile CSRF korumalı.
public_router = APIRouter(prefix="/api/sc", tags=["search-console-oauth"])

# In-memory state store: {state: created_at}. 10 dk TTL.
_oauth_states: dict[str, float] = {}
_STATE_TTL = 600.0  # 10 minutes

# Both Search Console + Google Ads scope'ları — tek auth flow ikisini de kapsar
_OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/adwords",
]
_OAUTH_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth"
_OAUTH_TOKEN = "https://oauth2.googleapis.com/token"

ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


def _redirect_uri() -> str:
    """Google'ın token sonrası bizi yönlendireceği URL."""
    base = (env_settings.app_base_url or "http://localhost:8000").rstrip("/")
    return f"{base}/api/sc/oauth/callback"


def _cleanup_states() -> None:
    now = time.time()
    expired = [s for s, t in _oauth_states.items() if now - t > _STATE_TTL]
    for s in expired:
        _oauth_states.pop(s, None)


def _write_env_var(key: str, value: str) -> None:
    """Append-or-replace .env satırı."""
    if not ENV_PATH.exists():
        ENV_PATH.write_text(f"{key}={value}\n", encoding="utf-8")
        return
    text = ENV_PATH.read_text(encoding="utf-8")
    pat = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
    if pat.search(text):
        text = pat.sub(f"{key}={value}", text)
    else:
        if not text.endswith("\n"):
            text += "\n"
        text += f"{key}={value}\n"
    ENV_PATH.write_text(text, encoding="utf-8")


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


# ─── Inline OAuth flow ──────────────────────────────────────────────────────


class OAuthCredentialsIn(BaseModel):
    client_id: str
    client_secret: str


@router.get("/oauth/status")
def oauth_status():
    """Mevcut OAuth durumu — Client ID/Secret + refresh_token var mı?"""
    return {
        "client_id_set": bool(env_settings.google_ads_client_id),
        "client_secret_set": bool(env_settings.google_ads_client_secret),
        "refresh_token_set": bool(env_settings.google_ads_refresh_token),
        "redirect_uri": _redirect_uri(),
    }


@router.post("/oauth/save-credentials")
def save_credentials(body: OAuthCredentialsIn):
    """Client ID + Secret'ı .env'ye yaz (OAuth başlamadan önce gerekli)."""
    cid = body.client_id.strip()
    csec = body.client_secret.strip()
    if not cid or not csec:
        raise HTTPException(status_code=400, detail="Client ID ve Client Secret zorunlu")
    _write_env_var("GOOGLE_ADS_CLIENT_ID", cid)
    _write_env_var("GOOGLE_ADS_CLIENT_SECRET", csec)
    # Reload env so subsequent requests see new values
    try:
        from .. import config as _cfg
        _cfg.settings = _cfg.Settings()
        env_settings.google_ads_client_id = cid
        env_settings.google_ads_client_secret = csec
    except Exception as e:
        logger.warning("settings reload failed: %s", e)
    return {"ok": True, "redirect_uri": _redirect_uri()}


@router.post("/oauth/start")
def oauth_start():
    """OAuth flow için Google authorization URL üret."""
    if not (env_settings.google_ads_client_id and env_settings.google_ads_client_secret):
        raise HTTPException(
            status_code=400,
            detail="Önce Client ID + Secret kaydet (Google Cloud Console'dan)",
        )
    _cleanup_states()
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = time.time()

    params = {
        "client_id": env_settings.google_ads_client_id,
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": " ".join(_OAUTH_SCOPES),
        "access_type": "offline",
        "prompt": "consent",  # her seferinde refresh_token almak için
        "state": state,
    }
    auth_url = f"{_OAUTH_AUTHORIZE}?{urlencode(params)}"
    return {"auth_url": auth_url, "state": state, "redirect_uri": _redirect_uri()}


# Public callback — Google redirects here (no admin JWT)
@public_router.get("/oauth/callback")
def oauth_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    """Google'dan token kodu gelir, refresh_token al + .env'ye yaz + popup'a mesaj gönder."""
    # Hata durumu
    if error:
        return _close_popup_html(success=False, message=f"Google hatası: {error}")

    if not code or not state:
        return _close_popup_html(success=False, message="Eksik parametre (code veya state)")

    # State doğrula (CSRF)
    _cleanup_states()
    if state not in _oauth_states:
        return _close_popup_html(success=False, message="State geçersiz veya süresi dolmuş — tekrar dene")
    _oauth_states.pop(state, None)

    if not (env_settings.google_ads_client_id and env_settings.google_ads_client_secret):
        return _close_popup_html(success=False, message="Client ID/Secret yok")

    # Code → refresh_token
    try:
        resp = httpx.post(
            _OAUTH_TOKEN,
            data={
                "code": code,
                "client_id": env_settings.google_ads_client_id,
                "client_secret": env_settings.google_ads_client_secret,
                "redirect_uri": _redirect_uri(),
                "grant_type": "authorization_code",
            },
            timeout=20.0,
        )
        if resp.status_code != 200:
            return _close_popup_html(
                success=False,
                message=f"Token değişimi başarısız: {resp.status_code} {resp.text[:200]}",
            )
        data = resp.json()
        refresh_token = data.get("refresh_token")
        if not refresh_token:
            return _close_popup_html(
                success=False,
                message="Refresh token alınamadı (Google offline_access vermedi). Google Cloud Console'da consent screen ayarlarını kontrol et.",
            )
    except Exception as e:
        return _close_popup_html(success=False, message=f"İstek başarısız: {e}")

    # Save token to .env
    try:
        _write_env_var("GOOGLE_ADS_REFRESH_TOKEN", refresh_token)
        # Reload settings so module-level cache picks up new token
        from .. import config as _cfg
        _cfg.settings = _cfg.Settings()
        env_settings.google_ads_refresh_token = refresh_token
        # Also clear search_console module's cached access token
        sc._token_cache = {"token": "", "expires_at": __import__("datetime").datetime.utcnow()}
    except Exception as e:
        logger.exception("token kaydı başarısız: %s", e)
        return _close_popup_html(success=False, message=f"Token kaydedilemedi: {e}")

    return _close_popup_html(success=True, message="✓ Bağlandı! Bu pencere kapanıyor…")


def _close_popup_html(success: bool, message: str) -> HTMLResponse:
    """Popup'ı kapatan + parent window'a mesaj gönderen HTML."""
    safe_msg = message.replace('"', '\\"').replace("\n", " ")
    color = "#10b981" if success else "#ef4444"
    icon = "✓" if success else "✗"
    body = f"""<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><title>OAuth</title>
<style>
  body {{ font-family: -apple-system, system-ui, sans-serif; padding: 40px; text-align: center;
         background: #f8fafc; color: #0f172a; }}
  .icon {{ font-size: 48px; color: {color}; margin-bottom: 20px; }}
  .msg {{ font-size: 16px; max-width: 500px; margin: 0 auto; }}
  .hint {{ color: #64748b; font-size: 13px; margin-top: 16px; }}
</style></head>
<body>
  <div class="icon">{icon}</div>
  <div class="msg">{safe_msg}</div>
  <div class="hint">Bu pencere otomatik kapanıyor…</div>
  <script>
    try {{
      if (window.opener) {{
        window.opener.postMessage({{type: "oauth-result", success: {str(success).lower()}, message: "{safe_msg}"}}, "*");
      }}
    }} catch(e) {{}}
    setTimeout(() => {{ window.close(); }}, 2000);
  </script>
</body></html>"""
    return HTMLResponse(content=body, status_code=200)
