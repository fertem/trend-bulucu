@echo off
chcp 65001 >nul

echo.
echo Trend Intelligence Dashboard - Durduruluyor...
echo.

REM Port 8000 (backend) ve 3000 (frontend) uzerindeki surecleri sonlandir
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
    echo   ✓ Backend durduruldu
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
    echo   ✓ Frontend durduruldu
)

REM Pencere title'iyla da kapat (yedek)
taskkill /FI "WINDOWTITLE eq Trend Backend*" /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq Trend Frontend*" /F >nul 2>nul

echo.
echo Tamamlandi.
echo.
timeout /t 3 /nobreak >nul
