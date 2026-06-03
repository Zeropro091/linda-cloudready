@echo off
title Local Development Starter

:: Ensure Docker Desktop is running
echo Checking Docker status...
docker info >nul 2>&1
if errorlevel 1 (
    echo Docker is not running. Please start Docker Desktop and re-run this script.
    pause
    exit /b 1
) else (
    echo Docker is running.
)

:: Start Supabase (Docker containers)
echo Starting Supabase containers...
start "Supabase" cmd /c "supabase start"

:: Wait for Supabase API to become reachable
set "API_URL=http://127.0.0.1:54321"
echo Waiting for Supabase API at %API_URL% ...
:wait_loop
powershell -Command "try { (Invoke-WebRequest -Uri '%API_URL%/auth/v1/health' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul
if errorlevel 1 (
    timeout /t 2 >nul
    goto wait_loop
) else (
    echo Supabase API is ready.
)

:: Start Vite dev server
echo Starting Vite dev server...
start "Vite" cmd /c "npm run dev"

echo All services launched. Press any key to close this window...
pause >nul
