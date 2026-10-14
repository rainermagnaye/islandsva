-- Staff profile details, filled after an invite. One row per person. The account itself stays on profiles.
-- Registration status is written by the app from which sections are filled; the database only stores it.

create type public.staff_gender as enum ('female', 'male', 'non_binary', 'prefer_not_to_say');
create type public.staff_marital_status as enum ('single', 'married', 'widowed', 'separated', 'prefer_not_to_say');
create type public.staff_registration_status as enum ('pending', 'in_progress', 'completed');

create table public.staff_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  date_of_birth date,
  gender public.staff_gender,
  nationality text check (nationality is null or char_length(nationality) <= 80),
  marital_status public.staff_marital_status,
  current_street text check (current_street is null or char_length(current_street) <= 160),
  current_city text check (current_city is null or char_length(current_city) <= 80),
  current_province text check (current_province is null or char_length(current_province) <= 80),
  current_postal_code text check (current_postal_code is null or char_length(current_postal_code) <= 20),
  permanent_street text check (permanent_street is null or char_length(permanent_street) <= 160),
  permanent_city text check (permanent_city is null or char_length(permanent_city) <= 80),
  permanent_province text check (permanent_province is null or char_length(permanent_province) <= 80),
  permanent_postal_code text check (permanent_postal_code is null or char_length(permanent_postal_code) <= 20),
  mobile_number text check (mobile_number is null or char_length(mobile_number) <= 40),
  alternate_phone text check (alternate_phone is null or char_length(alternate_phone) <= 40),
  emergency_name text check (emergency_name is null or char_length(emergency_name) <= 120),
  emergency_relationship text check (emergency_relationship is null or char_length(emergency_relationship) <= 40),
  emergency_phone text check (emergency_phone is null or char_length(emergency_phone) <= 40),
  highest_education text check (highest_education is null or char_length(highest_education) <= 160),
  certifications text check (certifications is null or char_length(certifications) <= 500),
  skills text check (skills is null or char_length(skills) <= 500),
  languages text check (languages is null or char_length(languages) <= 200),
  employers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(employers) = 'array' and jsonb_array_length(employers) <= 8),
  key_responsibilities text check (key_responsibilities is null or char_length(key_responsibilities) <= 2000),
  achievements text check (achievements is null or char_length(achievements) <= 2000),
  resume_name text check (resume_name is null or char_length(resume_name) <= 200),
  resume_type text check (resume_type is null or resume_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  -- The file itself. Kept off the authenticated select grant so a list query can't pull every resume.
  resume_bytes bytea check (resume_bytes is null or octet_length(resume_bytes) <= 2097152),
  registration_status public.staff_registration_status not null default 'pending',
  invitation_sent_at timestamptz not null default now(),
  registration_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger staff_profiles_set_updated_at before update on public.staff_profiles
  for each row execute function private.set_updated_at();

grant select, insert, update, delete on public.staff_profiles to service_role;

-- The person fills their own profile. An admin with two-factor sign-in fills anyone's.
-- resume_bytes stays server-only: the app checks the file, then writes it with the secret key.
grant select (
  user_id, date_of_birth, gender, nationality, marital_status,
  current_street, current_city, current_province, current_postal_code,
  permanent_street, permanent_city, permanent_province, permanent_postal_code,
  mobile_number, alternate_phone, emergency_name, emergency_relationship, emergency_phone,
  highest_education, certifications, skills, languages, employers,
  key_responsibilities, achievements, resume_name, resume_type,
  registration_status, invitation_sent_at, registration_completed_at, updated_at
) on public.staff_profiles to authenticated;

grant insert (
  user_id, date_of_birth, gender, nationality, marital_status,
  current_street, current_city, current_province, current_postal_code,
  permanent_street, permanent_city, permanent_province, permanent_postal_code,
  mobile_number, alternate_phone, emergency_name, emergency_relationship, emergency_phone,
  highest_education, certifications, skills, languages, employers,
  key_responsibilities, achievements, resume_name, resume_type,
  registration_status, invitation_sent_at, registration_completed_at
), update (
  date_of_birth, gender, nationality, marital_status,
  current_street, current_city, current_province, current_postal_code,
  permanent_street, permanent_city, permanent_province, permanent_postal_code,
  mobile_number, alternate_phone, emergency_name, emergency_relationship, emergency_phone,
  highest_education, certifications, skills, languages, employers,
  key_responsibilities, achievements, resume_name, resume_type,
  registration_status, invitation_sent_at, registration_completed_at
) on public.staff_profiles to authenticated;

alter table public.staff_profiles enable row level security;

create policy "Read own staff profile; admins read all" on public.staff_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "Insert own staff profile; admins insert any" on public.staff_profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "Update own staff profile; admins update any" on public.staff_profiles
  for update to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()))
  with check (user_id = (select auth.uid()) or (select private.is_admin()));
