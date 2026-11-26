-- Soft delete untuk memenuhi operasi Delete pada kasus verifikasi.
-- Payment, booking, dan audit log tidak pernah dihapus.

alter table public.payment_verification_cases
  add column if not exists deleted_at timestamptz;

create index if not exists payment_verification_cases_active_idx
  on public.payment_verification_cases (created_at desc)
  where deleted_at is null;
