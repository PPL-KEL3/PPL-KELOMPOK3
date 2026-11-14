-- TPR-74: service_id sebelumnya memiliki FK inline dan FK bernama yang sama.
-- Dua relasi membuat PostgREST gagal melakukan embed services(name) karena relasi ambigu.
-- Pertahankan FK bernama bookings_service_fkey yang dipakai query backend.
alter table if exists public.bookings
  drop constraint if exists bookings_service_id_fkey;
