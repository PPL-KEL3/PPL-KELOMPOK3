# Dokumen Test Case Pengelolaan Verifikasi Pembayaran (`TPR-22`)

- **Dokumen**: Test Case Pengelolaan Verifikasi Pembayaran
- **PBI Key**: `TPR-22` — Payment Verification Management
- **Parent**: `TPR-126` — Payment & Transaction
- **Subtask**: `TPR-138` — Menyusun test case verifikasi dan penanganan pembayaran
- **PIC**: Geraldo Amarullah Herianto
- **Sprint**: TPR Sprint 1
- **Priority**: High
- **Story Point PBI**: 8

Dokumen ini menyusun skenario pengujian untuk Admin dalam memeriksa kasus pengecualian pembayaran, mencatat keputusan, memperbarui status kasus, menutup kasus, menandai kasus duplikat, dan menelusuri audit log. Status pembayaran tetap merupakan entitas terpisah; keputusan pemeriksaan tidak boleh mengubah payment menjadi `paid`.

---

## Ringkasan Implementasi Aktual

### Frontend TPR-109

Halaman tersedia pada:

```text
/admin/payments/verification
```

Komponen:

```text
frontend/src/components/admin/payments/PaymentVerificationQueueClient.tsx
```

Saat ini halaman menggunakan `DashboardShell` dan `RoleGate` Admin, tetapi belum mengambil data kasus dari API. Halaman menampilkan dependency state `Menunggu TPR-110` dan tidak menggunakan data pembayaran dummy. Search, filter, pagination, tabel kasus, dan detail kasus belum dapat diuji melalui UI karena belum terhubung ke endpoint.

### Backend TPR-110

Route berada pada `backend/src/routes/payment-verification.routes.ts` dan service pada `backend/src/services/payment-verification.service.ts`.

Endpoint aktual:

| Method | Endpoint | Fungsi | Akses |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/payment-verifications` | Daftar kasus, pagination, search, filter status dan jenis kasus | Admin |
| `POST` | `/api/admin/payment-verifications` | Membuat kasus verifikasi | Admin |
| `GET` | `/api/admin/payment-verifications/:caseId` | Detail kasus | Admin |
| `PATCH` | `/api/admin/payment-verifications/:caseId` | Memperbarui status, catatan, atau admin penanggung jawab | Admin |
| `POST` | `/api/admin/payment-verifications/:caseId/close` | Menutup kasus `resolved` atau `duplicate` | Admin |
| `POST` | `/api/admin/payment-verifications/:caseId/mark-duplicate` | Menandai kasus sebagai duplikat | Admin |

Payload aktual yang relevan:

```json
{
  "paymentId": "<PAYMENT_UUID>",
  "issueType": "amount_mismatch",
  "description": "Nominal payment perlu diperiksa.",
  "assignedAdminId": "<ADMIN_UUID>"
}
```

Jenis kasus aktual:

```text
amount_mismatch
gateway_status_mismatch
payment_confirmation_problem
suspected_duplicate
payment_session_problem
other
```

Status kasus aktual:

```text
open
in_progress
resolved
duplicate
closed
```

Transisi yang diizinkan:

- `open` → `in_progress`, `resolved`, `duplicate`
- `in_progress` → `resolved`, `duplicate`
- `resolved` → `closed`
- `duplicate` → `closed`
- `closed` tidak dapat diubah.

### Database TPR-110/TPR-111

- `public.payment_verification_cases`: data utama kasus.
- `public.payment_verification_case_events`: histori audit kasus.
- `public.payments`: payment yang dirujuk oleh kasus.
- `public.bookings`: booking yang dirujuk melalui payment.
- Migration kasus: `supabase/migrations/20261125000000_payment_verification_cases.sql`.
- Migration audit: `supabase/migrations/20261126000000_payment_verification_audit_atomicity.sql`.

Audit dicatat oleh trigger database pada insert/update kasus. Audit bersifat append-only untuk client authenticated: dapat dibaca Admin, tetapi tidak dapat diubah atau dihapus melalui akses biasa.

### Automated Test Aktual

File:

```text
backend/src/tests/payment-verification-validation.test.ts
```

Perintah:

```bash
cd backend
npm run test:tpr111
```

Test tersebut hanya memeriksa transisi status dan validasi catatan secara unit test. Test tersebut bukan eksekusi seluruh skenario TPR-138/TPR-112.

---

## 1. Pemetaan Acceptance Criteria (`TPR-22`)

| Kode AC | Pernyataan Acceptance Criteria | Cakupan Test Case |
| :--- | :--- | :--- |
| **AC-01** | Admin dapat melihat pembayaran yang membutuhkan pemeriksaan. | `TC-PAYVER-01`–`TC-PAYVER-04`, `TC-PAYVER-20`–`TC-PAYVER-23` |
| **AC-02** | Admin dapat membuka atau mencatat kasus ketidaksesuaian pembayaran. | `TC-PAYVER-02`, `TC-PAYVER-05`–`TC-PAYVER-08` |
| **AC-03** | Admin dapat memperbarui status pemeriksaan dan menambahkan catatan keputusan. | `TC-PAYVER-09`–`TC-PAYVER-14` |
| **AC-04** | Kasus yang selesai dapat ditutup; kasus duplikat ditandai tanpa menghapus data transaksi/log. | `TC-PAYVER-15`–`TC-PAYVER-19`, `TC-PAYVER-29`–`TC-PAYVER-30` |
| **AC-05** | Perubahan status harus tercatat agar dapat ditelusuri. | `TC-PAYVER-25`–`TC-PAYVER-31` |

---

## 2. Daftar Skenario dan Data Uji

### Data Uji Umum

- `ADMIN_A`: akun dummy dengan role `admin` dan sesi valid.
- `ADMIN_B`: akun dummy Admin lain jika diperlukan untuk pengujian aktor.
- `CUSTOMER_A`: akun dummy customer tanpa hak akses Admin.
- `PROVIDER_A`: akun dummy provider tanpa hak akses Admin.
- `PAYMENT_A`: UUID payment dummy yang ada pada `public.payments` dan memiliki `booking_id` valid.
- `PAYMENT_NOT_FOUND`: UUID valid yang tidak terdapat pada `public.payments`.
- `CASE_A`: kasus dummy berstatus `open` milik `PAYMENT_A`.
- `CASE_IN_PROGRESS`: kasus dummy berstatus `in_progress`.
- `CASE_RESOLVED`: kasus dummy berstatus `resolved`.
- `CASE_DUPLICATE`: kasus dummy berstatus `duplicate` dengan `duplicate_of_case_id` valid.
- `CASE_CLOSED`: kasus dummy berstatus `closed`.
- Nominal contoh `150000` adalah data dummy, bukan transaksi nyata.
- Seluruh UUID, nama, catatan, dan timestamp dalam dokumen ini adalah data uji.

### Tabel Skenario

| ID Test Case | Ref AC | Jenis Uji | Skenario Pengujian | Prasyarat | Langkah Pengujian & Data Uji | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-PAYVER-01** | AC-01 | Positif | Admin melihat daftar kasus pengecualian | `ADMIN_A` login; terdapat beberapa kasus | `GET /api/admin/payment-verifications` sebagai `ADMIN_A` | HTTP `200`; response memuat `cases` dan `pagination`; kasus berasal dari database, bukan data dummy frontend | NOT RUN (TPR-112) |
| **TC-PAYVER-02** | AC-01/02 | Positif | Admin melihat detail kasus | `CASE_A` tersedia | `GET /api/admin/payment-verifications/<CASE_A>` | HTTP `200`; ID kasus, payment ID, booking ID, issue type, deskripsi, status, catatan, dan data payment yang tersedia dikembalikan | NOT RUN (TPR-112) |
| **TC-PAYVER-03** | AC-01 | Positif | Daftar kasus kosong | Admin login; tidak ada row kasus yang cocok | Panggil endpoint daftar tanpa filter | HTTP `200`; `cases=[]`, pagination tetap valid; frontend menampilkan empty state, bukan error | NOT RUN (TPR-112) |
| **TC-PAYVER-04** | AC-01 | Positif | Search dan filter kasus | Terdapat kasus dengan status dan issue type berbeda | Uji `search`, `status=open`, `status=in_progress`, dan `issueType=amount_mismatch` pada query endpoint | Hasil hanya memuat kasus yang sesuai; nilai status/issue type tidak valid ditolak dengan error validasi | NOT RUN (TPR-112) |
| **TC-PAYVER-05** | AC-02 | Positif | Admin mencatat kasus payment bermasalah | `PAYMENT_A` tersedia; Admin login | `POST /api/admin/payment-verifications` dengan `paymentId=PAYMENT_A`, issue type `amount_mismatch`, dan deskripsi valid | HTTP `201`; kasus dibuat dengan status awal `open`, terhubung ke payment dan booking yang benar | NOT RUN (TPR-112) |
| **TC-PAYVER-06** | AC-02 | Negatif | Mencatat kasus dengan payment tidak ditemukan | `PAYMENT_NOT_FOUND` tidak ada | POST payload dengan payment ID tersebut | HTTP `404 PAYMENT_NOT_FOUND`; tidak ada kasus baru | NOT RUN (TPR-112) |
| **TC-PAYVER-07** | AC-02 | Negatif | Menolak issue type atau deskripsi tidak valid | Admin login | Uji issue type di luar enum dan deskripsi kosong/lebih dari 2.000 karakter | HTTP `400`; kasus tidak dibuat; status database tidak berubah | NOT RUN (TPR-112) |
| **TC-PAYVER-08** | AC-02 | Negatif | Pembuatan kasus berulang untuk payment yang sama | `PAYMENT_A` sudah memiliki satu atau beberapa kasus | Kirim POST kasus yang sama dua kali | Sistem mengikuti model aktual yang mengizinkan relasi payment-ke-banyak-kasus; tidak mengasumsikan unique case jika database tidak menerapkannya. Duplikasi harus ditangani melalui `suspected_duplicate` dan bukan penghapusan data | NOT RUN (TPR-112) |
| **TC-PAYVER-09** | AC-03 | Positif | Admin memulai pemeriksaan kasus | `CASE_A` berstatus `open` | `PATCH /api/admin/payment-verifications/<CASE_A>` dengan `status=in_progress` dan catatan keputusan valid | HTTP `200`; status menjadi `in_progress`; catatan tersimpan; audit perubahan tercatat | NOT RUN (TPR-112) |
| **TC-PAYVER-10** | AC-03 | Positif | Admin menambahkan catatan keputusan | Kasus belum closed; catatan baru valid | PATCH dengan `decisionNotes` valid, tanpa mengubah status jika diperbolehkan | HTTP `200`; catatan terbaru tersimpan; perubahan catatan tercatat sebagai event audit | NOT RUN (TPR-112) |
| **TC-PAYVER-11** | AC-03 | Positif | Admin memperbarui status secara valid | `CASE_IN_PROGRESS` tersedia | PATCH `status=resolved` dan `decisionNotes` valid | HTTP `200`; status menjadi `resolved`; payment status tidak berubah; audit mencatat perubahan | NOT RUN (TPR-112) |
| **TC-PAYVER-12** | AC-03 | Negatif | Menolak transisi status tidak valid | Kasus `open` atau `closed` tersedia | Uji `closed → open`, `open → closed` melalui PATCH, atau `duplicate → resolved` | HTTP `409 INVALID_VERIFICATION_STATUS_TRANSITION` atau `400 USE_CLOSE_ENDPOINT` sesuai aturan aktual; kasus tidak berubah | NOT RUN (TPR-112) |
| **TC-PAYVER-13** | AC-03 | Negatif | Menolak perubahan status tanpa catatan keputusan | `CASE_A` berstatus `open` | PATCH status `in_progress` tanpa `decisionNotes` | HTTP `400 DECISION_NOTE_REQUIRED`; status tidak berubah dan tidak ada audit perubahan palsu | NOT RUN (TPR-112) |
| **TC-PAYVER-14** | AC-03 | Negatif | Menolak catatan kosong atau whitespace | Kasus belum closed | PATCH dengan `decisionNotes="   "` atau catatan melebihi 2.000 karakter | HTTP `400 VALIDATION_ERROR`; catatan dan status lama tetap tersimpan | NOT RUN (TPR-112) |
| **TC-PAYVER-15** | AC-04 | Positif | Admin menutup kasus resolved | `CASE_RESOLVED` tersedia | `POST /api/admin/payment-verifications/<CASE_RESOLVED>/close` dengan note valid | HTTP `200`; status menjadi `closed`, `closedAt` terisi, catatan tersimpan, audit close tercatat | NOT RUN (TPR-112) |
| **TC-PAYVER-16** | AC-04 | Negatif | Menolak penutupan kasus yang belum siap | `CASE_A` berstatus `open` atau `in_progress` | Panggil endpoint close dengan catatan valid | HTTP `409 VERIFICATION_CASE_NOT_READY_TO_CLOSE`; kasus tidak berubah | NOT RUN (TPR-112) |
| **TC-PAYVER-17** | AC-04 | Positif | Admin menandai kasus sebagai duplikat | `CASE_A` dan kasus utama valid; kasus utama bukan duplicate | POST `/mark-duplicate` dengan `duplicateOfCaseId` kasus utama dan note valid | HTTP `200`; status menjadi `duplicate`, referensi kasus utama tersimpan, audit tercatat | NOT RUN (TPR-112) |
| **TC-PAYVER-18** | AC-04 | Negatif | Menolak kasus menandai dirinya sendiri | `CASE_A` tersedia | POST `/mark-duplicate` dengan `duplicateOfCaseId=CASE_A` | HTTP `400 DUPLICATE_CASE_SELF_REFERENCE`; kasus tetap pada status sebelumnya | NOT RUN (TPR-112) |
| **TC-PAYVER-19** | AC-04 | Positif | Transaksi tetap tersimpan setelah close/duplicate | Payment, booking, dan gateway/session data tersedia | Tutup atau tandai kasus duplicate, lalu baca payment, booking, dan case events | Data payment, booking, kasus, dan histori tetap tersedia; tidak ada hard delete | NOT RUN (TPR-112) |
| **TC-PAYVER-20** | AC-01 | Security | Admin dapat mengakses fitur verifikasi | `ADMIN_A` login dengan sesi valid | Akses halaman `/admin/payments/verification` dan seluruh endpoint Admin | Halaman dan API dapat diakses; data hanya berasal dari response backend | NOT RUN (TPR-112) |
| **TC-PAYVER-21** | AC-01/02 | Security | Customer tidak dapat mengelola kasus | Login sebagai `CUSTOMER_A` | Panggil GET, POST, PATCH, close, dan mark-duplicate endpoint Admin | HTTP `403 FORBIDDEN`; tidak ada data kasus atau perubahan yang diberikan | NOT RUN (TPR-112) |
| **TC-PAYVER-22** | AC-01/02 | Security | Provider tidak dapat mengelola kasus | Login sebagai `PROVIDER_A` | Panggil endpoint Admin seperti pada TC-PAYVER-21 | HTTP `403 FORBIDDEN`; kasus tidak berubah | NOT RUN (TPR-112) |
| **TC-PAYVER-23** | AC-01/02 | Security | Pengguna tanpa sesi ditolak | Tidak ada cookie/token sesi | Panggil endpoint daftar, detail, create, update, close, dan duplicate | HTTP `401 NO_SESSION`; tidak ada data kasus yang bocor | NOT RUN (TPR-112) |
| **TC-PAYVER-24** | AC-03/04 | Security | Payload dan identitas aktor tidak dapat dimanipulasi | `ADMIN_A` login | Kirim `adminId` palsu, case ID bukan UUID, field status/payment yang tidak diizinkan, atau ID kasus milik request lain | Admin ID diambil dari sesi, ID invalid ditolak, field yang tidak didukung tidak mengubah data, dan akses tetap dibatasi middleware Admin | NOT RUN (TPR-112) |
| **TC-PAYVER-25** | AC-05 | Positif | Perubahan status menghasilkan audit log | `CASE_A` tersedia; audit migration sudah diterapkan | Ubah `open → in_progress`, lalu baca `payment_verification_case_events` sebagai Admin | Event `status_changed` tersimpan dengan case ID, actor Admin, previous status, new status, note, dan timestamp | NOT RUN (TPR-112) |
| **TC-PAYVER-26** | AC-05 | Positif | Audit log menyimpan Admin dan timestamp sistem | Admin melakukan keputusan | Periksa event setelah PATCH/close/duplicate | `actor_admin_id` sesuai sesi Admin; `created_at` dibuat database, bukan nilai bebas dari request | NOT RUN (TPR-112) |
| **TC-PAYVER-27** | AC-05 | Positif | Audit log menyimpan status sebelum dan sesudah | Kasus memiliki transisi valid | Periksa event setelah transisi | `from_status` dan `to_status` sesuai perubahan aktual; tidak mencatat status palsu | NOT RUN (TPR-112) |
| **TC-PAYVER-28** | AC-05 | Positif | Audit log menyimpan alasan keputusan | PATCH/close/duplicate dengan catatan valid | Baca event audit setelah tindakan | Field `note` memuat catatan keputusan yang relevan; secret/token tidak masuk log | NOT RUN (TPR-112) |
| **TC-PAYVER-29** | AC-05 | Positif | Histori tidak terhapus setelah kasus ditutup | Kasus memiliki beberapa event dan siap ditutup | Tutup kasus lalu query histori | Semua event lama tetap tersedia; status kasus hanya menjadi `closed` | NOT RUN (TPR-112) |
| **TC-PAYVER-30** | AC-05 | Positif | Histori kasus duplikat tetap tersimpan | Kasus dapat ditandai duplicate | Tandai duplicate lalu query case dan events | Kasus dan event `marked_duplicate` tetap tersimpan; payment dan booking tidak dihapus | NOT RUN (TPR-112) |
| **TC-PAYVER-31** | AC-05 | Integration | Kegagalan audit tidak meninggalkan status tanpa histori | Gunakan database test/mock yang dapat mensimulasikan kegagalan trigger/audit | Jalankan update kasus saat insert audit gagal | Operasi transaksi gagal/rollback sesuai mekanisme database; tidak boleh ada status baru tanpa event audit | NOT RUN (TPR-112) |
| **TC-PAYVER-32** | AC-03/AC-05 | Security | Perubahan status kasus tidak mengubah status payment | Payment memiliki status tertentu; kasus terhubung | Ubah status kasus melalui PATCH, close, atau duplicate; baca kembali `public.payments` | Status payment tetap sama; hanya case dan audit yang berubah | NOT RUN (TPR-112) |
| **TC-PAYVER-33** | AC-03/AC-05 | Integration | Payment paid bukan hasil keputusan manual kasus | Gunakan payment lokal/gateway fixture sesuai environment | Selesaikan kasus menjadi `resolved` atau `closed`, lalu periksa payment | Case status berubah tanpa otomatis mengubah payment menjadi `paid`; status paid hanya berasal dari mekanisme payment yang sah sesuai implementasi | NOT RUN (TPR-112) |

---

## 3. Matriks Cakupan Pengujian

| Ref AC | Test Case | Cakupan |
| :--- | :--- | :--- |
| AC-01 | `TC-PAYVER-01`–`TC-PAYVER-04`, `TC-PAYVER-20`–`TC-PAYVER-23` | Daftar, detail, empty state, filter, dan akses Admin |
| AC-02 | `TC-PAYVER-02`, `TC-PAYVER-05`–`TC-PAYVER-08`, `TC-PAYVER-21`–`TC-PAYVER-24` | Detail dan pembuatan kasus serta validasi akses |
| AC-03 | `TC-PAYVER-09`–`TC-PAYVER-14`, `TC-PAYVER-24`, `TC-PAYVER-32` | Transisi status, catatan keputusan, dan pemisahan payment |
| AC-04 | `TC-PAYVER-15`–`TC-PAYVER-19`, `TC-PAYVER-29`–`TC-PAYVER-30` | Close, duplicate, dan retensi data |
| AC-05 | `TC-PAYVER-25`–`TC-PAYVER-31`, `TC-PAYVER-33` | Actor, timestamp, status lama/baru, alasan, atomicity, dan histori |

Seluruh lima Acceptance Criteria memiliki cakupan pengujian. Semua test case masih `NOT RUN` sampai TPR-112 melaksanakan pengujian formal.

---

## 4. Ringkasan Hasil Eksekusi (`TPR-112`)

- **Tanggal Eksekusi**: Belum dieksekusi.
- **File Pengujian Otomatis yang tersedia**: `backend/src/tests/payment-verification-validation.test.ts`.
- **Perintah unit test yang tersedia**: `cd backend && npm run test:tpr111`.
- **Metode yang direncanakan**: unit test untuk validasi status/catatan, integration/API test dengan database test untuk endpoint dan RLS, serta pemeriksaan database untuk trigger audit.
- **Pelaksana formal**: TPR-112.

Test `test:tpr111` hanya memverifikasi tiga aturan unit-level: transisi valid, transisi invalid, serta normalisasi/penolakan catatan kosong. Test tersebut tidak menjadi hasil PASS untuk 33 skenario pada dokumen ini.

| Ref AC | Test Case | Hasil |
| :--- | :--- | :--- |
| AC-01 | `TC-PAYVER-01`–`TC-PAYVER-04`, `TC-PAYVER-20`–`TC-PAYVER-23` | NOT RUN (TPR-112) |
| AC-02 | `TC-PAYVER-02`, `TC-PAYVER-05`–`TC-PAYVER-08`, `TC-PAYVER-21`–`TC-PAYVER-24` | NOT RUN (TPR-112) |
| AC-03 | `TC-PAYVER-09`–`TC-PAYVER-14`, `TC-PAYVER-24`, `TC-PAYVER-32` | NOT RUN (TPR-112) |
| AC-04 | `TC-PAYVER-15`–`TC-PAYVER-19`, `TC-PAYVER-29`–`TC-PAYVER-30` | NOT RUN (TPR-112) |
| AC-05 | `TC-PAYVER-25`–`TC-PAYVER-31`, `TC-PAYVER-33` | NOT RUN (TPR-112) |
| **Total** | **33 test case** | **NOT RUN (TPR-112)** |

### Ringkasan Jumlah

| Total Test Case | PASS | FAIL | BLOCKED | NOT RUN |
| :---: | :---: | :---: | :---: | :---: |
| 33 | 0 | 0 | 0 | 33 |

---

## 5. Catatan Pengujian dan Keterbatasan

1. Halaman TPR-109 belum terhubung ke endpoint TPR-110 sehingga skenario UI daftar, filter, pagination, dan detail masih perlu integrasi frontend sebelum dapat diuji melalui browser.
2. Endpoint TPR-110 dan service TPR-111 tersedia untuk diuji melalui API/database setelah migration dijalankan berurutan.
3. Audit trigger membutuhkan konteks authenticated Admin (`auth.uid()`); pemeriksaan harus memakai sesi Admin, bukan akses anonim.
4. Tidak ada data gateway eksternal, webhook, atau signature payment gateway pada repository saat ini. Skenario `TC-PAYVER-33` memeriksa pemisahan status, bukan verifikasi gateway end-to-end.
5. Status kasus (`open`, `in_progress`, `resolved`, `duplicate`, `closed`) berbeda dari status payment (`unpaid`, `paid`) dan tidak boleh dicampur.
6. Tidak ada hasil PASS/FAIL yang diklaim dalam dokumen ini.
7. Pengujian tidak menggunakan transaksi sungguhan, credential gateway, atau data pelanggan nyata.

---

## Batasan Lingkup TPR-138

Dokumen ini hanya menyusun test case. Tidak ada perubahan implementasi frontend, backend, database, payment gateway, maupun konfigurasi. Temuan bahwa halaman TPR-109 belum terhubung ke API dicatat sebagai dependensi integrasi, bukan diperbaiki pada TPR-138.
