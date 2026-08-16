@echo off
setlocal EnableExtensions

REM VibX 2.0 — Expo dev client + optional backend stubs
REM Vyze voice runs on-device. Python/Rust stubs start only if their tools work.
REM Extra flags are passed to Expo, e.g. start-vibx.bat --tunnel
cd /d "%~dp0"

echo.
echo  VibX 2.0 — starting services...
echo  Project: %CD%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node 22+ and try again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [OK] Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

if not defined ANDROID_HOME (
  if exist "%LOCALAPPDATA%\Android\Sdk" (
    set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
  )
)
if defined ANDROID_HOME set "ANDROID_SDK_ROOT=%ANDROID_HOME%"

REM USB-connected Android can reach Metro on this PC
where adb >nul 2>&1
if not errorlevel 1 (
  adb reverse tcp:8081 tcp:8081 >nul 2>&1
  if not errorlevel 1 echo [OK] ADB reverse: device Metro port 8081
)

REM --- Python Vyze API stub (port 8000; unused while speech is on-device) ---
set "PY="
where py >nul 2>&1
if not errorlevel 1 set "PY=py -3"
if not defined PY (
  where python >nul 2>&1
  if not errorlevel 1 set "PY=python"
)
if defined PY (
  %PY% -c "import uvicorn,fastapi" >nul 2>&1
  if not errorlevel 1 (
    echo [OK] Starting Vyze Python API on http://127.0.0.1:8000
    start "VibX Vyze Python" cmd /k "cd /d ""%~dp0python"" && %PY% -m uvicorn api:app --host 127.0.0.1 --port 8000 --reload"
  ) else (
    echo [SKIP] Python found, but FastAPI/Uvicorn are not installed — Vyze API not started.
  )
) else (
  echo [SKIP] Python not found — Vyze API not started.
)

REM --- Rust backend stub (port 8080) ---
where cargo >nul 2>&1
if not errorlevel 1 (
  echo [OK] Starting Rust backend on http://127.0.0.1:8080
  start "VibX Rust Backend" cmd /k "cd /d ""%~dp0backend\rust"" && cargo run"
) else (
  echo [SKIP] Rust/Cargo not found — backend not started.
)

echo.
echo [OK] Starting Expo dev server (dev client)...
echo      Open the VibX dev APK on your phone and scan the QR code.
echo      Or press "a" here if an Android emulator is running.
echo      Optional flags: --tunnel  --clear
echo.

call npm run start -- %*

endlocal
