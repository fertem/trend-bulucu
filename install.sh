#!/bin/bash
# Trend Intelligence Dashboard - macOS / Linux Kurulum
set -e

echo ""
echo "============================================================"
echo "  Trend Intelligence Dashboard - Kurulum"
echo "============================================================"
echo ""

# 1. Python kontrolü
echo "[1/6] Python kontrol ediliyor..."
if ! command -v python3 &> /dev/null; then
    echo ""
    echo "HATA: Python3 bulunamadı."
    echo ""
    echo "macOS: brew install python@3.12"
    echo "Linux (Debian/Ubuntu): sudo apt install python3 python3-venv python3-pip"
    echo ""
    exit 1
fi
PY_VERSION=$(python3 --version | awk '{print $2}')
echo "  ✓ Python $PY_VERSION bulundu"

# 2. Node kontrolü
echo ""
echo "[2/6] Node.js kontrol ediliyor..."
if ! command -v node &> /dev/null; then
    echo ""
    echo "HATA: Node bulunamadı."
    echo ""
    echo "macOS: brew install node"
    echo "Linux: https://nodejs.org/"
    echo ""
    exit 1
fi
NODE_VERSION=$(node --version)
echo "  ✓ Node $NODE_VERSION bulundu"

# 3. Backend venv + pip
echo ""
echo "[3/6] Backend hazırlanıyor (Python sanal ortam + bağımlılıklar)..."
cd backend

if [ -d "venv" ]; then
    echo "  venv zaten var, atlanıyor."
else
    python3 -m venv venv
fi

echo "  pip paketleri yükleniyor (~2-3 dk)..."
source venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
echo "  ✓ Backend bağımlılıkları yüklendi"

# 4. .env oluşturma
echo ""
echo "[4/6] Yapılandırma dosyaları hazırlanıyor..."
if [ -f ".env" ]; then
    echo "  .env zaten var, atlanıyor."
else
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    echo ""
    read -p "Admin şifresi belirleyin (panele giriş için): " ADMIN_PWD
    if [ -z "$ADMIN_PWD" ]; then
        ADMIN_PWD="admin"
    fi

    cp .env.example .env
    # sed ile değerleri değiştir (BSD/GNU uyumlu)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$ADMIN_PWD|" .env
        sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    else
        sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$ADMIN_PWD|" .env
        sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    fi
    echo "  ✓ .env oluşturuldu"
fi

cd ..

# 5. Frontend
echo ""
echo "[5/6] Frontend bağımlılıkları yükleniyor (~3-5 dk)..."
cd frontend

if [ -d "node_modules" ]; then
    echo "  node_modules zaten var, atlanıyor."
else
    npm install --silent
    echo "  ✓ Frontend bağımlılıkları yüklendi"
fi

if [ ! -f ".env.local" ]; then
    cp .env.local.example .env.local
    echo "  ✓ frontend/.env.local oluşturuldu"
fi

cd ..

# 6. Data klasörü
echo ""
echo "[6/6] Veri klasörü hazırlanıyor..."
mkdir -p data
echo "  ✓ data/ klasörü hazır"

# Script'leri çalıştırılabilir yap
chmod +x start.sh stop.sh 2>/dev/null || true

echo ""
echo "============================================================"
echo "  ✓ KURULUM TAMAMLANDI!"
echo "============================================================"
echo ""
echo "Şimdi paneli başlatmak için:"
echo ""
echo "  ./start.sh"
echo ""
echo "  Veya tarayıcıda: http://localhost:3000"
echo "  Kullanıcı: admin"
echo "  Şifre: belirlediğin şifre"
echo ""
