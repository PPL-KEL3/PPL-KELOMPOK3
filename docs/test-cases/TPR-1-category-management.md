# Dokumen Test Case Pengelolaan Kategori Jasa (PBI-01 / TPR-1)

- **Kode PBI / Issue:** `PBI-01` / `TPR-1` (Subtask `TPR-127`)
- **Kebutuhan Fungsional:** `KF-01` (Category Management)
- **Aktor Utama:** Administrator LOKA (`role = 'admin'`)
- **User Story:** *Sebagai admin, saya ingin mengelola kategori jasa agar layanan pada platform tersusun rapi dan mudah ditemukan.*

---

## 1. Pemetaan Kriteria Penerimaan (Acceptance Criteria)

| Kode AC | Kriteria Penerimaan (Acceptance Criteria) | ID Test Case Terkait |
| :--- | :--- | :--- |
| **AC-01** | Admin dapat menambah kategori dengan nama dan deskripsi. | `TC-CAT-01`, `TC-CAT-02`, `TC-CAT-13` |
| **AC-02** | Daftar kategori menampilkan informasi yang tersimpan. | `TC-CAT-03`, `TC-CAT-04`, `TC-CAT-05` |
| **AC-03** | Admin dapat memperbarui nama dan deskripsi kategori. | `TC-CAT-06`, `TC-CAT-07`, `TC-CAT-08` |
| **AC-04** | Admin dapat menghapus kategori yang tidak digunakan; kategori yang masih terhubung ke jasa tidak dihapus sembarangan. | `TC-CAT-11`, `TC-CAT-12`, `TC-CAT-14` |
| **AC-05** | Nama kategori wajib diisi dan tidak boleh duplikat. | `TC-CAT-09`, `TC-CAT-10` |

---

## 2. Daftar Skenario Test Case

| ID Test Case | Kategori Uji | Skenario Pengujian | Prasyarat (Precondition) | Langkah Pengujian & Data Uji | Hasil yang Diharapkan (Expected Result) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-CAT-01** | Positif (Create) | Menambahkan kategori baru dengan nama dan deskripsi valid | Pengguna masuk sebagai Admin (`role = 'admin'`). Nama kategori belum terdaftar. | 1. Buka halaman `/admin/categories` atau panggil `POST /api/categories`.<br>2. Isi `name`: `"Perbaikan Atap & Talang"` dan `description`: `"Jasa perbaikan kebocoran atap dan instalasi talang rumah."`.<br>3. Klik **Simpan**. | Status HTTP `201 Created`. Kategori baru tersimpan dan tampil pada daftar kategori beserta deskripsinya (`usageCount = 0`). |
| **TC-CAT-02** | Positif (Create) | Menambahkan kategori baru tanpa deskripsi (deskripsi kosong) | Pengguna masuk sebagai Admin (`role = 'admin'`). | 1. Buka form **Tambah Kategori** atau panggil `POST /api/categories`.<br>2. Isi `name`: `"Jasa Angkut Barang"` dan kosongkan `description`.<br>3. Klik **Simpan**. | Status HTTP `201 Created`. Kategori tersimpan dengan nilai `description: null` dan tabel menampilkan keterangan *"Belum ada deskripsi kategori"*. |
| **TC-CAT-03** | Positif (Read) | Menampilkan seluruh daftar kategori jasa yang tersimpan | Terdapat minimal 1 data kategori pada penyimpanan data. | 1. Akses halaman `/admin/categories` atau panggil `GET /api/categories`. | Status HTTP `200 OK`. Sistem mengembalikan daftar kategori berurutan lengkap dengan `id`, `name`, `description`, dan `usageCount`. |
| **TC-CAT-04** | Positif (Read) | Menampilkan kondisi daftar kosong (*empty state*) | Belum ada data kategori yang tersimpan (`categories = []`). | 1. Buka halaman `/admin/categories` saat daftar kategori kosong. | Tabel menampilkan panel *"Belum ada kategori jasa."* beserta tombol aksi **Tambah Kategori**. |
| **TC-CAT-05** | Positif / Negatif (Read Detail) | Mengambil detail kategori berdasarkan ID valid dan ID tidak ditemukan | Terdapat kategori dengan UUID valid di sistem. | 1. Panggil `GET /api/categories/:id` dengan UUID terdaftar.<br>2. Panggil `GET /api/categories/:id` dengan UUID yang tidak ada. | 1. Status `200 OK` mengembalikan objek kategori.<br>2. Status `404 Not Found` dengan kode `CATEGORY_NOT_FOUND`. |
| **TC-CAT-06** | Positif (Update) | Memperbarui nama dan deskripsi kategori yang sudah ada | Pengguna masuk sebagai Admin. Kategori target tersedia. | 1. Klik **Edit** pada kategori target atau panggil `PATCH /api/categories/:id`.<br>2. Ubah `name` menjadi `"Servis AC & Pendingin"` dan perbarui `description`.<br>3. Klik **Simpan Perubahan**. | Status HTTP `200 OK`. Nama dan deskripsi kategori diperbarui serta perubahan langsung tampil pada tabel daftar kategori. |
| **TC-CAT-07** | Negatif (Update) | Memperbarui kategori dengan ID yang tidak terdaftar | Pengguna masuk sebagai Admin. | 1. Panggil `PATCH /api/categories/550e8400-e29b-41d4-a716-446655440999` dengan payload nama valid. | Status HTTP `404 Not Found` (`CATEGORY_NOT_FOUND`) dengan pesan *"Kategori jasa tidak ditemukan."*. |
| **TC-CAT-08** | Negatif (Validasi) | Menolak deskripsi kategori yang melebihi 350 karakter | Pengguna masuk sebagai Admin. | 1. Masukkan `name` valid dan `description` sepanjang 351 karakter pada `POST /api/categories`. | Status HTTP `400 Bad Request` (`VALIDATION_ERROR`) dengan pesan *"Deskripsi kategori maksimal 350 karakter."*. |
| **TC-CAT-09** | Negatif (Validasi Wajib Isi) | Menolak penambahan atau pembaruan kategori dengan nama kosong atau kurang dari 2 karakter | Pengguna masuk sebagai Admin. | 1. Kosongkan field `name` (`""` atau `"   "`) lalu klik **Simpan**.<br>2. Isi field `name` dengan 1 karakter (`"A"`) lalu klik **Simpan**. | Status HTTP `400 Bad Request` (`VALIDATION_ERROR`). Form menolak penyimpanan dan menampilkan pesan *"Nama kategori wajib diisi."* atau *"Nama kategori minimal terdiri dari 2 karakter."*. |
| **TC-CAT-10** | Negatif (Validasi Duplikat) | Menolak nama kategori duplikat termasuk perbedaan huruf besar/kecil dan spasi (*case-insensitive*) | Kategori `"Servis Elektronik & AC"` sudah terdaftar di sistem. | 1. Tambah atau ubah kategori lain dengan `name`: `"  servis   elektronik & ac  "`.<br>2. Klik **Simpan**. | Status HTTP `409 Conflict` (`CATEGORY_NAME_EXISTS`). Penyimpanan ditolak dengan pesan *"Nama kategori sudah digunakan. Gunakan nama kategori yang berbeda."*. |
| **TC-CAT-11** | Positif (Delete) | Menghapus kategori yang tidak digunakan oleh layanan jasa (`usageCount = 0`) | Pengguna masuk sebagai Admin. Kategori target memiliki `usageCount = 0`. | 1. Klik **Hapus** pada kategori yang belum digunakan.<br>2. Konfirmasi penghapusan pada dialog (`DELETE /api/categories/:id`). | Status HTTP `200 OK`. Kategori terhapus dari sistem dan hilang dari daftar tabel kategori. |
| **TC-CAT-12** | Negatif (Pemeriksaan Relasi) | Menolak penghapusan kategori yang masih terhubung ke layanan jasa (`usageCount > 0`) | Pengguna masuk sebagai Admin. Kategori target memiliki minimal 1 layanan jasa terhubung (`usageCount > 0`). | 1. Klik **Hapus** pada kategori yang memiliki layanan terhubung di UI.<br>2. Panggil `DELETE /api/categories/:id` untuk kategori tersebut. | 1. Pada UI, dialog menampilkan blokir *"Perlindungan Relasi Jasa"* dan menyembunyikan tombol hapus.<br>2. Pada API, status HTTP `409 Conflict` (`CATEGORY_IN_USE`) menolak penghapusan dengan pesan *"Kategori tidak dapat dihapus karena masih terhubung dengan layanan jasa."*. |
| **TC-CAT-13** | Negatif (Otorisasi) | Menolak operasi mutasi kategori oleh pengguna yang belum login (`Anon`) | Pengguna tidak menyertakan sesi login. | 1. Panggil `POST /api/categories`, `PATCH /api/categories/:id`, atau `DELETE /api/categories/:id` tanpa token sesi. | Status HTTP `401 Unauthorized` (`NO_SESSION`) dengan pesan *"Kamu belum masuk. Silakan login terlebih dahulu."*. |
| **TC-CAT-14** | Negatif (Otorisasi Role) | Menolak operasi mutasi kategori oleh pengguna ber-role `customer` atau `provider` | Pengguna login sebagai `customer` atau `provider` (bukan `admin`). | 1. Panggil `POST /api/categories` atau `DELETE /api/categories/:id` menggunakan sesi non-admin. | Status HTTP `403 Forbidden` (`FORBIDDEN`) dengan pesan *"Hanya administrator LOKA yang dapat mengelola kategori jasa."*. |

