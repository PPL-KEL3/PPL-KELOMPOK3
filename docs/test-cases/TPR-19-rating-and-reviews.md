# Dokumen Test Case: Pengelolaan Rating dan Ulasan (`TPR-19` / `PBI-19`)

- **PBI Key**: `TPR-19` (PBI-19: Mengelola Rating dan Ulasan Setelah Layanan Selesai)
- **Subtask Penyusunan Test Case**: `TPR-136` (Menyusun test case pemberian rating dan ulasan)
- **Subtask Pengujian Eksekusi**: `TPR-100` (Menguji fitur rating dan ulasan)
- **Subtask Form Rating & Ulasan**: `TPR-97` (Membuat form rating dan ulasan)
- **Subtask Backend CRUD Rating**: `TPR-98` (Membuat endpoint CRUD rating dan review)
- **Subtask Validasi Transaksi & Konten**: `TPR-99` (Membuat validasi transaksi dan konten ulasan)
- **PIC / Pengembang**: Rendy Putra Setiawan
- **Lingkup Modul**:
  - Frontend Pelanggan: Form rating & komentar bintang 1-5 (`ReviewFormModal.tsx`, `EditReviewModal.tsx`, `DeleteReviewDialog.tsx`), Halaman ulasan pelanggan `/customer/reviews` (`CustomerReviewsClient.tsx`), integrasi tombol "Beri Ulasan" pada detail pesanan (`BookingDetailClient.tsx`).
  - Frontend Publik / Profil Penyedia: Tab & kartu ulasan pelanggan serta ringkasan rating (`ReviewCard.tsx`, `PublicProviderProfileClient.tsx`).
  - Backend REST API:
    - `POST /api/reviews` (Membuat rating & komentar baru dengan verifikasi transaksi booking berstatus `accepted`)
    - `GET /api/reviews/provider/:providerId` (Publik: Melihat ulasan & agregasi rating rata-rata penyedia)
    - `GET /api/reviews/mine` (Pelanggan: Melihat seluruh ulasan yang pernah diberikan)
    - `GET /api/reviews/booking/:bookingId` (Pelanggan: Cek status ulasan untuk booking tertentu)
    - `PATCH /api/reviews/:id` (Pelanggan: Mengubah rating & komentar dengan batas kuota maksimal 3 kali)
    - `DELETE /api/reviews/:id` (Pelanggan: Menarik/menghapus ulasan miliknya)
  - Database: Tabel `public.reviews` dengan Foreign Key ke `bookings`, `profiles` (pelanggan & penyedia), dan `services`, disertai Row Level Security (RLS) serta unique index pada `booking_id`.

---

## 1. Pemetaan Acceptance Criteria (`TPR-19`)

| Kode AC | Pernyataan Acceptance Criteria | Cakupan Test Case |
| :--- | :--- | :--- |
| **AC-01** | Pelanggan dapat memberi rating 1–5 dan komentar setelah transaksi memenuhi syarat. | `TC-REV-01`, `TC-REV-02`, `TC-REV-03`, `TC-REV-04`, `TC-REV-05`, `TC-REV-06` |
| **AC-02** | Ulasan tersimpan dan tampil pada profil penyedia. | `TC-REV-07`, `TC-REV-08` |
| **AC-03** | Pelanggan dapat mengubah ulasannya sesuai batas perubahan yang berlaku. | `TC-REV-09`, `TC-REV-10`, `TC-REV-11`, `TC-REV-12` |
| **AC-04** | Pelanggan dapat menarik ulasannya sesuai kebijakan platform. | `TC-REV-13`, `TC-REV-14` |
| **AC-05** | Sistem menolak rating di luar rentang atau ulasan yang tidak memenuhi aturan. | `TC-REV-15`, `TC-REV-16`, `TC-REV-17`, `TC-REV-18`, `TC-REV-19` |

---

## 2. Matriks Detail Test Case (`TC-REV-01` s.d. `TC-REV-19`)

| ID Test Case | Ref AC | Jenis Uji | Skenario Pengujian | Prasyarat (Precondition) | Langkah & Data Uji | Hasil yang Diharapkan (Expected Result) | Status Eksekusi (`TPR-100`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-REV-01** | AC-01 | Positif | Pelanggan memberi rating 5 dan komentar valid pada transaksi yang diterima | Pelanggan A memiliki booking berstatus `accepted` | Kirim `POST /api/reviews` dengan `{ "bookingId": "<id>", "rating": 5, "comment": "Pelayanan sangat memuaskan..." }` | HTTP `201 Created`, ulasan tersimpan, `rating = 5`, `editCount = 0`, `isEdited = false` | `PASS` |
| **TC-REV-02** | AC-01 | Positif | Pelanggan memberi rating 1 dan kritik ulasan pada transaksi yang diterima | Pelanggan A memiliki booking berstatus `accepted` | Kirim `POST /api/reviews` dengan `{ "bookingId": "<id>", "rating": 1, "comment": "Pekerjaan kurang rapi..." }` | HTTP `201 Created`, ulasan tersimpan dengan `rating = 1` | `PASS` |
| **TC-REV-03** | AC-01 | Negatif | Menolak ulasan jika transaksi booking belum disetujui (masih `pending_provider_confirmation`) | Booking masih pending | Kirim `POST /api/reviews` untuk booking pending | HTTP `400 Bad Request`, `error.code = "BOOKING_NOT_ELIGIBLE"` | `PASS` |
| **TC-REV-04** | AC-01 | Negatif | Menolak ulasan jika transaksi booking berstatus dibatalkan (`cancelled`) | Booking dibatalkan | Kirim `POST /api/reviews` untuk booking cancelled | HTTP `400 Bad Request`, `error.code = "BOOKING_NOT_ELIGIBLE"` | `PASS` |
| **TC-REV-05** | AC-01 | Negatif | Menolak ulasan kedua pada transaksi booking yang sama (mencegah duplikasi) | Booking sudah pernah direview | Kirim `POST /api/reviews` dengan `bookingId` yang sama | HTTP `409 Conflict`, `error.code = "REVIEW_ALREADY_EXISTS"` | `PASS` |
| **TC-REV-06** | AC-01 | Negatif | Menolak ulasan jika pelanggan bukan pemesan sah booking tersebut | Pelanggan A mencoba mereview booking milik Pelanggan B | Kirim `POST /api/reviews` dengan `bookingId` milik Pelanggan B | HTTP `403 Forbidden`, `error.code = "BOOKING_FORBIDDEN"` | `PASS` |
| **TC-REV-07** | AC-02 | Positif | Publik melihat daftar ulasan dan statistik agregat rating profil penyedia | Tersedia ulasan rating 5 dan rating 3 untuk penyedia X | Kirim `GET /api/reviews/provider/:providerId` | HTTP `200 OK`, `totalReviews = 2`, `averageRating = 4.0`, breakdown bintang 1-5 sesuai | `PASS` |
| **TC-REV-08** | AC-02 | Positif | Mengembalikan statistik 0 dan daftar kosong jika penyedia belum memiliki ulasan | Penyedia belum memiliki riwayat ulasan | Kirim `GET /api/reviews/provider/:providerId` | HTTP `200 OK`, `totalReviews = 0`, `averageRating = 0`, `reviews = []` | `PASS` |
| **TC-REV-09** | AC-03 | Positif | Pelanggan memperbarui rating dan komentar ulasan (perubahan ke-1) | Ulasan milik Pelanggan A tersedia (`editCount = 0`) | Kirim `PATCH /api/reviews/:id` dengan `{ "rating": 5, "comment": "Komentar revisi..." }` | HTTP `200 OK`, `editCount = 1`, `isEdited = true`, data terupdate | `PASS` |
| **TC-REV-10** | AC-03 | Positif | Pelanggan memperbarui ulasan hingga batas maksimal yang ditentukan (3x edit) | Ulasan sudah diedit 2 kali | Kirim `PATCH /api/reviews/:id` untuk edit ke-3 | HTTP `200 OK`, `editCount = 3`, perubahan berhasil disimpan | `PASS` |
| **TC-REV-11** | AC-03 | Negatif | Menolak pembaruan ulasan jika batas maksimal 3 kali perubahan telah terlewati | Ulasan sudah diedit 3 kali | Kirim `PATCH /api/reviews/:id` untuk edit ke-4 | HTTP `400 Bad Request`, `error.code = "REVIEW_EDIT_LIMIT_EXCEEDED"` | `PASS` |
| **TC-REV-12** | AC-03 | Negatif | Menolak pembaruan ulasan jika ID ulasan tidak ditemukan | Login sebagai Pelanggan A | Kirim `PATCH /api/reviews/<random-uuid>` | HTTP `404 Not Found`, `error.code = "REVIEW_NOT_FOUND"` | `PASS` |
| **TC-REV-13** | AC-04 | Positif | Pelanggan menarik/menghapus ulasannya dari sistem | Ulasan Pelanggan A tersedia | Kirim `DELETE /api/reviews/:id` | HTTP `200 OK`, `data.deletedId` terkonfirmasi, ulasan terhapus dari profil dan daftar | `PASS` |
| **TC-REV-14** | AC-04 | Negatif | Menolak penarikan ulasan jika ID ulasan tidak ditemukan | Login sebagai Pelanggan A | Kirim `DELETE /api/reviews/<random-uuid>` | HTTP `404 Not Found`, `error.code = "REVIEW_NOT_FOUND"` | `PASS` |
| **TC-REV-15** | AC-05 | Negatif | Menolak rating di luar rentang valid 1 sampai 5 (misal rating 0 atau 6) | Booking valid tersedia | Kirim `POST /api/reviews` dengan `rating = 0` atau `rating = 6` | HTTP `400 Bad Request`, `error.code = "VALIDATION_ERROR"`, error pada field rating | `PASS` |
| **TC-REV-16** | AC-05 | Negatif | Menolak komentar ulasan yang kurang dari batas minimum 10 karakter | Booking valid tersedia | Kirim `POST /api/reviews` dengan komentar kurang dari 10 karakter | HTTP `400 Bad Request`, `error.code = "VALIDATION_ERROR"`, error pada field comment | `PASS` |
| **TC-REV-17** | AC-05 | Negatif | Menolak komentar ulasan yang melebihi batas maksimum 1000 karakter | Booking valid tersedia | Kirim `POST /api/reviews` dengan komentar 1001 karakter | HTTP `400 Bad Request`, `error.code = "VALIDATION_ERROR"`, error pada field comment | `PASS` |
| **TC-REV-18** | AC-05 | Negatif | Pelanggan B dilarang mengubah ulasan milik Pelanggan A (Ownership Isolation) | Ulasan dibuat oleh Pelanggan A | Pelanggan B mengirim `PATCH /api/reviews/:id_A` | HTTP `403 Forbidden`, `error.code = "REVIEW_FORBIDDEN"`, perubahan dicegah | `PASS` |
| **TC-REV-19** | AC-05 | Negatif | Pelanggan B dilarang menarik/menghapus ulasan milik Pelanggan A (Ownership Isolation) | Ulasan dibuat oleh Pelanggan A | Pelanggan B mengirim `DELETE /api/reviews/:id_A` | HTTP `403 Forbidden`, `error.code = "REVIEW_FORBIDDEN"`, penarikan dicegah | `PASS` |

---

## 3. Hasil Pengujian Otomatis

Eksekusi suite pengujian backend:
```bash
npm run test:tpr136  # Spesifikasi dan pemetaan acceptance criteria test case
npm run test:tpr100  # Eksekusi 19 skenario pengujian alur, validasi, batas edit, dan isolasi hak akses
```
**Hasil**: 19 dari 19 test case berhasil lulus (**PASS**, 100%).
