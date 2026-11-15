# Selenium Tests LOKA (Sprint 1)

Pengujian fungsional otomatis untuk PBI Sprint 1 dengan **Python + pytest + Selenium**,
mengikuti modul praktikum "Pengujian Fungsional dengan Selenium".

Tiap file tes berisi semua test case satu PBI dari Excel `LOKA_Test_Case_Template_Per_Epic.xlsx`.
**Nama tes di output pytest = Case ID di Excel**, contoh `test_harga_ditolak[TC.PKG.004.003] PASSED`,
jadi hasilnya bisa langsung dipindah ke kolom Status.

| File | PBI | Pemilik | Sheet Excel | Jumlah TC |
|---|---|---|---|---|
| `test_tpr1_categories.py` | TPR-1 Kategori Jasa | Vivi | Service Discovery | 19 |
| `test_tpr2_services.py` | TPR-2 Daftar Jasa | Vivi | Service Discovery | 32 |
| `test_tpr5_packages.py` | TPR-5 Paket & Harga | Naufal | Service Offering | 35 |
| `test_tpr6_portfolio.py` | TPR-6 Portofolio | Naufal | Service Offering | 28 |
| `test_tpr9_provider_profile.py` | TPR-9 Profil + WhatsApp | Fattan | Provider Management | 33 |
| `test_tpr10_service_areas.py` | TPR-10 Wilayah Layanan | Fattan | Provider Management | 20 |
| `test_tpr13_booking.py` | TPR-13 Pemesanan Jasa | Arsya | Booking & Service Requests | 17 |
| `test_tpr14_booking_requirements.py` | TPR-14 Kebutuhan Booking | Arsya | Booking & Service Requests | 10 |
| `test_tpr21_qris_payment.py` | TPR-21 Pembayaran QRIS | Geraldo | Payment & Transaction | 13 |
| `test_tpr22_payment_verification.py` | TPR-22 Verifikasi Pembayaran | Geraldo | Payment & Transaction | 6 |

**Jalankan hanya file PBI milikmu sendiri.**

## 1. Ambil kodenya

Folder ini ada di branch `main` setelah PR-nya di-merge.

```powershell
git checkout main
git pull origin main
```

Kalau kamu bekerja di branch sendiri, merge `main` ke branch kamu dulu supaya folder `selenium-tests/` ikut.

## 2. Persiapan (sekali saja)

Butuh Python 3.11+ (centang "Add python.exe to PATH" saat instal) dan Google Chrome.
Driver Chrome diunduh otomatis oleh Selenium.

```powershell
cd selenium-tests
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

- PowerShell menolak `activate`? Jalankan sekali: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- **Setiap membuka terminal baru**, masuk ke folder `selenium-tests` lalu jalankan lagi `.venv\Scripts\activate`
  (tanda `(.venv)` muncul di awal baris). Tanpa ini, perintah `pytest` tidak dikenali.

## 3. Akun uji dan `.env`

Tes membaca dan menulis ke **database yang dipakai `.env` backend kamu**. Kalau database itu dipakai
bersama tim, **wajib pakai akun uji khusus**, karena tes membuat, mengubah, dan menghapus data milik
akun yang dipakai. Jangan pakai akun pribadi atau akun teman.

1. Salin `.env.example` menjadi `.env` (di folder ini), lalu isi akun yang dibutuhkan PBI kamu (tabel di bawah).
2. Akun customer dan penyedia dibuat lewat halaman **Daftar** di aplikasi (pilih peran yang sesuai).
3. **Akun admin tidak bisa dibuat lewat halaman Daftar.** Daftarkan akun biasa, lalu minta orang yang punya
   akses database (Arsya) menjalankan di SQL Editor Supabase:
   `update public.profiles set role = 'admin' where email = '<email-akun-admin-uji>';`
4. `E2E_PROVIDER_A` harus **sudah punya profil penyedia**: login sekali, isi dan simpan form di `/provider/profile`.
5. Akun yang belum diisi membuat tes yang memakainya otomatis di-**skip** (bukan fail).
6. Kalau beberapa orang memakai akun uji yang sama, **jangan menjalankan tes bersamaan**: tes saling
   membersihkan data akun yang sama.

### Akun yang dibutuhkan per PBI

| File | Akun di `.env` |
|---|---|
| `test_tpr1_categories.py` | `E2E_ADMIN`, `E2E_CUSTOMER_A`, `E2E_PROVIDER_A` |
| `test_tpr2_services.py` | `E2E_PROVIDER_A`, `E2E_PROVIDER_B`, `E2E_PROVIDER_EMPTY`, `E2E_CUSTOMER_A` |
| `test_tpr5_packages.py` | `E2E_PROVIDER_A`, `E2E_PROVIDER_EMPTY` |
| `test_tpr6_portfolio.py` | `E2E_PROVIDER_A`, `E2E_PROVIDER_EMPTY` |
| `test_tpr9_provider_profile.py` | `E2E_PROVIDER_A`, `E2E_PROVIDER_NEW`, `E2E_CUSTOMER_A` |
| `test_tpr10_service_areas.py` | `E2E_PROVIDER_A`, `E2E_PROVIDER_NEW` |
| `test_tpr13_booking.py` | `E2E_PROVIDER_A`, `E2E_CUSTOMER_A`, `E2E_CUSTOMER_B` |
| `test_tpr14_booking_requirements.py` | `E2E_PROVIDER_A`, `E2E_CUSTOMER_A` |
| `test_tpr21_qris_payment.py` | `E2E_PROVIDER_A`, `E2E_CUSTOMER_A`, `E2E_CUSTOMER_B`, `E2E_ADMIN` (+ opsional `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) |
| `test_tpr22_payment_verification.py` | `E2E_ADMIN`, `E2E_CUSTOMER_A`, `E2E_PROVIDER_A` |

Arti tiap akun:
- `E2E_PROVIDER_A`: penyedia utama, sudah punya profil.
- `E2E_PROVIDER_B`: penyedia kedua.
- `E2E_PROVIDER_EMPTY`: penyedia tanpa jasa dan tanpa portofolio.
- `E2E_PROVIDER_NEW`: penyedia yang belum pernah mengisi profil.
- `E2E_CUSTOMER_A`, `E2E_CUSTOMER_B`: customer.
- `E2E_ADMIN`: admin.

## 4. Menjalankan aplikasi

Jalankan frontend dan backend di laptop (`npm run dev` di masing-masing folder), dengan `.env`
aplikasi seperti biasa. Pastikan `http://localhost:3000` bisa dibuka dan backend berjalan di
`http://localhost:4000` (atau sesuaikan `LOKA_BASE_URL` / `LOKA_API_URL` di `.env`).

## 5. Menjalankan tes

```powershell
# semua TC satu PBI
pytest test_tpr5_packages.py -v

# satu kasus saja
pytest test_tpr5_packages.py -v -k "TC.PKG.004.003"
```

Chrome akan terbuka, mengetik, mengklik, lalu menutup sendiri untuk tiap tes. Jangan menyentuh
mouse/keyboard di jendela Chrome itu selama tes berjalan.

## 6. Membaca hasil dan mengisi Excel (aturan modul)

| Output pytest | Arti | Kolom Status di Excel |
|---|---|---|
| `PASSED` | perilaku aplikasi sesuai Expected | **Pass** |
| `FAILED` | perilaku aplikasi berbeda dari Expected: **itu temuan** | **Fail** + tulis Bug Notes |
| `ERROR` | gagal di persiapan (akun, server, data), bukan temuan | perbaiki penyebabnya, jalankan ulang |
| `SKIPPED` | precondition belum terpenuhi; alasannya tercetak di bagian akhir output | belum diisi |

- **Jangan ubah Expected supaya hijau.** Kalau aplikasinya yang salah, catat sebagai temuan.
- Bug Notes berisi empat hal: langkah reproduksi, expected, actual (lihat pesan `assert` di output), dugaan penyebab.
- Kalau ternyata **Expected di Excel yang keliru** (ditulis dari asumsi, bukan dari aplikasi), perbaiki
  baris Excel dan file tesnya bersama-sama, lalu jalankan ulang.

## 7. Keterbatasan yang sudah diketahui per PBI

| PBI | Catatan |
|---|---|
| TPR-1 | `TC.CAT.001.002` butuh database tanpa kategori, jadi selalu di-skip di database bersama. Kasus yang membuat kategori dengan nama tertentu di-skip kalau nama itu sudah ada. |
| TPR-2 | `TC.SVC.001.003` kemungkinan **FAIL**: Daftar Jasa menampilkan jasa milik penyedia lain (`useServices.ts` mode API tidak memfilter per penyedia). Catat sebagai temuan. |
| TPR-9 | `E2E_PROVIDER_NEW` **sekali pakai**: `TC.PRF.002.001` membuatkan profil untuk akun itu, dan profil tidak bisa dihapus lewat aplikasi. Untuk mengulang `TC.PRF.001.001` dan `TC.PRF.002.001`, pakai akun penyedia baru. |
| TPR-10 | `TC.AREA.001.001` juga butuh `E2E_PROVIDER_NEW` yang belum punya profil. Jalankan TPR-10 sebelum TPR-9. |
| TPR-13, TPR-14, TPR-21 | Belum ada halaman penyedia untuk menerima booking, jadi status "Diterima Penyedia" disiapkan lewat API. Booking yang sudah diterima tidak bisa dibatalkan, jadi tetap tersimpan. |
| TPR-21 | `TC.PAY.004.001`–`003` butuh `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` untuk mengubah masa berlaku sesi. Tanpa itu di-skip. Kunci ini sangat sensitif: jangan dibagikan dan jangan di-commit. |
| TPR-22 | Halaman verifikasi belum tersambung ke API, jadi baru 6 TC (akses dan tampilan) yang bisa diuji lewat browser. |

## 8. Aturan data uji

- Tiap file **menyiapkan datanya sendiri lewat API** (mis. membuat 9 paket sebelum uji paket ke-10)
  dan **membersihkannya setelah tes** (hapus atau kembalikan seperti semula).
- Data yang terlihat publik diberi awalan **`[E2E]`**, mis. jasa `[E2E] Jasa Paket`, `[E2E] Jasa Booking`.
- Data yang tidak bisa dihapus oleh aplikasi (jasa yang punya paket, booking yang sudah diterima,
  profil penyedia baru) dinonaktifkan atau dibiarkan dengan awalan `[E2E]`. Rinciannya ada di
  docstring di atas tiap file.
- Booking memakai tanggal acak jauh di depan supaya slot tidak bentrok antar run.

## 9. Selektor

- Komponen TPR-5 dan TPR-6 memakai atribut `data-testid` (dianjurkan modul).
- PBI lain memakai `id`, `aria-label`, dan teks tombol yang sudah ada, tanpa mengubah kode aplikasi.
  Kalau pemilik PBI ingin lebih stabil, tambahkan `data-testid` di komponennya lalu sesuaikan
  selektor di file tesnya.
- XPath absolut tidak dipakai (dilarang modul).

## 10. Kalau tersendat

| Pesan atau gejala | Penyebab yang paling sering | Tindakan |
|---|---|---|
| `pytest` tidak dikenali | venv belum aktif | `cd selenium-tests` lalu `.venv\Scripts\activate` |
| `ModuleNotFoundError` (selenium, requests, PIL) | paket belum terpasang di venv | `pip install -r requirements.txt` |
| Semua tes `SKIPPED` dengan pesan "belum diisi di selenium-tests/.env" | akun belum diisi atau nama file bukan `.env` | isi akun sesuai tabel di bagian 3 |
| `ConnectionError` / `Max retries exceeded ... localhost:4000` | backend belum jalan | jalankan backend (`npm run dev` di folder backend) |
| Chrome terbuka tapi halaman "This site can't be reached" | frontend belum jalan | jalankan frontend (`npm run dev` di folder frontend) |
| `POST /auth/login gagal (401)` | email/password akun uji salah | cek ulang isi `.env` |
| `TimeoutException` di tes tertentu | halaman lambat dimuat, atau elemen/teks berbeda dari Expected | naikkan `E2E_WAIT_SECONDS` di `.env`; kalau masih gagal, bandingkan teks di layar dengan Expected |
| `SessionNotCreatedException` / masalah chromedriver | Chrome belum terpasang atau versinya bermasalah | perbarui Google Chrome, jalankan ulang |
