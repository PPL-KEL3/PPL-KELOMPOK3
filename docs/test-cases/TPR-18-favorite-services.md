# Dokumen Test Case: Pengelolaan Daftar Jasa Favorit (`TPR-18` / `PBI-18`)

- **PBI Key**: `TPR-18` (PBI-18: Mengelola Daftar Jasa Favorit)
- **Subtask Penyusunan Test Case**: `TPR-135` (Menyusun test case pengelolaan jasa favorit)
- **Subtask Pengujian Eksekusi**: `TPR-96` (Menguji daftar favorit dan kepemilikan)
- **Subtask Backend CRUD**: `TPR-94` (Membuat endpoint CRUD item favorit)
- **Subtask Frontend Halaman**: `TPR-93` (Membuat halaman daftar favorit)
- **Subtask Frontend Kontrol**: `TPR-95` (Membuat kontrol tambah/hapus dan edit favorit)
- **PIC / Pengembang**: Rendy Putra Setiawan
- **Lingkup Modul**:
  - Frontend Pelanggan: `/customer/favorites` (`FavoritesClient`, `FavoriteCard`, `EditFavoriteModal`, `DeleteFavoriteDialog`, `useFavorites`)
  - Kontrol Tambah/Hapus: Terintegrasi pada Katalog Jasa (`PublishedServicesCatalog`) & Profil Publik Penyedia (`PublicProviderProfileClient`)
  - Navigasi: Menu "Favorit Saya" pada `CustomerSidebar`
  - Backend REST API:
    - `GET /api/favorites` (Melihat daftar favorit & filter `?itemType=service|provider`)
    - `GET /api/favorites/:id` (Detail favorit tertentu)
    - `POST /api/favorites` (Menambahkan jasa/penyedia ke favorit)
    - `PATCH /api/favorites/:id` (Memperbarui label/catatan pribadi)
    - `DELETE /api/favorites/:id` (Menghapus item dari favorit)
  - Database: Tabel `public.customer_favorites` dengan Foreign Key `customer_id -> public.profiles(id)`, `service_id -> public.services(id)`, `provider_id -> public.profiles(id)`, serta Row Level Security (RLS) untuk isolasi kepemilikan.

---

## 1. Pemetaan Acceptance Criteria (`TPR-18`)

| Kode AC | Pernyataan Acceptance Criteria | Cakupan Test Case |
| :--- | :--- | :--- |
| **AC-01** | Pelanggan dapat menambahkan jasa atau profil penyedia ke favorit. | `TC-FAV-01`, `TC-FAV-02`, `TC-FAV-03`, `TC-FAV-04` |
| **AC-02** | Pelanggan dapat melihat daftar favorit miliknya. | `TC-FAV-05`, `TC-FAV-06`, `TC-FAV-07` |
| **AC-03** | Pelanggan dapat memperbarui label/catatan pribadi atau pengaturan item favorit. | `TC-FAV-08`, `TC-FAV-09`, `TC-FAV-10` |
| **AC-04** | Pelanggan dapat menghapus item dari favorit. | `TC-FAV-11`, `TC-FAV-12` |
| **AC-05** | Pelanggan tidak dapat melihat atau mengubah daftar favorit pengguna lain. | `TC-FAV-13`, `TC-FAV-14`, `TC-FAV-15` |

---

## 2. Matriks Detail Test Case (`TC-FAV-01` s.d. `TC-FAV-15`)

| ID Test Case | Ref AC | Jenis Uji | Skenario Pengujian | Prasyarat (Precondition) | Langkah & Data Uji | Hasil yang Diharapkan (Expected Result) | Status Eksekusi (`TPR-96`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-FAV-01** | AC-01 | Positif | Pelanggan menambahkan layanan jasa ke daftar favorit | Login sebagai Pelanggan A; ID layanan jasa valid tersedia | Kirim `POST /api/favorites` dengan `{ "itemType": "service", "serviceId": "<uuid-jasa>", "label": "Langganan AC", "notes": "Panggil tiap 3 bulan" }` | HTTP `201 Created`, `success: true`, `data.favorite.itemType = "service"`, target terisi nama jasa dan harga | `PASS` |
| **TC-FAV-02** | AC-01 | Positif | Pelanggan menambahkan profil penyedia jasa ke daftar favorit | Login sebagai Pelanggan A; ID penyedia valid tersedia | Kirim `POST /api/favorites` dengan `{ "itemType": "provider", "providerId": "<uuid-provider>", "label": "Laundry Favorit" }` | HTTP `201 Created`, `success: true`, `data.favorite.itemType = "provider"`, target terisi nama usaha dan kontak WhatsApp | `PASS` |
| **TC-FAV-03** | AC-01 | Negatif | Menolak penambahan duplikasi item yang sudah ada di daftar favorit | Item sudah pernah ditambahkan oleh Pelanggan A sebelumnya | Kirim `POST /api/favorites` dengan data target yang sama | HTTP `409 Conflict`, `error.code = "FAVORITE_ALREADY_EXISTS"`, pesan penolakan duplikasi | `PASS` |
| **TC-FAV-04** | AC-01 | Negatif | Menolak penambahan favorit jika tipe atau ID tidak valid | Login sebagai Pelanggan A | Kirim `POST /api/favorites` dengan `{ "itemType": "invalid", "serviceId": "bukan-uuid" }` | HTTP `400 Bad Request`, `error.code = "VALIDATION_ERROR"` | `PASS` |
| **TC-FAV-05** | AC-02 | Positif | Pelanggan melihat seluruh daftar item favorit miliknya | Pelanggan A memiliki item favorit (jasa & penyedia) | Kirim `GET /api/favorites` | HTTP `200 OK`, mengembalikan seluruh item favorit milik Pelanggan A beserta detail targetnya | `PASS` |
| **TC-FAV-06** | AC-02 | Positif | Pelanggan memfilter daftar favorit berdasarkan tipe item | Pelanggan A memiliki beberapa item campuran | Kirim `GET /api/favorites?itemType=service` | HTTP `200 OK`, seluruh item yang dikembalikan memiliki `itemType = "service"` | `PASS` |
| **TC-FAV-07** | AC-02 | Positif | Mengembalikan daftar kosong jika pelanggan belum memiliki item favorit | Pelanggan A baru mendaftar dan belum menambahkan favorit | Kirim `GET /api/favorites` | HTTP `200 OK`, `data.count = 0`, `data.favorites = []` | `PASS` |
| **TC-FAV-08** | AC-03 | Positif | Pelanggan memperbarui label dan catatan pribadi item favorit miliknya | Item favorit milik Pelanggan A tersedia | Kirim `PATCH /api/favorites/:id` dengan `{ "label": "AC Rumah Utama", "notes": "Langganan 2025" }` | HTTP `200 OK`, `data.favorite.label = "AC Rumah Utama"`, catatan diperbarui | `PASS` |
| **TC-FAV-09** | AC-03 | Negatif | Menolak pembaruan item favorit jika ID tidak ditemukan | Login sebagai Pelanggan A | Kirim `PATCH /api/favorites/<uuid-acak>` dengan `{ "notes": "Catatan baru" }` | HTTP `404 Not Found`, `error.code = "FAVORITE_NOT_FOUND"` | `PASS` |
| **TC-FAV-10** | AC-03 | Negatif | Menolak pembaruan catatan favorit jika melebihi batas 500 karakter | Item favorit tersedia | Kirim `PATCH /api/favorites/:id` dengan catatan 501 karakter | HTTP `400 Bad Request`, `error.code = "VALIDATION_ERROR"`, error pada field notes | `PASS` |
| **TC-FAV-11** | AC-04 | Positif | Pelanggan menghapus item dari daftar favorit miliknya | Item favorit milik Pelanggan A tersedia | Kirim `DELETE /api/favorites/:id` | HTTP `200 OK`, `data.deletedId` terkonfirmasi, item tidak lagi muncul di `GET /api/favorites` | `PASS` |
| **TC-FAV-12** | AC-04 | Negatif | Menolak penghapusan item favorit jika ID tidak ditemukan | Login sebagai Pelanggan A | Kirim `DELETE /api/favorites/<uuid-acak>` | HTTP `404 Not Found`, `error.code = "FAVORITE_NOT_FOUND"` | `PASS` |
| **TC-FAV-13** | AC-05 | Negatif | Pelanggan tidak dapat melihat item favorit milik pengguna lain | Item favorit dibuat oleh Pelanggan A; Pelanggan B mencoba akses | Pelanggan B mengirim `GET /api/favorites/:id_milik_A` | HTTP `403 Forbidden`, `error.code = "FAVORITE_FORBIDDEN"`, akses ditolak | `PASS` |
| **TC-FAV-14** | AC-05 | Negatif | Pelanggan tidak dapat mengubah label atau catatan favorit milik pengguna lain | Item favorit dibuat oleh Pelanggan A; Pelanggan B mencoba modifikasi | Pelanggan B mengirim `PATCH /api/favorites/:id_milik_A` | HTTP `403 Forbidden`, `error.code = "FAVORITE_FORBIDDEN"`, perubahan dicegah | `PASS` |
| **TC-FAV-15** | AC-05 | Negatif | Pelanggan tidak dapat menghapus item favorit milik pengguna lain | Item favorit dibuat oleh Pelanggan A; Pelanggan B mencoba menghapus | Pelanggan B mengirim `DELETE /api/favorites/:id_milik_A` | HTTP `403 Forbidden`, `error.code = "FAVORITE_FORBIDDEN"`, penghapusan dicegah | `PASS` |

---

## 3. Hasil Pengujian Otomatis

Eksekusi suite pengujian backend:
```bash
npm run test:tpr135  # Spesifikasi dan validasi struktur test case
npm run test:tpr96   # Eksekusi 15 skenario pengujian alur dan isolasi hak akses
```
**Hasil**: 15 dari 15 test case berhasil lulus (`PASS`, 100%).
