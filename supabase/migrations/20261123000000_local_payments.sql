-- Pembayaran lokal LOKA.
-- TPR-106 pada project ini tidak terhubung ke payment gateway eksternal.
-- Status paid hanya dapat ditetapkan oleh administrator melalui backend.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  amount integer not null check (amount between 0 and 100000000),
  payment_method text not null default 'qris' check (payment_method = 'qris'),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payments_paid_at_consistency check (
    (status = 'paid' and paid_at is not null)
    or (status = 'unpaid' and paid_at is null)
  )
);

create index if not exists payments_customer_created_idx
  on public.payments (customer_id, created_at desc);

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

drop policy if exists "payments_select_owner_or_admin" on public.payments;
create policy "payments_select_owner_or_admin"
  on public.payments for select to authenticated
  using (
    auth.uid() = customer_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "payments_insert_customer_own_booking" on public.payments;
create policy "payments_insert_customer_own_booking"
  on public.payments for insert to authenticated
  with check (
    auth.uid() = customer_id
    and exists (
      select 1 from public.bookings
      where bookings.id = booking_id
        and bookings.customer_id = auth.uid()
    )
  );

drop policy if exists "payments_update_admin_only" on public.payments;
create policy "payments_update_admin_only"
  on public.payments for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

grant select, insert, update on public.payments to authenticated;
