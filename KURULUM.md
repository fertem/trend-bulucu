# 🚀 Kurulum (Çift Tıkla)

## Windows

### 1. Önkoşul (sadece ilk sefer, ~5 dk)

İki şey yüklü olmalı:

**Python 3.10+** → https://www.python.org/downloads/
> ⚠️ Kurulumun ilk ekranında **"Add Python to PATH"** kutusunu MUTLAKA işaretle, sonra "Install Now"

**Node.js 18+** → https://nodejs.org/
> "LTS" sürümünü indir, varsayılan ayarlarla kur

Yüklü mü kontrol etmek için: Başlat → "cmd" → şu iki komutu çalıştır:
```
python --version
node --version
```
İkisi de versiyon yazıyorsa hazırsın.

### 2. Kurulum (~5-10 dk)

1. Bu klasörde **`install.bat`** dosyasına **çift tıkla**
2. Açılan siyah pencerede:
   - "Admin şifresi belirleyin:" yazısı çıkınca panel için bir şifre yaz, Enter
3. ~5 dakika bekle (paketler yükleniyor)
4. "✓ KURULUM TAMAMLANDI!" yazısını gör
5. Pencereyi kapat

### 3. Çalıştırma

1. **`start.bat`** dosyasına çift tıkla
2. ~10 saniye sonra tarayıcı otomatik açılır → http://localhost:3000
3. Giriş:
   - Kullanıcı: `admin`
   - Şifre: kurulumda belirlediğin şifre

### 4. Durdurma

İki yol:
- Açılan iki siyah pencereyi (Trend Backend, Trend Frontend) kapat
- Veya **`stop.bat`** dosyasına çift tıkla

---

## macOS / Linux

### 1. Önkoşul

```bash
# macOS (Homebrew ile)
brew install python@3.12 node

# Linux (Debian/Ubuntu)
sudo apt install python3 python3-venv python3-pip nodejs npm
```

### 2. Kurulum

Terminal aç, bu klasöre gel:
```bash
cd /path/to/trend-bulucu
chmod +x install.sh start.sh stop.sh
./install.sh
```

Admin şifresi sorulduğunda gir.

### 3. Çalıştırma

```bash
./start.sh
```

Tarayıcı otomatik açılır.

### 4. Durdurma

```bash
./stop.sh
```

---

## Sonra Ne Olacak?

### Hesap Açtıktan Sonra (~5 dk)

1. Tarayıcıda **http://localhost:3000** → admin / şifren ile giriş yap
2. **🪄 Hızlı Kurulum Sihirbazı** otomatik karşılar:
   - Marka adı, açıklama, hedef kitle gir
   - AI sektörünü tespit eder
   - Sana özel kategori ve kelime önerir
3. **5. adımda** "Tamamla" → Genel Bakış'a git
4. **AI ozellikleri için API anahtarı** ekle:
   - Sol menüden **Ayarlar → API Anahtarları**
   - `ANTHROPIC_API_KEY` veya `OPENAI_API_KEY` alanına anahtarını yapıştır
   - Kaydet
   - Backend'i yeniden başlat (start.bat dosyasını tekrar tıkla)
5. **Genel Bakış'ta "Tümünü Güncelle"** → ilk veri çekimi (~5 dk)
6. **Sol menüde "Kurulum"** sekmesinden tüm adımları kontrol et

### AI Anahtarı Nasıl Alınır?

**Kolay olan: OpenAI**
1. https://platform.openai.com/api-keys → Hesap aç
2. "Create new secret key" → kopyala (sk-... ile başlar)
3. Faturalamaya $5 yükle (1000+ AI çağrısı)
4. Anahtarı **Ayarlar → API**'ye yapıştır

**Daha iyi Türkçe için: Anthropic Claude**
1. https://console.anthropic.com → Hesap aç → kredi yükle ($5)
2. API Keys → Create → kopyala
3. Anahtarı yapıştır

---

## Sorun Çıkarsa

### "install.bat çalışmıyor"
- Sağ tıkla → "Yönetici olarak çalıştır"
- Hala olmuyorsa Windows Defender / antivirüs blokluyordur, geçici izin ver

### "Python/Node bulunamadı"
Python kurarken **"Add Python to PATH"** kutusunu işaretlemediysen tekrar kur ve işaretle.

### "Tarayıcı açılmadı / sayfa boş"
- 30 saniye bekle, sayfayı yenile (F5)
- Hala olmuyorsa siyah pencerelerde hata var mı kontrol et

### "Port 8000 already in use" hatası
Önceki sürec kapanmamış. **stop.bat**'a çift tıkla, sonra **start.bat**'ı tekrar dene.

### Daha derin yapılandırma (Search Console / Google Ads / Site içerik analizi)
[docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) dökümanına bak — opsiyonel entegrasyonlar.

---

## Yardım

Sorun yaşarsan **GitHub Issues**'a yaz, screenshot ekle.
