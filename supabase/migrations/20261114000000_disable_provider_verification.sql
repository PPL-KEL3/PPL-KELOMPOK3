-- Providers are trusted immediately in the current demo/business flow.
-- Run this migration in Supabase SQL Editor for existing projects.

update public.profiles
set provider_verification_status = 'verified',
    provider_rejection_reason = null
where role = 'provider';

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
  safe_role := case when requested_role in ('customer', 'provider') then requested_role else 'customer' end;
  display_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');

  insert into public.profiles (id, email, full_name, role, provider_verification_status)
  values (
    new.id,
    new.email,
    coalesce(display_name, split_part(coalesce(new.email, ''), '@', 1)),
    safe_role,
    case when safe_role = 'provider' then 'verified' else null end
  )
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;

-- Existing policies are replaced so providers no longer need a verified flag.
drop policy if exists "services_insert_verified_provider" on public.services;
create policy "services_insert_verified_provider"
  on public.services for insert to authenticated
  with check (
    auth.uid() = provider_id
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'provider')
  );

drop policy if exists "services_update_own_verified_provider" on public.services;
create policy "services_update_own_verified_provider"
  on public.services for update to authenticated
  using (
    auth.uid() = provider_id
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'provider')
  )
  with check (
    auth.uid() = provider_id
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'provider')
  );

drop policy if exists "services_delete_own_verified_provider" on public.services;
create policy "services_delete_own_verified_provider"
  on public.services for delete to authenticated
  using (
    auth.uid() = provider_id
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'provider')
  );
