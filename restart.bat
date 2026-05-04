@echo off
chcp 65001 >nul

REM Trend Intelligence Dashboard - Restart helper
REM Spawned detached by the backend's self-update endpoint.
REM Waits for backend to exit, stops anything on ports 8000/3000, restarts.

echo.
echo ============================================================
echo   Trend Intelligence Dashboard - Yeniden baslatiliyor
echo ============================================================
echo.

REM Backend'in kendini sonlandirmasi icin kisa bekleme
timeout /t 4 /nobreak >nul

REM Port 8000 (backend) ve 3000 (frontend) uzerindeki surecleri kapat
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
)

REM Kisa bos bekleme
timeout /t 2 /nobreak >nul

REM start.bat'i baslat (yeni pencerede)
start "" "%~dp0start.bat"

exit
