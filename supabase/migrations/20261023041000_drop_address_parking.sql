-- Parking, usage and a second address were copied from another form and are not part of this profile.

alter table public.staff_profiles
  drop column if exists current_parking,
  drop column if exists current_usage,
  drop column if exists permanent_parking,
  drop column if exists permanent_usage,
  drop column if exists permanent_street,
  drop column if exists permanent_line2,
  drop column if exists permanent_city,
  drop column if exists permanent_province,
  drop column if exists permanent_postal_code,
  drop column if exists permanent_country;
