# Dokumen Test Case: Pengelolaan Daftar Layanan Jasa (`TPR-2` / `KF-02`)

- **PBI Key**: `TPR-2` (PBI-02 / `KF-02`: Mengelola Daftar Jasa)
- **Subtask Penyusunan Test Case**: `TPR-128` (Menyusun test case pengelolaan daftar)
- **Subtask Pengujian Eksekusi**: `TPR-32` (Menguji alur pengelolaan jasa)
- **PIC / Penyusun**: Vivi Silfia (Fullstack Developer / System Analyst)
- **Lingkup Modul**:
  - Frontend Penyedia Jasa: `/provider/dashboard/services` (`ServiceManagementClient`, `ServiceTable`, `ServiceFormModal`, `DeleteServiceDialog`, `useServices`)
  - Frontend Katalog Pelanggan: `/customer/dashboard` (`PublishedServicesCatalog`)
  - Backend REST API: `GET /api/services`, `GET /api/services/mine`, `GET /api/services/:id`, `POST /api/services`, `PATCH /api/services/:id`, `PUT /api/services/:id`, `DELETE /api/services/:id`
  - Database: Tabel `public.services` dengan Foreign Key `provider_id -> public.profiles(id)` dan `category_id -> public.categories(id) ON DELETE RESTRICT`

---

## 1. Pemetaan Acceptance Criteria (`TPR-2`)

| Kode AC | Pernyataan Acceptance Criteria | Cakupan Test Case |
| :--- | :--- | :--- |
| **AC-01** | Penyedia yang telah diverifikasi dapat menambahkan jasa dengan nama, kategori, deskripsi, dan harga. | `TC-SVC-01`, `TC-SVC-02` |
| **AC-02** | Penyedia dapat melihat seluruh jasa miliknya dan pelanggan dapat melihat jasa yang dipublikasikan. | `TC-SVC-03`, `TC-SVC-04`, `TC-SVC-05` |
| **AC-03** | Penyedia dapat mengubah informasi jasa miliknya. | `TC-SVC-06`, `TC-SVC-07` |
| **AC-04** | Penyedia dapat menghapus atau menonaktifkan jasa yang tidak lagi ditawarkan. | `TC-SVC-08`, `TC-SVC-09` |
| **AC-05** | Sistem menolak data wajib yang kosong dan mencegah pengguna mengubah jasa milik orang lain. | `TC-SVC-10`, `TC-SVC-11`, `TC-SVC-12`, `TC-SVC-13`, `TC-SVC-14`, `TC-SVC-15` |

---

## 2. Daftar Skenario & Data Uji (`TC-SVC-01` s.d. `TC-SVC-15`)

| ID Test Case | Ref AC | Jenis Uji | Skenario Pengujian | Prasyarat (Precondition) | Langkah Pengujian & Data Uji | Hasil yang Diharapkan (Expected Result) | Status Eksekusi (`TPR-32`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-SVC-01** | AC-01 | Positif | Menambahkan layanan jasa baru oleh penyedia jasa terverifikasi (`is_active = true`) | Login sebagai `provider` dengan `providerVerificationStatus = "verified"`; kategori valid tersedia | Kirim `POST /api/services` dengan body `{ "name": "Servis AC Split & Cuci Unit", "categoryId": "<uuid-kategori-valid>", "description": "Pembersihan evaporator, kondensor, dan pengecekan tekanan freon.", "price": 85000, "isActive": true }` | Respons HTTP `201 Created`, `data.service.name = "Servis AC Split & Cuci Unit"`, `data.service.price = 85000`, `data.service.isActive = true` | `PASS` |
| **TC-SVC-02** | AC-01 | Negatif | Menolak penambahan layanan oleh penyedia jasa yang belum terverifikasi (`unverified` / `pending`) | Login sebagai `provider` dengan `providerVerificationStatus = "pending"` | Kirim `POST /api/services` dengan data layanan valid | Respons HTTP `403 Forbidden`, `error.code = "PROVIDER_NOT_VERIFIED"`, pesan menolak penambahan layanan sebelum akun diverifikasi | `PASS` |
| **TC-SVC-03** | AC-02 | Positif | Pelanggan melihat daftar layanan yang dipublikasikan (`is_active = true`) tanpa menampilkan layanan nonaktif | Tersedia 2 layanan aktif dan 1 layanan nonaktif (`is_active = false`) di database | Kirim `GET /api/services` (publik/pelanggan) | Respons HTTP `200 OK`, hanya mengembalikan layanan dengan `isActive = true` (layanan nonaktif tidak ikut tampil ke pelanggan) | `PASS` |
| **TC-SVC-04** | AC-02 | Positif | Pelanggan memfilter daftar layanan publik berdasarkan kategori (`categoryId`) | Tersedia layanan aktif pada beberapa kategori berbeda | Kirim `GET /api/services?categoryId=<uuid-kategori-1>` | Respons HTTP `200 OK`, seluruh item pada `data.services` memiliki `categoryId` sesuai filter yang diminta | `PASS` |
| **TC-SVC-05** | AC-02 | Positif | Penyedia jasa melihat seluruh layanan miliknya sendiri (baik yang aktif maupun nonaktif) | Login sebagai Penyedia A yang memiliki layanan aktif dan layanan nonaktif | Kirim `GET /api/services/mine` | Respons HTTP `200 OK`, menampilkan seluruh layanan milik Penyedia A (termasuk `isActive = false`) dan tidak menampilkan milik Penyedia B | `PASS` |
| **TC-SVC-06** | AC-03 | Positif | Penyedia jasa mengubah informasi nama, kategori, deskripsi, dan harga layanan miliknya sendiri | Login sebagai Penyedia A (`verified`); layanan milik Penyedia A tersedia | Kirim `PATCH /api/services/:id` dengan `{ "name": "Servis AC Split & Isi Freon R32", "description": "Pembersihan unit indoor outdoor lengkap dengan penambahan freon R32.", "price": 120000 }` | Respons HTTP `200 OK`, data layanan berhasil diperbarui sesuai input terbaru | `PASS` |
| **TC-SVC-07** | AC-03 | Negatif | Menolak perubahan layanan jika ID layanan tidak terdaftar di database | Login sebagai Penyedia A (`verified`) | Kirim `PATCH /api/services/99999999-9999-4999-8999-999999999999` dengan `{ "price": 95000 }` | Respons HTTP `404 Not Found`, `error.code = "SERVICE_NOT_FOUND"` | `PASS` |
| **TC-SVC-08** | AC-04 | Positif | Penyedia jasa menonaktifkan layanan miliknya (`isActive = false`) agar tidak tampil di katalog pelanggan | Login sebagai Penyedia A (`verified`); layanan aktif tersedia | Kirim `PATCH /api/services/:id` dengan `{ "isActive": false }` | Respons HTTP `200 OK`, `data.service.isActive = false`; layanan tidak lagi muncul pada `GET /api/services` publik | `PASS` |
| **TC-SVC-09** | AC-04 | Positif | Penyedia jasa menghapus permanen layanan miliknya yang tidak lagi ditawarkan | Login sebagai Penyedia A (`verified`); layanan milik Penyedia A tersedia | Kirim `DELETE /api/services/:id` | Respons HTTP `200 OK`, `data.deletedId` sesuai ID layanan; layanan terhapus dari daftar penyedia dan katalog publik | `PASS` |
| **TC-SVC-10** | AC-05 | Negatif | Menolak penyimpanan layanan dengan data wajib kosong (nama, kategori, deskripsi, atau harga kosong) | Login sebagai Penyedia A (`verified`) | Kirim `POST /api/services` dengan `{ "name": "   ", "categoryId": "", "description": "", "price": "" }` | Respons HTTP `400 Bad Request`, `error.code = "VALIDATION_ERROR"`, mengembalikan pesan error pada `fields.name`, `fields.categoryId`, `fields.description`, dan `fields.price` | `PASS` |
| **TC-SVC-11** | AC-05 | Negatif | Menolak harga layanan yang tidak valid (kurang dari `Rp 1.000`, negatif, atau bukan angka bulat) | Login sebagai Penyedia A (`verified`) | Kirim `POST /api/services` dengan `price: 500` atau `price: -25000` | Respons HTTP `400 Bad Request`, `error.code = "VALIDATION_ERROR"`, `error.fields.price = "Harga layanan minimal Rp 1.000."` | `PASS` |
| **TC-SVC-12** | AC-05 | Negatif | Menolak penambahan layanan jika `categoryId` tidak terdaftar di tabel kategori | Login sebagai Penyedia A (`verified`) | Kirim `POST /api/services` dengan `categoryId: "88888888-8888-4888-8888-888888888888"` (UUID valid namun tidak ada di database) | Respons HTTP `400 Bad Request`, `error.code = "INVALID_CATEGORY_REFERENCE"`, `error.fields.categoryId` berisi pesan kategori tidak ditemukan | `PASS` |
| **TC-SVC-13** | AC-05 | Negatif | Mencegah Penyedia B mengubah atau menonaktifkan layanan milik Penyedia A | Layanan dimiliki oleh Penyedia A; request dikirim oleh Penyedia B (`verified`) | Kirim `PATCH /api/services/<id-layanan-penyedia-A>` menggunakan sesi Penyedia B | Respons HTTP `403 Forbidden`, `error.code = "SERVICE_OWNERSHIP_FORBIDDEN"`, data layanan Penyedia A tetap utuh | `PASS` |
| **TC-SVC-14** | AC-05 | Negatif | Mencegah Penyedia B menghapus layanan milik Penyedia A | Layanan dimiliki oleh Penyedia A; request dikirim oleh Penyedia B (`verified`) | Kirim `DELETE /api/services/<id-layanan-penyedia-A>` menggunakan sesi Penyedia B | Respons HTTP `403 Forbidden`, `error.code = "SERVICE_OWNERSHIP_FORBIDDEN"`, layanan Penyedia A tidak terhapus | `PASS` |
| **TC-SVC-15** | AC-05 | Negatif | Menolak operasi pengelolaan layanan oleh pengguna tanpa sesi login (`401`) atau ber-role `customer` (`403`) | Request tanpa token sesi atau login sebagai `customer` | Kirim `POST /api/services` tanpa sesi login dan dengan sesi `customer` | Tanpa sesi menghasilkan `401 Unauthorized` (`NO_SESSION`); sesi `customer` menghasilkan `403 Forbidden` (`FORBIDDEN`) | `PASS` |


---

## 3. Ringkasan Hasil Eksekusi Pengujian (`TPR-32`)

- **Tanggal Eksekusi**: 10 November 2026
- **File Pengujian Otomatis**: `backend/src/tests/service.test.ts`
- **Perintah**: `cd backend && npm run test:tpr32` (khusus `TPR-32`) atau `npm test` (seluruh suite)
- **Metode**: Pengujian integrasi router Express (`createServiceRouter`) dengan middleware autentikasi tiruan (penyedia A, penyedia B, penyedia belum terverifikasi, customer, tamu) dan penyimpanan data in-memory yang menggantikan Supabase melalui `setServiceListingStoreForTesting`.

| Ref AC | Test Case | Hasil |
| :--- | :--- | :--- |
| AC-01 | `TC-SVC-01`, `TC-SVC-02` | 2/2 PASS |
| AC-02 | `TC-SVC-03`, `TC-SVC-04`, `TC-SVC-05` | 3/3 PASS |
| AC-03 | `TC-SVC-06`, `TC-SVC-07` | 2/2 PASS |
| AC-04 | `TC-SVC-08`, `TC-SVC-09` | 2/2 PASS |
| AC-05 | `TC-SVC-10` s.d. `TC-SVC-15` | 6/6 PASS |
| **Total** | **15 test case** | **15/15 PASS, 0 FAIL** |

> Catatan: pengujian ini memverifikasi logika API, validasi, dan otorisasi di sisi backend. Kebijakan RLS pada tabel `public.services` di Supabase tetap perlu dicek manual pada database bersama.
