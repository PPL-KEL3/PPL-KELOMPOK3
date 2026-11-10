-- LOKA provider service areas (TPR-10)
-- Daftar wilayah layanan + radius per penyedia jasa, disimpan sebagai JSONB
-- pada tabel provider_profiles agar tetap sederhana tanpa tabel tambahan.
--
-- Bentuk data:
-- [
--   { "id": "uuid", "areaName": "Kecamatan Coblong", "radiusKm": 5 }
-- ]

alter table public.provider_profiles
  add column if not exists service_areas jsonb not null default '[]'::jsonb;

alter table public.provider_profiles
  drop constraint if exists provider_profiles_service_areas_array_check;

alter table public.provider_profiles
  add constraint provider_profiles_service_areas_array_check
  check (jsonb_typeof(service_areas) = 'array');
