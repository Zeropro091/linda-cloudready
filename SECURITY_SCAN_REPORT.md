# Laporan Security Scan — Lensa Insignia

**Tanggal:** 7 Juni 2026  
**Tools:** npm audit, static code analysis (manual review), dependency analysis  
**Scope:** Frontend (React + TypeScript), Backend (Supabase), Infrastruktur (Firebase, Vite)

---

## Ringkasan Eksekutif

| Kategori | Tingkat Keparahan | Temuan |
|---|---|---|
| Kerentanan Dependensi | **Critical (1), High (4)** | Protobufjs RCE, React Router RCE |
| Hardcoded Credentials | **High** | Firebase API key, password seed |
| Keamanan Autentikasi | **Medium** | Weak password policy, email confirmation disabled |
| Konfigurasi Infrastruktur | **Medium** | TLS disabled, no CSP headers |
| Best Practice | **Low-Medium** | Data URLs di database, secret search easter egg |

**Total Temuan: 12** | **Critical: 1** | **High: 5** | **Medium: 4** | **Low: 2**

---

## 1. Kerentanan Dependensi (npm audit)

### 1.1 Critical — Arbitrary Code Execution via ProtobufJS

| Detail | Value |
|---|---|
| **Package** | `protobufjs` (through `@grpc/proto-loader`, `@firebase/firestore`) |
| **Severity** | ⚠️ CRITICAL |
| **CVE** | GHSA-xq3m-2v4x-88gg (RCE via bytes field defaults) |
| **Fix** | `npm audit fix --force` (akan meng-upgrade Firebase ke v12 — breaking change) |

**Dampak:** Attacker dapat mengeksekusi kode arbitrer melalui crafted protobuf messages.  
**Mitigasi:** Upgrade Firebase ke versi terbaru atau batasi input protobuf.

### 1.2 High — React Router RCE via Deserialization

| Detail | Value |
|---|---|
| **Package** | `react-router` v7.0.0–7.14.2 |
| **Severity** | ⚠️ HIGH |
| **CVE** | GHSA-49rj-9fvp-4h2h |
| **Fixed in** | v7.14.3+ |

**Dampak:** Constructor invocation arbitrary melalui TYPE_ERROR deserialization.  
**Mitigasi:** Upgrade ke `react-router-dom@7.14.3` atau lebih baru.

### 1.3 High — React Router DoS

| Detail | Value |
|---|---|
| **Package** | `react-router` |
| **Severity** | ⚠️ HIGH |
| **CVE** | GHSA-8x6r-g9mw-2r78 |
| **Fix** | Upgrade react-router |

**Dampak:** Denial of Service melalui unbounded path expansion di `__manifest` endpoint.

### 1.4 Moderate — Vulnerabilities Lainnya

| Package | Severity | Issue |
|---|---|---|
| `@grpc/grpc-js` | Moderate | Memory allocation DoS |
| `postcss` | Moderate | XSS via unescaped `</style>` |
| `ws` | Moderate | Uninitialized memory disclosure |
| `qs` (via express) | Moderate | DoS via `qs.stringify` crash |
| `quill` (via react-quill) | Moderate | XSS vulnerability |
| `@protobufjs/utf8` | Moderate | Overlong UTF-8 decoding |

**Total:** 16 vulnerabilities (1 critical, 4 high, 11 moderate)

---

## 2. Hardcoded Credentials & Secrets

### 2.1 🔴 Firebase API Key Eksposed (HIGH)

**File:** `firebase-applet-config.json`

```json
{
  "apiKey": "AIzaSyD1N-WdyU81azsOr-HMeThghtpEPptUM7Q",
  "authDomain": "modular-album-d07pf.firebaseapp.com",
  "projectId": "modular-album-d07pf"
}
```

**Risiko:** API key Firebase bersifat publik untuk client-side apps, namun tetap tidak boleh dicantumkan di repositori publik. Attacker dapat menggunakan project ID untuk footprinting.

**Rekomendasi:** Gunakan environment variables dan gitignore file config ini.

### 2.2 🔴 Weak Hardcoded Password di Seed Data (HIGH)

**File:** `supabase/seed.sql`

```sql
-- Password is '123123'
INSERT INTO auth.users (...) VALUES (... crypt('123123', gen_salt('bf')) ...
```

**Risiko:** Empat akun seed (`admin@admin.com`, `dev@dev.com`, `poster@poster.com`, `user@user.com`) semuanya menggunakan password yang sama: `123123`. Meskipun di-hash dengan bcrypt di database, password ini sangat mudah ditebak.

**Rekomendasi:**
- Gunakan password yang kuat dan unik untuk setiap akun seed
- Jangan cantumkan password dalam komentar SQL
- Hapus seed yang tidak diperlukan di production

### 2.3 🟡 Environment Variables Tidak Terlindungi

**File:** `.env.example`, `.env`

**Risiko:** File `.env` tidak terbaca (terproteksi), namun pattern menunjukkan adanya credential Firebase & Supabase yang mungkin belum diatur proper.

---

## 3. Keamanan Autentikasi & RBAC

### 3.1 🔴 Weak Password Policy (HIGH)

**File:** `supabase/config.toml`

```toml
minimum_password_length = 6
password_requirements = ""
```

**Risiko:** Password minimal 6 karakter tanpa persyaratan kompleksitas sangat rentan terhadap brute force. NIST merekomendasikan minimal 8 karakter.

**Rekomendasi:** Set `minimum_password_length = 8` dan aktifkan `password_requirements`.

### 3.2 🟡 Email Confirmation Disabled (MEDIUM)

**File:** `supabase/config.toml`

```toml
[auth.email]
enable_signup = true
enable_confirmations = false
```

**Risiko:** Siapa pun dapat mendaftar tanpa verifikasi email, memungkinkan spam account creation.

**Rekomendasi:** Aktifkan `enable_confirmations = true` di production.

### 3.3 🟡 MFA Tidak Diaktifkan (MEDIUM)

**File:** `supabase/config.toml`

```toml
[auth.mfa.totp]
enroll_enabled = false
verify_enabled = false
```

**Rekomendasi:** Aktifkan MFA untuk admin dan dev roles.

### 3.4 🟢 Rate Limiting Terkonfigurasi (INFO - GOOD)

Rate limiting sudah diatur dengan baik:
- Sign in/sign up: 30/5 menit per IP
- Token refresh: 150/5 menit per IP
- Email sent: 2/jam

---

## 4. Keamanan Aplikasi (Frontend)

### 4.1 🔴 Search "Easter Egg" — Backdoor Tidak Sengaja (HIGH)

**File:** `src/App.tsx`

```typescript
const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = searchQuery.trim();
    if (queryStr === 'admin123123') {
      navigate('/admin');
      // ...
    }
```

**Risiko:** Siapa pun yang mengetahui kata kunci `admin123123` di search bar akan langsung diarahkan ke halaman admin. Ini merupakan **security through obscurity** yang sangat berbahaya. Kombinasi dengan password seed yang lemah (`123123`), ini menjadi eksploit yang mudah.

**Rekomendasi:** Hapus secret search "easter egg" ini.

### 4.2 🟡 Image Upload via Data URL (MEDIUM)

**File:** `src/pages/AdminDashboard.tsx`

```typescript
const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
};
```

**Risiko:**
- Gambar disimpan sebagai base64 Data URL di database → **membludakkan ukuran database** (base64 ~33% lebih besar dari binary)
- Tidak ada validasi tipe file server-side
- Tidak ada batasan ukuran file server-side (hanya client-side)

**Rekomendasi:** Gunakan Supabase Storage bucket untuk menyimpan file, bukan Data URL di database.

### 4.3 🟡 Markdown Content — Potensi XSS (MEDIUM)

**File:** `src/App.tsx` (MDEditor rendering)

```tsx
<MDEditor.Markdown source={article.contentStr} />
```

**Risiko:** Meskipun MDEditor memiliki sanitasi bawaan, user-generated content yang dirender sebagai Markdown dapat menjadi vektor XSS jika ada celah di library yang digunakan.

**Rekomendasi:**
- Validasi input konten di server-side (Supabase Row Level Security)
- Gunakan DOMPurify sebagai lapisan sanitasi tambahan

### 4.4 🟡 JSON-LD tanpa Sanitasi (LOW)

**File:** `src/App.tsx`

```tsx
<script type="application/ld+json">
  {JSON.stringify(schemaMarkup)}
</script>
```

Risiko rendah karena `JSON.stringify` meng-escape string dengan proper, namun perlu dipastikan `schemaMarkup` tidak mengandung input user yang tidak difilter.

### 4.5 🟢 Firebase & Supabase Dual Setup (INFO)

Proyek mengonfigurasi **dua** backend auth (Firebase dan Supabase). Saat ini hanya Supabase yang aktif (`AuthProvider.tsx` menggunakan Supabase). Firebase masih terkonfigurasi dan dapat menjadi surface attack tambahan yang tidak terpakai.

**Rekomendasi:** Hapus Firebase dependencies jika tidak digunakan.

---

## 5. Keamanan Infrastruktur & Konfigurasi

### 5.1 🔴 TLS Disabled di Supabase Local (LOW untuk dev, HIGH jika production)

**File:** `supabase/config.toml`

```toml
[api.tls]
enabled = false
```

**Risiko:** Jika konfigurasi ini dibawa ke production, semua traffic tidak terenkripsi.

**Rekomendasi:** Aktifkan TLS di production.

### 5.2 🟡 No Content Security Policy (MEDIUM)

Tidak ada CSP headers atau meta tags yang ditemukan di aplikasi. Ini berarti browser tidak memiliki perlindungan terhadap XSS dan data injection attacks.

**Rekomendasi:** Implementasi CSP headers via meta tag atau server configuration.

### 5.3 🟡 Supabase Anon Key Exposure (MEDIUM)

**File:** `src/lib/supabase.ts`

```typescript
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
```

Supabase anon key bersifat public (itulah fungsinya), namun harus dipastikan Row Level Security (RLS) sudah diaktifkan dan policies sudah benar untuk mencegah akses tidak sah.

### 5.4 🟢 Firestore Rules — Default Deny (GOOD)

```javascript
match /{document=**} {
  allow read, write: if false;
}
```

Firestore sudah memiliki default deny yang baik.

---

## 6. Rekomendasi Prioritas

### 🔴 Segera (Critical - High)

| # | Action | Severity | Effort |
|---|---|---|---|
| 1 | **Hapus secret search easter egg** (`admin123123`) | HIGH | 5 menit |
| 2 | **Upgrade react-router-dom** ke v7.14.3+ | HIGH | 2 menit |
| 3 | **Ubah password seed** yang lemah dan hapus dari komentar | HIGH | 10 menit |
| 4 | **Tingkatkan minimum password length** ke 8+ | HIGH | 2 menit |
| 5 | **Hapus Firebase config** dari repositori (jika tidak digunakan) | HIGH | 10 menit |
| 6 | **Upgrade protobufjs** via upgrade Firebase | CRITICAL | 1-2 jam |

### 🟡 Sedang

| # | Action | Effort |
|---|---|---|
| 7 | Aktifkan email confirmation (`enable_confirmations = true`) | 2 menit |
| 8 | Implementasi CSP (Content Security Policy) | 30 menit |
| 9 | Migrasi image storage ke Supabase Storage bucket | 2-4 jam |
| 10 | Aktifkan MFA untuk admin/dev roles | 30 menit |

### 🟢 Improvement

| # | Action | Effort |
|---|---|---|
| 11 | Tambahkan validasi tipe file server-side | 1 jam |
| 12 | Gunakan environment variables untuk semua konfigurasi | 1 jam |

---

## 7. Detail Teknis Tambahan

### Type Safety Issues

```typescript
// src/lib/firebase.ts dan src/lib/supabase.ts
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
```

Penggunaan `as any` menghilangkan type checking pada environment variables. Gunakan proper typing atau library seperti `zod` untuk validasi env.

### File `.env` Status

File `.env` tidak terbaca oleh tool scan, yang berarti mungkin sudah di-gitignore atau diproteksi. Verifikasi bahwa `.env` ada di `.gitignore`.

### Gallery Storage Architecture

Gambar gallery saat ini disimpan sebagai Data URL di tabel `gallery`:

```sql
-- inferenced schema
gallery (id, name, url TEXT, uploadedAt)
```

**Masalah:** Field `url` berisi string base64 yang sangat panjang (~1.3MB per gambar 1MB). Ini akan memperlambat query dan membloating database.

**Solusi:** Gunakan Supabase Storage bucket untuk menyimpan file, simpan hanya path/URL di database.

---

## 8. Dependency Health Overview

| Dependency | Version | Status |
|---|---|---|
| firebase | ^9.22.2 | 🔴 Outdated (v12 available) |
| react-router-dom | ^7.14.1 | 🔴 Vulnerable (upgrade to 7.14.3) |
| react-quill | ^2.0.0 | 🟡 Uses vulnerable quill |
| express | ^4.21.2 | 🟡 Uses vulnerable qs |
| vite | ^6.2.0 | ✅ Latest |
| typescript | ~5.8.2 | ✅ Latest |
| supabase-js | ^2.106.1 | ✅ Recent |

---

*Laporan ini digenerate secara otomatis oleh security scan tool pada 7 Juni 2026.*
*Beberapa temuan mungkin memerlukan verifikasi manual lebih lanjut.*
