# Kurulum Rehberi

Sıfırdan kurulum, **15-20 dakika** sürer. Her adım sırayla — atlamadan ilerle.

---

## Önce Neye İhtiyacın Var

Aşağıdakiler bilgisayarında kurulu mu? Kontrol et:

### 1. Python 3.10 veya üstü

Terminal/CMD aç, yaz:
```bash
python --version
```

✅ `Python 3.10.x` veya üstü görüyorsan → **OK, sıradaki**
❌ Hata veriyorsa veya 3.9 ve altı çıkıyorsa:
- **Windows:** https://www.python.org/downloads/ → "Download Python 3.12" → kurulumda **"Add Python to PATH"** kutusunu işaretle
- **macOS:** `brew install python@3.12` (Homebrew yoksa: https://brew.sh)
- **Linux:** `sudo apt install python3.12` (Ubuntu/Debian)

### 2. Node.js 18 veya üstü

```bash
node --version
```

✅ `v18.x.x` veya üstü → **OK**
❌ Yoksa: https://nodejs.org/ → "LTS" sürümünü indir, kur

### 3. Git (opsiyonel ama önerilen)

```bash
git --version
```

Yoksa: https://git-scm.com/downloads

---

## Adım 1: Projeyi İndir

### A) Git ile (önerilen):
```bash
git clone <repo-url>
cd trend-bulucu
```

### B) ZIP olarak:
GitHub'da yeşil **"Code" → "Download ZIP"** → İndir → çıkart → klasöre gir

```bash
cd trend-bulucu  # veya nereye çıkardıysan
```

---

## Adım 2: Backend Kurulumu

Hala terminal açık. **Backend klasörüne** gir:

```bash
cd backend
```

### 2.1 Python sanal ortam (venv) oluştur

```bash
python -m venv venv
```

Klasörde `venv/` oluşur, projenin Python paketleri buraya kurulacak (sistem Python'una karışmaz).

### 2.2 venv'i aktif et

**Windows (PowerShell):**
```bash
venv\Scripts\activate
```

**Windows (CMD):**
```bash
venv\Scripts\activate.bat
```

**macOS/Linux:**
```bash
source venv/bin/activate
```

✅ Komut satırının başına `(venv)` yazısı gelmiş olmalı:
```
(venv) PS C:\...\backend>
```

❌ "running scripts is disabled" hatası (Windows PowerShell):
```bash
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
→ Y → tekrar dene

### 2.3 Bağımlılıkları kur

```bash
pip install -r requirements.txt
```

~2-3 dakika sürer, ekranda paketler kurulurken kayar. Sonunda:
```
Successfully installed fastapi-... uvicorn-... pytrends-... ...
```

### 2.4 .env dosyasını hazırla

```bash
# Windows:
copy .env.example .env
# macOS/Linux:
cp .env.example .env
```

Sonra `.env` dosyasını **Notepad** veya VS Code ile aç. Sadece **2 alanı** doldurman zorunlu:

```env
ADMIN_PASSWORD=istediğin-bir-şifre
JWT_SECRET=rastgele-uzun-bir-metin-yaz-buraya-en-az-32-karakter
```

> **JWT_SECRET için:** https://generate-secret.vercel.app/32 sayfasından bir rastgele string al, kopyala-yapıştır.

Diğer alanları **şimdi doldurma** — UI'dan daha kolay.

### 2.5 Backend'i başlat

```bash
python -m uvicorn app.main:app --port 8000
```

✅ Şu yazıyı görüyor musun?
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

→ Backend çalışıyor. **Bu pencereyi kapatma**, açık kalsın.

---

## Adım 3: Frontend Kurulumu

**Yeni terminal aç** (önceki açık kalsın). Proje klasörüne gel ve frontend'e gir:

```bash
cd trend-bulucu/frontend
```

### 3.1 Bağımlılıkları kur

```bash
npm install
```

~3-5 dakika sürer. Bitince:

### 3.2 .env.local hazırla

```bash
# Windows:
copy .env.local.example .env.local
# macOS/Linux:
cp .env.local.example .env.local
```

İçeriği zaten hazır (`NEXT_PUBLIC_API_URL=http://localhost:8000`), düzenleme gerek yok.

### 3.3 Frontend'i başlat

```bash
npm run dev
```

✅ Şunu görmelisin:
```
✓ Ready in 6.9s
- Local:        http://localhost:3000
```

→ **Bu terminali de kapatma.**

---

## Adım 4: İlk Giriş

Tarayıcı aç → **http://localhost:3000**

Giriş ekranı:
- **Kullanıcı:** `admin`
- **Şifre:** `.env`'de yazdığın `ADMIN_PASSWORD`

→ **Giriş yap**.

✅ Genel Bakış sayfası açıldı. En üstte mor bir banner:

> **🪄 Markana özel hızlı kurulum sihirbazı**
> 5 adımda marka bilgilerini gir, AI sektörünü tespit etsin...

---

## Adım 5: AI Anahtarı Al (önerilen)

AI olmadan da panel çalışır ama özelliklerin çoğu (özet, içerik üretimi, kelime önerileri) çalışmaz.

### Seçenek A: OpenAI (ChatGPT)

1. https://platform.openai.com/api-keys
2. **"Create new secret key"** → adlandır → **Create**
3. Çıkan anahtarı kopyala (`sk-proj-...` ile başlar)
4. **Bu anahtar bir kez gösterilir, mutlaka kopyala**
5. https://platform.openai.com/account/billing → kredi kartı ekle (~$5 yeter)

### Seçenek B: Anthropic (Claude) — önerilen

1. https://console.anthropic.com
2. Hesap aç → **API Keys** → **Create Key** → kopyala
3. Settings → Billing → kredi yükle ($5)

### Anahtarı sisteme ekle

Tarayıcıda:
1. **Sol menüden Ayarlar** → **API Anahtarları** sekmesi
2. `OPENAI_API_KEY` veya `ANTHROPIC_API_KEY` alanına anahtarını yapıştır
3. **"X değişikliği kaydet"**
4. Sayfanın üstünde uyarı: *"Backend'i yeniden başlat"*

### Backend'i yeniden başlat

Backend'in çalıştığı terminale dön → **Ctrl+C** → tekrar:
```bash
python -m uvicorn app.main:app --port 8000
```

---

## Adım 6: Hızlı Kurulum Sihirbazı

Tarayıcıda Genel Bakış'a dön (sayfa yenile) → mor banner → **"Sihirbazı Başlat"**

### Adım 1/5: Marka Bilgileri

| Alan | Örnek |
|---|---|
| Marka adı | `Şirketim` |
| Site URL | `https://www.example.com` |
| Marka açıklaması | `Kadınlar için online yoga ve meditasyon platformu` |
| Hedef kitle | (boş bırakabilirsin, AI önerecek) |

→ **"Devam → AI Sektör Tespiti"**

### Adım 2/5: AI Sektör Tespiti

AI markanı okur, sektörünü çıkarır, hedef kitle önerir.

→ **"Devam → Kategori Önerileri"**

### Adım 3/5: AI Kategori Önerileri

Markaya özel 5-7 kategori önerisi. Hepsi seçili gelir, istemediğini kaldır.

→ **"Devam → Kelime Önerileri"**

### Adım 4/5: AI Tohum Kelime Önerileri

15 anahtar kelime önerisi. Her gün otomatik takip edilecek olanları seç (ilk 10 önerilir).

→ **"Tamamla"**

### Adım 5/5: Bitti! 🎉

Genel Bakış'a dön.

---

## Adım 7: İlk Veri Çekimi

Genel Bakış'ta üstte **"Veri Tazelik Durumu"** kartı → **"Tümünü Güncelle"** butonu

→ Backend arka planda:
1. Pytrends'ten son 30 gün verisini çeker (~3-5 dk)
2. Skor hesaplar
3. İçerik fırsatlarını tarar

5-10 dk sonra Genel Bakış'ta veriler görünmeye başlar:
- AI Hero özet kartı
- Mevsimsellik kartı
- Top 10 trend
- Anomali, hot uyarılar

---

## Adım 8: Opsiyonel Entegrasyonlar

Aşağıdakiler zorunlu değil. İhtiyacın olduğunda ayrı dökümanlardan kur:

- **🔍 Google Search Console** (gerçek pozisyon, CTR) → [INTEGRATIONS.md → Search Console](INTEGRATIONS.md#google-search-console)
- **💰 Google Ads Keyword Planner** (gerçek aylık hacim) → [INTEGRATIONS.md → Google Ads](INTEGRATIONS.md#google-ads-keyword-planner)
- **📁 Site içerik tarama** (sitende olmayan trend kelimeler) → Aşağıda

### Site Yolu (içerik boşluk analizi)

Sitenin **lokal kaynak kodu klasörü** yolunu Ayarlar → Site sekmesine gir. Klasör altında `app/` veya `app/blog/` (Next.js) olmalı.

```
örnek: c:/Users/me/projects/my-website
```

Vercel'de yayındaki bir siteyi izlemek istersen:
```bash
git clone https://github.com/sen/sitenin-repo.git ~/my-website
```

Sonra Ayarlar → Site → yolu gir → Kaydet → Genel Bakış'ta "Siteyi Tara".

---

## Sorun Giderme

### "ModuleNotFoundError: No module named 'fastapi'"
venv'i aktif etmeyi unutmuşsun:
```bash
cd backend
venv\Scripts\activate    # Windows
source venv/bin/activate # macOS/Linux
```

### "Port 8000 already in use"
Önceki backend hala çalışıyor:
- **Windows:** `taskkill /F /IM python.exe` (dikkat — tüm Python süreçlerini öldürür)
- **macOS/Linux:** `lsof -ti:8000 | xargs kill -9`

### Frontend'de "API hatası" / "Network error"
Backend kapalı. Backend terminaline dön, çalışıyor mu kontrol et. Yoksa tekrar başlat.

### "Pytrends 429 Too Many Requests"
Google IP'ni geçici olarak yavaşlatmış. 1-2 saat bekle, sonra tekrar dene. `.env`'de `REQUEST_DELAY_SECONDS=4` yapabilirsin.

### Tarayıcıda Türkçe karakterler bozuk
Sayfa cache'i. **Ctrl+Shift+R** ile sert yenile.

### "Access blocked: app has not completed Google verification"
Google OAuth consent screen'de **kendi gmail'ini Test Users listesine eklemeyi unutmuşsun**. [INTEGRATIONS.md → OAuth Setup](INTEGRATIONS.md#oauth-consent-screen) bölümüne bak.

---

## Sonraki Adımlar

Kurulum tamam ✓. Şimdi:

1. **Genel Bakış'ı keşfet** — AI Hero, Mevsimsellik, Search Console kartı, İçerik Boşluğu
2. **AI Keşif Hattı** — markaya özel yeni kelime keşfetmek için
3. **Keşif sayfası** — herhangi bir kelimenin 5y datasını anlık çek
4. **AI Yazı** — bir gap için tek tıkla blog yazısı + sosyal medya paketi
5. **Otomatik mod** — backend açık kaldığı sürece her gece 03:00'te otomatik güncellenir

İyi keşifler! 🚀
