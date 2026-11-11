-- Allow the public services catalog to resolve a provider display name.
--
-- The services API embeds profiles(full_name) when listing public services.
-- Keep email and other profile columns private: anon receives access only to
-- the two columns needed for the public catalog.

drop policy if exists "profiles_select_public_name" on public.profiles;
create policy "profiles_select_public_name"
  on public.profiles
  for select
  to anon
  using (true);

revoke all on public.profiles from anon;
grant select (id, full_name) on public.profiles to anon;
