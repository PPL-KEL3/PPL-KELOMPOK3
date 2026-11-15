-- TPR-111: audit keputusan kasus dibuat append-only dan otomatis dalam transaksi
-- yang sama dengan insert/update payment_verification_cases.

alter table public.payment_verification_case_events
  drop constraint if exists payment_verification_case_events_event_type_check;
alter table public.payment_verification_case_events
  add constraint payment_verification_case_events_event_type_check
  check (event_type in ('created', 'updated', 'closed', 'marked_duplicate', 'status_changed', 'decision_recorded'));

create or replace function public.audit_payment_verification_case_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  action text;
begin
  if actor_id is null then
    raise exception 'authenticated admin context is required for verification case audit';
  end if;

  if tg_op = 'INSERT' then
    insert into public.payment_verification_case_events (
      case_id, actor_admin_id, event_type, from_status, to_status, note
    ) values (
      new.id, actor_id, 'created', null, new.status, new.description
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    action := case
      when new.status = 'closed' then 'closed'
      when new.status = 'duplicate' then 'marked_duplicate'
      else 'status_changed'
    end;
  else
    action := 'decision_recorded';
  end if;

  insert into public.payment_verification_case_events (
    case_id, actor_admin_id, event_type, from_status, to_status, note
  ) values (
    new.id, actor_id, action, old.status, new.status,
    coalesce(new.decision_notes, new.description)
  );
  return new;
end;
$$;

drop trigger if exists payment_verification_case_audit on public.payment_verification_cases;
create trigger payment_verification_case_audit
  after insert or update on public.payment_verification_cases
  for each row execute function public.audit_payment_verification_case_change();

-- Audit bersifat historis: client authenticated hanya boleh membaca dan trigger
-- database yang menulis. Tidak ada endpoint untuk mengubah/menghapus histori.
drop policy if exists "payment_verification_events_admin_all" on public.payment_verification_case_events;
drop policy if exists "payment_verification_events_admin_select" on public.payment_verification_case_events;
create policy "payment_verification_events_admin_select"
  on public.payment_verification_case_events for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

revoke insert, update, delete on public.payment_verification_case_events from authenticated;
grant select on public.payment_verification_case_events to authenticated;
