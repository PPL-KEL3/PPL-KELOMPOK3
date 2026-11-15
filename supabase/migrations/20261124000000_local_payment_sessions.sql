-- Lifecycle sesi pembayaran lokal untuk TPR-107.
-- Tidak terhubung ke payment gateway dan tidak menerbitkan QRIS nyata.

alter table public.payments
  add column if not exists session_status text not null default 'active',
  add column if not exists expires_at timestamptz not null default (timezone('utc', now()) + interval '30 minutes'),
  add column if not exists cancelled_at timestamptz,
  add column if not exists session_version integer not null default 1;

update public.payments
set expires_at = coalesce(expires_at, timezone('utc', now()) + interval '30 minutes')
where expires_at is null;

update public.payments
set session_status = 'completed'
where status = 'paid';

alter table public.payments
  drop constraint if exists payments_session_status_check;
alter table public.payments
  add constraint payments_session_status_check
  check (session_status in ('active', 'expired', 'cancelled', 'completed'));

alter table public.payments
  drop constraint if exists payments_session_version_check;
alter table public.payments
  add constraint payments_session_version_check check (session_version > 0);

alter table public.payments
  drop constraint if exists payments_session_consistency_check;
alter table public.payments
  add constraint payments_session_consistency_check check (
    (status = 'paid' and session_status = 'completed' and paid_at is not null)
    or (status = 'unpaid' and session_status in ('active', 'expired', 'cancelled') and paid_at is null)
  );

-- Customer boleh menutup sesi miliknya, tetapi tidak pernah boleh menulis status paid.
drop policy if exists "payments_update_customer_session" on public.payments;
create policy "payments_update_customer_session"
  on public.payments for update to authenticated
  using (auth.uid() = customer_id and status = 'unpaid')
  with check (
    auth.uid() = customer_id
    and status = 'unpaid'
    and paid_at is null
    and session_status in ('active', 'expired', 'cancelled')
  );

create table if not exists public.payment_session_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  session_version integer not null check (session_version > 0),
  event_type text not null check (event_type in ('created', 'expired', 'regenerated', 'cancelled', 'completed')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists payment_session_events_payment_idx
  on public.payment_session_events (payment_id, created_at desc);

alter table public.payment_session_events enable row level security;

drop policy if exists "payment_session_events_select_owner_or_admin" on public.payment_session_events;
create policy "payment_session_events_select_owner_or_admin"
  on public.payment_session_events for select to authenticated
  using (
    exists (
      select 1 from public.payments
      where payments.id = payment_id
        and (payments.customer_id = auth.uid()
          or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
    )
  );

drop policy if exists "payment_session_events_insert_owner_or_admin" on public.payment_session_events;
create policy "payment_session_events_insert_owner_or_admin"
  on public.payment_session_events for insert to authenticated
  with check (
    exists (
      select 1 from public.payments
      where payments.id = payment_id
        and (payments.customer_id = auth.uid()
          or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
    )
  );

grant select, insert on public.payment_session_events to authenticated;
