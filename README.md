# Trend Intelligence Dashboard

Open-source SEO + content intelligence dashboard combining **Google Trends + Search Console + Google Ads + AI** in one panel. **Bilingual UI (Türkçe / English)**, light/dark theme, mobile-friendly — all switchable from the sidebar.

> *Türkçe için aşağı kaydır.*

---

## English

### What it does

- **Google Trends** — multi-provider routing (SerpAPI → Apify → Pytrends), daily collection, 5y historical, seasonality (12 × 5 heatmap), anomaly detection, 30-day forecast, yearly projection (CAGR + linear regression)
- **Search Console** — real position, CTR, clicks for the last 28 days; finds title-improvement opportunities, page-2 keywords, position movers, cannibalization detection
- **Google Ads (Keyword Planner)** — real monthly volume, competition, CPC ranges (optional)
- **AI (Anthropic Claude or OpenAI)** — search intent, keyword difficulty (KD), People Also Ask, full article writer (markdown + social media), SEO scorecard, internal-link suggestions, streaming chat with your data, deep keyword analysis, 4-period digest (daily/weekly/monthly/yearly)
- **Content gaps** — scans your site's local source, finds trending queries you haven't covered, one-click AI-generated post + WordPress/Ghost publish
- **Smart layer** — explainable **Opportunity Score v2** (momentum + demand + SEO position + coverage + seasonality, with reasons and a suggested action), a **"What to do today" action feed** (7 rules: improve title, push from page 2, write content, prepare for peak, falling, page conflict, sudden spike — done / snooze), **smart alerts** (severity, de-duplicated, mute) with optional **Telegram / Slack** notifications, and a **seasonal publishing calendar** (publish-by dates from 5-year peaks)
- **Brand-aware** — onboarding wizard derives industry, categories and seed keywords from your brand description; all AI prompts use brand context
- **Resilient by design** — resume-from-where-it-stopped (skips fresh-window keywords automatically), inline OAuth for GSC + Ads (no terminal), self-update from UI (git pull + deps install), 3-level reset

### Trend data providers (in routing order)

| Provider | Cost | Reliability | When to use |
|---|---|---|---|
| **SerpAPI** | 250 free/mo, $50/mo for 5K | ✅ Highest — paid proxy backend | Recommended primary |
| **Apify Google Trends** | $5 free credit/mo | ⚠️ Variable — puppeteer can hang | Fallback |
| **Pytrends** | Free | ⚠️ Frequent rate limits | Last resort, has built-in cooldown |

### Quick install

**Windows:** double-click `install.bat` → set admin password → double-click `start.bat` → browser opens at http://localhost:3000

**macOS / Linux:**
```bash
chmod +x install.sh start.sh stop.sh
./install.sh
./start.sh
```

→ http://localhost:3000 → admin / your-password → setup wizard appears

📖 Detailed: [docs/SETUP.md](docs/SETUP.md) (manual install) · [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) (Search Console / Google Ads / AI keys)

### Tech stack

- **Backend:** Python 3.10+ / FastAPI / SQLAlchemy / SQLite / Pytrends / APScheduler / Google Ads API v25
- **Frontend:** Next.js 14.2 / TypeScript / Tailwind (CSS-variable design tokens, dark mode) / Recharts / SWR
- **AI:** Anthropic SDK 1.x (default model `claude-sonnet-5-5`, change with `ANTHROPIC_MODEL`) + OpenAI SDK (either, or both)
- **Notifications:** Telegram Bot API / Slack Incoming Webhook (optional)
- **Auth:** JWT (local admin)

---

## Türkçe

SEO ve içerik üreticileri için **Google Trends + Search Console + Google Ads + AI** dörtlüsünü tek panelde toplayan açık kaynak araç.

> **Hedef ülkende ne aratılıyor? Sitende karşılığı var mı? AI sana ne yazmanı söyler?**
> Üç soruya tek panelden cevap. Arayüz Türkçe veya İngilizce, açık veya koyu tema, telefonda da çalışır — hepsi sidebar'dan.

### ⚡ Çift Tıkla Kurulum

**🪟 Windows**
1. `install.bat` → çift tık → admin şifresi belirle (~5 dk)
2. `start.bat` → çift tık → tarayıcı otomatik açılır

**🍎 macOS / 🐧 Linux**
```bash
chmod +x install.sh start.sh stop.sh
./install.sh    # ~5 dk
./start.sh
```

→ http://localhost:3000 → admin / (şifren) → otomatik kurulum sihirbazı karşılar

📖 **Detaylı:** [KURULUM.md](KURULUM.md) · [docs/SETUP.md](docs/SETUP.md) · [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)

### 🎯 Özellikler

#### 📊 Trend Takibi (3 sağlayıcı, otomatik fallback)
- **Çoklu sağlayıcı routing**: SerpAPI (250 free/ay) → Apify ($5 free credit) → Pytrends (free, rate-limited)
- Günlük otomatik veri toplama (TR / US / GB / DE / FR / global)
- 5 yıllık tarihsel veri + mevsimsellik analizi (12 ay × 5 yıl heatmap)
- **Yıllık projeksiyon** — CAGR + lineer regresyon ile gelecek yıl tahmini (±RMSE bandı)
- Anomali tespiti, hot uyarılar, fırsat skorlama
- Pattern correlation (X yükselince Y de yükseliyor)
- 30 günlük tahmin (mevsimsellik + trend kombine)
- **"Kaldığı yerden devam"** — rate-limit yiyince yarıda kalsa bile, tekrar tetiklendiğinde sadece eksik kelimeler tazelenir

#### 🧠 Akıllı Katman
- **Fırsat Skoru v2** — tek bir 0-100 skor, beş bileşen: ivme (35) + talep (25, Ads hacmi yoksa Trends ilgisi) + SEO konumu (20, Search Console sayfa 2 ve CTR açığı) + kapsam (10, sitede içerik yoksa) + mevsim (10, 1-3 ay içinde zirve). Her kartta **neden rozetleri**, güven düzeyi ve önerilen aksiyon: Yaz / Optimize et / Koru / İzle / Takip et
- **"Bugün ne yapmalı" aksiyon akışı** — Genel Bakış'ta öncelik sıralı liste. 7 kural: başlığı iyileştir, sayfa 2'den it, içerik yaz, zirveye hazırlan, düşüşte, sayfa çakışması, ani sıçrama. Her madde tek tıkla ilgili araca gider; Yapıldı / 7 gün ertele
- **Akıllı uyarılar** — 5 tür (yükseliş, düşüş, ani sıçrama, zirve yaklaşıyor, Search Console pozisyon kaybı), kritik / uyarı / bilgi derecesi, **tekrarsız** (aynı uyarı her gün yeniden listelenmez), Gördüm / 7 gün sustur. Yeni uyarılar **Telegram veya Slack**'e gider (eşik ayarlanabilir)
- **Mevsimsel yayın takvimi** — 5 yıllık veriden zirve ayı, "zirveden 28 gün önce yayınla" tarihi, sitede içerik yoksa Yaz / varsa Güncelle; 12 aylık takvim görünümü

#### 🔍 Search Console (gerçek SEO)
- Son 28 gün gerçek pozisyon, CTR, tıklama, gösterim
- **Başlık fırsatı** tespiti (yüksek gösterim + düşük CTR)
- Sayfa 2'de bekleyen sorgular (pos 11-20)
- Pozisyon hareketi takibi
- Cannibalization tespiti (aynı sorgu için birden fazla sayfa)

#### 💰 Google Ads (gerçek hacim)
- Her kelime için aylık arama hacmi
- Rekabet seviyesi, üst sayfa CPC aralığı

#### 🤖 AI (Anthropic Claude / OpenAI)
- **Search Intent** sınıflandırma (informational / commercial / transactional / navigational)
- **Keyword Difficulty** (0-100 skor + verdict + strateji)
- **People Also Ask** soruları + topic clusters
- **AI Yazı Üretici** — bir kelimeden tam markdown blog + Instagram + Reels + LinkedIn + Twitter thread + DALL-E kapak + Schema.org JSON-LD
- **AI Yazı Editörü** — yazıyı doğal dille yeniden düzenleyebilir ("samimi yap", "FAQ ekle" vb.)
- **SEO Scorecard** — programatik metrik + AI önerisi (kelime sayısı, density, başlık kullanımı, engagement)
- **Internal Link Önerisi** — sitendeki sayfaları okur, alakalı linkleri önerir
- **Streaming Chat** — verinle doğrudan konuş (SSE, akan cevap)
- **Topic Authority** + **Content Cluster** analizi
- **AI Keşif Hattı** — AI yeni kelime üretir → Trends'ten verisini çeker → mevcut sayfalarınla karşılaştırır → öncelik sıralı liste
- **Onboarding sihirbazı** — marka tarifinden sektör + kategori + tohum kelime önerisi
- **Haftalık AI özet** + **derin kelime analizi** (5 bölümlü rapor)

#### 🟡 İçerik Boşluğu + Yayın
- Sitenin lokal kaynak kodunu tarar (Next.js / Remix / markdown blog)
- Trend olan ama sitede karşılığı olmayan kelimeleri çıkarır
- Yeni / İşleniyor / Yazıldı / İptal durumlarıyla yönet
- Tek tıkla AI ile yazı oluştur, **WordPress** veya **Ghost**'a doğrudan yayınla (taslak veya canlı)

#### 🌍 Çoklu Dil
- Arayüz tamamen TR ve EN — sidebar toggle ile anında geçiş
- AI çıktıları seçilen dilde (Settings → Sistem → Arayüz + AI Dili)
- Hedef coğrafya seçimi (Türkiye, ABD, İngiltere, Almanya, Fransa, global)

#### 🪄 Diğer
- Long-tail varyant üretici (soru / yaş / karşılaştırma / yıl / modifier)
- Tek tıkla "Tümünü Güncelle"
- Tüm veri kaynaklarının canlı tazelik durumu
- 5 sekmeli Ayarlar paneli (Marka, API, Kategoriler, Site, Sistem)
- API anahtarları .env'ye yazılıp anında aktif (backend restart gerekmez)
- **Karanlık mod** (Sistem / Açık / Koyu), **mobil uyumlu** kabuk (çekmece menü), skeleton yükleme, toast bildirimleri

---

## 📚 Dokümanlar

| Belge | İçerik |
|---|---|
| [KURULUM.md](KURULUM.md) | Çift tıkla kurulum (Türkçe) |
| [docs/SETUP.md](docs/SETUP.md) | **Adım adım kurulum** (Python/Node, venv, ilk giriş, AI key, sihirbaz) |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | **Entegrasyonlar** (OpenAI / Anthropic / Search Console / Google Ads OAuth / Telegram / Slack) |

---

## 🏗️ Tech Stack

- **Backend:** Python 3.10+ / FastAPI / SQLAlchemy / SQLite / Pytrends / APScheduler / httpx / Google Ads API v25
- **Frontend:** Next.js 14.2 / TypeScript / Tailwind CSS (CSS değişkenli renk token'ları, karanlık mod) / Recharts / SWR
- **AI:** Anthropic SDK 1.x (varsayılan model `claude-sonnet-5-5`, `ANTHROPIC_MODEL` ile değiştirilebilir) + OpenAI SDK (her ikisi de desteklenir)
- **Bildirim:** Telegram Bot API / Slack Incoming Webhook (opsiyonel)
- **Auth:** JWT (lokal admin)
- **i18n:** Context-based dictionary (TR + EN, ek lib yok)

---

## 🗂️ Proje Yapısı

```
trend-bulucu/
├── backend/                FastAPI (Python)
│   ├── app/
│   │   ├── main.py         FastAPI girişi
│   │   ├── config.py       .env config
│   │   ├── app_settings.py DB-tabanlı dinamik ayarlar
│   │   ├── models.py       SQLAlchemy modelleri (20+ tablo)
│   │   ├── collector.py    Pytrends — günlük + 5y tarihsel
│   │   ├── analytics.py    Skor / anomali / forecast / korelasyon
│   │   ├── seasonality.py  Aylık profil / YoY / lift
│   │   ├── search_console.py GSC API + günlük sync
│   │   ├── google_ads.py   Ads API + Keyword Planner
│   │   ├── site_coverage.py İçerik tarama + gap analizi
│   │   ├── ai.py           Claude + OpenAI + 20+ AI fonksiyon
│   │   ├── insights.py     Fırsat Skoru v2 + aksiyon akışı kuralları
│   │   ├── alerts.py       Akıllı uyarılar (üretim, tekilleştirme, durum)
│   │   ├── notify.py       Telegram / Slack bildirimi
│   │   ├── calendar_plan.py Mevsimsel yayın takvimi
│   │   ├── auth.py         JWT
│   │   ├── scheduler.py    APScheduler (günlük cron → skor, uyarı, bildirim)
│   │   └── routes/         API endpoint'leri (insights, alerts, calendar dahil 13 router)
│   ├── reauth_oauth.py     OAuth refresh token üretici
│   ├── setup_google_ads.py Google Ads ilk kurulum
│   └── requirements.txt
├── frontend/               Next.js 14
│   ├── app/(dashboard)/    Auth gerektiren sayfalar
│   │   ├── page.tsx        Genel Bakış
│   │   ├── explorer/       Kelime detay + araştırma
│   │   ├── opportunities/  Fırsat Skoru v2 kartları
│   │   ├── categories/
│   │   ├── alerts/         Akıllı uyarılar
│   │   ├── calendar/       Mevsimsel yayın takvimi
│   │   ├── chat/           Streaming AI chat
│   │   ├── seo/            Topic clusters + Authority + Cannibalization
│   │   ├── admin/
│   │   └── settings/       Ayarlar + onboarding wizard
│   ├── components/         35+ React component (ActionFeed, OpportunityCard, AppShell, Sidebar…)
│   │   └── ui/             Skeleton, EmptyState, Toast, CollapsibleCard
│   └── lib/
│       ├── theme.tsx       Tema sağlayıcı (Sistem / Açık / Koyu)
│       └── i18n/           TR + EN sözlükleri + LanguageProvider
├── data/                   SQLite DB (gitignored)
├── docs/                   Detaylı dökümanlar
└── README.md
```

---

## 🛣️ Yol Haritası

- [ ] Multi-site / multi-brand (tek kurulumla birden fazla domain)
- [ ] CSV import (mevcut keyword listenizi yükleyin)
- [ ] Bing Webmaster Tools entegrasyonu
- [ ] Daha fazla CMS desteği (Webflow, Strapi)
- [ ] Stripe / iyzico (SaaS olmak isteyen için)

### Tamamlananlar
- ✅ Fırsat Skoru v2 (açıklanabilir) + "Bugün ne yapmalı" aksiyon akışı
- ✅ Akıllı uyarılar + Slack / Telegram bildirimi
- ✅ Mevsimsel yayın takvimi
- ✅ Karanlık mod + mobil uyumlu arayüz
- ✅ Çoklu dil (TR + EN, anlık geçiş)
- ✅ WordPress + Ghost yayın
- ✅ Search Intent + Keyword Difficulty + People Also Ask
- ✅ AI Yazı Editörü + SEO Scorecard + Internal Link önerisi
- ✅ Streaming chat (SSE)
- ✅ Cannibalization + Topic Authority

---

## ⬆️ Mevcut Kurulumu Güncelleme

Daha önce kurduysan (Mayıs 2026 ve öncesi) `git pull` sonrası şunlar gerekir:

1. **Bağımlılıklar:** `backend/requirements.txt` değişti (Anthropic SDK 1.x) ve `frontend/package.json` (Next.js 14.2.35). Sistem → "GitHub'dan güncelle" bunu yapar; elle yapıyorsan `pip install -r requirements.txt` ve `npm install`.
2. **Google Ads:** `.env`'deki `GOOGLE_ADS_API_VERSION=v21` (veya v17) değerini `v25` yap — eski sürümler Ağustos 2026'da kapandı, Keyword Planner çağrıları 404 döner.
3. **Claude modeli:** isteğe bağlı `ANTHROPIC_MODEL=claude-sonnet-5-5` (varsayılan). `claude-opus-5-5` veya `claude-haiku-5-5` de seçilebilir; Ayarlar → API'den de değiştirilir.
4. **Bildirim (opsiyonel):** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SLACK_WEBHOOK_URL`, `NOTIFY_MIN_SEVERITY` — bkz. [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).
5. Yeni tablolar (`alerts`, `insight_action_state`) backend ilk açılışta otomatik oluşur; veri kaybı yok.

---

## 📄 Lisans

[MIT](LICENSE) — Copyright © 2026 Ferhat. İstediğin gibi kullan, değiştir, dağıt.

---

## 🙋 Geri Bildirim

Sorun mu var? Özellik mi istiyorsun? **Issues**'a yaz.
