-- TPR-75: booking aktif tidak boleh memakai slot provider yang sama.
-- Booking cancelled tidak memblokir slot kembali.
create unique index if not exists bookings_provider_active_slot_uidx
  on public.bookings (provider_id, work_date, work_time)
  where status in ('pending_provider_confirmation', 'accepted');
