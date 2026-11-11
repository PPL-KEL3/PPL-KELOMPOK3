-- LOKA provider profiles (TPR-9)
-- Profil publik penyedia jasa + kontak WhatsApp, alamat, area layanan,
-- jam operasional per hari, dan kategori utama.
--
-- Catatan: aturan verifikasi provider belum diterapkan pada PBI ini.
-- Semua akun dengan role `provider` boleh melengkapi dan mempublikasikan profil.

create table if not exists public.provider_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  business_name text not null
    check (char_length(trim(business_name)) between 2 and 80),
  bio text
    check (bio is null or char_length(trim(bio)) <= 500),
  whatsapp_number text not null
    check (whatsapp_number ~ '^628[0-9]{7,12}$'),
  address text not null
    check (char_length(trim(address)) between 5 and 255),
  service_area text not null
    check (char_length(trim(service_area)) between 3 and 100),
  operating_hours jsonb not null
    check (
      jsonb_typeof(operating_hours) = 'object'
      and operating_hours ?& array[
        'monday','tuesday','wednesday','thursday',
        'friday','saturday','sunday'
      ]
    ),
  primary_category_id uuid not null
    references public.categories (id) on delete restrict,
  is_public boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists provider_profiles_public_idx
  on public.provider_profiles (is_public)
  where is_public = true;

create index if not exists provider_profiles_primary_category_idx
  on public.provider_profiles (primary_category_id);

drop trigger if exists provider_profiles_set_updated_at on public.provider_profiles;
create trigger provider_profiles_set_updated_at
  before update on public.provider_profiles
  for each row
  execute function public.set_updated_at();

alter table public.provider_profiles enable row level security;

-- Profil yang dipublikasikan boleh dibaca siapa saja (termasuk anon).
-- Pemilik tetap dapat membaca profilnya sendiri meskipun masih disembunyikan.
drop policy if exists "provider_profiles_select_public_or_owner" on public.provider_profiles;
create policy "provider_profiles_select_public_or_owner"
  on public.provider_profiles
  for select
  to anon, authenticated
  using (
    is_public = true
    or auth.uid() = profile_id
  );

-- Hanya pemilik akun yang ber-role provider yang dapat membuat profilnya.
drop policy if exists "provider_profiles_insert_owner_provider" on public.provider_profiles;
create policy "provider_profiles_insert_owner_provider"
  on public.provider_profiles
  for insert
  to authenticated
  with check (
    auth.uid() = profile_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'provider'
    )
  );

-- Hanya pemilik akun yang ber-role provider yang dapat memperbarui profilnya.
drop policy if exists "provider_profiles_update_owner_provider" on public.provider_profiles;
create policy "provider_profiles_update_owner_provider"
  on public.provider_profiles
  for update
  to authenticated
  using (
    auth.uid() = profile_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'provider'
    )
  )
  with check (
    auth.uid() = profile_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'provider'
    )
  );

-- Hapus profil hanya oleh pemilik (opsional, untuk kebutuhan administratif).
drop policy if exists "provider_profiles_delete_owner_provider" on public.provider_profiles;
create policy "provider_profiles_delete_owner_provider"
  on public.provider_profiles
  for delete
  to authenticated
  using (
    auth.uid() = profile_id
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'provider'
    )
  );

grant select on public.provider_profiles to anon, authenticated;
grant insert, update, delete on public.provider_profiles to authenticated;
