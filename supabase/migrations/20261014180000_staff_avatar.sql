-- Profile photo (kept off the authenticated grants, same as a résumé) and Divorced as its own marital status.
-- "Other" for gender reuses the existing non_binary value, so that enum is unchanged.

alter type public.staff_marital_status add value if not exists 'divorced';

alter table public.staff_profiles
  add column avatar_type text,
  add column avatar_bytes bytea,
  add constraint staff_profiles_avatar_type check (
    avatar_type is null or avatar_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  add constraint staff_profiles_avatar_size check (
    avatar_bytes is null or octet_length(avatar_bytes) <= 524288
  ),
  add constraint staff_profiles_avatar_pair check (
    (avatar_type is null) = (avatar_bytes is null)
  );
