-- LOKA service listings (Rancangan Migration Lokal - TPR-30)
-- Catatan: Skema tabel `public.services` untuk pengelolaan daftar layanan penyedia jasa (PBI-02 / TPR-2).
-- Berelasi dengan `public.profiles` (penyedia jasa) dan `public.categories` (`ON DELETE RESTRICT`).

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null
    references public.profiles (id) on delete cascade,
  category_id uuid not null
    references public.categories (id) on delete restrict,
  name text not null
    check (char_length(trim(name)) between 3 and 100),
  description text not null
    check (char_length(trim(description)) between 10 and 500),
  price integer not null
    check (price between 1000 and 100000000),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists services_provider_id_idx
  on public.services (provider_id, created_at desc);

create index if not exists services_category_id_idx
  on public.services (category_id);

create index if not exists services_active_created_at_idx
  on public.services (is_active, created_at desc);

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
  before update on public.services
  for each row
  execute function public.set_updated_at();

alter table public.services enable row level security;

-- Pelanggan dan pengunjung publik dapat melihat layanan yang dipublikasikan (`is_active = true`),
-- sedangkan penyedia jasa dapat melihat seluruh layanan miliknya sendiri (aktif maupun nonaktif).
drop policy if exists "services_select_public_or_owner" on public.services;
create policy "services_select_public_or_owner"
  on public.services
  for select
  to anon, authenticated
  using (
    is_active = true
    or auth.uid() = provider_id
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Hanya penyedia jasa yang sudah terverifikasi (`role = 'provider'` dan `provider_verification_status = 'verified'`)
-- yang dapat menambahkan layanan baru untuk akunnya sendiri.
drop policy if exists "services_insert_verified_provider" on public.services;
create policy "services_insert_verified_provider"
  on public.services
  for insert
  to authenticated
  with check (
    auth.uid() = provider_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'provider'
        and profiles.provider_verification_status = 'verified'
    )
  );

-- Penyedia jasa terverifikasi hanya dapat mengubah layanan miliknya sendiri.
drop policy if exists "services_update_own_verified_provider" on public.services;
create policy "services_update_own_verified_provider"
  on public.services
  for update
  to authenticated
  using (
    auth.uid() = provider_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'provider'
        and profiles.provider_verification_status = 'verified'
    )
  )
  with check (
    auth.uid() = provider_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'provider'
        and profiles.provider_verification_status = 'verified'
    )
  );

-- Penyedia jasa terverifikasi hanya dapat menghapus layanan miliknya sendiri.
drop policy if exists "services_delete_own_verified_provider" on public.services;
create policy "services_delete_own_verified_provider"
  on public.services
  for delete
  to authenticated
  using (
    auth.uid() = provider_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'provider'
        and profiles.provider_verification_status = 'verified'
    )
  );

grant select on public.services to anon, authenticated;
grant insert, update, delete on public.services to authenticated;

