# Trend Intelligence Dashboard

Open-source SEO + content intelligence dashboard combining **Google Trends + Search Console + Google Ads + AI** in one panel. **Bilingual UI (Türkçe / English)** — switch instantly from the sidebar.

> *Türkçe için aşağı kaydır.*

---

## English

### What it does

- **Google Trends** — daily Pytrends collection, 5y historical, seasonality (12 × 5 heatmap), anomaly detection, 30-day forecast
- **Search Console** — real position, CTR, clicks for the last 28 days; finds title-improvement opportunities, page-2 keywords, position movers
- **Google Ads (Keyword Planner)** — real monthly volume, competition, CPC ranges
- **AI (Anthropic Claude or OpenAI)** — search intent, keyword difficulty (KD), People Also Ask, full article writer (markdown + social media), SEO scorecard, internal-link suggestions, streaming chat with your data, deep keyword analysis, weekly digest
- **Content gaps** — scans your site's local source, finds trending queries you haven't covered, one-click AI-generated post + WordPress/Ghost publish
- **Brand-aware** — onboarding wizard derives industry, categories and seed keywords from your brand description; all AI prompts use brand context

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

- **Backend:** Python 3.10+ / FastAPI / SQLAlchemy / SQLite / Pytrends / APScheduler
- **Frontend:** Next.js 14 / TypeScript / Tailwind / Recharts / SWR
- **AI:** Anthropic SDK + OpenAI SDK (either, or both)
- **Auth:** JWT (local admin)

---

## Türkçe

SEO ve içerik üreticileri için **Google Trends + Search Console + Google Ads + AI** dörtlüsünü tek panelde toplayan açık kaynak araç.

> **Hedef ülkende ne aratılıyor? Sitende karşılığı var mı? AI sana ne yazmanı söyler?**
> Üç soruya tek panelden cevap. Arayüz Türkçe veya İngilizce — sidebar'dan anında değiştir.

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

#### 📊 Trend Takibi
- Pytrends ile günlük otomatik veri toplama (TR / US / GB / DE / FR / global)
- 5 yıllık tarihsel veri + mevsimsellik analizi (12 ay × 5 yıl heatmap)
- Anomali tespiti, hot uyarılar, fırsat skorlama
- Pattern correlation (X yükselince Y de yükseliyor)
- 30 günlük tahmin (mevsimsellik + trend kombine)

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

---

## 📚 Dokümanlar

| Belge | İçerik |
|---|---|
| [KURULUM.md](KURULUM.md) | Çift tıkla kurulum (Türkçe) |
| [docs/SETUP.md](docs/SETUP.md) | **Adım adım kurulum** (Python/Node, venv, ilk giriş, AI key, sihirbaz) |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | **Entegrasyonlar** (OpenAI / Anthropic / Search Console / Google Ads OAuth) |

---

## 🏗️ Tech Stack

- **Backend:** Python 3.10+ / FastAPI / SQLAlchemy / SQLite / Pytrends / APScheduler / httpx
- **Frontend:** Next.js 14 / TypeScript / Tailwind CSS / Recharts / SWR
- **AI:** Anthropic SDK + OpenAI SDK (her ikisi de desteklenir)
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
│   │   ├── auth.py         JWT
│   │   ├── scheduler.py    APScheduler (günlük cron)
│   │   └── routes/         API endpoint'leri (10+ router)
│   ├── reauth_oauth.py     OAuth refresh token üretici
│   ├── setup_google_ads.py Google Ads ilk kurulum
│   └── requirements.txt
├── frontend/               Next.js 14
│   ├── app/(dashboard)/    Auth gerektiren sayfalar
│   │   ├── page.tsx        Genel Bakış
│   │   ├── explorer/       Kelime detay + araştırma
│   │   ├── opportunities/
│   │   ├── categories/
│   │   ├── alerts/
│   │   ├── chat/           Streaming AI chat
│   │   ├── seo/            Topic clusters + Authority + Cannibalization
│   │   ├── admin/
│   │   └── settings/       Ayarlar + onboarding wizard
│   ├── components/         30+ React component
│   └── lib/
│       └── i18n/           TR + EN sözlükleri + LanguageProvider
├── data/                   SQLite DB (gitignored)
├── docs/                   Detaylı dökümanlar
└── README.md
```

---

## 🛣️ Yol Haritası

- [ ] Multi-site / multi-brand (tek kurulumla birden fazla domain)
- [ ] Slack / Telegram bildirim entegrasyonu
- [ ] CSV import (mevcut keyword listenizi yükleyin)
- [ ] Bing Webmaster Tools entegrasyonu
- [ ] Daha fazla CMS desteği (Webflow, Strapi)
- [ ] Stripe / iyzico (SaaS olmak isteyen için)

### Tamamlananlar
- ✅ Çoklu dil (TR + EN, anlık geçiş)
- ✅ WordPress + Ghost yayın
- ✅ Search Intent + Keyword Difficulty + People Also Ask
- ✅ AI Yazı Editörü + SEO Scorecard + Internal Link önerisi
- ✅ Streaming chat (SSE)
- ✅ Cannibalization + Topic Authority

---

## 📄 Lisans

[MIT](LICENSE) — Copyright © 2026 Ferhat. İstediğin gibi kullan, değiştir, dağıt.

---

## 🙋 Geri Bildirim

Sorun mu var? Özellik mi istiyorsun? **Issues**'a yaz.
