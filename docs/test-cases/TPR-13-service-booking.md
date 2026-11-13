# Dokumen Test Case: Proses Pemesanan Jasa (`TPR-13`)

- **PBI Key**: `TPR-13` — Service Booking Management
- **Parent**: `TPR-124` — Booking & Service Request
- **Subtask**:
  - `TPR-73` — Membuat halaman form dan detail booking
  - `TPR-74` — Membuat endpoint CRUD dan alur status booking
  - `TPR-75` — Membuat validasi jadwal dan aturan status booking
  - `TPR-133` — Menyusun test case proses pemesanan jasa
  - `TPR-76` — Menguji proses booking end-to-end
- **PIC**: Arsyanova Dewanto
- **Sprint**: TPR Sprint 1
- **Story Point PBI**: 8
- **Priority**: Highest

---

## Lingkup Modul

### Frontend

- Form booking: `frontend/src/components/customer/booking/BookingFormClient.tsx`
- Detail booking: `frontend/src/components/customer/booking/BookingDetailClient.tsx`
- API client: `frontend/src/lib/api.ts` (`bookingApi`)
- Tipe data: `frontend/src/types/booking.ts`
- Halaman form: `/customer/booking/new`
- Halaman detail: `/customer/booking/[id]`

Form mengirim `serviceId`, `packageId`, `workDate`, dan `workTime`. Detail menampilkan status booking dan menyediakan aksi pembatalan sesuai hak akses.

### Backend REST API

Route berada di `backend/src/routes/booking.routes.ts`; business logic berada di `backend/src/services/booking.service.ts`.

- `POST /api/bookings`
- `GET /api/bookings/mine`
- `GET /api/bookings/incoming`
- `GET /api/bookings/:id`
- `PATCH /api/bookings/:id`
- `POST /api/bookings/:id/accept`
- `POST /api/bookings/:id/reject`
- `POST /api/bookings/:id/cancel`

Authentication menggunakan `requireAuth`; pembatasan role provider menggunakan `requireProvider`, sedangkan operasi customer menggunakan middleware customer pada route terkait.

### Validasi dan Database

- Validator: `backend/src/services/booking-validation.service.ts`
- Unit test existing: `backend/src/tests/booking-validation.test.ts`
- Tabel: `public.bookings`
- Schema: `supabase/migrations/20261119000000_bookings.sql`
- Unique active slot: `supabase/migrations/20261120000000_booking_schedule_rules.sql`
- Jadwal provider aktual: `provider_profiles.operating_hours`
- Relasi booking: `customer_id` dan `provider_id` ke `profiles`, `service_id` ke `services`, serta `package_id` ke `service_packages`.

Status aktual adalah `pending_provider_confirmation`, `accepted`, dan `cancelled`. Penolakan provider menggunakan status `cancelled`.

## 1. Pemetaan Acceptance Criteria

| Kode AC | Pernyataan Acceptance Criteria | Cakupan Test Case |
| :--- | :--- | :--- |
| AC-01 | Customer dapat membuat booking untuk jasa dan slot yang tersedia. | `TC-BOOK-01`–`TC-BOOK-13`, `TC-BOOK-24`–`TC-BOOK-25` |
| AC-02 | Booking baru memiliki status awal menunggu konfirmasi penyedia. | `TC-BOOK-14`–`TC-BOOK-15` |
| AC-03 | Customer dan provider hanya dapat membaca booking sesuai hak aksesnya. | `TC-BOOK-16`–`TC-BOOK-23` |
| AC-04 | Provider dapat menerima atau menolak booking sesuai ownership dan transisi status. | `TC-BOOK-26`–`TC-BOOK-31` |
| AC-05 | Customer dapat membatalkan booking hanya pada status yang diperbolehkan. | `TC-BOOK-32`–`TC-BOOK-35` |

## 2. Daftar Skenario dan Data Uji

### Data Uji Umum

- `CUSTOMER_A` dan `CUSTOMER_B`: dua akun customer terautentikasi dengan profil berbeda.
- `PROVIDER_A` dan `PROVIDER_B`: dua akun provider terautentikasi dengan profil berbeda.
- `SERVICE_A`: service aktif milik `PROVIDER_A` dengan UUID valid.
- `PACKAGE_A`: paket aktif milik `SERVICE_A` dengan UUID valid.
- Jadwal contoh provider: Senin–Jumat `08:00`–`17:00`; Minggu tutup.
- Slot valid: `08.00–09.00`; slot di luar jam kerja: `07.00–08.00`.
- Semua tanggal uji masa depan harus disesuaikan dengan tanggal eksekusi dan hari kalender yang benar.

| ID Test Case | Ref AC | Jenis Uji | Skenario Pengujian | Prasyarat | Langkah Pengujian & Data Uji | Hasil yang Diharapkan | Status (TPR-76) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-BOOK-01 | AC-01 | Positif | Customer membuat booking tanpa paket | Customer login; `SERVICE_A` aktif | `POST /api/bookings` dengan `serviceId=SERVICE_A`, `packageId=null`, tanggal operasional masa depan, `workTime=08.00–09.00` | HTTP `201`; booking terbentuk dengan service, provider, tanggal, waktu, harga, dan status | NOT EXECUTED (TPR-76) |
| TC-BOOK-02 | AC-01 | Positif | Customer membuat booking dengan paket aktif | `PACKAGE_A` aktif dan milik `SERVICE_A` | Kirim payload create dengan `serviceId=SERVICE_A`, `packageId=PACKAGE_A`, tanggal dan slot valid | HTTP `201`; `packageId` dan harga paket tersimpan pada booking | NOT EXECUTED (TPR-76) |
| TC-BOOK-03 | AC-01 | Negatif | Field wajib kosong | Customer login | Kirim `serviceId=""`, `workDate=""`, `workTime=""` ke `POST /api/bookings` | HTTP `400` validasi; booking tidak dibuat | NOT EXECUTED (TPR-76) |
| TC-BOOK-04 | AC-01 | Negatif | Service ID bukan UUID | Customer login | Kirim `serviceId="bukan-uuid"` dan data jadwal lain valid | HTTP `400 INVALID_SERVICE_ID` atau error validasi route aktual; booking tidak dibuat | NOT EXECUTED (TPR-76) |
| TC-BOOK-05 | AC-01 | Negatif | Service tidak ditemukan atau tidak aktif | UUID service tidak terdaftar/nonaktif | Kirim payload create dengan service target dan jadwal valid | HTTP `404 SERVICE_NOT_FOUND`; booking tidak dibuat | NOT EXECUTED (TPR-76) |
| TC-BOOK-06 | AC-01 | Negatif | Paket tidak sesuai service | Paket milik service lain atau tidak aktif | Kirim `serviceId=SERVICE_A`, `packageId` paket yang tidak sesuai | HTTP `404 PACKAGE_NOT_FOUND`; booking tidak dibuat | NOT EXECUTED (TPR-76) |
| TC-BOOK-07 | AC-01 | Security | User tanpa sesi membuat booking | Tidak ada sesi autentikasi | Kirim `POST /api/bookings` dengan payload valid | HTTP `401`; booking tidak dibuat | NOT EXECUTED (TPR-76) |
| TC-BOOK-08 | AC-01 | Boundary | Tanggal booking sudah lewat | Service dan provider valid | Kirim `workDate="2000-01-03"`, slot valid | HTTP `400 BOOKING_DATE_IN_PAST`; booking tidak dibuat | NOT EXECUTED (TPR-76) |
| TC-BOOK-09 | AC-01 | Boundary | Tanggal kalender tidak valid | Customer login | Kirim `workDate="2026-02-30"` | HTTP `400 BOOKING_DATE_INVALID`; booking tidak dibuat | NOT EXECUTED (TPR-76) |
| TC-BOOK-10 | AC-01 | Negatif | Booking pada hari provider tutup | Provider menutup hari Minggu | Kirim tanggal Minggu masa depan dan `workTime=08.00–09.00` | HTTP `409 BOOKING_DAY_UNAVAILABLE`; booking tidak dibuat | NOT EXECUTED (TPR-76) |
| TC-BOOK-11 | AC-01 | Negatif | Slot di luar jam operasional | Provider buka `08:00`–`17:00` | Kirim `workTime=07.00–08.00` pada hari buka | HTTP `409 BOOKING_SLOT_UNAVAILABLE`; booking tidak dibuat | NOT EXECUTED (TPR-76) |
| TC-BOOK-12 | AC-01 | Boundary | Format slot invalid atau interval terbalik | Customer login | Uji `workTime="pagi"`, lalu `workTime="10.00–09.00"` | HTTP `400 BOOKING_SLOT_INVALID`; booking tidak dibuat | NOT EXECUTED (TPR-76) |
| TC-BOOK-13 | AC-01 | Negatif | Jadwal operasional provider belum tersedia | `provider_profiles.operating_hours` null/tidak tersedia | Kirim payload create dengan tanggal dan slot valid | HTTP `409 PROVIDER_SCHEDULE_UNAVAILABLE`; booking tidak dibuat | NOT EXECUTED (TPR-76) |
| TC-BOOK-14 | AC-02 | Positif | Booking baru memiliki status awal | Create booking valid | Jalankan create lalu periksa response dan row `public.bookings` | HTTP `201`; status tepat `pending_provider_confirmation` | NOT EXECUTED (TPR-76) |
| TC-BOOK-15 | AC-02 | Security | Customer mencoba menentukan status awal | Customer login | Tambahkan `status="accepted"` pada payload create valid | Status request diabaikan/tidak dapat dipilih; status tersimpan tetap `pending_provider_confirmation` | NOT EXECUTED (TPR-76) |
| TC-BOOK-16 | AC-03 | Positif | Customer melihat daftar booking miliknya | `CUSTOMER_A` memiliki booking | `GET /api/bookings/mine` sebagai `CUSTOMER_A` | HTTP `200`; hanya row dengan `customer_id=CUSTOMER_A` yang ditampilkan | NOT EXECUTED (TPR-76) |
| TC-BOOK-17 | AC-03 | Positif | Customer melihat detail booking miliknya | Booking customer A tersedia | `GET /api/bookings/<booking-A>` sebagai `CUSTOMER_A` | HTTP `200`; detail jasa, provider, jadwal, harga, status, dan timestamp sesuai database | NOT EXECUTED (TPR-76) |
| TC-BOOK-18 | AC-03 | Security | Customer melihat booking customer lain | Booking B milik `CUSTOMER_B` tersedia | `GET /api/bookings/<booking-B>` sebagai `CUSTOMER_A` | HTTP `404 BOOKING_NOT_FOUND`; data customer B tidak bocor | NOT EXECUTED (TPR-76) |
| TC-BOOK-19 | AC-03 | Positif | Provider melihat booking masuk miliknya | Booking service A tersedia | `GET /api/bookings/incoming` sebagai `PROVIDER_A` | HTTP `200`; daftar hanya memuat booking dengan `provider_id=PROVIDER_A` | NOT EXECUTED (TPR-76) |
| TC-BOOK-20 | AC-03 | Positif | Provider melihat detail booking terkait jasanya | Booking A terkait service provider A | `GET /api/bookings/<booking-A>` sebagai `PROVIDER_A` | HTTP `200`; detail booking dapat dibaca provider terkait | NOT EXECUTED (TPR-76) |
| TC-BOOK-21 | AC-03 | Security | Provider melihat booking provider lain | Booking B milik `PROVIDER_B` tersedia | Provider A memanggil detail booking B dan daftar incoming | Detail menghasilkan `404 BOOKING_NOT_FOUND`; booking B tidak muncul pada daftar | NOT EXECUTED (TPR-76) |
| TC-BOOK-22 | AC-03 | Security | User tanpa sesi membaca booking | Tidak ada sesi | Panggil `/mine`, `/incoming`, dan `/:id` tanpa autentikasi | Setiap endpoint terlindungi menghasilkan HTTP `401` | NOT EXECUTED (TPR-76) |
| TC-BOOK-23 | AC-03 | Security | Customer mengakses daftar incoming provider | Customer login | `GET /api/bookings/incoming` sebagai `CUSTOMER_A` | HTTP `403`; tidak ada data provider yang dikembalikan | NOT EXECUTED (TPR-76) |
| TC-BOOK-24 | AC-01 | Concurrency | Dua customer memakai slot sama bersamaan | Dua customer login; migration unique active slot sudah diterapkan | Kirim dua `POST /api/bookings` hampir bersamaan dengan provider, tanggal, dan `workTime` identik | Maksimal satu HTTP `201`; request lain HTTP `409 BOOKING_SLOT_UNAVAILABLE`; tidak ada dua booking aktif | NOT EXECUTED (TPR-76) |
| TC-BOOK-25 | AC-01 | Boundary | Idempotency key sama dikirim ulang | Request pertama berhasil; gunakan key `booking-test-001` sesuai kontrak client | Ulangi create dengan customer dan key yang sama | HTTP `409 BOOKING_DUPLICATE`; tidak ada booking duplikat | NOT EXECUTED (TPR-76) |
| TC-BOOK-26 | AC-04 | Positif | Provider menerima booking pending miliknya | Booking service A berstatus pending | `POST /api/bookings/<id>/accept` sebagai `PROVIDER_A` | HTTP `200`; status berubah menjadi `accepted` dan tersimpan | NOT EXECUTED (TPR-76) |
| TC-BOOK-27 | AC-04 | Positif | Provider menolak booking pending miliknya | Booking service A berstatus pending | `POST /api/bookings/<id>/reject` sebagai `PROVIDER_A`, dengan alasan bila didukung route | HTTP `200`; status berubah menjadi `cancelled`; alasan tersimpan bila dikirim | NOT EXECUTED (TPR-76) |
| TC-BOOK-28 | AC-04 | Security | Provider lain memproses booking | Booking terkait provider A; login provider B | Provider B memanggil `accept` dan `reject` untuk booking A | HTTP `404 BOOKING_NOT_FOUND` atau response authorization aktual; status booking A tidak berubah | NOT EXECUTED (TPR-76) |
| TC-BOOK-29 | AC-04 | Security | Customer menerima atau menolak booking | Booking pending tersedia; login customer | Customer memanggil endpoint `accept` dan `reject` | HTTP `403`; status tetap pending | NOT EXECUTED (TPR-76) |
| TC-BOOK-30 | AC-04 | Negatif | Booking accepted/cancelled diproses kembali | Siapkan satu booking accepted dan satu cancelled | Panggil accept/reject pada keduanya | HTTP `409 INVALID_BOOKING_STATUS`; status tidak berubah | NOT EXECUTED (TPR-76) |
| TC-BOOK-31 | AC-04 | Concurrency | Dua aksi status dijalankan bersamaan | Booking pending milik provider A | Kirim accept dan reject bersamaan untuk booking yang sama | Hanya satu transisi berhasil; request lain ditolak karena status conditional berubah | NOT EXECUTED (TPR-76) |
| TC-BOOK-32 | AC-05 | Positif | Customer membatalkan booking pending miliknya | Booking milik customer berstatus pending | `POST /api/bookings/<id>/cancel` sebagai pemilik booking | HTTP `200`; status menjadi `cancelled`; row tetap tersimpan | NOT EXECUTED (TPR-76) |
| TC-BOOK-33 | AC-05 | Negatif | Customer membatalkan booking accepted | Booking milik customer berstatus accepted | Panggil endpoint cancel sebagai customer pemilik | HTTP `409 INVALID_BOOKING_STATUS`; status tetap accepted | NOT EXECUTED (TPR-76) |
| TC-BOOK-34 | AC-05 | Security | Customer membatalkan booking milik customer lain | Booking B milik `CUSTOMER_B` | `CUSTOMER_A` memanggil cancel untuk booking B | HTTP `404 BOOKING_NOT_FOUND` karena RLS/anti-enumeration; booking B tidak berubah | NOT EXECUTED (TPR-76) |
| TC-BOOK-35 | AC-05 | Positif | Booking cancelled tetap menjadi histori | Booking berhasil dibatalkan | Baca `/mine` dan detail booking setelah cancel | Booking tetap tercatat dengan status `cancelled`; tidak hilang dari histori customer | NOT EXECUTED (TPR-76) |

## 3. Ringkasan Rencana Eksekusi (TPR-76)

- **Tanggal eksekusi**: Belum dieksekusi pada TPR-133.
- **File pengujian otomatis**: `backend/src/tests/booking-validation.test.ts` (unit test TPR-75).
- **Perintah test suite dari `backend/package.json`**: `cd backend && npm test`.
- **Perintah unit test booking validation**: `cd backend && npm run build && node --test dist/tests/booking-validation.test.js`.
- **Metode**: unit test Node.js untuk validator; pengujian API/integration dengan sesi customer/provider dan database Supabase untuk TPR-76.
- **Jumlah test case**: 35.
- **Hasil**: Belum dieksekusi oleh TPR-133; menunggu TPR-76.

| Ref AC | Test Case | Hasil Eksekusi |
| :--- | :--- | :--- |
| AC-01 | `TC-BOOK-01`–`TC-BOOK-13`, `TC-BOOK-24`–`TC-BOOK-25` | NOT EXECUTED (TPR-76) |
| AC-02 | `TC-BOOK-14`–`TC-BOOK-15` | NOT EXECUTED (TPR-76) |
| AC-03 | `TC-BOOK-16`–`TC-BOOK-23` | NOT EXECUTED (TPR-76) |
| AC-04 | `TC-BOOK-26`–`TC-BOOK-31` | NOT EXECUTED (TPR-76) |
| AC-05 | `TC-BOOK-32`–`TC-BOOK-35` | NOT EXECUTED (TPR-76) |
| **Total** | **35 test case** | **NOT EXECUTED (TPR-76)** |

Unit test TPR-75 yang sudah tersedia dan pernah menghasilkan 4 test lulus dipisahkan dari eksekusi formal TPR-133. Dokumen ini tidak menyatakan 35 test case sebagai PASS.

## Implementation Gap dan Catatan Aktual

1. Belum ada suite integration test booking khusus; TPR-76 memerlukan fixture autentikasi dan environment database yang menjalankan migration booking.
2. Availability khusus, hari libur, slot custom, kapasitas, dan durasi layanan belum tersedia. Validasi aktual hanya memakai `provider_profiles.operating_hours`.
3. Status `rejected`, `completed`, dan riwayat status terpisah belum ada. Penolakan provider menjadi `cancelled`.
4. Detail booking yang tidak terlihat oleh aktor lain kemungkinan merespons `404 BOOKING_NOT_FOUND` akibat RLS/anti-enumeration, bukan `403`.
5. Unique partial index mencegah slot aktif ganda berdasarkan string `work_time`; overlap berbasis durasi belum didukung.
6. Test case terkait idempotency menggunakan perilaku dan index existing; verifikasi header/request aktual perlu dikonfirmasi kembali oleh TPR-76.

## Batasan Lingkup

Dokumen ini tidak mencakup PBI-14 (catatan atau upload foto kebutuhan booking), recurring booking, Open Service Request, Provider Offer Management, QRIS/payment, transaction history, rating, atau review.
