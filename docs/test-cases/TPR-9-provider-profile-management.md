# Dokumen Test Case: Pengelolaan Profil Penyedia dan Kontak WhatsApp (`TPR-9`)

- **PBI Key**: `TPR-9` (PBI: Mengelola Profil dan Kontak WhatsApp Penyedia Jasa)
- **Parent**: `TPR-123` Provider Management
- **Subtask**:
  - `TPR-57` — Membuat halaman profil penyedia
  - `TPR-58` — Membuat endpoint CRUD profil penyedia
  - `TPR-59` — Membuat validasi kontak dan status publikasi
  - `TPR-60` — Menguji pengelolaan profil penyedia
  - `TPR-131` — Menyusun test case pengelolaan profil
- **PIC**: Fattan Darmawan
- **Sprint**: TPR Sprint 1 | **Story Point**: 5 | **Priority**: High
- **Lingkup Modul**:
  - Frontend penyedia: `/provider/profile` (`ProviderProfileClient`, `ProviderProfileForm`, `OperatingHoursEditor`, `ProviderProfilePreview`, `useProviderProfile`)
  - Frontend publik: `/providers/[id]` (`PublicProviderProfileClient`, `usePublicProvider`)
  - Backend REST API: `GET /api/providers/me`, `PUT /api/providers/me`, `PATCH /api/providers/me`, `GET /api/providers/:id`
  - Database: `public.provider_profiles` (1:1 ke `public.profiles`, FK `primary_category_id -> public.categories(id) ON DELETE RESTRICT`)

---

## 1. Pemetaan Acceptance Criteria (`TPR-9`)

| Kode AC | Pernyataan Acceptance Criteria | Cakupan Test Case |
| :--- | :--- | :--- |
| **AC-01** | Penyedia dapat membuat atau melengkapi profil dan kontak WhatsApp. | `TC-PRF-01`, `TC-PRF-02`, `TC-PRF-08`, `TC-PRF-09`, `TC-PRF-10`, `TC-PRF-11`, `TC-PRF-12`, `TC-PRF-13` |
| **AC-02** | Profil yang aktif dapat dilihat pelanggan. | `TC-PRF-04`, `TC-PRF-06`, `TC-PRF-15` |
| **AC-03** | Penyedia dapat memperbarui informasi profilnya. | `TC-PRF-03`, `TC-PRF-05`, `TC-PRF-09` |
| **AC-04** | Penyedia dapat menonaktifkan atau menyembunyikan profil dari publik. | `TC-PRF-05` |
| **AC-05** | Sistem memvalidasi informasi dan membatasi perubahan pada pemilik profil. | `TC-PRF-07`, `TC-PRF-08`, `TC-PRF-10`, `TC-PRF-11`, `TC-PRF-12`, `TC-PRF-14` |
| **AC-06** | Nomor WhatsApp wajib nomor Indonesia dan dinormalisasi ke format `62...`. | `TC-PRF-09`, `TC-PRF-10` |
| **AC-07** | Jam operasional disimpan per hari dengan satu rentang buka–tutup. | `TC-PRF-03`, `TC-PRF-12` |
| **AC-08** | Kategori utama wajib dan harus valid. | `TC-PRF-08`, `TC-PRF-13` |

---

## 2. Daftar Skenario & Data Uji (`TC-PRF-01` s.d. `TC-PRF-15`)

| ID Test Case | Ref AC | Jenis Uji | Skenario Pengujian | Prasyarat | Langkah Pengujian & Data Uji | Hasil yang Diharapkan | Status (`TPR-60`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-PRF-01** | AC-01 | Positif | Provider mengambil profil sendiri saat belum ada | Login provider; belum punya baris `provider_profiles` | `GET /api/providers/me` | HTTP `200 OK`, `data.profile = null` | `PASS` |
| **TC-PRF-02** | AC-01 | Positif | Provider `pending` membuat profil lengkap | Login provider (`provider_verification_status = pending`) | `PUT /api/providers/me` dengan nama usaha, bio, WhatsApp `0812-3456-7890`, alamat, area, jam operasional 7 hari, kategori utama | HTTP `200 OK`; `businessName` dinormalisasi; `whatsappNumber = 6281234567890`; `isPublic = false`; kategori terisi | `PASS` |
| **TC-PRF-03** | AC-03, AC-07 | Positif | Provider memperbarui alamat, area, bio, dan jam operasional | Profil sudah ada | `PATCH /api/providers/me` dengan alamat/area/bio baru dan hari Minggu dibuka | HTTP `200 OK`, data terbaru tersimpan, `operatingHours.sunday.isOpen = true` | `PASS` |
| **TC-PRF-04** | AC-02 | Positif | Switch publik aktif menampilkan profil dan layanan aktif | Profil disimpan dengan `isPublic = true`; provider punya 1 layanan aktif dan 1 nonaktif | `GET /api/providers/:id` tanpa sesi | HTTP `200 OK`; profil tampil; `services` hanya layanan aktif (nonaktif tidak ikut) | `PASS` |
| **TC-PRF-05** | AC-03, AC-04 | Positif | Switch publik nonaktif menyembunyikan profil | Profil sudah publik | `PATCH /api/providers/me` dengan `{ "isPublic": false }`, lalu `GET /api/providers/:id` | `PATCH` HTTP `200 OK` dengan `isPublic = false`; endpoint publik HTTP `404 PROVIDER_PROFILE_NOT_FOUND` | `PASS` |
| **TC-PRF-06** | AC-02 | Negatif | Profil publik tidak ada | Tidak ada baris profil untuk ID tersebut | `GET /api/providers/:id` | HTTP `404 PROVIDER_PROFILE_NOT_FOUND` | `PASS` |
| **TC-PRF-07** | AC-05 | Negatif | Format ID penyedia tidak valid | — | `GET /api/providers/bukan-uuid` | HTTP `400 INVALID_PROVIDER_ID` | `PASS` |
| **TC-PRF-08** | AC-01, AC-05 | Negatif | Field inti wajib kosong | Login provider | `PUT /api/providers/me` dengan body `{}` | HTTP `400 VALIDATION_ERROR`; `fields.businessName`, `fields.whatsappNumber`, `fields.address`, `fields.serviceArea`, `fields.primaryCategoryId` terisi | `PASS` |
| **TC-PRF-09** | AC-01, AC-03, AC-06 | Positif | Normalisasi WhatsApp dari `+62`, `08`, dan `8` | Login provider | `PUT` dengan `+62 812 3456 7890`; `PATCH` dengan `812-3456-7891` | Tersimpan sebagai `6281234567890` dan `6281234567891` | `PASS` |
| **TC-PRF-10** | AC-01, AC-05, AC-06 | Negatif | WhatsApp tidak valid | Login provider | `PUT` dengan `bukan-nomor` dan `0812` | HTTP `400 VALIDATION_ERROR` dengan `fields.whatsappNumber` | `PASS` |
| **TC-PRF-11** | AC-01, AC-05 | Negatif | Alamat/area terlalu pendek | Login provider | `PUT` dengan `address = "Jln"` dan `serviceArea = "A"` | HTTP `400 VALIDATION_ERROR` dengan `fields.address` dan `fields.serviceArea` | `PASS` |
| **TC-PRF-12** | AC-01, AC-05, AC-07 | Negatif | Jam operasional tidak lengkap/tidak valid | Login provider | `PUT` dengan hari tidak lengkap; `open = 18:00`, `close = 08:00`; semua hari tutup | HTTP `400 VALIDATION_ERROR` dengan `fields.operatingHours` pada ketiga kasus | `PASS` |
| **TC-PRF-13** | AC-05, AC-08 | Negatif | Kategori utama tidak terdaftar | Login provider | `PUT` dengan `primaryCategoryId` UUID valid yang tidak ada di tabel kategori | HTTP `400 INVALID_CATEGORY_REFERENCE`; `fields.primaryCategoryId` terisi | `PASS` |
| **TC-PRF-14** | AC-05 | Negatif | Anon/customer/provider lain tidak dapat mengubah profil | Profil milik Provider A sudah ada | `GET /api/providers/me` tanpa sesi; `PUT /api/providers/me` sebagai customer; `GET /api/providers/me` sebagai Provider B | Anon HTTP `401 NO_SESSION`; customer HTTP `403 FORBIDDEN`; Provider B hanya melihat profilnya sendiri (`null`) | `PASS` |
| **TC-PRF-15** | AC-02, AC-05 | Positif | Respons publik tidak memuat data privat dan hanya layanan aktif | Profil publik Provider A tersedia | `GET /api/providers/:id` tanpa sesi | HTTP `200 OK`; respons tidak memuat `email`/`fullName`; `services` hanya milik Provider A dan semuanya `isActive = true` | `PASS` |

---

## 3. Ringkasan Hasil Eksekusi (`TPR-60`)

- **Tanggal Eksekusi**: 12 November 2026
- **File Pengujian Otomatis**: `backend/src/tests/provider-profile.test.ts`
- **Perintah**: `cd backend && npm run test:tpr60` (khusus `TPR-60`) atau `npm test` (seluruh suite)
- **Metode**: Pengujian integrasi router Express (`createProviderProfileRouter`) dengan middleware autentikasi tiruan (provider verified, provider pending, provider lain, customer, tamu), penyimpanan profil in-memory melalui `setProviderProfileStoreForTesting`, dan penyimpanan layanan in-memory melalui `setServiceListingStoreForTesting`.

| Ref AC | Test Case | Hasil |
| :--- | :--- | :--- |
| AC-01 | `TC-PRF-01`, `TC-PRF-02`, `TC-PRF-08`, `TC-PRF-09`, `TC-PRF-10`, `TC-PRF-11`, `TC-PRF-12`, `TC-PRF-13` | 8/8 PASS |
| AC-02 | `TC-PRF-04`, `TC-PRF-06`, `TC-PRF-15` | 3/3 PASS |
| AC-03 | `TC-PRF-03`, `TC-PRF-05`, `TC-PRF-09` | 3/3 PASS |
| AC-04 | `TC-PRF-05` | 1/1 PASS |
| AC-05 | `TC-PRF-07`, `TC-PRF-08`, `TC-PRF-10`, `TC-PRF-11`, `TC-PRF-12`, `TC-PRF-14` | 6/6 PASS |
| AC-06 | `TC-PRF-09`, `TC-PRF-10` | 2/2 PASS |
| AC-07 | `TC-PRF-03`, `TC-PRF-12` | 2/2 PASS |
| AC-08 | `TC-PRF-08`, `TC-PRF-13` | 2/2 PASS |
| **Total** | **15 test case** | **15/15 PASS, 0 FAIL** |

> Catatan:
> - Pengujian ini memverifikasi logika API, validasi, normalisasi WhatsApp, aturan publikasi, dan otorisasi di sisi backend.
> - Kebijakan RLS pada `public.provider_profiles` di Supabase tetap perlu dicek manual pada database bersama.
> - Frontend diverifikasi melalui `cd frontend && npm run build` (kompilasi TypeScript dan build Next.js berhasil).
> - Aturan verifikasi provider sengaja belum diterapkan pada PBI ini; seluruh provider dapat mengelola dan mempublikasikan profil.
