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

## Catatan Pengembangan

Saat ini hanya berisi **landing page informasi** dan **fondasi backend**. Fitur-fitur berdasarkan Product Backlog (24 PBI) akan diimplementasikan pada sprint berikutnya.
