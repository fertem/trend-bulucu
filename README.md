# Trend Intelligence Dashboard

Türkçe SEO ve içerik üreticileri için **Google Trends + Search Console + AI** üçlüsünü tek panelde toplayan açık kaynak araç.

> **Türkiye'de ne aratılıyor? Sitende karşılığı var mı? AI sana ne yazmanı söyler?**
> Üç soruya tek panelden cevap.

---

## ⚡ Çift Tıkla Kurulum

### 🪟 Windows
1. `install.bat` → çift tık → admin şifresi belirle (~5 dk)
2. `start.bat` → çift tık → tarayıcı otomatik açılır

### 🍎 macOS / 🐧 Linux
```bash
chmod +x install.sh start.sh stop.sh
./install.sh    # ~5 dk
./start.sh
```

→ http://localhost:3000 → admin / (şifren) → otomatik kurulum sihirbazı karşılar

📖 **Detaylı:** [KURULUM.md](KURULUM.md) (sade Türkçe) · [docs/SETUP.md](docs/SETUP.md) (manuel kurulum)

---

## 🎯 Özellikler

### 📊 Trend Takibi
- Pytrends ile günlük otomatik veri toplama (Türkiye geo)
- 5 yıllık tarihsel veri + mevsimsellik analizi (12 ay × 5 yıl heatmap)
- Anomali tespiti, hot uyarılar, fırsat skorlama
- Pattern correlation (X yükselince Y de yükseliyor)
- 30 günlük tahmin (mevsimsellik + trend kombine)

### 🔍 Search Console (gerçek SEO)
- Son 28 gün gerçek pozisyon, CTR, tıklama, gösterim
- **Başlık fırsatı** tespiti (yüksek gösterim + düşük CTR)
- Sayfa 2'de bekleyen sorgular (pos 11-20)
- Pozisyon hareketi takibi

### 💰 Google Ads (gerçek hacim)
- Her kelime için aylık arama hacmi
- Rekabet seviyesi, CPC aralığı

### 🤖 AI (Anthropic Claude / OpenAI)
- **Onboarding sihirbazı**: marka tarifinden sektör + kategori + tohum kelime önerisi
- **Haftalık AI özet**: Trends + Search Console verisini birleştirip somut aksiyon önerir
- **Derin kelime analizi**: 5 bölümlü rapor (tarihsel + güncel + 3 ay tahmini + aksiyonlar)
- **AI Keşif Hattı**: AI yeni kelime üretir → Trends'ten verisini çeker → mevcut sayfalarınla karşılaştırır → öncelik sıralı liste
- **AI Yazı Üretici**: bir kelimeden tam blog yazısı (markdown) + Instagram + Reels + LinkedIn + Twitter thread

### 🟡 İçerik Boşluğu
- Sitenin lokal kaynak kodunu tarar
- Trend olan ama sitede karşılığı olmayan kelimeleri çıkarır
- Yeni / İşleniyor / Yazıldı / İptal durumlarıyla yönet
- Tek tıkla AI ile yazı oluştur

### 🪄 Diğer
- Long-tail varyant üretici (soru/yaş/karşılaştırma/yıl/modifier)
- Tek tıkla "Tümünü Güncelle"
- Tüm veri kaynaklarının canlı tazelik durumu
- 5 sekmeli Ayarlar paneli (marka, API, kategori, site, sistem)

---

## 📚 Dokümanlar

| Belge | İçerik |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | **Adım adım kurulum** (Python/Node, venv, ilk giriş, AI key, sihirbaz) |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | **Entegrasyonlar** (OpenAI / Anthropic / Search Console / Google Ads OAuth) |

---

## 🏗️ Tech Stack

- **Backend:** Python 3.10+ / FastAPI / SQLAlchemy / SQLite / Pytrends / APScheduler / httpx
- **Frontend:** Next.js 14 / TypeScript / Tailwind CSS / Recharts / SWR
- **AI:** Anthropic SDK + OpenAI SDK (her ikisi de desteklenir)
- **Auth:** JWT (lokal admin)

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
│   │   ├── ai.py           Claude + OpenAI + 15 AI fonksiyon
│   │   ├── auth.py         JWT
│   │   ├── scheduler.py    APScheduler (günlük cron)
│   │   └── routes/         API endpoint'leri (10+ router)
│   ├── reauth_oauth.py     OAuth refresh token üretici
│   ├── setup_google_ads.py Google Ads ilk kurulum
│   └── requirements.txt
├── frontend/               Next.js
│   ├── app/(dashboard)/    Auth gerektiren sayfalar
│   │   ├── page.tsx        Genel Bakış
│   │   ├── explorer/       Kelime detay + araştırma
│   │   ├── opportunities/
│   │   ├── categories/
│   │   ├── alerts/
│   │   ├── admin/
│   │   └── settings/       Ayarlar + onboarding wizard
│   ├── components/         25+ React component
│   └── lib/
├── data/                   SQLite DB (gitignored)
├── docs/                   Detaylı dökümanlar
└── README.md
```

---

## 🛣️ Yol Haritası

- [ ] WordPress / Webflow / Ghost desteği (şu an Next.js)
- [ ] Multi-site / multi-brand
- [ ] Çoklu dil (TR + EN)
- [ ] Slack / Telegram bildirim
- [ ] CSV import (mevcut keyword listenizi yükleyin)
- [ ] Stripe / iyzico (SaaS olmak isteyen için)

---

## 📄 Lisans

MIT — istediğin gibi kullan, değiştir, dağıt.

---

## 🙋 Geri Bildirim

Sorun mu var? Özellik mi istiyorsun? **Issues**'a yaz.
