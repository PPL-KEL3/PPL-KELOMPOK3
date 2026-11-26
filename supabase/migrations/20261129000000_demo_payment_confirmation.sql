-- Konfirmasi pembayaran simulasi untuk demo lokal.
-- Customer hanya dapat mengonfirmasi payment miliknya sendiri dan sesi aktif.

create or replace function public.confirm_demo_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  current_payment public.payments;
begin
  if auth.uid() is null then
    raise exception 'Autentikasi diperlukan untuk konfirmasi pembayaran.' using errcode = '42501';
  end if;

  select * into current_payment
  from public.payments
  where id = p_payment_id;

  if not found or current_payment.customer_id <> auth.uid() then
    raise exception 'Kamu tidak memiliki akses ke pembayaran ini.' using errcode = '42501';
  end if;

  if current_payment.status = 'paid' then
    return current_payment;
  end if;

  if current_payment.session_status <> 'active'
     or current_payment.expires_at <= timezone('utc', now()) then
    raise exception 'Sesi pembayaran sudah tidak aktif.' using errcode = 'P0001';
  end if;

  update public.payments
  set status = 'paid',
      session_status = 'completed',
      paid_at = timezone('utc', now())
  where id = p_payment_id
    and customer_id = auth.uid()
    and status = 'unpaid';

  insert into public.payment_session_events (payment_id, session_version, event_type)
  values (current_payment.id, current_payment.session_version, 'completed');

  select * into current_payment
  from public.payments
  where id = p_payment_id;

  return current_payment;
end;
$$;

revoke all on function public.confirm_demo_payment(uuid) from public;
grant execute on function public.confirm_demo_payment(uuid) to authenticated;
