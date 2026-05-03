# Entegrasyonlar

Tüm entegrasyonlar **opsiyonel**. Hiçbiri olmadan da temel Pytrends + AI çalışır. Ama her biri panele ciddi değer katar.

| Entegrasyon | Ne Verir | Maliyet | Zorluk |
|---|---|---|---|
| **OpenAI / Anthropic** | AI özet, içerik üretimi, kelime önerileri | $5-20/ay | ⭐ Çok kolay |
| **Google Search Console** | Gerçek pozisyon, CTR, tıklama | Ücretsiz | ⭐⭐ Orta |
| **Google Ads Keyword Planner** | Gerçek aylık arama hacmi | Ücretsiz | ⭐⭐⭐ Zor (onay süreci) |

---

## AI Sağlayıcıları

### OpenAI (ChatGPT)

**Hesap aç:**
1. https://platform.openai.com → Sign up
2. https://platform.openai.com/account/billing → Add payment method
3. ~$5 yeter (1000+ AI çağrısı)

**API anahtarı:**
1. https://platform.openai.com/api-keys → **Create new secret key**
2. İsim ver → Create
3. **Anahtar bir kez gösterilir, mutlaka kopyala** (sk-proj-... ile başlar)

**Sisteme ekle:**
- Tarayıcıda Ayarlar → API Anahtarları → `OPENAI_API_KEY` → yapıştır → Kaydet
- Backend'i yeniden başlat (.env değişiyor)

### Anthropic (Claude) — önerilen

Claude daha iyi Türkçe yazar, daha akıllı SEO önerileri verir. Önerim:

1. https://console.anthropic.com → Sign up
2. Settings → Plans & Billing → Add credits (~$5)
3. API Keys → Create Key → kopyala (sk-ant-... ile başlar)
4. Ayarlar → API → `ANTHROPIC_API_KEY` → yapıştır → Kaydet
5. `AI_PROVIDER=anthropic` (varsayılan zaten bu)

> İkisini de eklersen: `AI_PROVIDER` hangisi yazıyorsa öncelikli. Anthropic varken OpenAI çağrısı yapılmaz.

---

## Google Search Console

Gerçek SEO performansını izlemek için. **1 saat** sürer.

### Önkoşul: Search Console'da siten doğrulanmış mı?

https://search.google.com/search-console — siten listede mi?

❌ Hayır → önce orada doğrula:
- "Domain" property öner (tüm subdomain'leri kapsar)
- DNS TXT kaydı ekle veya HTML meta tag yöntemini seç
- Vercel'de hosting varsa otomatik

✅ Evet → devam et.

### 1. Google Cloud Console — Proje + API'lar

#### 1.1 Yeni proje
1. https://console.cloud.google.com/ → giriş
2. Üstte proje seçici → **New Project** → ad ver (örn. `Trend Dashboard`)
3. Create

#### 1.2 Search Console API'yi aktive et
1. Sol menü → **APIs & Services → Library**
2. Ara: `Search Console API`
3. Aç → **Enable**

### 2. OAuth Consent Screen

1. Sol menü → **APIs & Services → OAuth consent screen**
2. **External** seç → Create
3. Form:
   - App name: `Trend Dashboard` (istediğin)
   - User support email: kendi gmail
   - Developer contact: kendi gmail
4. Scopes: **Add or Remove Scopes** → ara: `webmasters` → işaretle → Update → Save
5. Test users: **+ Add users** → kendi gmail'ini ekle (önemli, yoksa "access blocked")
6. Submit

### 3. OAuth Client ID

1. Sol menü → **Credentials**
2. **+ CREATE CREDENTIALS → OAuth client ID**
3. Application type: **Desktop app** (Web değil!)
4. Name: `Trend Dashboard`
5. Create
6. Açılan pop-up: **DOWNLOAD JSON** (bilgisayara kaydet)

### 4. .env'ye anahtarları gir

İndirdiğin JSON'u Notepad ile aç:
```json
{
  "installed": {
    "client_id": "12345-abc.apps.googleusercontent.com",
    "client_secret": "GOCSPX-...",
    ...
  }
}
```

Tarayıcıda Ayarlar → API → 
- `GOOGLE_ADS_CLIENT_ID` → JSON'daki `client_id`
- `GOOGLE_ADS_CLIENT_SECRET` → JSON'daki `client_secret`
- Kaydet → Backend yeniden başlat

> Not: Bu alanlar Google Ads ile ortak — Search Console aynı OAuth flow'u kullanır.

### 5. OAuth Refresh Token

Backend terminalinde (venv aktif):

```bash
python reauth_oauth.py
```

Olacaklar:
1. Tarayıcı otomatik açılır → Google'a giriş yap
2. **2 izin** birden çıkar:
   - Google Ads erişim (göz ardı edebilirsin, kapalı kalır)
   - **View Search Console data** ← bunu onayla
3. **Continue / Allow**
4. "Tamamdır, bu pencereyi kapatabilirsin" → kapat
5. Terminal: `✓ Yeni refresh_token .env'ye yazıldı`

Backend'i yeniden başlat.

### 6. Site Seç

Tarayıcıda Genel Bakış → 🔵 Search Console kartı → **"Sitelerimi Listele"**

Doğrulanmış siteler çıkar. **Siteni seç** → Backend yeniden başlat → **"Şimdi Senkronize Et"**

Son 28 gün verisi çekilir (~10-30 sn).

### Sorun giderme

**"Search Console API has not been used in project X"**
→ Adım 1.2'yi atlamışsın. Cloud Console'da Search Console API'yi enable et.

**"Access blocked: app has not completed Google verification"**
→ OAuth consent screen → Test users'a kendi gmail'ini ekle.

**Site listesi boş**
→ Search Console'da siten doğrulanmamış. https://search.google.com/search-console adresinden ekle.

---

## Google Ads Keyword Planner

Gerçek aylık arama hacmi için. **Onay süreci 1-2 iş günü** sürer.

> ⚠️ **Manager (MCC) hesap zorunlu.** Normal advertiser hesabı API erişimi alamaz.

### 1. Manager Account Aç (yoksa)

Hiç Google Ads hesabın yoksa veya advertiser hesabın varsa:

1. https://ads.google.com/intl/tr_tr/home/tools/manager-accounts/
2. **"Yönetici hesabı oluştur"**
3. Form:
   - Hesap adı: `Trend Manager`
   - **"Diğer kişilerin hesaplarını yönetmek için"** seç
   - Para birimi: TRY
   - Saat dilimi: Istanbul
4. Submit
5. **Sağ üstteki Customer ID'yi not et** (10 hane, formatı: `123-456-7890`)

### 2. Google Cloud Console'da Google Ads API

(Search Console kurulumu yaptıysan aynı projeyi kullan.)

1. https://console.cloud.google.com → projeni seç
2. APIs & Services → Library → ara: `Google Ads API`
3. **Enable**

### 3. OAuth Scope Güncelleme

OAuth consent screen → Scopes:
- **+ Add or Remove Scopes** → `adwords` ara → işaretle → Update → Save

> Search Console için zaten OAuth kurduysan: scope'a `adwords` ekleyip `reauth_oauth.py`'i tekrar çalıştır → yeni refresh_token Ads + GSC ikisini birden kapsar.

### 4. Developer Token

1. https://ads.google.com (manager hesap seçili)
2. Sağ üst **Tools and Settings** → **Setup → API Center**
3. Geliştirici Token sekmesi → token görünür (test mode)
4. **"Temel Erişim için başvur"** linki → form

#### Form doldurma:

| Soru | Cevap |
|---|---|
| API contact email accurate | ✓ işaretle |
| Manager (MCC) ID | (yukarıda not aldığın customer ID) |
| Contact email | kendi mailin |
| Ongoing relationship with Google rep | **No** |
| URL | sitenin URL'si |
| Tool name | `Trend Dashboard` |
| Tool description | (aşağıdaki metni kullan) |
| Will you make publicly available | **No** (kendi kullanım) |
| Token type needed | **Basic** |
| Number of accounts | 1 |
| Estimated daily API calls | < 100 |
| Campaign types | `Search` |
| Capabilities | sadece **Keyword Planning Services** işaretle |

**Tool description metni:**
```
Internal trend intelligence dashboard for our website. We use 
GenerateKeywordHistoricalMetrics endpoint to track real monthly 
search volumes for Turkish keywords. Read-only, daily batch fetch 
of ~20-30 keywords. No third-party data sharing.
```

#### Design Document:
Form bir PDF/DOC isteyecek. Aşağıdaki içeriği bir Word dosyasına yapıştır → PDF olarak kaydet → upload:

```
Tool Name: Trend Dashboard
Owner: [Senin email]
Type: Internal SEO/content trend tool
Use case: GenerateKeywordHistoricalMetrics for Turkish keywords
Architecture: Python FastAPI backend + REST calls
Volume: ~30 ops/day
Auth: OAuth 2.0 installed app flow
Data handling: Local SQLite, no third-party sharing
```

Submit. Email gelir → genelde **aynı gün** veya 1 iş günü içinde onay.

> **İlk başvuru reddedilebilir** ("still in development" mesajı). Bu normal — sistem birkaç hafta kullanılınca tekrar başvur, geçer.

### 5. Customer ID

Google Ads UI sağ üstte **operating account**'un (advertiser) ID'si:
- 10 haneli, format: `123-456-7890`
- Tireleri çıkar: `1234567890`

### 6. Sisteme Bağla

`.env`'ye:
```env
GOOGLE_ADS_DEVELOPER_TOKEN=onaylanan-token
GOOGLE_ADS_CUSTOMER_ID=1234567890
GOOGLE_ADS_LOGIN_CUSTOMER_ID=manager-id-tiresiz
```

Veya UI'dan: Ayarlar → API Anahtarları → ilgili alanlar.

Backend'i yeniden başlat → Yönetim sayfası → **"Hacmi Güncelle"** → ~30 sn → tablolarda "Aylık arama" sütunu çıkar.

### Sorun giderme

**"DEVELOPER_TOKEN_NOT_APPROVED"**
→ Hala test mode'sun. Basic Access onayı gelmedi. Mail kontrol et veya tekrar başvur.

**"USER_PERMISSION_DENIED"**
→ Manager hesap operating hesaba bağlı değil. Manager → Sub-accounts → + → Link existing → operating ID'yi gir → onayla.

**"Google Ads API has not been used in project X"**
→ Cloud Console → APIs & Services → Library → Google Ads API → Enable.

**API v17/v18 → 404**
→ API sürümü deprecate olmuş. `.env`'de `GOOGLE_ADS_API_VERSION=v21` (veya o anki en güncel).

---

## OAuth Consent Screen (ortak)

İlk kez OAuth kuruyorsan bir kerelik yapılması gereken şey. Hem Search Console hem Ads aynı consent screen'i paylaşır.

### Adım adım

1. https://console.cloud.google.com/auth/audience
2. Yoksa: **CONFIGURE CONSENT SCREEN** butonu
3. **External** seç → Create
4. App information:
   - App name: `Trend Dashboard`
   - User support email: kendi gmail
   - Developer contact: kendi gmail
   - Save and continue
5. **Scopes:**
   - **+ Add or Remove Scopes**
   - Ara ve işaretle:
     - `https://www.googleapis.com/auth/webmasters.readonly` (Search Console)
     - `https://www.googleapis.com/auth/adwords` (Google Ads)
   - Update → Save and continue
6. **Test users:**
   - **+ Add users**
   - Kendi gmail adresini ekle (önemli!)
   - Save
7. Submit

> **Önemli:** Test mode'da maksimum 100 kullanıcı destekler. Sadece sen kullanacaksan sorun yok. Yayınlamak istersen Google verification gerekir.

---

Daha fazla soru? Issues'a yaz.
