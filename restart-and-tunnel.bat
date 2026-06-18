@echo off
title Lensa Insignia — Restart & Tunnel
cd /d "%~dp0"

:: ─────────────────────────────────────────────
::  One script to run after reboot.
::  Starts Docker → Supabase → PM2 (app + tunnel)
:: ─────────────────────────────────────────────

set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "RESET=[0m"

echo ============================================
echo    Lensa Insignia — Post-Reboot Startup
echo ============================================
echo.

:: ─────────── 1. Docker ───────────
echo [1/4] Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo   %YELLOW%Docker is not running. Starting Docker Desktop...%RESET%
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo   Waiting for Docker to be ready...
    powershell -Command "& {
        $timeout = 60;
        $elapsed = 0;
        while ($elapsed -lt $timeout) {
            try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:54321/auth/v1/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch {}
            Start-Sleep -Seconds 2;
            $elapsed += 2;
        }
        exit 1
    }" >nul 2>&1
    if errorlevel 1 (
        echo   %RED%ERROR: Docker didn't start within 60s. Start it manually.%RESET%
        pause
        exit /b 1
    )
)
echo   %GREEN%✓ Docker is running%RESET%
echo.

:: ─────────── 2. Supabase ───────────
echo [2/4] Starting Supabase...
supabase start >nul 2>&1
if errorlevel 1 (
    rem already running — that's fine
    echo   %YELLOW%Supabase may already be up (continuing)%RESET%
) else (
    echo   %GREEN%✓ Supabase started%RESET%
)

:wait_supabase
echo   Waiting for Supabase API...
powershell -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:54321/auth/v1/health' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto wait_supabase
)
echo   %GREEN%✓ Supabase API is ready%RESET%
echo.

:: ─────────── 3. Build (if needed) ───────────
echo [3/4] Checking SSR build...
if not exist "dist\server\entry-server.js" (
    echo   Building SSR production bundle...
    call npm run build:ssr
    if errorlevel 1 (
        echo   %RED%ERROR: SSR build failed. Run 'npm run build:ssr' manually.%RESET%
        pause
        exit /b 1
    )
    echo   %GREEN%✓ SSR build complete%RESET%
) else (
    echo   %GREEN%✓ SSR build exists%RESET%
)
echo.

:: ─────────── 4. PM2 (app + tunnel) ───────────
echo [4/4] Starting PM2 processes...
pm2 start ecosystem.config.cjs >nul 2>&1
if errorlevel 1 (
    echo   %RED%ERROR: PM2 failed to start.%RESET%
    pause
    exit /b 1
)
echo   %GREEN%✓ PM2 processes started%RESET%
echo.

:: Save process list so 'pm2 resurrect' works after future reboots
pm2 save >nul
echo   %GREEN%✓ PM2 process list saved (for auto-recovery on next boot)%RESET%
echo.

:: ─────────── Summary ───────────
echo ============================================
echo   %GREEN%All services running!%RESET%
echo.
echo   Local:      http://localhost:3000
echo   Live:       https://lensainsignia.com
echo.
echo   Check status: pm2 status
echo   View logs:    pm2 logs
echo   Stop all:     pm2 stop ecosystem.config.cjs
echo ============================================
echo.

:: Open the live site in browser
start https://lensainsignia.com

echo Press any key to close this window...
pause >nul
