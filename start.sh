#!/bin/bash
# Trend Intelligence Dashboard - Başlat (macOS / Linux)

echo ""
echo "============================================================"
echo "  Trend Intelligence Dashboard - Başlatılıyor"
echo "============================================================"
echo ""

# Kurulum yapılmış mı?
if [ ! -d "backend/venv" ]; then
    echo "HATA: Kurulum yapılmamış! Önce ./install.sh çalıştırın."
    exit 1
fi

if [ ! -f "backend/.env" ]; then
    echo "HATA: backend/.env yok. Önce ./install.sh çalıştırın."
    exit 1
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "HATA: frontend/node_modules yok. Önce ./install.sh çalıştırın."
    exit 1
fi

# Cleanup PID file
LOG_DIR="$(pwd)/logs"
mkdir -p "$LOG_DIR"

echo "Backend başlatılıyor (port 8000)..."
cd backend
source venv/bin/activate
nohup python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$LOG_DIR/backend.pid"
cd ..

echo "Frontend başlatılıyor (port 3000)..."
cd frontend
nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$LOG_DIR/frontend.pid"
cd ..

echo ""
echo "Sunucular başlatıldı. Tarayıcı 8 saniye sonra açılacak..."
sleep 8

# Tarayıcı aç
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3000
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000
fi

echo ""
echo "============================================================"
echo "  ✓ HAZIR!"
echo "============================================================"
echo ""
echo "  Adres:    http://localhost:3000"
echo "  Loglar:   logs/backend.log + logs/frontend.log"
echo "  Durdur:   ./stop.sh"
echo ""
echo "  Backend PID:  $BACKEND_PID"
echo "  Frontend PID: $FRONTEND_PID"
echo ""
