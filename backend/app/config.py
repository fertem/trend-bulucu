from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / "backend" / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    admin_username: str = "admin"
    admin_password: str = "degistir-beni"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24

    database_url: str = f"sqlite:///{BASE_DIR / 'data' / 'trends.db'}"

    collect_hour: int = 3
    collect_minute: int = 0
    timezone: str = "Europe/Istanbul"

    pytrends_geo: str = "TR"
    pytrends_hl: str = "tr-TR"
    pytrends_timeframe: str = "today 1-m"
    request_delay_seconds: float = 2.0
    max_retries: int = 3

    cors_origins: str = "http://localhost:3000"
    # Backend kendi public URL'i — OAuth callback'lerin redirect URI'si için
    app_base_url: str = "http://localhost:8000"

    anthropic_api_key: str = ""
    openai_api_key: str = ""
    ai_provider: str = "anthropic"

    # SerpAPI — Pytrends'in en güvenilir alternatifi (free 250/ay)
    # https://serpapi.com/google-trends-api
    # Routing önceliği: SerpAPI → Apify → Pytrends
    serpapi_key: str = ""

    # Apify — Pytrends fallback (rate-limit'siz Google Trends scraping)
    # https://apify.com/apify/google-trends-scraper
    apify_api_token: str = ""

    google_ads_client_id: str = ""
    google_ads_client_secret: str = ""
    google_ads_developer_token: str = ""
    google_ads_refresh_token: str = ""
    google_ads_customer_id: str = ""
    google_ads_login_customer_id: str = ""
    google_ads_language_id: str = "1055"
    google_ads_geo_target_id: str = "2792"
    google_ads_api_version: str = "v17"

    kod_org_path: str = ""

    search_console_site_url: str = ""  # örn. "sc-domain:example.com" veya "https://www.example.com/"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def has_ai(self) -> bool:
        return bool(self.anthropic_api_key) or bool(self.openai_api_key)

    @property
    def has_google_ads(self) -> bool:
        return bool(
            self.google_ads_client_id
            and self.google_ads_client_secret
            and self.google_ads_developer_token
            and self.google_ads_refresh_token
            and self.google_ads_customer_id
        )


settings = Settings()
(BASE_DIR / "data").mkdir(exist_ok=True)


def reload_settings() -> dict[str, str]:
    """`.env` dosyasını yeniden oku ve mevcut `settings` nesnesini güncelle.

    Backend restart gerektirmeden anahtarların hemen aktif olmasını sağlar.
    Mevcut import edilmiş `settings` referansları otomatik yeni değerleri görür
    (aynı nesneyi mutate ediyoruz, replace etmiyoruz).
    """
    new_values = Settings()
    changed = {}
    for key, value in new_values.model_dump().items():
        old = getattr(settings, key, None)
        if old != value:
            changed[key] = "(değişti)"
        setattr(settings, key, value)

    # AI ve OAuth modüllerinde token cache temizle
    try:
        from . import google_ads as _ga
        _ga._access_token_cache["token"] = ""
    except Exception:
        pass
    try:
        from . import search_console as _sc
        _sc._token_cache["token"] = ""
    except Exception:
        pass

    return changed
