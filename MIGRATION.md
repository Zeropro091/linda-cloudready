# LIN — Panduan Migrasi Server (Server Migration Guide)

> **Bahasa:** Indonesia / English  
> Dokumen ini menjelaskan cara memindahkan seluruh data dan aplikasi LIN ke server baru.

---

## 📋 Daftar Isi / Table of Contents

1. [Apa yang Dipindahkan / What Gets Migrated](#1-apa-yang-dipindahkan--what-gets-migrated)
2. [Prerequisites](#2-prerequisites)
3. [Fase 1: Export Data dari PC Lama / Phase 1: Export from Old PC](#3-fase-1-export-data-dari-pc-lama--phase-1-export-from-old-pc)
4. [Fase 2: Setup Server Baru / Phase 2: Setup New Server](#4-fase-2-setup-server-baru--phase-2-setup-new-server)
5. [Fase 3: Restore Data di Server / Phase 3: Restore Data on Server](#5-fase-3-restore-data-di-server--phase-3-restore-data-on-server)
6. [Fase 4: Konfigurasi Tunneling (Cloudflare) / Phase 4: Tunneling Setup](#6-fase-4-konfigurasi-tunneling-cloudflare--phase-4-tunneling-setup)
7. [Verifikasi / Verification](#7-verifikasi--verification)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Apa yang Dipindahkan / What Gets Migrated

| Komponen | Disimpan di | Cara Migrasi |
|----------|-------------|--------------|
| **Kode aplikasi** | Git (GitHub) | `git clone` di server baru |
| **Database (artikel, user, profile, dll)** | Supabase PostgreSQL (Docker volume) | Export SQL → Import SQL |
| **Gambar/upload** | Supabase Storage (Docker volume) | Download via API → Upload via API |
| **Konfigurasi (.env)** | File `.env` (gitignored!) | Copy manual dari PC lama |
| **Cloudflare Tunnel kredensial** | `~/.cloudflared/*.json` | Copy manual ke server |
| **PM2 process list** | Local system | `pm2 save` → `pm2 resurrect` |

> **PENTING:** File `.env` dan Cloudflare credentials **tidak ikut git push**.  
> Kamu harus meng-copy-nya secara manual atau membuat ulang di server baru.

---

## 2. Prerequisites

### Di PC Lama (Sumber)
- Docker Desktop berjalan
- `supabase start` sudah dijalankan
- Git sudah di-push (semua perubahan terbaru)

### Di Server Baru (Target)
- **OS:** Linux (Ubuntu 20.04+ direkomendasikan) atau Windows Server
- **Docker** + Docker Compose
- **Node.js** 18.x+
- **NPM** atau Yarn
- **PM2** (instal: `npm install -g pm2`)
- **Supabase CLI**
- **Nginx** (untuk reverse proxy — opsional jika pakai Cloudflare Tunnel)
- **Git** (untuk clone repo)
- **Cloudflared** (untuk tunnel)

---

## 3. Fase 1: Export Data dari PC Lama / Phase 1: Export from Old PC

### Opsi A: Gunakan Export Script (Direkomendasikan)

```bash
# Di PC lama (Windows), double-click atau jalankan dari terminal:
cd C:\Users\Putu Ari\Desktop\lin
export-data.bat
```

Script ini akan:
1. Mengecek Docker dan Supabase sudah berjalan
2. Export seluruh database (auth users, articles, profiles, categories, media, dll) → `*.sql`
3. Download semua file gambar dari Supabase Storage → `storage/api-files/`
4. Copy file konfigurasi (`.env`, `config.toml`, cloudflare config)
5. Membuat `restore.bat` (Windows) dan `restore.sh` (Linux) untuk server baru
6. Membuat folder: `migration-bundle-YYYYMMDD\`

Hasilnya adalah folder **`migration-bundle-YYYYMMDD\`** yang siap dipindahkan.

### Opsi B: Manual (jika script gagal)

```bash
# Export auth users
docker exec supabase_db_lin pg_dump -U postgres -d postgres ^
  --schema=auth --table=auth.users --data-only ^
  --column-inserts --on-conflict-do-nothing -f /tmp/auth_users.sql
docker cp supabase_db_lin:/tmp/auth_users.sql migration-bundle/

# Export public data
docker exec supabase_db_lin pg_dump -U postgres -d postgres ^
  --schema=public --data-only ^
  --column-inserts --on-conflict-do-nothing -f /tmp/public_data.sql
docker cp supabase_db_lin:/tmp/public_data.sql migration-bundle/

# Export storage metadata
docker exec supabase_db_lin pg_dump -U postgres -d postgres ^
  --schema=storage --data-only ^
  --column-inserts --on-conflict-do-nothing -f /tmp/storage_meta.sql
docker cp supabase_db_lin:/tmp/storage_meta.sql migration-bundle/
```

### Step Terakhir: Push Code ke GitHub

```bash
git add -A
git commit -m "feat: update for server migration"
git push
```

---

## 4. Fase 2: Setup Server Baru / Phase 2: Setup New Server

### 4.1 — Clone Repository

```bash
# Di server baru
git clone https://github.com/Zeropro091/linda-cloudready.git lin
cd lin
```

### 4.2 — Install Dependencies

```bash
npm install
```

### 4.3 — Setup Supabase Lokal

```bash
# Inisialisasi Supabase (pertama kali)
supabase init

# Jalankan Supabase (Docker containers)
supabase start
```

> **Tunggu sampai Supabase siap** — biasanya 30-60 detik.  
> Cek dengan: `supabase status`

### 4.4 — Transfer Migration Bundle

Copy folder `migration-bundle-YYYYMMDD\` dari PC lama ke server baru.

**Via SCP (Linux/Mac):**
```bash
scp -r migration-bundle-20260618 user@server-ip:/home/user/lin/
```

**Via USB / Manual:** Copy folder ke flash drive, pindahkan ke server.

---

## 5. Fase 3: Restore Data di Server / Phase 3: Restore Data on Server

### Opsi A: Windows Server — jalankan `restore.bat`

```cmd
cd migration-bundle-YYYYMMDD
restore.bat
```

### Opsi B: Linux Server — jalankan `restore.sh`

```bash
cd migration-bundle-YYYYMMDD
chmod +x restore.sh
./restore.sh
```

### Opsi C: Restore Manual (jika script gagal)

```bash
# 1. Restore auth users
docker cp auth_users.sql supabase_db_lin:/tmp/
docker exec supabase_db_lin psql -U postgres -d postgres -f /tmp/auth_users.sql

# 2. Restore public data
docker cp public_data.sql supabase_db_lin:/tmp/
docker exec supabase_db_lin psql -U postgres -d postgres --set ON_ERROR_STOP=off -f /tmp/public_data.sql

# 3. Restore storage metadata
docker cp storage_meta.sql supabase_db_lin:/tmp/
docker exec supabase_db_lin psql -U postgres -d postgres --set ON_ERROR_STOP=off -f /tmp/storage_meta.sql

# 4. Upload images back to storage
# Dapatkan anon key dari supabase status
SUPABASE_KEY=$(grep VITE_SUPABASE_ANON_KEY ../.env | cut -d= -f2)

# Buat bucket jika belum ada
curl -X POST http://127.0.0.1:54821/storage/v1/bucket \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "apikey: $SUPABASE_KEY" \
  -d '{"id":"images","name":"images","public":true}'

# Upload setiap file
for file in storage/api-files/*; do
  curl -X POST "http://127.0.0.1:54821/storage/v1/object/images/$(basename $file)" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "apikey: $SUPABASE_KEY" \
    --data-binary "@$file"
done
```

### 5.1 — Setup Environment Variables

```bash
# Copy dari bundle atau buat ulang
cp migration-bundle-YYYYMMDD/.env.source .env
# ATAU buat dari template
cp .env.example .env
```

Edit `.env` dan sesuaikan:

| Variable | Deskripsi |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL Supabase lokal: `http://127.0.0.1:54321` |
| `VITE_SUPABASE_ANON_KEY` | Dapatkan dari `supabase status` |
| `SITE_URL` | Domain kamu, misal `https://lensainsignia.com` |
| `GEMINI_API_KEY` | API key Gemini (jika pakai StockFinder) |

### 5.2 — Build SSR

```bash
npm run build:ssr
```

### 5.3 — Jalankan Aplikasi

**Development mode:**
```bash
npm run dev:ssr
```

**Production mode (via PM2):**
```bash
pm2 start ecosystem.config.cjs
pm2 save
```

---

## 6. Fase 4: Konfigurasi Tunneling (Cloudflare) / Phase 4: Tunneling Setup

### 6.1 — Install Cloudflared

**Linux:**
```bash
# Download cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

### 6.2 — Setup Tunnel Credentials

**Opsi A:** Copy credentials dari PC lama
```bash
# Di PC lama, file credential ada di:
# C:\Users\Putu Ari\.cloudflared\dc6820e6-043b-4fa4-ac16-9960157efd89.json
# Copy file ini ke server baru di:
mkdir -p ~/.cloudflared/
# Copy file .json ke ~/.cloudflared/
```

**Opsi B:** Buat tunnel baru (jika tidak punya credential lama)
```bash
cloudflared tunnel login
cloudflared tunnel create lin-tunnel
# Update .cloudflared/config.yml dengan tunnel ID baru
```

### 6.3 — Test Tunnel

```bash
cloudflared tunnel run
```

Kunjungi `https://lensainsignia.com` — jika muncul konten, tunnel berhasil.

### 6.4 — Auto-start Tunnel via PM2

Script `restart-and-tunnel.bat` atau `ecosystem.config.cjs` sudah mengatur ini.  
Di server, edit `ecosystem.config.cjs` jika perlu dan jalankan:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

### 6.5 — Setup PM2 Auto-start (Server Boot)

```bash
# Jalankan sebagai root/sudo
pm2 startup
# Copy perintah yang dihasilkan, lalu jalankan
pm2 save
```

Sekarang PM2 akan otomatis menjalankan aplikasi + tunnel setiap server restart.

---

## 7. Verifikasi / Verification

Setelah semua langkah selesai, verifikasi:

- ✅ **Local:** `http://localhost:3000` → muncul halaman utama
- ✅ **Live:** `https://lensainsignia.com` → muncul konten yang sama
- ✅ **Database:** Artikel, user, category, dll masih ada
- ✅ **Images:** Gambar artikel tampil normal
- ✅ **Login:** Bisa login dengan akun yang sudah ada
- ✅ **Admin:** Dashboard admin berfungsi
- ✅ **Auth:** User bisa register dan login

### Cek Status:

```bash
# Cek PM2
pm2 status

# Cek Docker
docker ps

# Cek Supabase
supabase status

# Cek log aplikasi
pm2 logs lin-app --lines 20

# Cek log tunnel
pm2 logs cloudflare-tunnel --lines 20
```

---

## 8. Troubleshooting

### ❌ "Supabase bisa jalan tapi data kosong"
**Penyebab:** Restore SQL gagal karena constraint/duplicate.  
**Solusi:** Jalankan restore dengan `--set ON_ERROR_STOP=off`

```bash
docker exec supabase_db_lin psql -U postgres -d postgres --set ON_ERROR_STOP=off -f /tmp/public_data.sql
```

### ❌ "Error: relation 'auth.users' does not exist"
**Penyebab:** Auth schema belum tersedia saat export.  
**Solusi:** Export auth users dari tabel aslinya:

```bash
docker exec supabase_db_lin psql -U postgres -d postgres -c "SELECT COUNT(*) FROM auth.users"
```

### ❌ "Gambar tidak muncul di website"
**Penyebab:** Storage files belum di-restore atau path berbeda.  
**Solusi:** 
1. Cek apakah bucket `images` ada: `curl http://127.0.0.1:54821/storage/v1/bucket/images`
2. Upload manual satu file untuk test
3. Pastikan `storage_meta.sql` sudah di-restore

### ❌ "Cloudflare Tunnel error: Invalid credentials"
**Penyebab:** File credential `.json` tidak ditemukan atau path-nya salah.  
**Solusi:**
1. Cek path di `.cloudflared/config.yml` sudah benar
2. Copy file `.json` dari PC lama ke `~/.cloudflared/`
3. Atau login ulang: `cloudflared tunnel login`

### ❌ "502 Bad Gateway" saat akses domain
**Penyebab:** Tunnel berhasil connect tapi aplikasi di port 3000 tidak berjalan.  
**Solusi:**
1. Cek `pm2 status` — apakah `lin-app` running?
2. Cek `http://localhost:3000` langsung di server
3. Restart: `pm2 restart lin-app`

### ❌ "Port already in use"
**Penyebab:** Ada aplikasi lain yang pakai port 3000 atau 54321.  
**Solusi:**
```bash
# Cek siapa yang pakai port
netstat -ano | findstr :3000
# Ganti port di ecosystem.config.cjs atau .env
```

---

> 📘 **Referensi:**  
> - `export-data.bat` — Export script (jalankan di PC lama)  
> - `migration-bundle-*/restore.bat` — Windows restore script  
> - `migration-bundle-*/restore.sh` — Linux restore script  
> - `restart-and-tunnel.bat` — Post-reboot startup script  
> - `MIGRATION_GUIDE.md` — Panduan setup server awal  
> - `CHECKLIST.md` — Checklist deployment
