-- Multi-tenancy, prepared for later: one tenant ("Islands VA") today, so adding a second is cheap.
--
-- Every tenant-owned row carries tenant_id; each user belongs to exactly one tenant (profiles.tenant_id).
--   Super Admin (super_admin role + two-factor) → every tenant
--   Admin (admin role + two-factor)             → everything in their tenant
--   client · VA · Closer                        → as before, inside their tenant
-- The existing per-role policies are unchanged. One RESTRICTIVE policy per table adds "and it's in your
-- tenant (or you're a Super Admin)" to all of them. Composite foreign keys stop a row from pointing at
-- another tenant's data, which RLS alone can't prevent.
-- tenant_id is filled on insert from the related row (a client from its creator, an assignment from its
-- client, …), so the app needs no change; authenticated users can't set or change it (column grants).

-- Tenants -----------------------------------------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (char_length(slug) <= 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Where rows with no other tenant to inherit go: new invites and contact-form leads. Exactly one.
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index tenants_one_default on public.tenants (is_default) where is_default;

insert into public.tenants (name, slug, is_default) values ('Islands VA', 'islands-va', true);

create function private.default_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select t.id from public.tenants t where t.is_default;
$$;

-- Roles may now be updated, but only by a tenant move (cascaded from profiles); grant and remove still
-- replace a role rather than editing it.
create or replace function private.guard_role_removal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.profiles p where p.id = old.user_id) then
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if (old.user_id, old.role) is distinct from (new.user_id, new.role) then
      raise exception 'roles are not edited in place: remove the role and grant the new one' using errcode = 'check_violation';
    end if;
    return new;
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

-- tenant_id on every tenant-owned table ---------------------------------------------------------------------
-- Backfilled with the updated_at triggers off, so existing rows don't look edited.

alter table public.profiles disable trigger profiles_set_updated_at;
alter table public.clients disable trigger clients_set_updated_at;
alter table public.leads disable trigger leads_set_updated_at;
alter table public.staff_profiles disable trigger staff_profiles_set_updated_at;

alter table public.profiles add column tenant_id uuid references public.tenants (id) on delete restrict;
update public.profiles set tenant_id = private.default_tenant_id();

alter table public.roles add column tenant_id uuid;
update public.roles r set tenant_id = p.tenant_id from public.profiles p where p.id = r.user_id;

alter table public.clients add column tenant_id uuid;
update public.clients c set tenant_id = p.tenant_id from public.profiles p where p.id = c.created_by;

alter table public.client_va_assignments add column tenant_id uuid;
update public.client_va_assignments a set tenant_id = c.tenant_id from public.clients c where c.id = a.client_id;

alter table public.leads add column tenant_id uuid;
update public.leads set tenant_id = private.default_tenant_id();

alter table public.staff_profiles add column tenant_id uuid;
update public.staff_profiles s set tenant_id = p.tenant_id from public.profiles p where p.id = s.user_id;

alter table public.profiles enable trigger profiles_set_updated_at;
alter table public.clients enable trigger clients_set_updated_at;
alter table public.leads enable trigger leads_set_updated_at;
alter table public.staff_profiles enable trigger staff_profiles_set_updated_at;

alter table public.profiles alter column tenant_id set not null;
alter table public.roles alter column tenant_id set not null;
alter table public.clients alter column tenant_id set not null;
alter table public.client_va_assignments alter column tenant_id set not null;
alter table public.leads alter column tenant_id set not null;
alter table public.staff_profiles alter column tenant_id set not null;

-- Same-tenant references. The single-column foreign keys stay (they carry the delete rules); these add
-- "and in the same tenant". Moving a user to another tenant carries their roles and staff profile with
-- them, and is refused while they created clients, are assigned to one, or are linked to one.

alter table public.profiles add constraint profiles_id_tenant_key unique (id, tenant_id);
alter table public.clients add constraint clients_id_tenant_key unique (id, tenant_id);
alter table public.leads add constraint leads_tenant_id_fkey foreign key (tenant_id) references public.tenants (id) on delete restrict;

alter table public.roles add constraint roles_user_tenant_fkey
  foreign key (user_id, tenant_id) references public.profiles (id, tenant_id) on update cascade on delete cascade;
alter table public.staff_profiles add constraint staff_profiles_user_tenant_fkey
  foreign key (user_id, tenant_id) references public.profiles (id, tenant_id) on update cascade on delete cascade;
alter table public.clients add constraint clients_created_by_tenant_fkey
  foreign key (created_by, tenant_id) references public.profiles (id, tenant_id);
alter table public.clients add constraint clients_user_tenant_fkey
  foreign key (user_id, tenant_id) references public.profiles (id, tenant_id);
alter table public.client_va_assignments add constraint client_va_assignments_client_tenant_fkey
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id);
alter table public.client_va_assignments add constraint client_va_assignments_va_tenant_fkey
  foreign key (va_id, tenant_id) references public.profiles (id, tenant_id);
alter table public.leads add constraint leads_closer_tenant_fkey
  foreign key (closer_id, tenant_id) references public.profiles (id, tenant_id);
alter table public.leads add constraint leads_converted_client_tenant_fkey
  foreign key (converted_client_id, tenant_id) references public.clients (id, tenant_id);

-- Lists stay newest first within a tenant.
create index profiles_tenant_created_at_idx on public.profiles (tenant_id, created_at desc);
create index clients_tenant_created_at_idx on public.clients (tenant_id, created_at desc);
create index leads_tenant_created_at_idx on public.leads (tenant_id, created_at desc);
create index roles_tenant_id_idx on public.roles (tenant_id);
create index client_va_assignments_tenant_id_idx on public.client_va_assignments (tenant_id);
create index staff_profiles_tenant_id_idx on public.staff_profiles (tenant_id);

-- New rows inherit their tenant: roles and staff profiles from the user, a client from its creator, an
-- assignment from its client; new users (invites) and contact-form leads go to the default tenant.
-- Named *_assign_tenant so it runs before the other BEFORE INSERT triggers (they fire alphabetically).
create function private.assign_tenant() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := to_jsonb(new);
begin
  if new.tenant_id is null then
    new.tenant_id := case tg_table_name
      when 'roles' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'user_id')::uuid)
      when 'staff_profiles' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'user_id')::uuid)
      when 'clients' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'created_by')::uuid)
      when 'client_va_assignments' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      else private.default_tenant_id()
    end;
  end if;
  return new;
end;
$$;

create trigger profiles_assign_tenant before insert on public.profiles for each row execute function private.assign_tenant();
create trigger roles_assign_tenant before insert on public.roles for each row execute function private.assign_tenant();
create trigger clients_assign_tenant before insert on public.clients for each row execute function private.assign_tenant();
create trigger client_va_assignments_assign_tenant before insert on public.client_va_assignments for each row execute function private.assign_tenant();
create trigger leads_assign_tenant before insert on public.leads for each row execute function private.assign_tenant();
create trigger staff_profiles_assign_tenant before insert on public.staff_profiles for each row execute function private.assign_tenant();

-- Who may grant a role. Roles are written by the server (secret key), so the rule reads assigned_by:
-- only a Super Admin grants admin or super_admin, and an admin grants roles only inside their own
-- tenant. No assigned_by = a person at the database (npm run admin:create, the SQL editor).
create function private.guard_role_grant() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_by is null or exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = new.assigned_by and r.role = 'super_admin' and p.status <> 'inactive'
  ) then
    return new;
  end if;
  if new.role in ('admin', 'super_admin') then
    raise exception 'only a Super Admin grants the % role', new.role using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = new.assigned_by and r.role = 'admin' and r.tenant_id = new.tenant_id and p.status <> 'inactive'
  ) then
    raise exception 'roles are granted by an admin of the same tenant' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger roles_guard_grant before insert on public.roles for each row execute function private.guard_role_grant();

-- A Super Admin may stand in wherever an admin is allowed (e.g. clients.created_by).
create or replace function private.enforce_role() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  target uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  allowed text[] := tg_argv[1:];
begin
  if target is not null and not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = target and p.status <> 'inactive'
      and (r.role::text = any (allowed) or ('admin' = any (allowed) and r.role = 'super_admin'))
  ) then
    raise exception '% % is not an active user with the % role', tg_argv[0], target, array_to_string(allowed, ' or ')
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Token and policy helpers ------------------------------------------------------------------------------------

-- The token also carries the user's tenant (app_metadata.tenant_id), read only from profiles.
create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_set(
    event,
    '{claims,app_metadata}',
    coalesce(event -> 'claims' -> 'app_metadata', '{}'::jsonb) || jsonb_build_object(
      'roles', (
        select coalesce(jsonb_agg(r.role order by r.role), '[]'::jsonb)
        from public.roles r
        join public.profiles p on p.id = r.user_id
        where r.user_id = (event ->> 'user_id')::uuid and p.status <> 'inactive'
      ),
      'tenant_id', (select p.tenant_id from public.profiles p where p.id = (event ->> 'user_id')::uuid)
    )
  );
$$;

-- The caller's tenant: from the token, or — for a token issued before this migration (valid up to an
-- hour) — from their profile. SECURITY DEFINER: the profiles policy calls it, so it must not re-enter it.
create function private.tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid,
    (select p.tenant_id from public.profiles p where p.id = (select auth.uid()))
  );
$$;

-- Super Admin rights need the role *and* a two-factor (aal2) session, like admin rights.
create function private.is_super_admin() returns boolean
language sql stable set search_path = '' as $$
  select private.has_role('super_admin') and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- Everything an admin may do, a Super Admin may do (the tenant policies below decide where).
create or replace function private.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select (private.has_role('admin') or private.has_role('super_admin')) and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

revoke all on function private.default_tenant_id(), private.assign_tenant(), private.guard_role_grant(),
  private.tenant_id(), private.is_super_admin() from public, anon, authenticated, service_role;
grant execute on function private.tenant_id(), private.is_super_admin() to authenticated;

-- Grants and row-level security -----------------------------------------------------------------------------
-- tenant_id is in no authenticated insert or update grant: users can't place or move rows between tenants.

grant select, insert, update, delete on public.tenants to service_role;
grant select on public.tenants to authenticated;

alter table public.tenants enable row level security;
create policy "Read own tenant; Super Admins read all" on public.tenants for select to authenticated
  using (id = (select private.tenant_id()) or (select private.is_super_admin()));

-- RESTRICTIVE: combined with AND, so every existing policy on these tables now also requires the row to be
-- in the caller's tenant — unless the caller is a Super Admin with two-factor sign-in.
create policy "Own tenant only" on public.profiles as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));
create policy "Own tenant only" on public.roles as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));
create policy "Own tenant only" on public.clients as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));
create policy "Own tenant only" on public.client_va_assignments as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));
create policy "Own tenant only" on public.leads as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));
create policy "Own tenant only" on public.staff_profiles as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));
