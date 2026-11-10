-- LOKA service categories (Rancangan Migration Lokal — TPR-26)
-- Catatan: File ini merupakan rancangan skema database untuk tabel `public.categories`.
-- Jangan dijalankan pada database bersama sebelum ditinjau dan dikoordinasikan dengan PM.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (char_length(trim(name)) between 2 and 80),
  description text
    check (description is null or char_length(trim(description)) <= 350),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Pastikan nama kategori bersifat unik secara case-insensitive setelah di-trim.
create unique index if not exists categories_name_lower_uidx
  on public.categories (lower(trim(name)));

create index if not exists categories_created_at_idx
  on public.categories (created_at asc);

-- Gunakan fungsi trigger `public.set_updated_at()` existing yang sudah dibuat PM
-- pada migration `20261109000000_auth_profiles.sql` tanpa mendefinisikan ulang
-- (`CREATE OR REPLACE`) fungsi bersama tersebut.
drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row
  execute function public.set_updated_at();

-- Row Level Security (RLS)
alter table public.categories enable row level security;

-- Daftar kategori dapat dibaca oleh publik (anon) maupun pengguna terautentikasi
-- untuk kebutuhan direktori layanan dan pemilihan kategori oleh penyedia jasa.
drop policy if exists "categories_select_public" on public.categories;
create policy "categories_select_public"
  on public.categories
  for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Kebijakan RLS Admin & Kesesuaian dengan `public.profiles`
-- ---------------------------------------------------------------------------
-- Pada `20261109000000_auth_profiles.sql`, tabel `public.profiles` sudah memiliki:
--   1. `grant select on public.profiles to authenticated;`
--   2. Policy `"profiles_select_own"` (`for select to authenticated using (auth.uid() = id)`).
-- Subquery `where profiles.id = auth.uid() and profiles.role = 'admin'` di bawah ini
-- hanya membaca baris profil milik pengguna yang sedang login (`auth.uid() = id`),
-- sehingga kompatibel dengan policy `"profiles_select_own"` tanpa perlu mengubah
-- policy `public.profiles` milik PM.
--
-- STATUS VERIFIKASI: Pengujian Tertunda (Pending Live Supabase Verification).
-- Karena migration ini belum dijalankan pada database Supabase bersama dan akun uji
-- Admin belum diverifikasi secara langsung, pembuktian eksekusi RLS di atas tercatat
-- sebagai pengujian tertunda sampai skema diterapkan di Supabase.
drop policy if exists "categories_insert_admin" on public.categories;
create policy "categories_insert_admin"
  on public.categories
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "categories_update_admin" on public.categories;
create policy "categories_update_admin"
  on public.categories
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "categories_delete_admin" on public.categories;
create policy "categories_delete_admin"
  on public.categories
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

-- ---------------------------------------------------------------------------
-- Status Perlindungan Relasi `ON DELETE RESTRICT` (Belum Diterapkan di TPR-26)
-- ---------------------------------------------------------------------------
-- PENTING: Perlindungan foreign key `ON DELETE RESTRICT` terhadap tabel layanan
-- jasa BELUM diterapkan pada migration ini karena tabel layanan jasa beserta
-- relasinya masih menjadi bagian pekerjaan PBI-02 dan subtask TPR-27.
-- Migration ini tidak membuat atau mengubah tabel layanan jasa.
--
-- Pada saat PBI-02 dan TPR-27 dikerjakan nanti, kolom `category_id` pada tabel
-- layanan jasa perlu diarahkan ke `public.categories (id)` dengan aturan:
--
--   category_id uuid not null references public.categories (id) on delete restrict
--
-- Di sisi kode backend (`category.service.ts`), penanganan SQLSTATE `23503`
-- (`foreign_key_violation` -> HTTP `409 Conflict` / `CATEGORY_IN_USE`) sudah
-- disiapkan terlebih dahulu agar langsung aktif begitu relasi diterapkan pada TPR-27.
