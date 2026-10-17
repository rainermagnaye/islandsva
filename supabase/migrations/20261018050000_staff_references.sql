-- Professional references on a staff profile. Up to 3, matching STAFF_LIMITS.references.
-- The app writes this with the secret key; the column grant lets the signed-in profile read it back.

alter table public.staff_profiles
  add column if not exists job_references jsonb not null default '[]'::jsonb;

do $$
begin
  alter table public.staff_profiles
    add constraint staff_profiles_job_references_check
    check (jsonb_typeof(job_references) = 'array' and jsonb_array_length(job_references) <= 3);
exception
  when duplicate_object or duplicate_table then null;
end
$$;

grant select (job_references), insert (job_references), update (job_references)
  on public.staff_profiles to authenticated;
