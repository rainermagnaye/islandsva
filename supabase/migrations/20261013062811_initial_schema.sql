-- Islands VA — authentication, roles and client access.
--
-- Identity: Supabase Auth owns auth.users (credentials, sessions, 2FA). public.profiles is our side of each
-- user — same id, email copy, account status — created by trigger when a user is invited.
-- Roles: public.roles (one row per user per role). The custom access token hook copies them into the
-- signed token, and RLS reads the token, so access checks never query the roles table per row.
--
-- Who sees which client:
--   client → their own record · VA → clients assigned to them · Closer → clients they created
--   admin (with two-factor sign-in) → everything.
-- Writes to roles and leads happen on the server only (secret key). `anon` gets nothing.

-- Default privileges: later tables, sequences and functions are granted to no API role automatically —
-- each migration grants exactly what it needs.
alter default privileges in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges in schema public revoke all on functions from anon, authenticated, service_role, public;

-- Helpers for triggers and policies live outside the API-exposed schema.
create schema if not exists private;
revoke all on schema private from public;

-- Types ------------------------------------------------------------------------------------------------------

create type public.account_status as enum ('invited', 'active', 'inactive');
create type public.app_role as enum ('client', 'va', 'closer', 'admin');
create type public.client_status as enum ('pending', 'active', 'inactive');
create type public.assignment_status as enum ('active', 'ended');
create type public.lead_status as enum ('new', 'contacted', 'qualified', 'converted', 'closed');

-- Users ------------------------------------------------------------------------------------------------------

-- invited: account created, never signed in · active · inactive: deactivated (no roles in the token).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null default '' check (char_length(full_name) <= 120),
  status public.account_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Roles ------------------------------------------------------------------------------------------------------

-- user_id references profiles (same uuid as auth.users) so the API can join users to their roles.
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id) on delete set null,
  unique (user_id, role)
);
create index roles_assigned_by_idx on public.roles (assigned_by);
create index profiles_created_at_idx on public.profiles (created_at desc); -- admin user list

-- Clients ----------------------------------------------------------------------------------------------------

-- A client company, created by a Closer and `pending` until activated. `user_id` is the client's login,
-- set when they accept their invite. Users and clients are deactivated, never deleted, so the creator,
-- assignment history and converted leads always resolve.
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on delete set null,
  company_name text not null check (char_length(company_name) between 1 and 160),
  contact_name text not null check (char_length(contact_name) between 1 and 120),
  contact_email text not null check (char_length(contact_email) <= 254 and contact_email = lower(contact_email) and contact_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  contact_phone text check (char_length(contact_phone) <= 40),
  status public.client_status not null default 'pending',
  created_by uuid not null references public.profiles (id) on delete restrict,
  activated_at timestamptz,
  notes text check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_active_has_activation check (status <> 'active' or activated_at is not null),
  constraint clients_pending_not_activated check (status <> 'pending' or activated_at is null)
);
-- Lists are newest first: a Closer's own clients, and the admin list (optionally by status).
create index clients_created_by_created_at_idx on public.clients (created_by, created_at desc);
create index clients_created_at_idx on public.clients (created_at desc);
create index clients_status_created_at_idx on public.clients (status, created_at desc);

-- Which VA works for which client: one active VA per client; history kept as ended rows.
create table public.client_va_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  va_id uuid not null references public.profiles (id) on delete restrict,
  status public.assignment_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint client_va_assignments_end_matches_status check ((status = 'ended') = (ended_at is not null)),
  constraint client_va_assignments_period_order check (ended_at >= started_at)
);
create unique index client_va_assignments_one_active_per_client on public.client_va_assignments (client_id) where status = 'active';
create index client_va_assignments_active_va_idx on public.client_va_assignments (va_id, client_id) where status = 'active';
create index client_va_assignments_client_id_idx on public.client_va_assignments (client_id, started_at desc); -- history; FK
create index client_va_assignments_assigned_by_idx on public.client_va_assignments (assigned_by);

-- Leads ------------------------------------------------------------------------------------------------------

-- Contact-form submissions (POST /api/v1/leads), server-only. Limits mirror LEAD_LIMITS.
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text not null check (char_length(email) <= 254 and email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  company_name text check (char_length(company_name) <= 160),
  message text not null check (char_length(message) between 1 and 5000),
  package_code text check (package_code ~ '^[a-z0-9-]{1,40}$'), -- site package slug; catalogue pending (M4)
  status public.lead_status not null default 'new',
  closer_id uuid references public.profiles (id) on delete set null,
  converted_client_id uuid references public.clients (id) on delete restrict,
  ip_hash text check (ip_hash ~ '^[0-9a-f]{64}$'), -- HMAC-SHA256 of the visitor's IP, never the raw IP
  user_agent text check (char_length(user_agent) <= 512),
  notified_at timestamptz, -- null: the team email hasn't been sent yet
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_converted_has_client check (status <> 'converted' or converted_client_id is not null)
);
create index leads_status_created_at_idx on public.leads (status, created_at desc);
create index leads_email_idx on public.leads (email);
create index leads_closer_id_idx on public.leads (closer_id);
create index leads_converted_client_id_idx on public.leads (converted_client_id);

-- Triggers ---------------------------------------------------------------------------------------------------

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger clients_set_updated_at before update on public.clients for each row execute function private.set_updated_at();
create trigger leads_set_updated_at before update on public.leads for each row execute function private.set_updated_at();

-- A user column may only name someone who holds one of the given roles on a usable account.
-- Usage: execute function private.enforce_role('<column>', '<role>' [, '<role>' …]). Null is allowed
-- (nullability is the column's business). Fires only when that column is written.
create function private.enforce_role() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  target uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  allowed text[] := tg_argv[1:];
begin
  if target is not null and not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = target and r.role::text = any (allowed) and p.status <> 'inactive'
  ) then
    raise exception '% % is not an active user with the % role', tg_argv[0], target, array_to_string(allowed, ' or ')
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger clients_created_by_role before insert or update of created_by on public.clients
  for each row execute function private.enforce_role('created_by', 'closer', 'admin');
create trigger clients_user_id_role before insert or update of user_id on public.clients
  for each row execute function private.enforce_role('user_id', 'client');
create trigger client_va_assignments_va_id_role before insert or update of va_id on public.client_va_assignments
  for each row execute function private.enforce_role('va_id', 'va');
create trigger leads_closer_id_role before insert or update of closer_id on public.leads
  for each row execute function private.enforce_role('closer_id', 'closer', 'admin');

-- Roles are granted and removed, never edited in place. A role can't be removed while something depends
-- on it: a VA with an active assignment, or a client whose login is linked to a client record.
create function private.guard_role_removal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- A deleted profile takes its roles with it; the restrict foreign keys protect what depends on it.
  if tg_op = 'DELETE' and not exists (select 1 from public.profiles p where p.id = old.user_id) then
    return old;
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'roles are not edited in place: remove the role and grant the new one' using errcode = 'check_violation';
  end if;
  if old.role = 'va' and exists (
    select 1 from public.client_va_assignments a where a.va_id = old.user_id and a.status = 'active'
  ) then
    raise exception 'end this VA''s active assignments before removing the role' using errcode = 'foreign_key_violation';
  end if;
  if old.role = 'client' and exists (select 1 from public.clients c where c.user_id = old.user_id) then
    raise exception 'unlink this user from their client record before removing the role' using errcode = 'foreign_key_violation';
  end if;
  return old;
end;
$$;

create trigger roles_guard_removal before update or delete on public.roles
  for each row execute function private.guard_role_removal();

-- Every auth user gets a profile; email changes and the first sign-in flow into it.
-- SECURITY DEFINER: these run as Supabase Auth's role, which can't write public tables.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120));
  return new;
end;
$$;

create function private.handle_user_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles
  set email = lower(new.email),
      -- Accepting the invite (first sign-in) activates the account; a deactivated one stays inactive.
      status = case when status = 'invited' and new.last_sign_in_at is not null then 'active' else status end
  where id = new.id
    and (email is distinct from lower(new.email) or (status = 'invited' and new.last_sign_in_at is not null));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
-- Fires only when the email changes or on the very first sign-in — not on every login.
create trigger on_auth_user_updated after update of email, last_sign_in_at on auth.users
  for each row
  when (old.email is distinct from new.email or (old.last_sign_in_at is null and new.last_sign_in_at is not null))
  execute function private.handle_user_update();

-- Custom access token hook (Dashboard → Authentication → Hooks): copies the user's roles into
-- app_metadata.roles. Inactive users get none, so they lose access at the next token refresh (≤ 1 hour).
create function public.custom_access_token_hook(event jsonb) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_set(
    event,
    '{claims,app_metadata}',
    coalesce(event -> 'claims' -> 'app_metadata', '{}'::jsonb) || jsonb_build_object('roles', (
      select coalesce(jsonb_agg(r.role order by r.role), '[]'::jsonb)
      from public.roles r
      join public.profiles p on p.id = r.user_id
      where r.user_id = (event ->> 'user_id')::uuid and p.status <> 'inactive'
    ))
  );
$$;

-- Policy helpers -------------------------------------------------------------------------------------------
-- Policies call each helper as `(select private.fn())` or `col in (select private.fn())`, so Postgres runs it
-- once per query (an InitPlan / hashed subplan), never once per row.

-- Role checks read the signed token: no table lookups.
create function private.has_role(wanted public.app_role) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? wanted::text, false);
$$;

-- Admin rights need the admin role *and* a two-factor (aal2) session.
create function private.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select private.has_role('admin') and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- The calling user's related client ids. SECURITY DEFINER so a clients policy can read assignments (and
-- vice versa) without the tables' policies invoking each other forever; each returns only the caller's
-- own relationships, through an index.
create function private.assigned_client_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select a.client_id from public.client_va_assignments a where a.va_id = (select auth.uid()) and a.status = 'active';
$$;

create function private.created_client_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select c.id from public.clients c where c.created_by = (select auth.uid());
$$;

create function private.own_client_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select c.id from public.clients c where c.user_id = (select auth.uid());
$$;

-- Grants -----------------------------------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated, service_role;
revoke all on all sequences in schema public from anon, authenticated, service_role;
revoke all on all functions in schema public from anon, authenticated, service_role, public;
revoke all on all functions in schema private from anon, authenticated, service_role, public;

-- The server (secret key) reads and writes rows; never TRUNCATE, REFERENCES or TRIGGER.
grant select, insert, update, delete on all tables in schema public to service_role;

-- Signed-in users, always narrowed by the policies below.
grant select on public.profiles, public.roles to authenticated;
-- Column grants keep status, activation and the client's login link server-controlled: a Closer edits a
-- client's details, but can't activate it or attach someone's account to it.
grant select on public.clients to authenticated;
grant insert (company_name, contact_name, contact_email, contact_phone, notes, created_by) on public.clients to authenticated;
grant update (company_name, contact_name, contact_email, contact_phone, notes) on public.clients to authenticated;
grant select, insert, update on public.client_va_assignments to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.has_role(public.app_role), private.is_admin(), private.assigned_client_ids(),
  private.created_client_ids(), private.own_client_ids() to authenticated;

-- Supabase Auth runs the token hook as supabase_auth_admin.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on public.profiles, public.roles to supabase_auth_admin;

-- Row-level security -----------------------------------------------------------------------------------------
-- One policy per table, role and action: several permissive policies would each be evaluated for every row.

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.clients enable row level security;
alter table public.client_va_assignments enable row level security;
alter table public.leads enable row level security; -- server-only: no policies

create policy "Read own profile; admins read all" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

-- Granting and removing roles is server-only.
create policy "Read own roles; admins read all" on public.roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Client: own record · VA: actively assigned · Closer: created by them · admin: all.
create policy "Read clients by role" on public.clients for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('closer')) and created_by = (select auth.uid()))
    or ((select private.has_role('client')) and user_id = (select auth.uid()))
    or ((select private.has_role('va')) and id in (select private.assigned_client_ids()))
  );

-- Closers create and edit their own clients; admins any (within the column grants above).
create policy "Closers and admins create clients" on public.clients for insert to authenticated
  with check ((select private.is_admin()) or ((select private.has_role('closer')) and created_by = (select auth.uid())));
create policy "Closers and admins update clients" on public.clients for update to authenticated
  using ((select private.is_admin()) or ((select private.has_role('closer')) and created_by = (select auth.uid())))
  with check ((select private.is_admin()) or ((select private.has_role('closer')) and created_by = (select auth.uid())));

-- Each side of an assignment reads it; only admins assign.
create policy "Read assignments by role" on public.client_va_assignments for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('va')) and va_id = (select auth.uid()))
    or ((select private.has_role('closer')) and client_id in (select private.created_client_ids()))
    or ((select private.has_role('client')) and client_id in (select private.own_client_ids()))
  );
create policy "Admins create assignments" on public.client_va_assignments for insert to authenticated
  with check ((select private.is_admin()));
create policy "Admins update assignments" on public.client_va_assignments for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Supabase Auth reads profiles and roles to build the token.
create policy "Auth reads profiles for the token hook" on public.profiles for select to supabase_auth_admin
  using (true);
create policy "Auth reads roles for the token hook" on public.roles for select to supabase_auth_admin
  using (true);
