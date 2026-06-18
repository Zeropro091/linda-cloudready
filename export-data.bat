@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title LIN — Data Export Tool
cd /d "%~dp0"

REM ============================================================
REM  LIN (Lensa Insignia) — Full Data Migration Export
REM  Run this on your CURRENT PC to export everything for the server.
REM  It creates a "migration-bundle-TODAY" folder with all data.
REM ============================================================

set BUNDLE_BASE=migration-bundle
for /f %%A in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd"') do set TIMESTAMP=%%A
set BUNDLE=%BUNDLE_BASE%-%TIMESTAMP%

set DB_CONTAINER=supabase_db_lin
set STORAGE_CONTAINER=supabase_storage_lin

color 0B
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║    LIN Data Migration Export Tool       ║
echo  ║    Lensa Insignia — Full Data Export    ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  This will export ALL your data from the local Supabase
echo  so you can move it to a new server.
echo.
echo  Export folder: %BUNDLE%\
echo.

REM ─────────── Pre-flight checks ───────────
echo  ----------------------------------------
echo   PREREQUISITE: Checking tools...
echo  ----------------------------------------

REM Check Docker
docker info >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Docker is not running!
    echo   Please start Docker Desktop and re-run.
    pause
    exit /b 1
)
echo   ✓ Docker is running

REM Check supabase CLI
supabase --version >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Supabase CLI not found!
    echo   Install it first: npm install -g supabase
    pause
    exit /b 1
)
echo   ✓ Supabase CLI found

REM Check Supabase containers
docker ps --filter "name=supabase_db_lin" --format "{{.Names}}" >nul 2>&1
if errorlevel 1 (
    echo.
    echo   Supabase containers not found. Start Supabase first:
    echo     supabase start
    echo.
    pause
    exit /b 1
)
echo   ✓ Supabase is running

REM Get anon key dynamically from supabase status
for /f "tokens=2 delims=:" %%a in ('supabase status 2^>nul ^| findstr "anon" ^| findstr "key"') do (
    set ANON_KEY=%%a
)
set ANON_KEY=!ANON_KEY: =!
if "!ANON_KEY!"=="" (
    echo   ⚠ Could not read anon key from supabase status
    echo   Will try to read from .env file...
    if exist .env (
        for /f "tokens=2 delims==" %%a in ('type .env ^| findstr VITE_SUPABASE_ANON_KEY') do set ANON_KEY=%%a
    )
)
if "!ANON_KEY!"=="" (
    echo   Enter your Supabase anon key manually:
    set /p ANON_KEY="   anon key: "
)
echo   ✓ Anon key: !ANON_KEY:~0,16!...
echo.

REM ─────────── Create bundle dir ───────────
if not exist %BUNDLE% mkdir %BUNDLE%
if not exist %BUNDLE%\storage mkdir %BUNDLE%\storage

REM ============================================================
REM  STEP 1: Export Database (schema + data)
REM ============================================================
echo  ═══════════════════════════════════════════
echo   [1/5] EXPORTING DATABASE...
echo  ═══════════════════════════════════════════

REM Auth users (critical — must come first due to FK relationships)
echo   • Exporting auth users...
docker exec %DB_CONTAINER% pg_dump -U postgres -d postgres ^
  --schema=auth ^
  --table=auth.users ^
  --data-only ^
  --column-inserts ^
  --on-conflict-do-nothing ^
  -f /tmp/auth_users.sql 2>nul
if errorlevel 1 (
    echo     • Auth schema not accessible (admin-only), skipping
) else (
    docker cp %DB_CONTAINER%:/tmp/auth_users.sql %BUNDLE%\auth_users.sql 2>nul
    if errorlevel 1 (echo     • Auth copy failed) else (echo     ✓ auth users)
)

REM Public data (articles, profiles, categories, tags, etc.)
echo   • Exporting public data...
docker exec %DB_CONTAINER% pg_dump -U postgres -d postgres ^
  --schema=public ^
  --data-only ^
  --column-inserts ^
  --on-conflict-do-nothing ^
  -f /tmp/public_data.sql 2>nul
docker cp %DB_CONTAINER%:/tmp/public_data.sql %BUNDLE%\public_data.sql
if exist %BUNDLE%\public_data.sql (echo     ✓ public data) else echo     ✗ Failed!

REM Storage metadata
echo   • Exporting storage metadata...
docker exec %DB_CONTAINER% pg_dump -U postgres -d postgres ^
  --schema=storage ^
  --data-only ^
  --column-inserts ^
  --on-conflict-do-nothing ^
  -f /tmp/storage_meta.sql 2>nul
docker cp %DB_CONTAINER%:/tmp/storage_meta.sql %BUNDLE%\storage_meta.sql 2>nul
if exist %BUNDLE%\storage_meta.sql (echo     ✓ storage metadata) else echo     • Skipping (no storage metadata)

REM Schema-only (for reference)
echo   • Exporting schema reference...
docker exec %DB_CONTAINER% pg_dump -U postgres -d postgres ^
  --schema=public ^
  --schema-only ^
  -f /tmp/schema.sql 2>nul
docker cp %DB_CONTAINER%:/tmp/schema.sql %BUNDLE%\schema.sql 2>nul
if exist %BUNDLE%\schema.sql (echo     ✓ schema reference) else echo     ✗ Failed!

REM ============================================================
REM  STEP 2: Export Storage Files (images)
REM ============================================================
echo.
echo  ═══════════════════════════════════════════
echo   [2/5] EXPORTING STORAGE FILES...
echo  ═══════════════════════════════════════════

REM Download all files from Supabase Storage via API
echo   • Downloading uploaded images...
if not exist "%BUNDLE%\storage\api-files" mkdir "%BUNDLE%\storage\api-files"

powershell -Command ^
  "$key = '!ANON_KEY!'; ^
  try { ^
    $body = '{"prefix":"","limit":1000}' | ConvertTo-Json; ^
    $objects = Invoke-RestMethod -Uri 'http://127.0.0.1:54821/storage/v1/object/list/images' -Method POST -ContentType 'application/json' -Body $body -Headers @{Authorization='Bearer ' + $key; apikey=$key} -ErrorAction Stop; ^
    if (-not (Test-Path '%BUNDLE%\storage\api-files')) { New-Item -ItemType Directory -Path '%BUNDLE%\storage\api-files' | Out-Null }; ^
    $count = 0; ^
    foreach ($obj in $objects) { ^
      if ($obj.name) { ^
        $url = 'http://127.0.0.1:54821/storage/v1/object/public/images/' + $obj.name; ^
        Invoke-WebRequest -Uri $url -OutFile ('%BUNDLE%\storage\api-files\' + $obj.name) -UseBasicParsing -ErrorAction SilentlyContinue; ^
        $count++; ^
        Write-Host ('         [' + $count + '] ' + $obj.name); ^
      } ^
    } ^
    Write-Host ('     ✓ Downloaded ' + $count + ' files'); ^
  } catch { Write-Host '     • Storage bucket may be empty or not yet created' }"

echo.
echo  ═══════════════════════════════════════════
echo   [3/5] EXPORTING CONFIG FILES...
echo  ═══════════════════════════════════════════

copy .env %BUNDLE%\.env.source 2>nul
if exist %BUNDLE%\.env.source (echo     ✓ .env saved) else echo     • No .env file found

copy supabase\config.toml %BUNDLE%\config.toml.source 2>nul
if exist %BUNDLE%\config.toml.source (echo     ✓ supabase/config.toml saved) else echo     • No config.toml

copy .cloudflared\config.yml %BUNDLE%\cloudflare-config.yml 2>nul
if exist %BUNDLE%\cloudflare-config.yml (echo     ✓ Cloudflare tunnel config saved) else echo     • No cloudflare config

REM ============================================================
REM  STEP 4: Create restore.bat (Windows) & restore.sh (Linux)
REM  for the NEW server
REM ============================================================
echo.
echo  ═══════════════════════════════════════════
echo   [4/5] CREATING RESTORE SCRIPTS...
echo  ═══════════════════════════════════════════

REM ─── Windows restore.bat ───
(
echo @echo off
chcp 65001 ^>nul
echo title LIN — Data Restore
echo cd /d "%%~dp0"
echo.
echo echo  ╔══════════════════════════════════════════╗
echo echo  ║       LIN Data Restore Tool           ║
echo echo  ║   Run this on the NEW server machine  ║
echo echo  ╚══════════════════════════════════════════╝
echo echo.
echo echo  Prerequisites:
echo echo    1. Docker Desktop is installed and running
echo echo    2. cd into the project folder ^(where package.json is^)
echo echo    3. supabase start has been run
echo echo    4. You are running this script from INSIDE the bundle folder
echo echo.
echo pause
echo.
echo set DB_CONTAINER=supabase_db_lin
echo.
echo echo [1/5] Applying schema migrations...
echo echo       supabase start already applies supabase/migrations/
echo echo       ✓ Done
echo.
echo echo [2/5] Restoring auth users...
echo docker cp auth_users.sql %%DB_CONTAINER%%:/tmp/auth_users.sql 2^>nul
echo if exist auth_users.sql ^(
echo   docker exec %%DB_CONTAINER%% psql -U postgres -d postgres -f /tmp/auth_users.sql
echo   if errorlevel 1 ^(echo   ⚠ Auth restore had errors ^(may be duplicates^)^) else echo   ✓ Auth users restored
echo ^) else echo   • No auth_users.sql found, skipping
echo.
echo echo [3/5] Restoring public data...
echo docker cp public_data.sql %%DB_CONTAINER%%:/tmp/public_data.sql 2^>nul
echo if exist public_data.sql ^(
echo   docker exec %%DB_CONTAINER%% psql -U postgres -d postgres --set ON_ERROR_STOP=off -f /tmp/public_data.sql
echo   echo   ✓ Public data restored
echo ^) else echo   • No public_data.sql found, skipping
echo.
echo echo [4/5] Restoring storage metadata...
echo docker cp storage_meta.sql %%DB_CONTAINER%%:/tmp/storage_meta.sql 2^>nul
echo if exist storage_meta.sql ^(
echo   docker exec %%DB_CONTAINER%% psql -U postgres -d postgres --set ON_ERROR_STOP=off -f /tmp/storage_meta.sql
echo   echo   ✓ Storage metadata restored
echo ^) else echo   • No storage_meta.sql, skipping
echo.
echo echo [5/5] Restoring storage files ^(images^)...
echo if exist "storage\api-files" ^(
echo   echo   Enter your NEW Supabase anon key:
echo   set /p ANON_KEY="   anon key: "
echo   set SUPABASE_URL=http://127.0.0.1:54821
echo   powershell -Command "$key='%%ANON_KEY%%'; Get-ChildItem 'storage\api-files' -File | ForEach-Object { $uri = $env:SUPABASE_URL + '/storage/v1/object/images/' + $_.Name; try { Invoke-RestMethod -Uri $uri -Method POST -InFile $_.FullName -ContentType 'application/octet-stream' -Headers @{Authorization='Bearer ' + $key; apikey=$key} -ErrorAction Stop | Out-Null; Write-Host ('  ✓ ' + $_.Name) } catch { Write-Host ('  ⚠ ' + $_.Name + ' failed') } }"
echo   echo   ✓ Storage files restored
echo ^) else echo   • No storage files to restore, skipping
echo.
echo echo.
echo echo  ╔══════════════════════════════════════════╗
echo echo  ║       RESTORE COMPLETE!               ║
echo echo  ╚══════════════════════════════════════════╝
echo echo.
echo echo  Next steps:
echo echo    1. cp .env.source ../.env  ^(or create .env manually^)
echo echo    2. cd ..
echo echo    3. npm install
echo echo    4. npm run build:ssr
echo echo    5. npm run serve
echo echo.
echo pause
) > %BUNDLE%\restore.bat
echo     ✓ restore.bat created

REM ─── Linux restore.sh (Unix-friendly version) ───
(
echo #!/bin/bash
# LIN — Data Restore Script (Linux/Server)
set -e
echo ""
echo "  ========================================"
echo "   LIN Data Restore"
echo "  ========================================"
echo ""
echo.
DB_CONTAINER="supabase_db_lin"
SUPABASE_URL="http://127.0.0.1:54821"
echo.
echo "[1/5] Restoring auth users..."
if [ -f "auth_users.sql" ]; then
  docker cp auth_users.sql $DB_CONTAINER:/tmp/auth_users.sql
  docker exec $DB_CONTAINER psql -U postgres -d postgres -f /tmp/auth_users.sql 2>&1 | tail -1
  echo "       ✓ auth users restored"
else
  echo "       • auth_users.sql not found, skipping"
fi
echo.
echo "[2/5] Restoring public data..."
if [ -f "public_data.sql" ]; then
  docker cp public_data.sql $DB_CONTAINER:/tmp/public_data.sql
  docker exec $DB_CONTAINER psql -U postgres -d postgres --set ON_ERROR_STOP=off -f /tmp/public_data.sql 2>&1 | tail -3
  echo "       ✓ public data restored"
else
  echo "       • public_data.sql not found, skipping"
fi
echo.
echo "[3/5] Restoring storage metadata..."
if [ -f "storage_meta.sql" ]; then
  docker cp storage_meta.sql $DB_CONTAINER:/tmp/storage_meta.sql
  docker exec $DB_CONTAINER psql -U postgres -d postgres --set ON_ERROR_STOP=off -f /tmp/storage_meta.sql 2>&1 | tail -1
  echo "       ✓ storage metadata restored"
else
  echo "       • storage_meta.sql not found, skipping"
fi
echo.
echo "[4/5] Reading Supabase anon key..."
ANON_KEY=""
if [ -f "../.env" ]; then
  ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY ../.env | cut -d= -f2)
fi
if [ -z "$ANON_KEY" ]; then
  echo "       Enter your NEW Supabase anon key:"
  read -r ANON_KEY
fi
echo.
echo "[5/5] Restoring storage files..."
if [ -d "storage/api-files" ]; then
  # Ensure bucket exists
  curl -s -X POST "$SUPABASE_URL/storage/v1/bucket" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"id":"images","name":"images","public":true}' > /dev/null 2>&1 || true
  for file in storage/api-files/*; do
    filename=$(basename "$file")
    echo "       Uploading: $filename"
    curl -s -X POST "$SUPABASE_URL/storage/v1/object/images/$filename" \
      -H "Authorization: Bearer $ANON_KEY" \
      -H "apikey: $ANON_KEY" \
      -H "Content-Type: application/octet-stream" \
      --data-binary "@$file" > /dev/null 2>&1
  done
  echo "       ✓ storage files restored"
else
  echo "       • No storage files to restore, skipping"
fi
echo.
echo "  ========================================"
echo "   ✅ Restore Complete!"
echo "  ========================================"
echo.
echo "  Next steps:"
echo "    1. cp .env.source ../.env"
echo "    2. cd .."
echo "    3. npm install"
echo "    4. npm run build:ssr"
echo "    5. npm run serve"
echo ""
) > %BUNDLE%\restore.sh
echo     ✓ restore.sh created

REM ============================================================
REM  STEP 5: Create summary file
REM ============================================================
echo.
echo  ═══════════════════════════════════════════
echo   [5/5] CREATING SUMMARY...
echo  ═══════════════════════════════════════════

(
echo # LIN Data Migration Bundle
echo # Exported: %DATE% %TIME%
echo.
echo # ── How to use this bundle ──
echo.
echo # 1. Transfer this entire folder to your new server
echo # 2. On the new server, clone the repo + npm install + supabase start
echo # 3. cd into this bundle folder
echo # 4. Run restore.bat ^(Windows^) or restore.sh ^(Linux^)
echo # 5. Create .env from .env.source
echo # 6. npm run build:ssr ^&^& npm run serve
echo.
echo # ── Contents ──
echo # - auth_users.sql      = User accounts
echo # - public_data.sql      = Articles, profiles, categories, tags
echo # - storage_meta.sql     = Storage bucket metadata
echo # - schema.sql           = Database schema ^(reference^)
echo # - storage/api-files/   = Uploaded images
echo # - .env.source          = Environment variables
echo # - restore.bat          = Windows restore script
echo # - restore.sh           = Linux restore script
echo.
echo # More info: MIGRATION.md in the project root
echo.
) > %BUNDLE%\README.txt
echo     ✓ README.txt created

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║       EXPORT COMPLETE!                  ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  Bundle location: %BUNDLE%\
echo.
echo  Next steps:
echo    1. Copy the "%BUNDLE%" folder to your server
echo    2. On the server: git clone + npm install + supabase start
echo    3. Run restore.bat ^(or restore.sh^) inside the bundle folder
echo    4. Create .env from .env.source
echo    5. npm run build:ssr ^&^& npm run serve
echo.
echo  For detailed instructions, open: MIGRATION.md
echo.
pause
