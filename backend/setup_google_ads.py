"""Google Ads OAuth refresh_token üretici + .env güncelleyici.

Kullanım:
    cd backend
    venv/Scripts/python.exe setup_google_ads.py

Tarayıcıda Google'a giriş yapacaksın, izin vereceksin, sonra script
refresh_token'ı .env'e otomatik yazacak. Developer token ve customer ID'yi
ayrıca soracak.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/adwords",
    "https://www.googleapis.com/auth/webmasters.readonly",
]
ENV_PATH = Path(__file__).resolve().parent / ".env"


def read_env() -> dict[str, str]:
    if not ENV_PATH.exists():
        print(f"HATA: .env yok ({ENV_PATH})")
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


def prompt(question: str, current: str = "") -> str:
    suffix = f" [şu an: {current[:20]}...]" if current else ""
    val = input(f"{question}{suffix}\n> ").strip()
    return val or current


def main():
    print("=" * 60)
    print("  Google Ads API — OAuth Refresh Token Üretici")
    print("=" * 60)

    env = read_env()
    client_id = env.get("GOOGLE_ADS_CLIENT_ID", "")
    client_secret = env.get("GOOGLE_ADS_CLIENT_SECRET", "")

    if not client_id or not client_secret:
        print("\n.env'de GOOGLE_ADS_CLIENT_ID ve GOOGLE_ADS_CLIENT_SECRET yok.")
        client_id = prompt("Client ID:")
        client_secret = prompt("Client Secret:")

    print("\n→ OAuth akışı başlıyor. Tarayıcı açılacak, Google hesabınla giriş yap.")
    print("  Onay ekranında 'continue' veya 'allow' de.\n")

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
        print("\nHATA: refresh_token alınamadı. Google hesabını OAuth ekranında 'test users' altına eklediğinden emin ol.")
        sys.exit(1)

    print("\n✓ Refresh token alındı.")

    print("\n--- Eksik bilgileri tamamla ---")
    dev_token = prompt("Developer Token (Google Ads → API Center):", env.get("GOOGLE_ADS_DEVELOPER_TOKEN", ""))
    cust_id = prompt(
        "Customer ID (10 haneli, tiresiz — sağ üstte görünen):",
        env.get("GOOGLE_ADS_CUSTOMER_ID", ""),
    )
    cust_id = re.sub(r"\D", "", cust_id)
    login_id = prompt(
        "Login Customer ID (MCC/manager hesabın varsa, yoksa boş bırak):",
        env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID", ""),
    )
    login_id = re.sub(r"\D", "", login_id)

    upsert_env({
        "GOOGLE_ADS_REFRESH_TOKEN": creds.refresh_token,
        "GOOGLE_ADS_DEVELOPER_TOKEN": dev_token,
        "GOOGLE_ADS_CUSTOMER_ID": cust_id,
        "GOOGLE_ADS_LOGIN_CUSTOMER_ID": login_id,
    })

    print("\n✓ .env güncellendi. Backend'i yeniden başlat:\n")
    print("    venv/Scripts/python.exe -m uvicorn app.main:app --port 8000")
    print("\nSonra tarayıcıda Yönetim → 'Şimdi Topla' (volume verisi için).")


if __name__ == "__main__":
    main()
