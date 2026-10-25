-- Clock preference chosen on My Profile and shown on the staff profile. 12-hour is the default.

alter table public.staff_profiles
  add column time_format text not null default '12'
    check (time_format in ('12', '24'));

grant select (time_format), insert (time_format), update (time_format)
  on public.staff_profiles to authenticated;
