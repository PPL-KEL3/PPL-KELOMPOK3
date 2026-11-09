# LOKA — Sistem Informasi Direktori Jasa Lokal

LOKA adalah platform web yang menghubungkan masyarakat dengan penyedia jasa lokal untuk membuka peluang penghasilan dan mendukung SDG 1: No Poverty.

## Teknologi yang Digunakan

### Frontend
- [Next.js](https://nextjs.org/) (App Router)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)

### Backend
- [Node.js](https://nodejs.org/)
- [Express.js](https://expressjs.com/)
- [TypeScript](https://www.typescriptlang.org/)

### Database
- [Supabase](https://supabase.com/) (PostgreSQL)
- [@supabase/supabase-js](https://supabase.com/docs/reference/javascript)

## Struktur Folder

`
LOKA/
+-- frontend/          # Aplikasi Next.js (App Router)
+-- backend/           # Aplikasi Express.js (TypeScript)
+-- design-reference/  # Referensi desain Figma (read-only)
+-- README.md
`

## Prasyarat

- [Node.js](https://nodejs.org/) v18 atau lebih baru
- [npm](https://www.npmjs.com/)

## Instalasi & Menjalankan

### Frontend

`ash
cd frontend
npm install
npm run dev
`

Frontend berjalan di [http://localhost:3000](http://localhost:3000)

### Backend

`ash
cd backend
npm install
cp .env.example .env
npm run dev
`

Backend berjalan di [http://localhost:4000](http://localhost:4000)

### Health Check API

`ash
GET http://localhost:4000/api/health
`

Response contoh:
`json
{
  "status": "ok",
  "service": "loka-api",
  "supabaseConfigured": true
}
`

## Konfigurasi Supabase

1. Salin ackend/.env.example menjadi ackend/.env
2. Isi SUPABASE_URL dan SUPABASE_ANON_KEY dari project Supabase Anda
3. supabaseConfigured pada health endpoint hanya menandakan keberadaan variabel lingkungan, bukan verifikasi koneksi database

## Autentikasi LOKA

Halaman `/login` digunakan oleh ketiga role (customer, provider, admin). Role tidak dipilih di halaman login: backend membacanya dari tabel `public.profiles` di Supabase setelah sesi Supabase Auth tervalidasi.

### 1. Siapkan database

Jalankan migrasi berikut di Supabase SQL Editor (atau melalui Supabase CLI):

`supabase/migrations/20261109000000_auth_profiles.sql`

Migrasi tersebut membuat tabel `profiles`, trigger pembuatan profil, RLS, dan fungsi pengajuan ulang verifikasi provider. Registrasi publik hanya dapat membuat role `customer` atau `provider`. Akun admin harus diberikan secara manual oleh operator yang berwenang:

```sql
update public.profiles
   set role = 'admin'
 where email = 'alamat-admin@example.com';
```

### 2. Environment variables

Backend (`backend/.env`):

```env
PORT=4000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
SUPABASE_URL=<url-project-supabase>
SUPABASE_ANON_KEY=<anon-key-supabase>
```

Frontend (`frontend/.env.local`, opsional):

```env
# Kosongkan agar browser memakai proxy same-origin /api
NEXT_PUBLIC_API_URL=
BACKEND_URL=http://localhost:4000
```

Jangan menaruh `SUPABASE_SERVICE_ROLE_KEY` di frontend. Implementasi ini tidak membutuhkannya.

### 3. Konfigurasi URL di Supabase

Di Supabase Dashboard > Authentication > URL Configuration:

- Site URL: `http://localhost:3000` untuk development.
- Redirect URLs: `http://localhost:3000/reset-password` dan URL production yang sesuai.

Aktifkan email confirmation bila ingin menguji alur "Silakan verifikasi email kamu terlebih dahulu.".

### 4. Menjalankan

```bash
cd backend
npm install
npm run dev

cd frontend
npm install
npm run dev
```

Frontend: http://localhost:3000/login
Backend health check: http://localhost:4000/api/health

### 5. Menguji tiap role

- Customer: buka `/register`, pilih Customer, daftar, verifikasi email bila diminta, lalu login. Pengguna diarahkan ke `/customer/dashboard`.
- Provider: buka `/register`, pilih Penyedia Jasa. Provider baru berstatus `pending` dan diarahkan ke `/provider/verification`. Setelah operator mengubah `provider_verification_status` menjadi `verified`, login berikutnya diarahkan ke `/provider/dashboard`. Status `rejected` menampilkan alasan penolakan dan tombol pengajuan ulang.
- Admin: daftarkan akun biasa melalui Supabase Dashboard atau registrasi, lalu ubah role menjadi `admin` dengan SQL di atas. Login diarahkan ke `/admin/dashboard`.

Jangan meng-hardcode akun pada source code. Buat akun uji langsung di project Supabase Anda.

### 6. Catatan keamanan

- Token Supabase disimpan di cookie `httpOnly`, bukan di localStorage.
- Role dan status verifikasi selalu dibaca ulang dari tabel `profiles` oleh backend.
- Setiap endpoint terlindungi memakai middleware `requireAuth`; middleware Next.js hanya lapisan UX.
- Logout memanggil Supabase untuk mencabut sesi dan menghapus cookie.
- Pesan error ke pengguna tidak memuat detail internal Supabase.

## Catatan Pengembangan

Saat ini autentikasi, login, registrasi, reset password, dan pengalihan berbasis role sudah tersedia. Fitur dashboard lengkap berdasarkan Product Backlog (24 PBI) akan diimplementasikan pada sprint berikutnya.
