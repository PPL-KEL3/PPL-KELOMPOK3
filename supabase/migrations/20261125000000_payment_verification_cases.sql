-- TPR-110: kasus pengecualian/verifikasi pembayaran.
-- Kasus adalah entitas penanganan dan tidak mengubah status payment.

create table if not exists public.payment_verification_cases (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  issue_type text not null check (issue_type in (
    'amount_mismatch',
    'gateway_status_mismatch',
    'payment_confirmation_problem',
    'suspected_duplicate',
    'payment_session_problem',
    'other'
  )),
  description text not null check (char_length(trim(description)) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'duplicate', 'closed')),
  assigned_admin_id uuid references public.profiles (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict,
  decision_notes text check (decision_notes is null or char_length(trim(decision_notes)) between 1 and 2000),
  duplicate_of_case_id uuid references public.payment_verification_cases (id) on delete restrict,
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payment_verification_duplicate_check check (
    (status = 'duplicate' and duplicate_of_case_id is not null)
    or (status <> 'duplicate')
  ),
  constraint payment_verification_closed_check check (
    (status = 'closed' and closed_at is not null)
    or (status <> 'closed' and closed_at is null)
  )
);

create index if not exists payment_verification_cases_status_created_idx
  on public.payment_verification_cases (status, created_at desc);
create index if not exists payment_verification_cases_payment_idx
  on public.payment_verification_cases (payment_id, created_at desc);
create index if not exists payment_verification_cases_booking_idx
  on public.payment_verification_cases (booking_id, created_at desc);

drop trigger if exists payment_verification_cases_set_updated_at on public.payment_verification_cases;
create trigger payment_verification_cases_set_updated_at
  before update on public.payment_verification_cases
  for each row execute function public.set_updated_at();

create table if not exists public.payment_verification_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.payment_verification_cases (id) on delete restrict,
  actor_admin_id uuid not null references public.profiles (id) on delete restrict,
  event_type text not null check (event_type in ('created', 'updated', 'closed', 'marked_duplicate')),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists payment_verification_case_events_case_idx
  on public.payment_verification_case_events (case_id, created_at desc);

alter table public.payment_verification_cases enable row level security;
alter table public.payment_verification_case_events enable row level security;

drop policy if exists "payment_verification_cases_admin_all" on public.payment_verification_cases;
create policy "payment_verification_cases_admin_all"
  on public.payment_verification_cases for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "payment_verification_events_admin_all" on public.payment_verification_case_events;
create policy "payment_verification_events_admin_all"
  on public.payment_verification_case_events for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

grant select, insert, update on public.payment_verification_cases to authenticated;
grant select, insert on public.payment_verification_case_events to authenticated;
