-- LOKA: perbaikan policy select `public.services` untuk pengunjung anon.
--
-- Masalah: policy `services_select_public_or_owner` mengecek admin lewat subquery langsung ke
-- `public.profiles`. Anon tidak punya izin membaca `profiles` (kolom `role` tertutup), sehingga
-- SEMUA query anon ke `services` ditolak dengan 42501 (permission denied). Akibatnya daftar jasa
-- publik (`GET /api/services`) dan hitungan jasa per kategori (`GET /api/categories`) gagal.
--
-- Perbaikan: cek admin dipindah ke fungsi `security definer` yang hanya menjawab true/false untuk
-- pengguna yang sedang login. Aturan akses TIDAK berubah:
--   jasa aktif -> semua orang; semua jasa milik sendiri -> penyedia; semua jasa -> admin.
-- Akses `public.profiles` untuk anon tidak dibuka lebih luas.
--
-- `alter policy` bersifat atomik, jadi tidak ada jeda tanpa policy saat migrasi berjalan.
-- Aman dijalankan ulang.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter policy "services_select_public_or_owner"
  on public.services
  using (
    is_active = true
    or auth.uid() = provider_id
    or public.is_admin()
  );
