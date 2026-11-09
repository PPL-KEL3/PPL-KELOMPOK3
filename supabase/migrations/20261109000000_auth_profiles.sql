-- LOKA authentication profiles
-- Run this in the Supabase SQL editor (or via `supabase db push`).
--
-- Public registration may only create `customer` or `provider` profiles.
-- Admin profiles must be granted manually by an authorized operator.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'customer'
    check (role in ('customer', 'provider', 'admin')),
  provider_verification_status text
    check (provider_verification_status in ('pending', 'verified', 'rejected')),
  provider_rejection_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists profiles_email_idx on public.profiles (lower(email));

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Only expose the profile table for reading. Role/verification updates happen
-- through a security-definer function or privileged operator access.
revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  safe_role text;
  display_name text;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data ->> 'role', 'customer'));

  -- Never allow a public signup to create an admin account, even when the
  -- Supabase Auth API is called directly with custom metadata.
  if requested_role in ('customer', 'provider') then
    safe_role := requested_role;
  else
    safe_role := 'customer';
  end if;

  display_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    provider_verification_status
  )
  values (
    new.id,
    new.email,
    coalesce(display_name, split_part(coalesce(new.email, ''), '@', 1)),
    safe_role,
    case when safe_role = 'provider' then 'pending' else null end
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill users created before this migration existed.
insert into public.profiles (
  id,
  email,
  full_name,
  role,
  provider_verification_status
)
select
  users.id,
  users.email,
  coalesce(
    nullif(trim(coalesce(users.raw_user_meta_data ->> 'full_name', '')), ''),
    split_part(coalesce(users.email, ''), '@', 1)
  ),
  case
    when lower(coalesce(users.raw_user_meta_data ->> 'role', 'customer')) = 'provider'
      then 'provider'
    else 'customer'
  end,
  case
    when lower(coalesce(users.raw_user_meta_data ->> 'role', 'customer')) = 'provider'
      then 'pending'
    else null
  end
from auth.users
on conflict (id) do nothing;

-- Providers may re-submit a rejected application. The function can only ever
-- move their own account to `pending`; it can never set `verified`.
create or replace function public.request_provider_verification()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
  current_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select role, provider_verification_status
    into current_role, current_status
    from public.profiles
    where id = auth.uid();

  if current_role is null then
    raise exception 'Profile not found';
  end if;

  if current_role <> 'provider' then
    raise exception 'Only providers can request verification';
  end if;

  if current_status = 'verified' then
    raise exception 'Provider is already verified';
  end if;

  update public.profiles
    set provider_verification_status = 'pending',
        provider_rejection_reason = null
    where id = auth.uid();
end;
$$;

revoke all on function public.request_provider_verification() from public;
grant execute on function public.request_provider_verification() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin provisioning (run manually, never from the public app)
-- ---------------------------------------------------------------------------
-- 1. Create the user from the Supabase Dashboard (Authentication > Users), or
--    let them register normally.
-- 2. Promote that account with:
--
--    update public.profiles
--       set role = 'admin',
--           provider_verification_status = null,
--           provider_rejection_reason = null
--     where email = 'admin-account@example.com';
--
-- The email above is a placeholder. Do not commit real credentials.
