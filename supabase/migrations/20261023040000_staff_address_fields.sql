-- One address: extra line and country. Street, city, state and postal code already exist.

alter table public.staff_profiles
  add column current_line2 text check (current_line2 is null or char_length(current_line2) <= 160),
  add column current_country text check (current_country is null or char_length(current_country) <= 80);

grant select (current_line2, current_country),
  insert (current_line2, current_country),
  update (current_line2, current_country)
  on public.staff_profiles to authenticated;
