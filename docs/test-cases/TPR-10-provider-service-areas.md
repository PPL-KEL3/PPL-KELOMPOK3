# Dokumen Test Case: Pengelolaan Wilayah Layanan Penyedia (`TPR-10`)

- **PBI Key**: `TPR-10` (Mengelola Wilayah Layanan)
- **Parent**: `TPR-123` Provider Management
- **Subtask**:
  - `TPR-61` — Membuat halaman dan form wilayah layanan
  - `TPR-62` — Membuat endpoint CRUD wilayah layanan
  - `TPR-63` — Membuat validasi wilayah dan radius
  - `TPR-64` — Menguji fitur wilayah layanan
  - `TPR-132` — Menyusun test case pengelolaan wilayah layanan
- **PIC**: Fattan Darmawan
- **Sprint**: TPR Sprint 1 | **Story Point**: 3 | **Priority**: Medium
- **Lingkup Modul**:
  - Frontend penyedia: section “Wilayah & Radius Layanan” pada `/provider/profile` (`ServiceAreasCard`, `ServiceAreaFormModal`, `DeleteServiceAreaDialog`, `useProviderServiceAreas`)
  - Frontend publik: `/providers/[id]` menampilkan daftar wilayah + radius
  - Backend REST API:
    - `GET /api/providers/me/service-areas`
    - `POST /api/providers/me/service-areas`
    - `PATCH /api/providers/me/service-areas/:areaId`
    - `DELETE /api/providers/me/service-areas/:areaId`
    - `GET /api/providers/:id` (menyertakan `serviceAreas`)
  - Database: kolom `provider_profiles.service_areas` bertipe `jsonb` (array of `{ id, areaName, radiusKm }`)

---

## 1. Pemetaan Acceptance Criteria (`TPR-10`)

| Kode AC | Pernyataan Acceptance Criteria | Cakupan Test Case |
| :--- | :--- | :--- |
| **AC-01** | Penyedia dapat menambahkan wilayah atau radius layanan. | `TC-AREA-02`, `TC-AREA-03`, `TC-AREA-06` |
| **AC-02** | Wilayah layanan tampil pada informasi penyedia. | `TC-AREA-10` |
| **AC-03** | Penyedia dapat memperbarui wilayah atau radius. | `TC-AREA-07` |
| **AC-04** | Penyedia dapat menghapus wilayah layanan yang tidak lagi digunakan. | `TC-AREA-09` |
| **AC-05** | Sistem menolak nilai radius atau wilayah yang tidak valid. | `TC-AREA-04`, `TC-AREA-05`, `TC-AREA-08` |
| **AC-06** | Hanya pemilik profil yang dapat mengelola wilayah layanannya. | `TC-AREA-11` |
| **AC-07** | Endpoint pengelolaan wilayah wajib menggunakan sesi provider. | `TC-AREA-12` |

---

## 2. Daftar Skenario & Data Uji (`TC-AREA-01` s.d. `TC-AREA-12`)

| ID Test Case | Ref AC | Jenis Uji | Skenario Pengujian | Prasyarat | Langkah Pengujian & Data Uji | Hasil yang Diharapkan | Status (`TPR-64`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-AREA-01** | AC-01 | Negatif | Provider belum punya profil tidak bisa mengakses wilayah layanan | Login provider; belum ada baris `provider_profiles` | `GET /api/providers/me/service-areas` | HTTP `404 PROVIDER_PROFILE_NOT_FOUND` | `PASS` |
| **TC-AREA-02** | AC-01 | Positif | Daftar wilayah kosong setelah profil dibuat | Profil provider sudah dibuat | `GET /api/providers/me/service-areas` | HTTP `200 OK`, `data.serviceAreas = []` | `PASS` |
| **TC-AREA-03** | AC-01 | Positif | Provider menambahkan wilayah + radius valid | Profil provider tersedia | `POST /api/providers/me/service-areas` dengan `{ "areaName": "  Kecamatan   Coblong ", "radiusKm": 5 }` | HTTP `201 Created`; `areaName` dinormalisasi menjadi `"Kecamatan Coblong"`; `radiusKm = 5`; daftar berisi 1 item | `PASS` |
| **TC-AREA-04** | AC-05 | Negatif | Menolak nama wilayah/radius tidak valid | Profil provider tersedia | `POST` dengan `areaName` kosong; `radiusKm = 0`; `radiusKm = 101` | HTTP `400 VALIDATION_ERROR` dengan `fields.areaName` atau `fields.radiusKm` | `PASS` |
| **TC-AREA-05** | AC-05 | Negatif | Menolak nama wilayah duplikat (case-insensitive) | Sudah ada wilayah `"Kecamatan Coblong"` | `POST` dengan `"  kecamatan   coblong "` | HTTP `400 VALIDATION_ERROR`; `fields.areaName = "Nama wilayah layanan sudah digunakan."` | `PASS` |
| **TC-AREA-06** | AC-01 | Negatif | Maksimal 10 wilayah per provider | Profil provider tersedia | Tambah 10 wilayah valid, lalu tambah wilayah ke-11 | 10 pertama HTTP `201`; wilayah ke-11 HTTP `400 VALIDATION_ERROR` pada `fields.areaName` | `PASS` |
| **TC-AREA-07** | AC-03 | Positif | Provider memperbarui nama wilayah dan radius | Profil provider + 1 wilayah tersedia | `PATCH /api/providers/me/service-areas/:areaId` dengan `{ "areaName": "Kecamatan Coblong Baru", "radiusKm": 12 }` | HTTP `200 OK`, nama dan radius diperbarui | `PASS` |
| **TC-AREA-08** | AC-05 | Negatif | Update/hapus wilayah tidak dikenal dan ID tidak valid | Profil provider tersedia | `PATCH`/`DELETE` dengan UUID yang tidak ada; `DELETE` dengan `bukan-uuid` | UUID tidak ada → HTTP `404 SERVICE_AREA_NOT_FOUND`; ID invalid → HTTP `400 INVALID_SERVICE_AREA_ID` | `PASS` |
| **TC-AREA-09** | AC-04 | Positif | Provider menghapus wilayah miliknya | Profil provider + 1 wilayah tersedia | `DELETE /api/providers/me/service-areas/:areaId` | HTTP `200 OK`; `data.serviceArea.id` sesuai; daftar menjadi kosong | `PASS` |
| **TC-AREA-10** | AC-02 | Positif | Wilayah layanan tampil di profil publik | Profil `is_public = true`; 1 wilayah tersedia | `GET /api/providers/:id` tanpa sesi | HTTP `200 OK`; `provider.serviceAreas` berisi 1 item dengan `areaName` dan `radiusKm` yang benar | `PASS` |
| **TC-AREA-11** | AC-06 | Negatif | Provider lain tidak melihat/mengubah wilayah Provider A | Provider A punya 1 wilayah; Provider B punya profil sendiri | Provider B `GET /me/service-areas`; lalu `PATCH` area milik Provider A | `GET` Provider B mengembalikan daftar kosong; `PATCH` area A → HTTP `404 SERVICE_AREA_NOT_FOUND` | `PASS` |
| **TC-AREA-12** | AC-07 | Negatif | Anon/customer tidak dapat mengelola wilayah | — | `GET /api/providers/me/service-areas` tanpa sesi; `POST` sebagai customer | Anon → HTTP `401 NO_SESSION`; customer → HTTP `403 FORBIDDEN` | `PASS` |

---

## 3. Ringkasan Hasil Eksekusi (`TPR-64`)

- **Tanggal Eksekusi**: 12 November 2026
- **File Pengujian Otomatis**: `backend/src/tests/provider-profile.test.ts` (blok `TC-AREA-*`)
- **Perintah**: `cd backend && npm run test:tpr64` (khusus `TPR-64`) atau `npm test` (seluruh suite)
- **Metode**: Pengujian integrasi router Express dengan middleware autentikasi tiruan dan penyimpanan profil in-memory melalui `setProviderProfileStoreForTesting`.

| Ref AC | Test Case | Hasil |
| :--- | :--- | :--- |
| AC-01 | `TC-AREA-02`, `TC-AREA-03`, `TC-AREA-06` | 3/3 PASS |
| AC-02 | `TC-AREA-10` | 1/1 PASS |
| AC-03 | `TC-AREA-07` | 1/1 PASS |
| AC-04 | `TC-AREA-09` | 1/1 PASS |
| AC-05 | `TC-AREA-04`, `TC-AREA-05`, `TC-AREA-08` | 3/3 PASS |
| AC-06 | `TC-AREA-11` | 1/1 PASS |
| AC-07 | `TC-AREA-12` | 1/1 PASS |
| **Total** | **12 test case** | **12/12 PASS, 0 FAIL** |

> Catatan:
> - Seluruh suite backend (`npm test`) lulus **64/64 test**.
> - Frontend diverifikasi melalui `npx tsc --noEmit` dan `npm run build` (berhasil).
> - Migration `20261113000000_provider_service_areas.sql` perlu dijalankan di Supabase sebelum menguji di environment nyata.
> - Data wilayah disimpan sebagai JSONB pada `provider_profiles`, sehingga RLS publik yang sudah ada otomatis ikut melindungi data ini.
