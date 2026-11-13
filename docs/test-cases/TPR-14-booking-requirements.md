# Dokumen Test Case: Pengelolaan Kebutuhan dan Lampiran Booking (`TPR-14`)

- **PBI Key**: `TPR-14` — Booking Requirements Management
- **Parent**: `TPR-124` — Booking & Service Request
- **Subtask**:
  - `TPR-77` — Membuat form detail kebutuhan dan unggah foto
  - `TPR-78` — Membuat endpoint CRUD detail kebutuhan booking
  - `TPR-79` — Membuat validasi lampiran dan status booking
  - `TPR-134` — Menyusun test case pengelolaan kebutuhan dan lampiran booking
  - `TPR-80` — Menguji perubahan detail kebutuhan
- **PIC**: Arsyanova Dewanto
- **Sprint**: TPR Sprint 1
- **Story Point PBI**: 5
- **Priority**: High

---

## Lingkup Modul

### Frontend TPR-77

- Form booking: `frontend/src/components/customer/booking/BookingFormClient.tsx`
- Form requirements: `frontend/src/components/customer/booking/BookingRequirementsForm.tsx`
- Tampilan detail requirements: `frontend/src/components/customer/booking/BookingRequirementsCard.tsx`
- Detail booking: `frontend/src/components/customer/booking/BookingDetailClient.tsx`
- API client: `frontend/src/lib/api.ts` (`bookingApi`)
- Tipe requirements: `frontend/src/types/booking-requirements.ts`
- Styling: `frontend/src/app/customer/booking/booking.css`

Form frontend mendukung catatan, multi-file preview lokal, penghapusan preview, dan upload JPG/PNG/WEBP. Detail booking mengambil requirements melalui API dan menampilkan foto menggunakan URL yang dikembalikan backend.

### Backend TPR-78/TPR-79

Route dan handler berada di `backend/src/routes/booking.routes.ts`. Business logic berada di `backend/src/services/booking-requirements.service.ts`.

- `POST /api/bookings/:id/requirements/upload-url`
- `POST /api/bookings/:id/requirements`
- `GET /api/bookings/:id/requirements`
- `PATCH /api/bookings/:id/requirements`
- `DELETE /api/bookings/:id/requirements/attachments/:attachmentId`
- `DELETE /api/bookings/:id/requirements`

Upload menggunakan signed upload URL. Pembacaan foto menggunakan signed URL. Customer memakai `requireCustomer`; endpoint read menggunakan `authMiddleware` dan pemeriksaan actor customer/provider di service.

### Database dan Storage

- Migration: `supabase/migrations/20261121000000_booking_requirements.sql`
- Tabel: `public.booking_requirements`
- Tabel lampiran: `public.booking_requirement_attachments`
- Relasi: satu `booking` memiliki maksimal satu requirement; satu requirement memiliki banyak attachment.
- Bucket: `booking-references` (private)
- Path: `{customerId}/booking-{bookingId}/{uuid}.jpg|jpeg|png|webp`
- RLS membatasi customer pemilik untuk mutasi dan customer/provider terkait untuk membaca.

### Status dan Validasi Aktual

- Status yang dapat mengubah requirements: `pending_provider_confirmation`.
- Status terkunci: `accepted` dan `cancelled`.
- Tipe yang diizinkan: `image/jpeg`, `image/png`, `image/webp`.
- Signature JPEG, PNG, dan WEBP diverifikasi setelah file diunggah.
- Ukuran file dan `contentType` dibandingkan dengan metadata storage.
- Batas maksimum ukuran file dan jumlah lampiran belum ditentukan; konstanta aktual masih bernilai `null`.

---

## 1. Pemetaan Acceptance Criteria (`TPR-14`)

| Kode AC | Pernyataan Acceptance Criteria | Cakupan Test Case |
| :--- | :--- | :--- |
| AC-01 | Customer dapat menambahkan catatan dan foto referensi pada booking. | `TC-REQ-01`–`TC-REQ-08` |
| AC-02 | Customer dan provider dapat melihat detail kebutuhan sesuai booking terkait. | `TC-REQ-09`–`TC-REQ-14` |
| AC-03 | Customer dapat memperbarui catatan atau foto sebelum batas perubahan. | `TC-REQ-15`–`TC-REQ-21`, `TC-REQ-32` |
| AC-04 | Customer dapat menghapus lampiran sebelum booking dikunci. | `TC-REQ-22`–`TC-REQ-26` |
| AC-05 | Sistem memvalidasi file, akses, dan status booking. | `TC-REQ-27`–`TC-REQ-35` |

---

## 2. Daftar Skenario dan Data Uji

### Data Uji Umum

- `CUSTOMER_A`: customer terautentikasi dan pemilik `BOOKING_A`.
- `CUSTOMER_B`: customer terautentikasi dan pemilik `BOOKING_B`.
- `PROVIDER_A`: provider pemilik jasa pada `BOOKING_A`.
- `PROVIDER_B`: provider lain yang tidak terkait `BOOKING_A`.
- `BOOKING_A`: UUID valid, customer A, provider A, status `pending_provider_confirmation`.
- `BOOKING_ACCEPTED`: booking customer A dengan status `accepted`.
- `BOOKING_CANCELLED`: booking customer A dengan status `cancelled`.
- `REQ_A`: requirement milik `BOOKING_A`.
- `ATTACHMENT_A1` dan `ATTACHMENT_A2`: metadata attachment berbeda pada `REQ_A`.
- File valid: `atap.jpg` dengan MIME `image/jpeg`, `atap.png` dengan MIME `image/png`, dan `atap.webp` dengan MIME `image/webp`; file harus memiliki signature sesuai isi sebenarnya.
- File invalid: `catatan.txt` dengan MIME `text/plain`, file kosong berukuran `0` byte, dan file berisi teks tetapi mengaku sebagai `image/png`.
- Batas ukuran dan jumlah lampiran: belum ditentukan pada implementasi, sehingga skenario terkait dicatat sebagai implementation gap.

| ID Test Case | Ref AC | Jenis Uji | Skenario Pengujian | Prasyarat | Langkah Pengujian & Data Uji | Hasil yang Diharapkan | Status (TPR-80) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-REQ-01 | AC-01 | Positif | Customer membuat requirement dengan catatan tanpa foto | `CUSTOMER_A` login; `BOOKING_A` pending; belum ada `REQ_A` | Kirim `POST /api/bookings/<BOOKING_A>/requirements` dengan `{ "notes": "Atap bocor di ruang tamu dekat jendela.", "attachments": [] }` | HTTP `201`; `data.requirements.bookingId` sama dengan `BOOKING_A`; catatan tersimpan; daftar attachment kosong | NOT EXECUTED (TPR-80) |
| TC-REQ-02 | AC-01 | Positif | Customer menyimpan catatan dan satu foto JPEG valid | Customer A memiliki signed upload URL; file `atap.jpg` benar-benar telah diunggah | Minta upload URL dengan nama `atap.jpg`, MIME `image/jpeg`, ukuran positif; PUT file; POST requirements dengan metadata path, nama, MIME, dan ukuran yang sama | HTTP `201`; metadata attachment tersimpan; response memiliki signed `url`; signature JPEG diterima | NOT EXECUTED (TPR-80) |
| TC-REQ-03 | AC-01 | Positif | Customer menambahkan beberapa foto dengan format yang didukung | Booking pending; tiga file valid berbeda: `atap.jpg`, `dinding.png`, `lokasi.webp` | Upload masing-masing melalui upload URL, lalu kirim ketiga metadata dalam array `attachments` | HTTP `201`; ketiga attachment terhubung ke `REQ_A`; tidak ada file yang saling menimpa | NOT EXECUTED (TPR-80) |
| TC-REQ-04 | AC-01 | Positif | Customer menyimpan foto tanpa catatan | Booking pending; file `atap.png` valid | POST requirements dengan `notes: null` dan satu attachment valid | HTTP `201`; `notes` null; attachment tersimpan | NOT EXECUTED (TPR-80) |
| TC-REQ-05 | AC-01 | Negatif | Customer membuat requirement untuk booking tidak ditemukan | Customer A login; UUID booking tidak ada | POST `/api/bookings/<UUID_TIDAK_ADA>/requirements` dengan catatan valid | HTTP `404 BOOKING_NOT_FOUND`; tidak ada requirement atau attachment metadata dibuat | NOT EXECUTED (TPR-80) |
| TC-REQ-06 | AC-01 | Security | Customer membuat requirement pada booking customer lain | `BOOKING_B` milik customer B; customer A login | POST `/api/bookings/<BOOKING_B>/requirements` sebagai customer A | HTTP `404 BOOKING_NOT_FOUND` karena `getBooking` mengikuti RLS; data booking B tidak berubah | NOT EXECUTED (TPR-80) |
| TC-REQ-07 | AC-01 | Security | Request create tanpa autentikasi | Tidak ada sesi | POST requirements dengan payload valid tanpa cookie/token | HTTP `401 NO_SESSION`; tidak ada upload URL atau data requirement dibuat | NOT EXECUTED (TPR-80) |
| TC-REQ-08 | AC-01 | Negatif | Customer mengirim metadata attachment yang belum diunggah | Booking pending; path storage tidak memiliki objek file | POST requirements dengan `storagePath` valid secara pola tetapi file belum ada | HTTP `400 UPLOAD_NOT_FOUND`; metadata tidak disimpan | NOT EXECUTED (TPR-80) |
| TC-REQ-09 | AC-02 | Positif | Customer membaca requirement miliknya | `REQ_A` tersedia untuk `BOOKING_A` | GET `/api/bookings/<BOOKING_A>/requirements` sebagai customer A | HTTP `200`; `data.requirements` memuat bookingId, notes, attachments, metadata, dan signed URL | NOT EXECUTED (TPR-80) |
| TC-REQ-10 | AC-02 | Positif | Provider terkait membaca requirement | Provider A terkait dengan `BOOKING_A` | GET endpoint requirements sebagai provider A | HTTP `200`; catatan dan attachment `BOOKING_A` dapat dibaca; provider tidak menerima hak mutasi | NOT EXECUTED (TPR-80) |
| TC-REQ-11 | AC-02 | Security | Customer lain membaca requirement booking | `BOOKING_A` milik customer A; customer B login | GET endpoint requirements untuk `BOOKING_A` sebagai customer B | HTTP `404 BOOKING_NOT_FOUND` karena booking tidak terlihat melalui RLS; signed URL tidak dibuat | NOT EXECUTED (TPR-80) |
| TC-REQ-12 | AC-02 | Security | Provider lain membaca requirement booking | `PROVIDER_B` tidak terkait `BOOKING_A` | GET endpoint requirements untuk `BOOKING_A` sebagai provider B | HTTP `404 BOOKING_NOT_FOUND` karena booking tidak terlihat melalui RLS; file tidak dapat diakses | NOT EXECUTED (TPR-80) |
| TC-REQ-13 | AC-02 | Security | Pengunjung publik membaca detail requirements | Tidak ada sesi | GET endpoint requirements tanpa autentikasi | HTTP `401 NO_SESSION`; bucket private tidak dapat diakses melalui endpoint | NOT EXECUTED (TPR-80) |
| TC-REQ-14 | AC-02 | Boundary | Booking belum memiliki requirement | `BOOKING_A` valid tetapi tidak memiliki row `booking_requirements` | GET endpoint requirements sebagai customer A | HTTP `200`; `data.requirements = null`; tidak ada error palsu | NOT EXECUTED (TPR-80) |
| TC-REQ-15 | AC-03 | Positif | Customer memperbarui catatan tanpa mengubah foto | `REQ_A` tersedia; booking pending; dua attachment existing | PATCH endpoint dengan `{ "notes": "Mohon periksa rangka atap dan talang air." }` | HTTP `200`; notes berubah; `ATTACHMENT_A1` dan `ATTACHMENT_A2` tetap tersedia | NOT EXECUTED (TPR-80) |
| TC-REQ-16 | AC-03 | Positif | Customer menambahkan foto baru | `REQ_A` pending; `ATTACHMENT_A1` existing; file `lokasi.webp` baru valid | Upload file baru, lalu PATCH dengan `attachments` berisi metadata baru | HTTP `200`; attachment lama tetap ada; attachment baru terhubung ke `REQ_A` | NOT EXECUTED (TPR-80) |
| TC-REQ-17 | AC-03 | Positif | Customer mengganti foto lama melalui delete lalu add | Booking pending; foto lama dan file baru tersedia | DELETE attachment lama, kemudian upload dan PATCH attachment baru; baca ulang GET | Foto lama tidak muncul; foto baru memiliki metadata dan signed URL valid; booking tidak berubah | NOT EXECUTED (TPR-80) |
| TC-REQ-18 | AC-03 | Positif | Customer mengubah catatan tanpa menghapus lampiran | `REQ_A` memiliki dua attachment | PATCH hanya field `notes`; GET ulang requirements | Notes terbaru tersimpan; jumlah dan path attachment tetap sama | NOT EXECUTED (TPR-80) |
| TC-REQ-19 | AC-03 | Positif | Customer menambahkan attachment tanpa mengubah catatan | `REQ_A` tersedia; notes existing | PATCH hanya array attachment baru | Notes existing tetap sama; attachment baru tersimpan | NOT EXECUTED (TPR-80) |
| TC-REQ-20 | AC-03 | Security | Customer memperbarui requirement milik customer lain | `REQ_B` terkait customer B; login customer A | PATCH `/api/bookings/<BOOKING_B>/requirements` dengan notes baru | HTTP `404` atau `403`; notes dan attachment B tidak berubah | NOT EXECUTED (TPR-80) |
| TC-REQ-21 | AC-03 | Negative | Customer mengirim update tanpa notes maupun attachments | `REQ_A` tersedia | PATCH dengan `{}` | HTTP `400 VALIDATION_ERROR`; data lama tetap sama | NOT EXECUTED (TPR-80) |
| TC-REQ-22 | AC-04 | Positif | Customer menghapus satu attachment | `REQ_A` memiliki `ATTACHMENT_A1` dan `ATTACHMENT_A2`; booking pending | DELETE `/api/bookings/<BOOKING_A>/requirements/attachments/<ATTACHMENT_A1>` | HTTP `200`; `deletedId` sesuai; attachment A1 dan file storage dihapus; A2 tetap tersedia | NOT EXECUTED (TPR-80) |
| TC-REQ-23 | AC-04 | Positif | Penghapusan satu foto tidak menghapus foto lain | Dua file dan metadata tersedia | Hapus hanya A1, lalu GET requirements | A1 tidak ada pada response/storage; A2 masih memiliki metadata dan signed URL | NOT EXECUTED (TPR-80) |
| TC-REQ-24 | AC-04 | Security | Customer menghapus attachment booking lain | A1 milik `BOOKING_A`; login customer B | DELETE attachment A1 menggunakan booking A sebagai customer B | HTTP `404` atau `403`; metadata dan file A1 tetap ada | NOT EXECUTED (TPR-80) |
| TC-REQ-25 | AC-04 | Negative | Menghapus attachment yang tidak ditemukan | Booking pending; ID attachment tidak ada | DELETE menggunakan UUID attachment yang tidak terdaftar | HTTP `404 BOOKING_ATTACHMENT_NOT_FOUND`; attachment lain tidak berubah | NOT EXECUTED (TPR-80) |
| TC-REQ-26 | AC-04 | Boundary | Penghapusan attachment dipanggil dua kali | A1 berhasil dihapus pada request pertama | Ulangi DELETE dengan ID A1 yang sama | Request kedua HTTP `404 BOOKING_ATTACHMENT_NOT_FOUND`; tidak ada attachment lain yang terhapus | NOT EXECUTED (TPR-80) |
| TC-REQ-27 | AC-05 | Positif | Upload URL menerima JPG/PNG/WEBP dengan metadata dasar valid | Customer pemilik booking pending | POST upload URL dengan `atap.jpg/image/jpeg`, `atap.png/image/png`, dan `lokasi.webp/image/webp`, masing-masing `size` integer positif | HTTP `200`; response berisi `uploadUrl` dan generated `storagePath`; nama path tidak memakai nama asli secara langsung | NOT EXECUTED (TPR-80) |
| TC-REQ-28 | AC-05 | Negatif | Ekstensi dan MIME type tidak didukung atau tidak cocok | Booking pending | Uji `foto.gif/image/gif`, `foto.jpg/image/png`, dan `foto.txt/image/jpeg` pada upload URL | HTTP `400 INVALID_FILE_TYPE`; tidak ada signed upload URL yang valid | NOT EXECUTED (TPR-80) |
| TC-REQ-29 | AC-05 | Negative | File kosong atau ukuran metadata tidak valid | Booking pending | Minta upload URL dengan `size=0`, ukuran negatif, atau bukan integer | HTTP `400 INVALID_FILE_TYPE`; file tidak diproses | NOT EXECUTED (TPR-80) |
| TC-REQ-30 | AC-05 | Negative | Isi file bukan gambar meskipun metadata mengaku PNG | Signed upload URL diperoleh; file berisi teks `bukan gambar`, metadata `image/png` dan nama `foto.png` | PUT file, lalu POST requirements dengan metadata tersebut | HTTP `400 INVALID_FILE_CONTENT`; metadata tidak menjadi attachment valid; cleanup dijalankan | NOT EXECUTED (TPR-80) |
| TC-REQ-31 | AC-05 | Negative | Signature file tidak sesuai MIME | File dimulai signature JPEG tetapi metadata `image/png`, atau sebaliknya | Upload file lalu POST requirements dengan metadata MIME yang salah | HTTP `400 INVALID_FILE_CONTENT` atau `INVALID_FILE_TYPE`; attachment tidak tersimpan | NOT EXECUTED (TPR-80) |
| TC-REQ-32 | AC-05 | Negative | Ukuran storage berbeda dari metadata request | File berhasil diunggah tetapi `fileSize` request sengaja diubah | POST/PATCH attachment dengan `fileSize` tidak sama dengan `storage.info` | HTTP `400 FILE_METADATA_MISMATCH`; metadata tidak tersimpan | NOT EXECUTED (TPR-80) |
| TC-REQ-33 | AC-05 | Boundary | Menguji batas maksimum ukuran file | Konfigurasi `BOOKING_REQUIREMENTS_MAX_FILE_SIZE` aktual masih `null` | Siapkan file kecil, file pada batas, dan file di atas batas; jalankan upload dan create | **IMPLEMENTATION GAP / PENDING TPR-79**: belum ada nilai batas resmi sehingga belum dapat diharapkan PASS/Reject berbasis angka | NOT EXECUTED (TPR-80) |
| TC-REQ-34 | AC-05 | Boundary | Menguji batas jumlah lampiran | Konfigurasi `BOOKING_REQUIREMENTS_MAX_ATTACHMENTS` aktual masih `null` | Tambahkan attachment existing lalu kirim sejumlah attachment baru melebihi batas yang kelak ditentukan | **IMPLEMENTATION GAP / PENDING TPR-79**: batas jumlah belum ditentukan; validasi `ATTACHMENT_LIMIT_REACHED` belum aktif | NOT EXECUTED (TPR-80) |
| TC-REQ-35 | AC-05 | Security | Provider mencoba mengubah atau menghapus requirements | Provider A terkait booking; requirement tersedia | Provider A memanggil PATCH dan DELETE requirements/attachment | HTTP `403 FORBIDDEN` dari `requireCustomer`; data customer tidak berubah | NOT EXECUTED (TPR-80) |
| TC-REQ-36 | AC-05 | Negative | Update pada booking accepted ditolak | `BOOKING_ACCEPTED` memiliki requirement; customer pemilik login | PATCH notes atau POST upload URL untuk booking accepted | HTTP `409 BOOKING_REQUIREMENTS_LOCKED`; requirement dan storage tidak berubah | NOT EXECUTED (TPR-80) |
| TC-REQ-37 | AC-05 | Negative | Delete pada booking cancelled ditolak | `BOOKING_CANCELLED` memiliki attachment | DELETE attachment atau DELETE requirements sebagai customer pemilik | HTTP `409 BOOKING_REQUIREMENTS_LOCKED`; metadata dan file tetap ada | NOT EXECUTED (TPR-80) |
| TC-REQ-38 | AC-05 | Concurrency | Status berubah saat update requirements berlangsung | Customer memulai PATCH saat booking pending; provider/admin mengubah status menjadi accepted secara bersamaan | Jalankan PATCH dan transisi status secara paralel, lalu baca database | Minimal salah satu operasi ditolak; RLS conditional status atau service mengembalikan conflict; tidak ada perubahan requirement setelah status terkunci | NOT EXECUTED (TPR-80) |
| TC-REQ-39 | AC-05 | Negative | Path storage diarahkan ke folder customer/booking lain | Customer A login; file path dibuat untuk customer/booking berbeda | POST/PATCH metadata dengan `storagePath="<CUSTOMER_B>/booking-<BOOKING_B>/<UUID>.jpg"` | HTTP `400 INVALID_STORAGE_PATH`; file booking lain tidak tersentuh | NOT EXECUTED (TPR-80) |
| TC-REQ-40 | AC-05 | Negative | Kegagalan cleanup storage tidak menghasilkan sukses palsu | Simulasikan metadata berhasil tetapi operasi `storage.remove` gagal | DELETE attachment lalu periksa response dan database/storage | Response menyertakan `fileCleanupFailed=true` atau error sesuai implementasi; sistem tidak menyatakan file pasti terhapus; masalah tercatat untuk cleanup | NOT EXECUTED (TPR-80) |

---

## 3. Ringkasan Rencana Eksekusi (`TPR-80`)

- **Tanggal Eksekusi**: Belum dieksekusi pada TPR-134.
- **File Pengujian Otomatis**: `backend/src/tests/booking-requirements-validation.test.ts`.
- **Perintah unit test aktual**: `cd backend && npm run build && node --test dist/tests/booking-requirements-validation.test.js`.
- **Perintah suite backend dari `package.json`**: `cd backend && npm test`.
- **Metode**: unit test validator murni; integration/API test dengan session customer/provider, Supabase database, RLS, dan bucket private untuk TPR-80.
- **Jumlah Test Case**: 40.
- **Hasil Eksekusi**: Menunggu TPR-80.

| Ref AC | Test Case | Hasil |
| :--- | :--- | :--- |
| AC-01 | `TC-REQ-01`–`TC-REQ-08` | NOT EXECUTED (TPR-80) |
| AC-02 | `TC-REQ-09`–`TC-REQ-14` | NOT EXECUTED (TPR-80) |
| AC-03 | `TC-REQ-15`–`TC-REQ-21`, `TC-REQ-38` | NOT EXECUTED (TPR-80) |
| AC-04 | `TC-REQ-22`–`TC-REQ-26`, `TC-REQ-40` | NOT EXECUTED (TPR-80) |
| AC-05 | `TC-REQ-27`–`TC-REQ-37`, `TC-REQ-39` | NOT EXECUTED (TPR-80) |
| **Total** | **40 test case** | **NOT EXECUTED (TPR-80)** |

### Bukti Automated Test Existing

`backend/src/tests/booking-requirements-validation.test.ts` berisi 3 unit test TPR-79 untuk signature JPEG/PNG/WEBP, penolakan signature yang tidak cocok, dan status editable. Test tersebut bukan eksekusi formal 40 test case TPR-134. Hasil unit test existing harus dicatat terpisah dari hasil TPR-80.

---

## Implementation Gap dan Catatan Aktual

1. `BOOKING_REQUIREMENTS_MAX_FILE_SIZE` dan `BOOKING_REQUIREMENTS_MAX_ATTACHMENTS` masih bernilai `null`; belum ada keputusan bisnis ukuran maksimum dan jumlah maksimum lampiran.
2. Karena itu TC-REQ-33 dan TC-REQ-34 belum memiliki angka batas resmi dan harus difinalisasi sebelum dieksekusi sebagai boundary test.
3. Belum ada integration test requirements dengan mock database/storage pada repository. TPR-80 membutuhkan environment Supabase atau test store yang mereplikasi RLS dan Storage API.
4. Pemeriksaan signature dilakukan setelah file di-upload, saat POST/PATCH metadata; signed upload URL sendiri hanya memvalidasi metadata dasar.
5. Cleanup file dilakukan sebagai kompensasi, bukan transaction atomik antara PostgreSQL dan Supabase Storage. Kegagalan cleanup dikembalikan melalui `fileCleanupFailed` dan perlu ditindaklanjuti.
6. Status penguncian aktual hanya menggunakan `pending_provider_confirmation` sebagai editable. Status lain yang belum ada seperti `completed` atau `in_progress` tidak dapat diuji berdasarkan implementasi saat ini.
7. Provider hanya memiliki hak baca. Endpoint read melakukan signed URL setelah authorization; bucket `booking-references` tetap private.

## Batasan Lingkup

Dokumen ini tidak mencakup pembuatan booking, validasi jadwal, recurring booking, Open Service Request, Provider Offer Management, pembayaran QRIS, transaction history, rating, atau review.
