# Dokumen Test Case: Pengelolaan Paket & Harga Layanan (`TPR-5` / `PBI-05`)

- **PBI Key**: `TPR-5` (PBI-05: Mengelola Paket dan Harga Layanan)
- **Subtask Penyusunan Test Case**: `TPR-129` (Menyusun test case paket dan harga)
- **Subtask Pengujian Eksekusi**: `TPR-44` (Menguji alur pengelolaan paket)
- **PIC / Penyusun**: Muhammad Naufal Sinambela
- **Lingkup Modul**:
  - Frontend Penyedia Jasa: `/provider/dashboard/packages?serviceId=` (`PackageManagementClient`, `PackageCard`, `PackageFormModal`, `DeletePackageDialog`, `usePackages`) dan menu sidebar "Paket & Harga"
  - Frontend Publik: `/preview/services/[id]/packages` (`PublicPackagesClient`, `PackageList`)
  - Backend REST API: `GET /api/services/:serviceId/packages`, `GET /api/packages/mine?serviceId=`, `POST /api/packages`, `PATCH /api/packages/:id`, `DELETE /api/packages/:id`, serta pemetaan `SERVICE_HAS_PACKAGES` pada `DELETE /api/services/:id`
  - Database: Tabel `public.service_packages` dengan Foreign Key `service_id -> public.services(id) ON DELETE RESTRICT`, unique index nama per jasa (`deleted_at is null`), fungsi `public.is_service_publicly_visible(uuid)` (`security definer`), dan RLS per peran

---

## 1. Pemetaan Acceptance Criteria (`TPR-5`)

| Kode AC | Pernyataan Acceptance Criteria | Cakupan Test Case |
| :--- | :--- | :--- |
| **AC-01** | Penyedia memilih jasa miliknya lalu menambah paket (nama, deskripsi opsional, harga, status aktif) lewat modal; paket langsung muncul di daftar dan toast sukses tampil. | `TC-PKG-01`, `TC-PKG-02`, `TC-PKG-03` |
| **AC-02** | Endpoint publik hanya mengembalikan paket aktif yang belum dihapus dari jasa aktif, urut harga termurah, tanpa login; didemokan lewat `/preview`. | `TC-PKG-04`, `TC-PKG-05`, `TC-PKG-06`, `TC-PKG-07` |
| **AC-03** | Modal Edit terisi data lama, perubahan tersimpan dan `updated_at` diperbarui; menutup modal saat isian berubah memunculkan konfirmasi "Buang perubahan?". | `TC-PKG-08`, `TC-PKG-09`, `TC-PKG-10` |
| **AC-04** | Nonaktifkan / aktifkan lagi langsung jalan tanpa dialog, lalu muncul toast; paket nonaktif berlabel "Nonaktif" dan tidak terlihat pelanggan. | `TC-PKG-11`, `TC-PKG-12` |
| **AC-05** | Hapus lewat dialog konfirmasi (nama + harga), berupa soft delete (`deleted_at`): paket hilang dari daftar penyedia dan pelanggan, data tetap ada. | `TC-PKG-13`, `TC-PKG-14`, `TC-PKG-15` |
| **AC-06** | Input tidak valid ditolak di frontend dan backend dengan `VALIDATION_ERROR` dan pesan per field berbahasa Indonesia (harga, nama, deskripsi, duplikat, paket ke-11). | `TC-PKG-16`, `TC-PKG-17`, `TC-PKG-18`, `TC-PKG-19`, `TC-PKG-20` |
| **AC-07** | Hanya role `provider` yang boleh menulis, dan hanya untuk paket di jasa miliknya; dicek di backend dan RLS. | `TC-PKG-21`, `TC-PKG-22`, `TC-PKG-23`, `TC-PKG-24` |
| **AC-08** | Chip ringkasan "Total · Aktif · Nonaktif" dan filter Semua / Aktif / Nonaktif dengan hitungan, disaring di sisi klien; paket yang dihapus tidak dihitung. | `TC-PKG-25` |
| **AC-09** | Menu "Paket & Harga" tampil di sidebar penyedia dan aktif di `/provider/dashboard/packages` dan turunannya. | `TC-PKG-26` |

---

## 2. Daftar Skenario & Data Uji (`TC-PKG-01` s.d. `TC-PKG-26`)

| ID Test Case | Ref AC | Jenis Uji | Skenario Pengujian | Prasyarat (Precondition) | Langkah Pengujian & Data Uji | Hasil yang Diharapkan (Expected Result) | Status Eksekusi (`TPR-44`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-PKG-01** | AC-01 | Positif | Penyedia menambah paket aktif ke jasa miliknya | Login sebagai Penyedia A (`role = provider`); Penyedia A punya jasa aktif `<id-jasa-A>` dengan kurang dari 10 paket | Kirim `POST /api/packages` dengan body `{ "serviceId": "<id-jasa-A>", "name": "Dasar", "description": "Cek kebocoran dan tambal titik bocor ringan.", "price": 150000, "isActive": true }` | Respons HTTP `201 Created`, `data.package.name = "Dasar"`, `data.package.price = 150000`, `data.package.isActive = true`, `data.package.serviceId = "<id-jasa-A>"` | Belum dieksekusi |
| **TC-PKG-02** | AC-01 | Positif | Penyedia menambah paket nonaktif dengan deskripsi kosong | Login sebagai Penyedia A; jasa `<id-jasa-A>` tersedia | Kirim `POST /api/packages` dengan `{ "serviceId": "<id-jasa-A>", "name": "Berkala", "description": "", "price": 500000, "isActive": false }` | Respons HTTP `201 Created`, `data.package.isActive = false`, `data.package.description = null` | Belum dieksekusi |
| **TC-PKG-03** | AC-01 | Positif | Penyedia melihat seluruh paket jasanya (aktif + nonaktif, tanpa yang dihapus), dan UI menampilkan paket baru beserta toast | Login sebagai Penyedia A; jasa A punya paket aktif, nonaktif, dan satu yang sudah dihapus | Kirim `GET /api/packages/mine?serviceId=<id-jasa-A>`; di UI, tambah paket lewat modal "Tambah Paket" | Respons HTTP `200 OK`, `data.packages` berisi paket aktif dan nonaktif urut harga termurah, tanpa paket ber-`deleted_at`. Di UI kartu baru langsung muncul dan toast `Paket "<nama>" berhasil ditambahkan.` tampil | Belum dieksekusi |
| **TC-PKG-04** | AC-02 | Positif | Pengunjung tanpa login melihat paket aktif suatu jasa, urut harga termurah | Jasa A aktif dengan paket aktif Rp 350.000 dan Rp 150.000, satu paket nonaktif, dan satu paket yang sudah dihapus | Kirim `GET /api/services/<id-jasa-A>/packages` tanpa sesi; buka `/preview/services/<id-jasa-A>/packages` | Respons HTTP `200 OK`, `data.packages` hanya berisi 2 paket aktif dengan urutan harga Rp 150.000 lalu Rp 350.000; halaman `/preview` menampilkan kartu yang sama | Belum dieksekusi |
| **TC-PKG-05** | AC-02 | Positif | Jasa aktif yang belum punya paket aktif mengembalikan daftar kosong | Jasa aktif tanpa paket aktif | Kirim `GET /api/services/<id-jasa>/packages` tanpa sesi; buka halaman `/preview` | Respons HTTP `200 OK`, `data.packages = []`; halaman `/preview` menampilkan state "Jasa ini belum punya paket aktif." | Belum dieksekusi |
| **TC-PKG-06** | AC-02 | Negatif | Jasa nonaktif atau tidak terdaftar tidak bisa dilihat publik | Jasa nonaktif `<id-jasa-nonaktif>`; UUID acak `99999999-9999-4999-8999-999999999999` | Kirim `GET /api/services/<id-jasa-nonaktif>/packages` dan `GET /api/services/99999999-9999-4999-8999-999999999999/packages` | Keduanya `404 Not Found`, `error.code = "SERVICE_NOT_FOUND"`; halaman `/preview` menampilkan state "Jasa tidak ditemukan." | Belum dieksekusi |
| **TC-PKG-07** | AC-02 | Negatif | Menolak ID jasa yang bukan UUID pada endpoint publik | - | Kirim `GET /api/services/abc/packages` | Respons HTTP `400 Bad Request`, `error.code = "INVALID_SERVICE_ID"` | Belum dieksekusi |
| **TC-PKG-08** | AC-03 | Positif | Penyedia mengubah nama, deskripsi, dan harga paket miliknya | Login sebagai Penyedia A; paket `<id-paket-A>` milik jasa A | Kirim `PATCH /api/packages/<id-paket-A>` dengan `{ "name": "Lengkap Plus", "description": "Tambal, ganti talang, dan waterproofing.", "price": 375000 }` | Respons HTTP `200 OK`, data paket sesuai input baru, `data.package.updatedAt` lebih baru dari sebelumnya | Belum dieksekusi |
| **TC-PKG-09** | AC-03 | Negatif | Menolak perubahan paket yang tidak terdaftar | Login sebagai Penyedia A | Kirim `PATCH /api/packages/99999999-9999-4999-8999-999999999999` dengan `{ "price": 95000 }` | Respons HTTP `404 Not Found`, `error.code = "PACKAGE_NOT_FOUND"` | Belum dieksekusi |
| **TC-PKG-10** | AC-03 | Positif (UI) | Modal Edit terisi data lama dan menutup modal saat isian berubah memunculkan konfirmasi | Login sebagai Penyedia A di `/provider/dashboard/packages` | Klik "Edit" pada kartu paket, ubah harga, lalu klik "Batal" (atau tombol tutup / Escape) | Modal awalnya berisi nama, deskripsi, harga, dan status lama. Setelah isian berubah muncul dialog "Buang perubahan?" dengan tombol "Lanjut mengedit" dan "Buang perubahan"; tanpa perubahan, modal langsung tertutup | Belum dieksekusi |
| **TC-PKG-11** | AC-04 | Positif | Penyedia menonaktifkan paket tanpa dialog konfirmasi; paket tidak tampil publik | Login sebagai Penyedia A; paket aktif `<id-paket-A>` | Kirim `PATCH /api/packages/<id-paket-A>` dengan `{ "isActive": false }`; di UI klik "Nonaktifkan" | Respons HTTP `200 OK`, `data.package.isActive = false`; paket tidak lagi ada di `GET /api/services/<id-jasa-A>/packages`. Di UI tidak ada dialog, kartu berlabel "Nonaktif" dengan tombol "Aktifkan", dan toast tampil | Belum dieksekusi |
| **TC-PKG-12** | AC-04 | Positif | Penyedia mengaktifkan lagi paket nonaktif | Login sebagai Penyedia A; paket nonaktif `<id-paket-A>` | Kirim `PATCH /api/packages/<id-paket-A>` dengan `{ "isActive": true }`; di UI klik "Aktifkan" | Respons HTTP `200 OK`, `data.package.isActive = true`; paket kembali muncul di endpoint publik; toast `Paket "<nama>" diaktifkan lagi.` tampil | Belum dieksekusi |
| **TC-PKG-13** | AC-05 | Positif | Penyedia menghapus paket (soft delete) lewat dialog konfirmasi | Login sebagai Penyedia A; paket `<id-paket-A>` milik jasa A | Di UI klik "Hapus" lalu konfirmasi; atau kirim `DELETE /api/packages/<id-paket-A>` | Dialog menampilkan nama dan harga paket. Respons HTTP `200 OK`, `data.deletedId = "<id-paket-A>"`; paket hilang dari `GET /api/packages/mine` dan endpoint publik; baris di `public.service_packages` tetap ada dengan `deleted_at` terisi | Belum dieksekusi |
| **TC-PKG-14** | AC-05 | Negatif | Menolak penghapusan paket yang sudah dihapus atau tidak terdaftar | Login sebagai Penyedia A; paket `<id-paket-terhapus>` sudah di-soft-delete | Kirim `DELETE /api/packages/<id-paket-terhapus>` | Respons HTTP `404 Not Found`, `error.code = "PACKAGE_NOT_FOUND"` | Belum dieksekusi |
| **TC-PKG-15** | AC-05 | Negatif | Menolak hapus permanen jasa yang masih punya paket | Login sebagai Penyedia A; jasa A masih punya paket (termasuk yang di-soft-delete) | Kirim `DELETE /api/services/<id-jasa-A>` | Respons HTTP `409 Conflict`, `error.code = "SERVICE_HAS_PACKAGES"`, pesan "Jasa ini masih punya paket, nonaktifkan saja."; jasa dan paketnya tetap ada | Belum dieksekusi |
| **TC-PKG-16** | AC-06 | Negatif | Menolak nama paket kosong, kurang dari 3, atau lebih dari 100 karakter | Login sebagai Penyedia A; jasa A tersedia | Kirim `POST /api/packages` dengan `name: "   "`, `name: "ab"`, dan `name` 101 karakter | Respons HTTP `400 Bad Request`, `error.code = "VALIDATION_ERROR"`, `error.fields.name` berisi pesan wajib diisi / minimal 3 / maksimal 100 karakter | Belum dieksekusi |
| **TC-PKG-17** | AC-06 | Negatif | Menolak harga kosong, di bawah Rp 1.000, di atas Rp 100.000.000, atau bukan bilangan bulat | Login sebagai Penyedia A; jasa A tersedia | Kirim `POST /api/packages` dengan `price: ""`, `price: 500`, `price: 100000001`, dan `price: 1500.5` | Respons HTTP `400 Bad Request`, `error.code = "VALIDATION_ERROR"`, `error.fields.price` berisi pesan yang sesuai (mis. "Harga minimal Rp 1.000.") | Belum dieksekusi |
| **TC-PKG-18** | AC-06 | Negatif | Menolak deskripsi lebih dari 500 karakter | Login sebagai Penyedia A; jasa A tersedia | Kirim `POST /api/packages` dengan `description` 501 karakter | Respons HTTP `400 Bad Request`, `error.code = "VALIDATION_ERROR"`, `error.fields.description = "Deskripsi maksimal 500 karakter."` | Belum dieksekusi |
| **TC-PKG-19** | AC-06 | Negatif | Menolak nama paket yang sudah dipakai di jasa yang sama (tanpa membedakan huruf besar-kecil) | Login sebagai Penyedia A; jasa A sudah punya paket "Dasar" | Kirim `POST /api/packages` dengan `name: "dasar"` ke jasa A; kirim `PATCH` paket lain di jasa A dengan `name: "DASAR"` | Respons HTTP `409 Conflict`, `error.code = "DUPLICATE_PACKAGE_NAME"`, `error.fields.name = "Nama paket sudah dipakai di jasa ini."` | Belum dieksekusi |
| **TC-PKG-20** | AC-06 | Negatif | Menolak paket ke-11 dalam satu jasa; tombol Tambah Paket nonaktif di UI | Login sebagai Penyedia A; jasa A sudah punya 10 paket yang belum dihapus | Kirim `POST /api/packages` dengan data valid ke jasa A; buka halaman paket jasa A | Respons HTTP `409 Conflict`, `error.code = "PACKAGE_LIMIT_REACHED"`; di UI tombol "Tambah Paket" nonaktif dan muncul info batas 10 paket | Belum dieksekusi |
| **TC-PKG-21** | AC-07 | Negatif | Menolak operasi tulis paket tanpa sesi login (`401`) atau dengan role `customer` (`403`) | Request tanpa sesi, atau login sebagai `customer` | Kirim `POST /api/packages` tanpa sesi dan dengan sesi `customer` | Tanpa sesi menghasilkan `401 Unauthorized` (`NO_SESSION`); sesi `customer` menghasilkan `403 Forbidden` (`FORBIDDEN`) | Belum dieksekusi |
| **TC-PKG-22** | AC-07 | Negatif | Mencegah Penyedia B menambah paket ke jasa milik Penyedia A | Jasa aktif `<id-jasa-A>` milik Penyedia A; login sebagai Penyedia B | Kirim `POST /api/packages` dengan `serviceId: "<id-jasa-A>"` menggunakan sesi Penyedia B | Respons HTTP `403 Forbidden`, `error.code = "PACKAGE_OWNERSHIP_FORBIDDEN"`; tidak ada paket baru di jasa A | Belum dieksekusi |
| **TC-PKG-23** | AC-07 | Negatif | Mencegah Penyedia B mengubah, menonaktifkan, atau menghapus paket milik Penyedia A | Paket aktif `<id-paket-A>` milik jasa A; login sebagai Penyedia B | Kirim `PATCH /api/packages/<id-paket-A>` dengan `{ "price": 1000 }` dan `DELETE /api/packages/<id-paket-A>` menggunakan sesi Penyedia B | Respons HTTP `403 Forbidden`, `error.code = "PACKAGE_OWNERSHIP_FORBIDDEN"`; data paket Penyedia A tetap utuh | Belum dieksekusi |
| **TC-PKG-24** | AC-07 | Negatif | Cek RLS per peran di Supabase pribadi (anon, Penyedia A, Penyedia B) | Migrasi `20261115000000_service_packages.sql` sudah dijalankan; jasa A aktif dengan paket aktif dan nonaktif | Di SQL Editor jalankan query cek dengan `set local role anon` / `authenticated` + `request.jwt.claims` Penyedia A dan B, lalu `rollback` | Anon hanya melihat paket aktif dari jasa aktif dan `INSERT` ditolak; Penyedia A melihat dan mengubah semua paketnya; Penyedia B tidak melihat paket nonaktif A, `UPDATE` ke paket A berdampak 0 baris, dan `INSERT` ke jasa A ditolak RLS | Belum dieksekusi |
| **TC-PKG-25** | AC-08 | Positif (UI) | Chip ringkasan dan filter Semua / Aktif / Nonaktif menghitung dan menyaring di sisi klien | Login sebagai Penyedia A; jasa A punya 2 paket aktif, 1 nonaktif, dan 1 yang sudah dihapus | Buka `/provider/dashboard/packages?serviceId=<id-jasa-A>`, klik filter "Aktif" lalu "Nonaktif" | Hitungan tampil Semua 3 · Aktif 2 · Nonaktif 1 (paket terhapus tidak dihitung); filter menyaring kartu tanpa request baru ke server | Belum dieksekusi |
| **TC-PKG-26** | AC-09 | Positif (UI) | Menu "Paket & Harga" tampil di sidebar dan aktif di halaman paket | Login sebagai penyedia | Buka `/provider/dashboard` lalu klik menu "Paket & Harga"; buka juga `/provider/dashboard/packages?serviceId=<id-jasa-A>` | Menu "Paket & Harga" tampil setelah "Profil Penyedia" dan berstatus aktif (`aria-current="page"`) di `/provider/dashboard/packages` beserta query string-nya | Belum dieksekusi |

---

## 3. Ringkasan Hasil Eksekusi Pengujian (`TPR-44`)

- **Tanggal Eksekusi**: belum dieksekusi (diisi setelah `TPR-44`)
- **File Pengujian Otomatis**: `backend/src/tests/package.test.ts` (dibuat di `TPR-44`)
- **Perintah**: `cd backend && npm run test:tpr44` (khusus `TPR-44`) atau `npm test` (seluruh suite)
- **Metode**:
  - Backend: pengujian integrasi router Express (`createPackageRouter`) dengan middleware autentikasi tiruan (Penyedia A, Penyedia B, customer, tamu) dan penyimpanan data in-memory yang menggantikan Supabase melalui `setPackageStoreForTesting`.
  - Database: query RLS per peran di SQL Editor Supabase pribadi (`TC-PKG-24`), karena tes mock tidak menangkap masalah izin database.
  - UI: dibuktikan lewat screenshot (`TC-PKG-10`, `TC-PKG-25`, `TC-PKG-26`, serta bagian UI pada `TC-PKG-03`, `TC-PKG-11`, `TC-PKG-13`, `TC-PKG-20`).

| Ref AC | Test Case | Hasil |
| :--- | :--- | :--- |
| AC-01 | `TC-PKG-01` s.d. `TC-PKG-03` | Belum dieksekusi |
| AC-02 | `TC-PKG-04` s.d. `TC-PKG-07` | Belum dieksekusi |
| AC-03 | `TC-PKG-08` s.d. `TC-PKG-10` | Belum dieksekusi |
| AC-04 | `TC-PKG-11`, `TC-PKG-12` | Belum dieksekusi |
| AC-05 | `TC-PKG-13` s.d. `TC-PKG-15` | Belum dieksekusi |
| AC-06 | `TC-PKG-16` s.d. `TC-PKG-20` | Belum dieksekusi |
| AC-07 | `TC-PKG-21` s.d. `TC-PKG-24` | Belum dieksekusi |
| AC-08 | `TC-PKG-25` | Belum dieksekusi |
| AC-09 | `TC-PKG-26` | Belum dieksekusi |
| **Total** | **26 test case** | **Belum dieksekusi** |

> Catatan: pengujian otomatis memverifikasi logika API, validasi, dan otorisasi di sisi backend. Kebijakan RLS pada tabel `public.service_packages` dicek manual di Supabase pribadi (`TC-PKG-24`). Database bersama tidak disentuh.
