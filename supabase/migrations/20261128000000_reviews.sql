-- LOKA Reviews & Ratings (TPR-19 / PBI-19)
-- Mengelola rating dan ulasan pelanggan setelah transaksi booking selesai/diterima
-- Relasi:
-- - booking_id -> public.bookings(id) ON DELETE CASCADE (1 booking = 1 review)
-- - customer_id -> public.profiles(id) ON DELETE CASCADE
-- - provider_id -> public.profiles(id) ON DELETE CASCADE
-- - service_id -> public.services(id) ON DELETE CASCADE

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique
    references public.bookings (id) on delete cascade,
  customer_id uuid not null
    references public.profiles (id) on delete cascade,
  provider_id uuid not null
    references public.profiles (id) on delete cascade,
  service_id uuid not null
    references public.services (id) on delete cascade,
  rating integer not null
    check (rating between 1 and 5),
  comment text not null
    check (char_length(trim(comment)) between 10 and 1000),
  edit_count integer not null default 0
    check (edit_count >= 0 and edit_count <= 3),
  is_edited boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists reviews_provider_created_idx
  on public.reviews (provider_id, created_at desc);

create index if not exists reviews_service_created_idx
  on public.reviews (service_id, created_at desc);

create index if not exists reviews_customer_created_idx
  on public.reviews (customer_id, created_at desc);

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
  before update on public.reviews
  for each row
  execute function public.set_updated_at();

-- Row Level Security (RLS)
alter table public.reviews enable row level security;

-- Publik dan seluruh pengguna dapat melihat ulasan pada profil penyedia
create policy "reviews_select_public"
  on public.reviews for select
  using (true);

-- Hanya pelanggan pemilik booking yang dapat menambahkan ulasan
create policy "reviews_insert_own"
  on public.reviews for insert
  with check (auth.uid() = customer_id);

-- Hanya pelanggan pemilik ulasan yang dapat memperbarui
create policy "reviews_update_own"
  on public.reviews for update
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

-- Hanya pelanggan pemilik ulasan yang dapat menarik/menghapus
create policy "reviews_delete_own"
  on public.reviews for delete
  using (auth.uid() = customer_id);
