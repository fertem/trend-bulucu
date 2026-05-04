#!/bin/bash
# Trend Intelligence Dashboard - Restart helper
# Spawned detached by the backend's self-update endpoint.

set -e
cd "$(dirname "$0")"

echo ""
echo "============================================================"
echo "  Trend Intelligence Dashboard - Yeniden baslatiliyor"
echo "============================================================"
echo ""

# Backend'in kendini sonlandirmasi icin bekle
sleep 4

# Port 8000 (backend) ve 3000 (frontend) uzerindeki surecleri durdur
if [ -x ./stop.sh ]; then
    bash ./stop.sh || true
else
    # Fallback: lsof + kill
    PID=$(lsof -ti tcp:8000 2>/dev/null || true)
    [ -n "$PID" ] && kill -9 $PID 2>/dev/null || true
    PID=$(lsof -ti tcp:3000 2>/dev/null || true)
    [ -n "$PID" ] && kill -9 $PID 2>/dev/null || true
fi

sleep 2

# start.sh'i arka planda baslatma — kullanici terminal donuyor
nohup bash ./start.sh > /tmp/trend-bulucu-restart.log 2>&1 &
disown
