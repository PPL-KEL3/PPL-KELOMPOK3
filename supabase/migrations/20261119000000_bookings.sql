-- LOKA bookings (TPR-74)
-- Alur awal: pending_provider_confirmation -> accepted/cancelled.
-- Validasi ketersediaan dan konflik jadwal rinci menjadi tanggung jawab TPR-75.

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  package_id uuid references public.service_packages (id) on delete restrict,
  work_date date not null,
  work_time text not null check (char_length(trim(work_time)) between 1 and 50),
  idempotency_key text check (idempotency_key is null or char_length(trim(idempotency_key)) between 1 and 100),
  price integer not null check (price between 0 and 100000000),
  status text not null default 'pending_provider_confirmation'
    check (status in ('pending_provider_confirmation', 'accepted', 'cancelled')),
  cancellation_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint bookings_service_fkey
    foreign key (service_id)
    references public.services (id)
    on delete restrict
);

create index if not exists bookings_customer_created_idx
  on public.bookings (customer_id, created_at desc);
create index if not exists bookings_provider_created_idx
  on public.bookings (provider_id, created_at desc);
create index if not exists bookings_service_schedule_idx
  on public.bookings (service_id, work_date, work_time, status);
create unique index if not exists bookings_customer_idempotency_uidx
  on public.bookings (customer_id, idempotency_key)
  where idempotency_key is not null;

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

alter table public.bookings enable row level security;

drop policy if exists "bookings_select_participant_or_admin" on public.bookings;
create policy "bookings_select_participant_or_admin"
  on public.bookings for select to authenticated
  using (
    auth.uid() = customer_id
    or auth.uid() = provider_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "bookings_insert_customer_own_service" on public.bookings;
create policy "bookings_insert_customer_own_service"
  on public.bookings for insert to authenticated
  with check (
    auth.uid() = customer_id
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'customer')
    and exists (
      select 1 from public.services
      where services.id = service_id
        and services.provider_id = bookings.provider_id
        and services.is_active = true
    )
  );

drop policy if exists "bookings_update_participant" on public.bookings;
create policy "bookings_update_participant"
  on public.bookings for update to authenticated
  using (auth.uid() = customer_id or auth.uid() = provider_id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (auth.uid() = customer_id or auth.uid() = provider_id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

grant select, insert, update on public.bookings to authenticated;
