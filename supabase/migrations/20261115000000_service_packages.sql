-- LOKA service packages (TPR-5 / TPR-42)
-- Paket dan harga per jasa. Berelasi dengan `public.services` (`ON DELETE RESTRICT`):
-- jasa yang masih punya paket tidak bisa dihapus (backend memetakan ke SERVICE_HAS_PACKAGES).
-- Jalankan setelah migrasi `20261111000000_services.sql`.

create table if not exists public.service_packages (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null
    references public.services (id) on delete restrict,
  name text not null
    check (char_length(trim(name)) between 3 and 100),
  description text
    check (description is null or char_length(trim(description)) <= 500),
  price integer not null
    check (price between 1000 and 100000000),
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Nama paket unik per jasa (tanpa membedakan huruf besar-kecil), hanya untuk paket yang belum dihapus.
create unique index if not exists service_packages_service_name_uidx
  on public.service_packages (service_id, lower(trim(name)))
  where deleted_at is null;

create index if not exists service_packages_service_id_idx
  on public.service_packages (service_id);

drop trigger if exists service_packages_set_updated_at on public.service_packages;
create trigger service_packages_set_updated_at
  before update on public.service_packages
  for each row
  execute function public.set_updated_at();

-- Anon tidak bisa membaca `public.services` secara langsung karena policy select `services`
-- memuat subquery ke `profiles` (yang dicabut dari anon). Fungsi ini hanya menjawab
-- "jasa ada dan aktif?" tanpa membuka data jasa maupun `profiles`.
create or replace function public.is_service_publicly_visible(p_service_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.services s
    where s.id = p_service_id
      and s.is_active = true
  );
$$;

revoke all on function public.is_service_publicly_visible(uuid) from public;
grant execute on function public.is_service_publicly_visible(uuid) to anon, authenticated;

alter table public.service_packages enable row level security;

-- Pelanggan dan pengunjung publik: paket aktif, belum dihapus, dari jasa yang aktif.
drop policy if exists "service_packages_select_public" on public.service_packages;
create policy "service_packages_select_public"
  on public.service_packages
  for select
  to anon, authenticated
  using (
    is_active = true
    and deleted_at is null
    and public.is_service_publicly_visible(service_id)
  );

-- Pemilik jasa: semua paket di jasanya, termasuk nonaktif dan yang sudah di-soft-delete
-- (agar UPDATE ... RETURNING saat soft delete tidak ditolak). Backend tetap memfilter `deleted_at`.
drop policy if exists "service_packages_select_owner" on public.service_packages;
create policy "service_packages_select_owner"
  on public.service_packages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.services s
      where s.id = service_id
        and s.provider_id = auth.uid()
    )
  );

-- Hanya penyedia jasa (`role = 'provider'`) yang boleh menambah paket, dan hanya untuk jasanya sendiri.
drop policy if exists "service_packages_insert_owner_provider" on public.service_packages;
create policy "service_packages_insert_owner_provider"
  on public.service_packages
  for insert
  to authenticated
  with check (
    deleted_at is null
    and exists (
      select 1
      from public.services s
      where s.id = service_id
        and s.provider_id = auth.uid()
    )
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'provider'
    )
  );

-- Ubah dan "hapus" (soft delete = update yang mengisi `deleted_at`) hanya untuk paket di jasa sendiri.
-- WITH CHECK mencegah paket dipindahkan ke jasa milik penyedia lain.
drop policy if exists "service_packages_update_owner_provider" on public.service_packages;
create policy "service_packages_update_owner_provider"
  on public.service_packages
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.services s
      where s.id = service_id
        and s.provider_id = auth.uid()
    )
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'provider'
    )
  )
  with check (
    exists (
      select 1
      from public.services s
      where s.id = service_id
        and s.provider_id = auth.uid()
    )
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'provider'
    )
  );

-- Tidak ada policy delete: paket tidak pernah dihapus fisik.
grant select on public.service_packages to anon, authenticated;
grant insert, update on public.service_packages to authenticated;
