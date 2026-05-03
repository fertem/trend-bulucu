#!/bin/bash
# Trend Intelligence Dashboard - Durdur

echo ""
echo "Durduruluyor..."

LOG_DIR="$(pwd)/logs"

if [ -f "$LOG_DIR/backend.pid" ]; then
    PID=$(cat "$LOG_DIR/backend.pid")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID" && echo "  ✓ Backend durduruldu (PID $PID)"
    fi
    rm -f "$LOG_DIR/backend.pid"
fi

if [ -f "$LOG_DIR/frontend.pid" ]; then
    PID=$(cat "$LOG_DIR/frontend.pid")
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID" && echo "  ✓ Frontend durduruldu (PID $PID)"
    fi
    rm -f "$LOG_DIR/frontend.pid"
fi

# Yedek: port'u dinleyen herhangi bir süreci kapat
if command -v lsof &> /dev/null; then
    lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "  ✓ Port 8000 temiz"
    lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "  ✓ Port 3000 temiz"
fi

echo ""
echo "Tamamlandı."
