-- A VA sets a password, then stays out of the portal until an admin confirms the profile.
-- Closers and admins still become active on the first sign-in.

alter table public.profiles add column signed_in_at timestamptz;

update public.profiles p
set signed_in_at = u.last_sign_in_at
from auth.users u
where u.id = p.id and u.last_sign_in_at is not null and p.signed_in_at is null;

create type public.staff_review_status as enum ('pending', 'pending_review', 'approved');

alter table public.staff_profiles
  add column review_status public.staff_review_status not null default 'pending',
  add column returned_sections text[] not null default '{}',
  add column return_note text,
  add constraint staff_profiles_return_note_check check (return_note is null or char_length(return_note) <= 500),
  add constraint staff_profiles_returned_sections_check check (
    returned_sections <@ array['basic', 'address', 'contact', 'skills', 'experience']::text[]
  );

-- People already in the portal keep their access.
update public.staff_profiles s
set review_status = 'approved'
from public.profiles p
where p.id = s.user_id and p.status = 'active';

-- Readable with the profile. Writes stay on the secret key, same as registration progress.
grant select (review_status, returned_sections, return_note) on public.staff_profiles to authenticated;

create or replace function private.handle_user_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  va_only boolean;
begin
  select exists (select 1 from public.roles r where r.user_id = new.id and r.role = 'va')
     and not exists (select 1 from public.roles r where r.user_id = new.id and r.role in ('admin', 'closer'))
    into va_only;

  update public.profiles
  set email = lower(new.email),
      signed_in_at = case when new.last_sign_in_at is not null then coalesce(signed_in_at, new.last_sign_in_at) else signed_in_at end,
      -- A VA stays invited until an admin confirms the profile. Everyone else is activated here.
      status = case
        when status = 'invited' and new.last_sign_in_at is not null and not va_only then 'active'
        else status
      end
  where id = new.id
    and (
      email is distinct from lower(new.email)
      or (signed_in_at is null and new.last_sign_in_at is not null)
      or (status = 'invited' and new.last_sign_in_at is not null and not va_only)
    );
  return new;
end;
$$;
