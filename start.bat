@echo off
chcp 65001 >nul
setlocal

echo.
echo ============================================================
echo   Trend Intelligence Dashboard - Baslatiliyor
echo ============================================================
echo.

REM Kurulum yapilmis mi?
if not exist backend\venv (
    echo HATA: Kurulum yapilmamis!
    echo.
    echo Once install.bat dosyasina cift tiklayin.
    echo.
    pause
    exit /b 1
)

if not exist backend\.env (
    echo HATA: backend\.env yok!
    echo.
    echo Once install.bat'i calistirin.
    echo.
    pause
    exit /b 1
)

if not exist frontend\node_modules (
    echo HATA: frontend\node_modules yok!
    echo.
    echo Once install.bat'i calistirin.
    echo.
    pause
    exit /b 1
)

echo Backend baslatiliyor (port 8000)...
start "Trend Backend" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

echo Frontend baslatiliyor (port 3000)...
timeout /t 3 /nobreak >nul
start "Trend Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Sunucular baslatildi. Tarayici 10 saniye sonra acilacak...
timeout /t 10 /nobreak >nul

start http://localhost:3000

echo.
echo ============================================================
echo   ✓ HAZIR!
echo ============================================================
echo.
echo Tarayici adresi: http://localhost:3000
echo.
echo KAPATMAK icin:
echo   - "Trend Backend" ve "Trend Frontend" pencerelerini kapatin
echo   - Veya stop.bat dosyasina cift tiklayin
echo.
echo Bu pencereyi kapatabilirsiniz.
echo.
pause
