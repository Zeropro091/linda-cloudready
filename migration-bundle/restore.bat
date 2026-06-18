@echo off
chcp 65001 >nul
title LIN — Data Restore
cd /d "%~dp0"

REM ============================================================
REM  LIN — Data Restore Script (Windows)
REM  Run this on the NEW server after:
REM    1. Docker Desktop is running
REM    2. cd into the project folder (where package.json is)
REM    3. supabase start has been run
REM    4. You are running this script from INSIDE the bundle folder
REM ============================================================

color 0A
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║       LIN Data Restore Tool             ║
echo  ║   Run this on the NEW server machine    ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  Make sure:
echo    1. Docker Desktop is running
echo    2. cd into the project folder (where package.json is)
echo    3. supabase start has been run
echo    4. This script is running from inside the bundle folder
echo.
pause

set DB_CONTAINER=supabase_db_lin

:: ─────────── Prerequisite check ───────────
echo.
echo  ----------------------------------------
echo   PREREQUISITE CHECK
echo  ----------------------------------------
docker info >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Docker is not running!
    pause
    exit /b 1
)
echo   ✓ Docker is running

docker ps --filter "name=%DB_CONTAINER%" --format "{{.Names}}" >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Supabase container not found!
    echo   Run 'supabase start' first.
    pause
    exit /b 1
)
echo   ✓ Supabase container found

:: ─────────── Step 1: Schema ───────────
echo.
echo  ═══════════════════════════════════════════
echo   [1/5] Schema Migrations
echo  ═══════════════════════════════════════════
echo   Schema is applied automatically by supabase start
echo   (from supabase/migrations/ folder)
echo.

:: ─────────── Step 2: Auth Users ───────────
echo  ═══════════════════════════════════════════
echo   [2/5] Restoring Auth Users
echo  ═══════════════════════════════════════════
if exist auth_users.sql (
    docker cp auth_users.sql %DB_CONTAINER%:/tmp/auth_users.sql
    docker exec %DB_CONTAINER% psql -U postgres -d postgres -f /tmp/auth_users.sql
    if errorlevel 1 (
        echo   ⚠ Auth restore had some errors (may be duplicates)
    ) else (
        echo   ✓ Auth users restored
    )
) else (
    echo   • auth_users.sql not found, skipping
)

:: ─────────── Step 3: Public Data ───────────
echo.
echo  ═══════════════════════════════════════════
echo   [3/5] Restoring Public Data
echo  ═══════════════════════════════════════════
if exist public_data.sql (
    docker cp public_data.sql %DB_CONTAINER%:/tmp/public_data.sql
    docker exec %DB_CONTAINER% psql -U postgres -d postgres --set ON_ERROR_STOP=off -f /tmp/public_data.sql
    echo   ✓ Public data restored
) else (
    echo   • public_data.sql not found, skipping
)

:: ─────────── Step 4: Storage Metadata ───────────
echo.
echo  ═══════════════════════════════════════════
echo   [4/5] Restoring Storage Metadata
echo  ═══════════════════════════════════════════
if exist storage_meta.sql (
    docker cp storage_meta.sql %DB_CONTAINER%:/tmp/storage_meta.sql
    docker exec %DB_CONTAINER% psql -U postgres -d postgres --set ON_ERROR_STOP=off -f /tmp/storage_meta.sql
    echo   ✓ Storage metadata restored
) else (
    echo   • storage_meta.sql not found, skipping
)

:: ─────────── Step 5: Storage Files ───────────
echo.
echo  ═══════════════════════════════════════════
echo   [5/5] Restoring Storage Files (Images)
echo  ═══════════════════════════════════════════
if exist "storage\api-files" (
    echo   Enter your NEW Supabase anon key:
    echo   (run 'supabase status' to get it)
    set /p ANON_KEY="   anon key: "

    set SUPABASE_URL=http://127.0.0.1:54821
    powershell -Command ^
      "$key = $env:ANON_KEY; ^
      $url = $env:SUPABASE_URL; ^
      Get-ChildItem 'storage\api-files' -File | ForEach-Object { ^
        $uri = $url + '/storage/v1/object/images/' + $_.Name; ^
        try { ^
          Invoke-RestMethod -Uri $uri -Method POST -InFile $_.FullName -ContentType 'application/octet-stream' -Headers @{Authorization='Bearer ' + $key; apikey=$key} -ErrorAction Stop | Out-Null; ^
          Write-Host ('  ✓ ' + $_.Name) ^
        } catch { ^
          Write-Host ('  ⚠ ' + $_.Name + ' failed - ' + $_.Exception.Message) ^
        } ^
      }"
    echo   ✓ Storage files restored
) else (
    echo   • No storage files to restore, skipping
)

:: ─────────── Done ───────────
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║       RESTORE COMPLETE!                  ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  Next steps:
echo    1. Copy .env.source to ../.env  (or create .env manually)
echo    2. cd .. 
echo       Move to project root folder
echo    3. npm install
echo       Install dependencies
echo    4. npm run build:ssr
echo       Build production bundle
echo    5. npm run serve
echo       Start the server (or use PM2: pm2 start ecosystem.config.cjs)
echo.
echo  OR for full auto-start:
echo    restart-and-tunnel.bat   (on Windows)
echo.
pause
