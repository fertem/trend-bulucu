"""Sade re-auth: sadece OAuth flow + refresh_token güncelleme.

Mevcut developer token, customer ID gibi değerlere dokunmaz.
Yeni scope'lar (Ads + Search Console) ile yeni refresh_token üretir.
"""
from __future__ import annotations

import io
import re
import sys
from pathlib import Path

# Windows konsol UTF-8 olmayabilir — Türkçe karakterler bozulmasın
try:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
except Exception:
    pass

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/adwords",
    "https://www.googleapis.com/auth/webmasters.readonly",
]
ENV_PATH = Path(__file__).resolve().parent / ".env"


def read_env() -> dict[str, str]:
    if not ENV_PATH.exists():
        print(f"HATA: .env yok ({ENV_PATH})", flush=True)
        sys.exit(1)
    out: dict[str, str] = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def upsert_env(updates: dict[str, str]) -> None:
    text = ENV_PATH.read_text(encoding="utf-8")
    for key, value in updates.items():
        pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
        if pattern.search(text):
            text = pattern.sub(f"{key}={value}", text)
        else:
            text += f"\n{key}={value}"
    ENV_PATH.write_text(text, encoding="utf-8")


def main():
    print("=" * 60, flush=True)
    print("  OAuth re-auth (Ads + Search Console)", flush=True)
    print("=" * 60, flush=True)

    env = read_env()
    client_id = env.get("GOOGLE_ADS_CLIENT_ID", "")
    client_secret = env.get("GOOGLE_ADS_CLIENT_SECRET", "")

    if not client_id or not client_secret:
        print("HATA: GOOGLE_ADS_CLIENT_ID veya GOOGLE_ADS_CLIENT_SECRET .env'de yok.", flush=True)
        sys.exit(1)

    print("\n→ Tarayıcı açılıyor. Google'a giriş yap, izin ver.", flush=True)
    print("  (Search Console izni de soracak — onayla.)\n", flush=True)

    flow = InstalledAppFlow.from_client_config(
        {
            "installed": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": ["http://localhost"],
            }
        },
        SCOPES,
    )

    creds = flow.run_local_server(
        port=0,
        prompt="consent",
        access_type="offline",
        authorization_prompt_message="",
        success_message="Tamamdır, bu pencereyi kapatabilirsin.",
        open_browser=True,
    )

    if not creds.refresh_token:
        print("HATA: refresh_token alınamadı.", flush=True)
        sys.exit(1)

    upsert_env({"GOOGLE_ADS_REFRESH_TOKEN": creds.refresh_token})
    print(f"\n✓ Yeni refresh_token .env'ye yazıldı.", flush=True)
    print("  Şimdi backend'i yeniden başlat ve Search Console kartından devam et.\n", flush=True)


if __name__ == "__main__":
    main()
