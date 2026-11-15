-- LOKA Customer Favorites (TPR-18 / PBI-18)
-- Mengelola daftar jasa & profil penyedia favorit milik pelanggan
-- Relasi:
-- - customer_id -> public.profiles(id) ON DELETE CASCADE
-- - service_id -> public.services(id) ON DELETE CASCADE (jika item_type = 'service')
-- - provider_id -> public.profiles(id) ON DELETE CASCADE (jika item_type = 'provider')

create table if not exists public.customer_favorites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null
    references public.profiles (id) on delete cascade,
  item_type text not null
    check (item_type in ('service', 'provider')),
  service_id uuid
    references public.services (id) on delete cascade,
  provider_id uuid
    references public.profiles (id) on delete cascade,
  label text
    check (label is null or char_length(trim(label)) <= 50),
  notes text
    check (notes is null or char_length(trim(notes)) <= 500),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint chk_favorite_item_target check (
    (item_type = 'service' and service_id is not null and provider_id is null) or
    (item_type = 'provider' and provider_id is not null and service_id is null)
  )
);

-- Mencegah duplikasi favorit yang sama oleh pelanggan yang sama
create unique index if not exists customer_favorites_service_unique_idx
  on public.customer_favorites (customer_id, service_id)
  where item_type = 'service';

create unique index if not exists customer_favorites_provider_unique_idx
  on public.customer_favorites (customer_id, provider_id)
  where item_type = 'provider';

create index if not exists customer_favorites_customer_idx
  on public.customer_favorites (customer_id, created_at desc);

drop trigger if exists customer_favorites_set_updated_at on public.customer_favorites;
create trigger customer_favorites_set_updated_at
  before update on public.customer_favorites
  for each row
  execute function public.set_updated_at();

-- Row Level Security (RLS)
-- Pelanggan hanya dapat melihat, menambah, mengubah, dan menghapus favorit miliknya sendiri
alter table public.customer_favorites enable row level security;

create policy "customer_favorites_select_own"
  on public.customer_favorites for select
  using (auth.uid() = customer_id);

create policy "customer_favorites_insert_own"
  on public.customer_favorites for insert
  with check (auth.uid() = customer_id);

create policy "customer_favorites_update_own"
  on public.customer_favorites for update
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

create policy "customer_favorites_delete_own"
  on public.customer_favorites for delete
  using (auth.uid() = customer_id);
