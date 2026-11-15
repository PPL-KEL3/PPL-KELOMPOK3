# Dokumen Test Case: Pembayaran QRIS (`TPR-21`)

- **PBI Key**: `TPR-21` — QRIS Payment Management
- **Parent**: `TPR-126` — QRIS Payment Management
- **Subtask**:
  - `TPR-105` — Membuat halaman detail dan sesi pembayaran QRIS
  - `TPR-106` — Mengintegrasikan endpoint/API payment gateway
  - `TPR-107` — Membuat alur refresh dan pembatalan sesi
  - `TPR-137` — Menyusun test case pembayaran QRIS
  - `TPR-108` — Menguji alur pembayaran QRIS
- **PIC**: Arsyanova Dewanto
- **Sprint**: TPR Sprint 1
- **Story Point PBI**: 8
- **Priority**: High

---

## Lingkup Modul

### Frontend

- Halaman pembayaran: `frontend/src/app/customer/booking/[id]/payment/page.tsx`
- Komponen pembayaran: `frontend/src/components/customer/booking/BookingPaymentClient.tsx`
- API client: `frontend/src/lib/api.ts` (`bookingApi.createPayment`, `getPayment`, `refreshPayment`, `regeneratePayment`, `cancelPayment`)
- Route halaman: `/customer/booking/[id]/payment`

Halaman menampilkan ringkasan booking, nominal, status sesi, masa berlaku sesi, refresh status, pembuatan ulang sesi expired, dan pembatalan sesi aktif. Implementasi saat ini **tidak menampilkan QRIS yang dapat dipindai** karena tidak ada provider gateway.

### Backend REST API

Route berada di `backend/src/routes/booking.routes.ts`; business logic berada di `backend/src/services/payment.service.ts`.

- `POST /api/bookings/:id/payment`
- `GET /api/bookings/:id/payment`
- `POST /api/bookings/:id/payment/refresh`
- `POST /api/bookings/:id/payment/regenerate`
- `POST /api/bookings/:id/payment/cancel`
- `PATCH /api/payments/:id/mark-paid`

Endpoint customer menggunakan `requireAuth` dan `requireCustomer`. Endpoint `mark-paid` hanya menggunakan `requireAuth` dan `requireAdmin`.

### Database

- Tabel utama: `public.payments`
- Riwayat sesi: `public.payment_session_events`
- Migration dasar: `supabase/migrations/20261123000000_local_payments.sql`
- Migration lifecycle sesi: `supabase/migrations/20261124000000_local_payment_sessions.sql`

Kolom lifecycle yang digunakan adalah `status` (`unpaid`/`paid`), `session_status` (`active`/`expired`/`cancelled`/`completed`), `amount`, `expires_at`, `cancelled_at`, `session_version`, dan `paid_at`.

### Gap Implementasi yang Harus Diketahui

1. Repository tidak menetapkan provider payment gateway.
2. Tidak ada external payment ID, QR payload/image URL, payment reference gateway, callback, webhook, atau signature verification.
3. Tidak ada status gateway `pending`, `failed`, atau `processing`; status lokal yang tersedia hanya `unpaid`/`paid` serta status sesi.
4. Status `paid` ditetapkan melalui endpoint admin lokal, bukan konfirmasi gateway terverifikasi.
5. Booking yang dianggap memenuhi syarat oleh service saat ini adalah booking dengan status `accepted`; status pekerjaan selesai dan konfirmasi customer belum tersedia.
6. Masa berlaku sesi lokal ditetapkan 30 menit dari server, bukan dari payment gateway.

---

## 1. Pemetaan Acceptance Criteria (`TPR-21`)

| Kode AC | Pernyataan Acceptance Criteria | Cakupan Test Case |
| :--- | :--- | :--- |
| AC-01 | Pelanggan dapat memulai pembayaran QRIS untuk booking yang memenuhi syarat. | `TC-PAY-01`–`TC-PAY-05`, `TC-PAY-21` |
| AC-02 | Sistem menampilkan kode QR dan status pembayaran. | `TC-PAY-06`–`TC-PAY-07`, `TC-PAY-25`; QR nyata belum dapat diverifikasi karena belum tersedia |
| AC-03 | Sesi pembayaran yang belum lunas dapat diperbarui/dibuat ulang sesuai status gateway. | `TC-PAY-14`–`TC-PAY-16`, `TC-PAY-23`; implementasi memakai status sesi lokal |
| AC-04 | Pelanggan dapat membatalkan sesi yang belum dibayar; pembayaran yang sudah berhasil tidak dapat dihapus. | `TC-PAY-18`–`TC-PAY-20`, `TC-PAY-23` |
| AC-05 | Status lunas hanya ditetapkan setelah ada konfirmasi terverifikasi dari payment gateway. | `TC-PAY-08`, `TC-PAY-09`–`TC-PAY-13`; gateway belum tersedia, sehingga AC ini belum terpenuhi secara penuh |

---

## 2. Daftar Skenario dan Data Uji (`TC-PAY-01` s.d. `TC-PAY-25`)

### Data Uji Umum

- `CUSTOMER_A`: customer dummy terautentikasi dan pemilik `BOOKING_ACCEPTED`.
- `CUSTOMER_B`: customer dummy lain yang tidak memiliki `BOOKING_ACCEPTED`.
- `ADMIN_A`: akun dummy dengan role `admin` untuk endpoint penandaan status lokal.
- `PROVIDER_A`: provider dummy pemilik layanan pada booking.
- `BOOKING_ACCEPTED`: UUID dummy valid, milik `CUSTOMER_A`, status booking `accepted`.
- `BOOKING_PENDING`: UUID dummy valid, milik `CUSTOMER_A`, status `pending_provider_confirmation`.
- `BOOKING_CANCELLED`: UUID dummy valid, milik `CUSTOMER_A`, status `cancelled`.
- `PAYMENT_A`: payment dummy untuk `BOOKING_ACCEPTED`, amount `150000`, payment method `qris`.
- `PAYMENT_PAID`: payment dummy dengan `status=paid` dan `session_status=completed`.
- `PAYMENT_EXPIRED`: payment dummy dengan `status=unpaid`, `session_status=expired`.
- `PAYMENT_CANCELLED`: payment dummy dengan `status=unpaid`, `session_status=cancelled`.
- Semua UUID, nominal, akun, dan timestamp pada dokumen ini adalah data dummy.
- Migration `20261123000000_local_payments.sql` dan `20261124000000_local_payment_sessions.sql` harus sudah diterapkan.

| ID Test Case | Ref AC | Jenis Uji | Skenario Pengujian | Prasyarat | Langkah Pengujian & Data Uji | Hasil yang Diharapkan | Status (TPR-108) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-PAY-01** | AC-01 | Positif | Customer membuat pembayaran untuk booking accepted | `CUSTOMER_A` login; `BOOKING_ACCEPTED` milik customer; belum ada payment | Kirim `POST /api/bookings/<BOOKING_ACCEPTED>/payment` sebagai `CUSTOMER_A` | HTTP `201`; payment dibuat dengan `amount` sama dengan `booking.price`, `status=unpaid`, `session_status=active`, `payment_method=qris`, dan `session_version=1` | NOT EXECUTED (TPR-108) |
| **TC-PAY-02** | AC-01 | Negatif | Menolak pembayaran untuk booking yang masih pending | `BOOKING_PENDING` berstatus `pending_provider_confirmation` | Kirim `POST /api/bookings/<BOOKING_PENDING>/payment` sebagai `CUSTOMER_A` | HTTP `409 PAYMENT_NOT_ELIGIBLE`; tidak ada row payment baru | NOT EXECUTED (TPR-108) |
| **TC-PAY-03** | AC-01 | Negatif | Menolak pembayaran untuk booking cancelled | `BOOKING_CANCELLED` berstatus `cancelled` | Kirim `POST /api/bookings/<BOOKING_CANCELLED>/payment` sebagai pemilik | HTTP `409 PAYMENT_NOT_ELIGIBLE`; tidak ada sesi pembayaran aktif | NOT EXECUTED (TPR-108) |
| **TC-PAY-04** | AC-01 | Security | Customer mengakses pembayaran booking customer lain | `BOOKING_ACCEPTED` milik `CUSTOMER_B`; login `CUSTOMER_A` | Panggil `POST` dan `GET /api/bookings/<booking-B>/payment` sebagai `CUSTOMER_A` | HTTP `403 PAYMENT_OWNERSHIP_FORBIDDEN`; data payment customer B tidak dikembalikan | NOT EXECUTED (TPR-108) |
| **TC-PAY-05** | AC-01 | Negatif | Meminta pembayaran ulang untuk payment yang sudah ada | `BOOKING_ACCEPTED` sudah memiliki `PAYMENT_A` | Kirim `POST /api/bookings/<BOOKING_ACCEPTED>/payment` dua kali sebagai `CUSTOMER_A` | Tidak ada row duplikat karena `booking_id` unik; response mengembalikan payment yang sama | NOT EXECUTED (TPR-108) |
| **TC-PAY-06** | AC-02 | Positif | Menampilkan nominal dan status sesi lokal | `PAYMENT_A` tersedia dengan amount `150000` | Panggil `GET /api/bookings/<BOOKING_ACCEPTED>/payment`; buka halaman pembayaran | HTTP `200`; response memuat `amount=150000`, `status=unpaid`, `sessionStatus=active`, `expiresAt`, dan `sessionVersion`; UI menampilkan nominal dan status belum dibayar | NOT EXECUTED (TPR-108) |
| **TC-PAY-07** | AC-02 | Gap/Integration | Memeriksa tampilan QRIS dari gateway | Payment gateway dan QR payload tersedia | Periksa response payment dan halaman pembayaran | Saat ini tidak ada field QR/image/payload dan UI secara eksplisit menyatakan tidak ada QR yang dapat dipindai; test gateway belum dapat diverifikasi | NOT EXECUTED (TPR-108) |
| **TC-PAY-08** | AC-05 | Positif Lokal | Admin menandai payment aktif sebagai paid | `ADMIN_A` login; `PAYMENT_A` active dan belum expired | Kirim `PATCH /api/payments/<PAYMENT_A>/mark-paid` sebagai `ADMIN_A` | HTTP `200`; `status=paid`, `sessionStatus=completed`, `paidAt` terisi; event `completed` tercatat | NOT EXECUTED (TPR-108) |
| **TC-PAY-09** | AC-05 | Security | Customer mencoba menandai payment sebagai paid | `CUSTOMER_A` login; payment unpaid | Kirim `PATCH /api/payments/<PAYMENT_A>/mark-paid` sebagai customer | HTTP `403 FORBIDDEN`; status tetap `unpaid`; customer tidak dapat mengubah status melalui frontend | NOT EXECUTED (TPR-108) |
| **TC-PAY-10** | AC-05 | Gap/Integration | Webhook dengan signature tidak valid | Tidak ada endpoint webhook pada repository | Cari dan panggil endpoint callback sesuai rancangan provider | Tidak ada webhook yang dapat diuji saat ini; skenario dicatat sebagai gap TPR-106 dan tidak boleh dianggap PASS | NOT EXECUTED (TPR-108) |
| **TC-PAY-11** | AC-05 | Security/Gap | Notifikasi dengan nominal berbeda | Tidak ada webhook atau provider | Siapkan payload gateway dummy dengan nominal berbeda | Belum ada handler gateway untuk memvalidasi mismatch; implementasi lokal tidak menerima nominal dari frontend, tetapi verifikasi gateway belum tersedia | NOT EXECUTED (TPR-108) |
| **TC-PAY-12** | AC-05 | Integration/Gap | Webhook pembayaran dikirim berulang | Tidak ada webhook; payment lokal memakai satu row per booking | Kirim event gateway yang sama dua kali jika provider sudah diputuskan | Belum dapat diuji sebagai webhook; pada implementasi lokal, penandaan paid idempotent karena payment yang sudah paid dikembalikan tanpa membuat row baru | NOT EXECUTED (TPR-108) |
| **TC-PAY-13** | AC-05 | Security | Status sukses dikirim langsung dari frontend | `CUSTOMER_A` login | Tambahkan `status=paid` pada body request create/refresh atau ubah request browser | Field body tidak digunakan untuk menentukan paid; endpoint penandaan paid membutuhkan role admin; status customer tetap tidak dapat diubah | NOT EXECUTED (TPR-108) |
| **TC-PAY-14** | AC-03 | Boundary | Sesi active melewati expiration time | `PAYMENT_A` active dengan `expiresAt` 30 menit sejak dibuat | Tunggu melewati waktu server atau siapkan data dummy dengan `expires_at` lampau, lalu panggil `POST /api/bookings/<id>/payment/refresh` | HTTP `200`; sesi berubah menjadi `sessionStatus=expired`; event `expired` tercatat; sesi tidak lagi aktif | NOT EXECUTED (TPR-108) |
| **TC-PAY-15** | AC-03 | Positif | Membuat ulang sesi expired | `PAYMENT_EXPIRED` milik `CUSTOMER_A`; booking masih `accepted` | Kirim `POST /api/bookings/<id>/payment/regenerate` | HTTP `201`; `sessionStatus=active`, `status=unpaid`, `sessionVersion` bertambah, `expiresAt` baru sekitar 30 menit; event `regenerated` tercatat | NOT EXECUTED (TPR-108) |
| **TC-PAY-16** | AC-03 | Negatif | Menolak regenerate saat sesi masih active | `PAYMENT_A` active dan belum expired | Kirim `POST /api/bookings/<id>/payment/regenerate` | HTTP `409 PAYMENT_SESSION_ACTIVE`; tidak ada versi sesi baru | NOT EXECUTED (TPR-108) |
| **TC-PAY-17** | AC-03 | Security | Menolak regenerate untuk payment paid | `PAYMENT_PAID` tersedia | Kirim `POST /api/bookings/<id>/payment/regenerate` sebagai pemilik | HTTP `409 PAYMENT_ALREADY_PAID`; status tetap `paid/completed`; riwayat tidak dihapus | NOT EXECUTED (TPR-108) |
| **TC-PAY-18** | AC-04 | Positif | Customer membatalkan sesi active yang belum dibayar | `PAYMENT_A` active dan `status=unpaid` | Kirim `POST /api/bookings/<id>/payment/cancel` sebagai `CUSTOMER_A`, setelah konfirmasi UI | HTTP `200`; `sessionStatus=cancelled`, `cancelledAt` terisi, status tetap `unpaid`; event `cancelled` tercatat | NOT EXECUTED (TPR-108) |
| **TC-PAY-19** | AC-04 | Security | Menolak pembatalan payment paid | `PAYMENT_PAID` tersedia | Kirim endpoint cancel sebagai customer pemilik | HTTP `409 PAYMENT_ALREADY_PAID`; payment tetap `paid/completed`; bukti payment tidak dihapus | NOT EXECUTED (TPR-108) |
| **TC-PAY-20** | AC-04 | Positif | Riwayat sesi tetap ada setelah expired/regenerate/cancel | Payment pernah mengalami event `created`, `expired`, `regenerated`, atau `cancelled` | Query `public.payment_session_events` sebagai pemilik payment atau admin | Event tetap tersimpan; row payment tidak dihapus; urutan dapat ditelusuri dengan `created_at` dan `session_version` | NOT EXECUTED (TPR-108) |
| **TC-PAY-21** | AC-01 | Security | User tanpa sesi mengakses seluruh endpoint payment customer | Tidak ada cookie sesi | Panggil create, get, refresh, regenerate, dan cancel tanpa autentikasi | Semua endpoint menghasilkan HTTP `401 NO_SESSION`; tidak ada data payment yang bocor | NOT EXECUTED (TPR-108) |
| **TC-PAY-22** | AC-01/04 | Security | Provider atau customer lain mencoba mengelola payment | Login sebagai `PROVIDER_A` atau `CUSTOMER_B` yang bukan pemilik | Panggil endpoint payment untuk `BOOKING_ACCEPTED` milik `CUSTOMER_A` | Role/provider tidak dapat memakai route customer; customer lain menerima penolakan ownership; payment tidak berubah | NOT EXECUTED (TPR-108) |
| **TC-PAY-23** | AC-03/04 | Negatif | Menolak cancel pada sesi expired atau cancelled | Siapkan `PAYMENT_EXPIRED` dan `PAYMENT_CANCELLED` | Panggil endpoint cancel untuk masing-masing payment | HTTP `409 PAYMENT_SESSION_NOT_CANCELLABLE`; status tetap; tidak ada event cancel tambahan yang salah | NOT EXECUTED (TPR-108) |
| **TC-PAY-24** | AC-05 | Negatif/Boundary | Admin tidak dapat menandai sesi expired atau cancelled sebagai paid | Payment berstatus unpaid tetapi `sessionStatus=expired/cancelled` | Admin memanggil `PATCH /api/payments/<id>/mark-paid` | HTTP `409 PAYMENT_SESSION_INACTIVE`; status tetap unpaid; tidak ada event completed | NOT EXECUTED (TPR-108) |
| **TC-PAY-25** | AC-02/03/04 | Positif UI | Halaman pembayaran menampilkan aksi sesuai status sesi | Buka halaman dengan fixture active, expired, cancelled, dan paid | Periksa `/customer/booking/<id>/payment` untuk setiap fixture; klik refresh, buat sesi baru, atau cancel sesuai kondisi | Active menampilkan refresh/cancel; expired menampilkan buat sesi baru; cancelled tidak menampilkan aksi aktif; paid tidak menampilkan regenerate/cancel; tidak ada QR palsu | NOT EXECUTED (TPR-108) |

---

## 3. Matriks Cakupan Pengujian

| Ref AC | Test Case | Kategori |
| :--- | :--- | :--- |
| AC-01 | `TC-PAY-01`–`TC-PAY-05`, `TC-PAY-21`–`TC-PAY-22` | Positif, negatif, security |
| AC-02 | `TC-PAY-06`–`TC-PAY-07`, `TC-PAY-25` | Positif UI, integration gap |
| AC-03 | `TC-PAY-14`–`TC-PAY-17`, `TC-PAY-23` | Boundary, positif, negatif, security |
| AC-04 | `TC-PAY-18`–`TC-PAY-20`, `TC-PAY-23`, `TC-PAY-25` | Positif, negatif, security, UI |
| AC-05 | `TC-PAY-08`–`TC-PAY-13`, `TC-PAY-17`, `TC-PAY-19`, `TC-PAY-24` | Security, integration gap, idempotency |

Seluruh AC memiliki cakupan test case. AC-02 dan AC-05 belum dapat dinyatakan terpenuhi penuh karena QRIS gateway dan webhook terverifikasi belum tersedia.

### Ringkasan Kategori

- **Total**: 25 test case.
- **Positif**: 7 skenario berlabel positif, termasuk create, tampilan status, penandaan lokal, regenerate, cancel, histori, dan UI.
- **Negatif**: 6 skenario berlabel negatif; `TC-PAY-24` juga merupakan negatif sekaligus boundary.
- **Boundary**: 2 skenario eksplisit (`TC-PAY-14`, `TC-PAY-24`); expiration juga diuji pada `TC-PAY-23`.
- **Security**: 7 skenario berlabel security, ditambah overlap `TC-PAY-11` dan `TC-PAY-24`.
- **Integration/gap**: 4 skenario terkait QR dan webhook (`TC-PAY-07`, `TC-PAY-10`, `TC-PAY-11`, `TC-PAY-12`).

Kategori dapat tumpang tindih karena satu test case dapat menguji lebih dari satu aspek.

---

## 4. Catatan Pelaksanaan Pengujian

- Dokumen ini disiapkan untuk pelaksanaan `TPR-108`.
- Seluruh test case berstatus `NOT EXECUTED (TPR-108)`.
- Pengujian lokal dapat menggunakan fixture/database test tanpa transaksi sungguhan.
- Tidak ada credential payment gateway atau data pribadi di dokumen ini.
- Pengujian QR gateway, webhook, signature, external reference, dan status gateway menunggu keputusan provider serta implementasi TPR-106 yang nyata.
- Hasil aktual, tanggal eksekusi, dan bukti screenshot/log harus diisi oleh pelaksana TPR-108 setelah pengujian benar-benar dilakukan.

### Prioritas Eksekusi TPR-108

1. `TC-PAY-01`, `TC-PAY-02`, dan `TC-PAY-04` untuk validasi eligibility dan ownership.
2. `TC-PAY-06`, `TC-PAY-14`, `TC-PAY-15`, dan `TC-PAY-16` untuk lifecycle sesi.
3. `TC-PAY-18`, `TC-PAY-19`, `TC-PAY-20`, dan `TC-PAY-24` untuk integritas pembatalan dan paid.
4. `TC-PAY-21`, `TC-PAY-22`, dan `TC-PAY-25` untuk security dan UI.
5. `TC-PAY-07`, `TC-PAY-10`, `TC-PAY-11`, dan `TC-PAY-12` hanya setelah provider gateway dan kontraknya tersedia.

---

## 5. Catatan Khusus

1. Pembayaran lokal hanya dapat dibuat untuk booking dengan status `accepted` pada implementasi saat ini.
2. Status `paid` tidak boleh ditentukan dari body frontend customer.
3. Endpoint `mark-paid` adalah mekanisme admin lokal dan **bukan** konfirmasi payment gateway.
4. Pembayaran yang sudah `paid/completed` tidak dapat dibatalkan, dibuat ulang, atau dihapus.
5. Sesi expired dapat dibuat ulang jika booking masih eligible dan payment belum lunas.
6. Sesi active tidak boleh dibuat ulang untuk mencegah sesi ganda.
7. Pembatalan sesi tidak menghapus row payment maupun event histori.
8. Tidak ada QRIS nyata yang boleh dianggap dapat dipindai sampai provider dan API gateway ditentukan.
9. Status booking `completed`, konfirmasi pekerjaan customer, dan status gateway belum tersedia; skenario yang membutuhkan ketiganya dicatat sebagai gap, bukan PASS.
10. TPR-108 harus memisahkan hasil pengujian lokal/mocked dari pengujian sandbox gateway.

---

## Batasan Lingkup

Dokumen ini hanya mencakup penyusunan test case TPR-137. Dokumen tidak mengubah kode, tidak membuat transaksi, tidak menjalankan pengujian end-to-end, dan tidak menyatakan integrasi gateway telah berhasil.
