@echo off
title Supabase + React App Server Setup

:: -------------------------------------------------
:: 1. Verify Docker is installed and running
:: -------------------------------------------------
echo Checking Docker installation...
docker --version >nul 2>&1
if errorlevel 1 (
    echo Docker is not installed. Please install Docker Desktop for Windows first.
    pause
    exit /b 1
)
echo Docker is installed.

echo Checking Docker daemon status...
docker info >nul 2>&1
if errorlevel 1 (
    echo Docker daemon is not running. Start Docker Desktop and re‑run this script.
    pause
    exit /b 1
)

:: -------------------------------------------------
:: 2. Load environment variables (if .env exists)
:: -------------------------------------------------
if exist "%~dp0\.env" (
    for /f "usebackq tokens=*" %%A in ("%~dp0\.env") do set "%%A"
    echo Loaded environment variables from .env
) else (
    echo No .env file found – using defaults.
)

:: -------------------------------------------------
:: 3. Start Supabase (Docker containers)
:: -------------------------------------------------
echo Starting Supabase containers...
pushd "%~dp0"
supabase start
if errorlevel 1 (
    echo Supabase failed to start. Check the logs for details.
    pause
    exit /b 1
)
popd

:: -------------------------------------------------
:: 4. Install npm dependencies
:: -------------------------------------------------
pushd "%~dp0"
echo Installing npm dependencies...
npm install --legacy-peer-deps
if errorlevel 1 (
    echo npm install failed. Fix the errors and re‑run.
    pause
    exit /b 1
)

:: -------------------------------------------------
:: 5. Build the production bundle
:: -------------------------------------------------
echo Building production assets (vite build)...
npm run build
if errorlevel 1 (
    echo Build failed. Review the output above.
    pause
    exit /b 1
)
popd

:: -------------------------------------------------
:: 6. Serve the built app (using a simple static server)
:: -------------------------------------------------
pushd "%~dp0"
:: You can replace this with any server of your choice (nginx, pm2, etc.)
echo Starting static server on port 3000...
npx serve -s dist -l 3000
popd

echo Setup complete. Your React app is reachable at http://localhost:3000
pause >nul
