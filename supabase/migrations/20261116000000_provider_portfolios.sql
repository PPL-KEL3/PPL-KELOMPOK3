-- LOKA provider portfolios (TPR-6 / TPR-46)
-- Portofolio milik penyedia jasa: 1 foto + judul + deskripsi per item.
-- Satu file berisi tabel, index, trigger, fungsi publik, RLS, bucket `portfolio`, dan storage policy.
-- Jalankan setelah migrasi `20261109000000_auth_profiles.sql` (butuh `public.profiles`
-- dan fungsi trigger `public.set_updated_at()`).
-- Batas 20 item per penyedia dicek di backend (saat upload-url dan saat simpan), bukan di sini.

-- ---------------------------------------------------------------------------
-- 1. Tabel
-- ---------------------------------------------------------------------------

create table if not exists public.provider_portfolios (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null
    references public.profiles (id) on delete cascade,
  title text not null
    check (char_length(trim(title)) between 3 and 100),
  description text
    check (description is null or char_length(trim(description)) <= 500),
  image_path text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  -- Path foto: `{provider_id}/{uuid}.jpg|png`, selalu di folder milik penyedia itu sendiri.
  constraint provider_portfolios_image_path_format check (
    image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png)$'
    and split_part(image_path, '/', 1) = provider_id::text
  )
);

create unique index if not exists provider_portfolios_image_path_uidx
  on public.provider_portfolios (image_path);

create index if not exists provider_portfolios_provider_created_idx
  on public.provider_portfolios (provider_id, created_at desc);

drop trigger if exists provider_portfolios_set_updated_at on public.provider_portfolios;
create trigger provider_portfolios_set_updated_at
  before update on public.provider_portfolios
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Fungsi publik
-- ---------------------------------------------------------------------------

-- Anon tidak bisa membaca `public.profiles`. Fungsi ini hanya menjawab "ID ini penyedia jasa?"
-- tanpa membuka data profil, dipakai endpoint publik untuk membedakan 404 dan 200 [].
create or replace function public.is_public_provider(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_provider_id
      and p.role = 'provider'
  );
$$;

revoke all on function public.is_public_provider(uuid) from public;
grant execute on function public.is_public_provider(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. RLS tabel
-- ---------------------------------------------------------------------------

alter table public.provider_portfolios enable row level security;

-- Semua item portofolio memang publik.
drop policy if exists "provider_portfolios_select_public" on public.provider_portfolios;
create policy "provider_portfolios_select_public"
  on public.provider_portfolios
  for select
  to anon, authenticated
  using (true);

-- Tambah: hanya penyedia jasa (`role = 'provider'`), hanya untuk dirinya sendiri.
drop policy if exists "provider_portfolios_insert_owner_provider" on public.provider_portfolios;
create policy "provider_portfolios_insert_owner_provider"
  on public.provider_portfolios
  for insert
  to authenticated
  with check (
    provider_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'provider'
    )
  );

-- Ubah: hanya item milik sendiri. WITH CHECK mencegah item dipindahkan ke penyedia lain.
drop policy if exists "provider_portfolios_update_owner_provider" on public.provider_portfolios;
create policy "provider_portfolios_update_owner_provider"
  on public.provider_portfolios
  for update
  to authenticated
  using (
    provider_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'provider'
    )
  )
  with check (
    provider_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'provider'
    )
  );

-- Hapus permanen: hanya item milik sendiri (portofolio bukan data transaksi).
drop policy if exists "provider_portfolios_delete_owner_provider" on public.provider_portfolios;
create policy "provider_portfolios_delete_owner_provider"
  on public.provider_portfolios
  for delete
  to authenticated
  using (
    provider_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'provider'
    )
  );

-- Anon hanya membaca.
revoke insert, update, delete, truncate on public.provider_portfolios from anon;
grant select on public.provider_portfolios to anon, authenticated;
grant insert, update, delete on public.provider_portfolios to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Bucket storage `portfolio`
-- ---------------------------------------------------------------------------

-- Publik baca (URL publik untuk galeri), maksimal 5 MB, hanya JPG/PNG.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 5. Storage policy (`storage.objects`)
-- ---------------------------------------------------------------------------
-- Folder pertama path = UID pemilik: `{auth.uid()}/{uuid}.jpg`.
-- Baca file lewat URL publik tidak butuh policy (bucket publik). Policy select di bawah
-- dibutuhkan backend untuk mengecek file ada dan untuk menghapus file (Storage API memakai
-- DELETE ... RETURNING), dan hanya untuk folder sendiri, jadi isi bucket tidak bisa di-list orang lain.

drop policy if exists "portfolio_objects_select_owner" on storage.objects;
create policy "portfolio_objects_select_owner"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Unggah: hanya penyedia jasa, hanya ke foldernya sendiri.
drop policy if exists "portfolio_objects_insert_owner_provider" on storage.objects;
create policy "portfolio_objects_insert_owner_provider"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'provider'
    )
  );

drop policy if exists "portfolio_objects_update_owner_provider" on storage.objects;
create policy "portfolio_objects_update_owner_provider"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'provider'
    )
  );

-- Hapus: pemilik folder saja (tanpa syarat role, supaya pembersihan file tetap bisa jalan).
drop policy if exists "portfolio_objects_delete_owner" on storage.objects;
create policy "portfolio_objects_delete_owner"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
