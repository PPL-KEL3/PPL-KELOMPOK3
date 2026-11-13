-- TPR-78: detail kebutuhan customer dan foto referensi booking.
-- Bucket private; akses file diberikan melalui signed URL setelah ownership diverifikasi.

create table if not exists public.booking_requirements (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.booking_requirement_attachments (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.booking_requirements (id) on delete cascade,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  storage_path text not null unique,
  content_type text not null,
  file_size bigint not null check (file_size > 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists booking_requirements_booking_idx
  on public.booking_requirements (booking_id);
create index if not exists booking_requirement_attachments_requirement_idx
  on public.booking_requirement_attachments (requirement_id, created_at);

drop trigger if exists booking_requirements_set_updated_at on public.booking_requirements;
create trigger booking_requirements_set_updated_at
  before update on public.booking_requirements
  for each row execute function public.set_updated_at();

alter table public.booking_requirements enable row level security;
alter table public.booking_requirement_attachments enable row level security;

drop policy if exists "booking_requirements_read_participant" on public.booking_requirements;
create policy "booking_requirements_read_participant"
  on public.booking_requirements for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_id and (b.customer_id = auth.uid() or b.provider_id = auth.uid())
  ));

drop policy if exists "booking_requirements_insert_customer" on public.booking_requirements;
create policy "booking_requirements_insert_customer"
  on public.booking_requirements for insert to authenticated
  with check (exists (
    select 1 from public.bookings b
    where b.id = booking_id and b.customer_id = auth.uid()
      and b.status = 'pending_provider_confirmation'
  ));

drop policy if exists "booking_requirements_update_customer" on public.booking_requirements;
create policy "booking_requirements_update_customer"
  on public.booking_requirements for update to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_id and b.customer_id = auth.uid()
      and b.status = 'pending_provider_confirmation'
  ))
  with check (exists (
    select 1 from public.bookings b
    where b.id = booking_id and b.customer_id = auth.uid()
      and b.status = 'pending_provider_confirmation'
  ));

drop policy if exists "booking_requirements_delete_customer" on public.booking_requirements;
create policy "booking_requirements_delete_customer"
  on public.booking_requirements for delete to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_id and b.customer_id = auth.uid()
      and b.status = 'pending_provider_confirmation'
  ));

drop policy if exists "booking_requirement_attachments_read_participant" on public.booking_requirement_attachments;
create policy "booking_requirement_attachments_read_participant"
  on public.booking_requirement_attachments for select to authenticated
  using (exists (
    select 1 from public.booking_requirements r
    join public.bookings b on b.id = r.booking_id
    where r.id = requirement_id and (b.customer_id = auth.uid() or b.provider_id = auth.uid())
  ));

drop policy if exists "booking_requirement_attachments_insert_customer" on public.booking_requirement_attachments;
create policy "booking_requirement_attachments_insert_customer"
  on public.booking_requirement_attachments for insert to authenticated
  with check (exists (
    select 1 from public.booking_requirements r
    join public.bookings b on b.id = r.booking_id
    where r.id = requirement_id and b.customer_id = auth.uid()
      and b.status = 'pending_provider_confirmation'
  ));

drop policy if exists "booking_requirement_attachments_delete_customer" on public.booking_requirement_attachments;
create policy "booking_requirement_attachments_delete_customer"
  on public.booking_requirement_attachments for delete to authenticated
  using (exists (
    select 1 from public.booking_requirements r
    join public.bookings b on b.id = r.booking_id
    where r.id = requirement_id and b.customer_id = auth.uid()
      and b.status = 'pending_provider_confirmation'
  ));

grant select, insert, update, delete on public.booking_requirements to authenticated;
grant select, insert, delete on public.booking_requirement_attachments to authenticated;

insert into storage.buckets (id, name, public)
values ('booking-references', 'booking-references', false)
on conflict (id) do update set public = false;

drop policy if exists "booking_references_read_participant" on storage.objects;
create policy "booking_references_read_participant"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'booking-references' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
      select 1
      from public.booking_requirement_attachments a
      join public.booking_requirements r on r.id = a.requirement_id
      join public.bookings b on b.id = r.booking_id
      where a.storage_path = name and (b.customer_id = auth.uid() or b.provider_id = auth.uid())
      )
    )
  );

drop policy if exists "booking_references_insert_customer" on storage.objects;
create policy "booking_references_insert_customer"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'booking-references'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'customer'
    )
  );

drop policy if exists "booking_references_delete_customer" on storage.objects;
create policy "booking_references_delete_customer"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'booking-references'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
