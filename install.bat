@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo.
echo ============================================================
echo   Trend Intelligence Dashboard - Kurulum
echo ============================================================
echo.

REM ---- 1. Python kontrolu ----
echo [1/6] Python kontrol ediliyor...
where python >nul 2>nul
if errorlevel 1 (
    echo.
    echo HATA: Python bulunamadi!
    echo.
    echo Lutfen Python 3.10 veya ustunu yukleyin:
    echo   https://www.python.org/downloads/
    echo.
    echo ONEMLI: Kurulum sirasinda "Add Python to PATH" kutusunu isaretle!
    echo.
    pause
    start https://www.python.org/downloads/
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PY_VERSION=%%i
echo   ✓ Python !PY_VERSION! bulundu

REM ---- 2. Node kontrolu ----
echo.
echo [2/6] Node.js kontrol ediliyor...
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo HATA: Node.js bulunamadi!
    echo.
    echo Lutfen Node.js 18 veya ustunu yukleyin:
    echo   https://nodejs.org/
    echo.
    pause
    start https://nodejs.org/
    exit /b 1
)

for /f %%i in ('node --version') do set NODE_VERSION=%%i
echo   ✓ Node !NODE_VERSION! bulundu

REM ---- 3. Backend venv + pip install ----
echo.
echo [3/6] Backend baslagibi (Python sanal ortam + bagimliliklar)...
cd backend

if exist venv (
    echo   venv zaten var, atlaniyor.
) else (
    echo   venv olusturuluyor...
    python -m venv venv
    if errorlevel 1 (
        echo HATA: venv olusturulamadi.
        pause
        exit /b 1
    )
)

echo   pip paketleri yukleniyor (~2-3 dk surebilir)...
call venv\Scripts\activate.bat
python -m pip install --upgrade pip --quiet
python -m pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo.
    echo HATA: pip install basarisiz. Internet baglantini kontrol et.
    pause
    exit /b 1
)
echo   ✓ Backend bagimliliklar yuklendi

REM ---- 4. .env olusturma ----
echo.
echo [4/6] Yapilandirma dosyalari hazirlaniyor...
if exist .env (
    echo   .env zaten var, atlaniyor.
) else (
    echo   .env olusturuluyor...

    REM Random JWT secret uret
    for /f %%i in ('python -c "import secrets; print(secrets.token_hex(32))"') do set JWT_SECRET=%%i

    REM Admin sifresi al
    echo.
    set /p ADMIN_PWD="Admin sifresi belirleyin (panele giris icin): "
    if "!ADMIN_PWD!"=="" set ADMIN_PWD=admin

    REM .env.example'i kopyala ve degerleri yaz
    copy .env.example .env >nul

    REM PowerShell ile dosya icindeki degerleri degistir
    powershell -NoProfile -Command "(Get-Content .env -Raw) -replace 'ADMIN_PASSWORD=.*', 'ADMIN_PASSWORD=!ADMIN_PWD!' -replace 'JWT_SECRET=.*', 'JWT_SECRET=!JWT_SECRET!' | Set-Content .env -NoNewline"

    echo   ✓ .env olusturuldu (admin sifren kayitli)
)

cd ..

REM ---- 5. Frontend npm install ----
echo.
echo [5/6] Frontend bagimliliklari yukleniyor (~3-5 dk surebilir)...
cd frontend

if exist node_modules (
    echo   node_modules zaten var, atlaniyor.
) else (
    call npm install --silent
    if errorlevel 1 (
        echo HATA: npm install basarisiz.
        pause
        exit /b 1
    )
    echo   ✓ Frontend bagimliliklari yuklendi
)

if not exist .env.local (
    copy .env.local.example .env.local >nul
    echo   ✓ frontend\.env.local olusturuldu
)

cd ..

REM ---- 6. Data klasoru ----
echo.
echo [6/6] Veri klasoru hazirlaniyor...
if not exist data mkdir data
echo   ✓ data\ klasoru hazir

echo.
echo ============================================================
echo   ✓ KURULUM TAMAMLANDI!
echo ============================================================
echo.
echo Simdi paneli baslatmak icin:
echo.
echo   1. start.bat dosyasina cift tiklayin
echo   2. Tarayici otomatik acilacak (http://localhost:3000)
echo   3. Giris bilgileri:
echo      - Kullanici: admin
echo      - Sifre: belirledigin sifre
echo.
echo Panele girince "Hizli Kurulum Sihirbazi" sizi karsilayacak.
echo AI ozelliklerini kullanmak icin OpenAI veya Anthropic API anahtariniz olmali.
echo.
pause
