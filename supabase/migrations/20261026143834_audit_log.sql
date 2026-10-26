-- Audit log (M8, slice 2): who changed what, written by database triggers so no write path can skip it — the
-- app, an admin, the secret key, a discovery-call function or another trigger.
--
-- Audited: leads, meetings, clients, client_va_assignments, tasks, va_shortlists, roles, and profiles.status.
-- Not audited: the timelines (lead_events, meeting_events, client_notes, task_comments — they are the readable
-- story), discovery_times, va_working_hours, payments (for now) and the demo tables (retired in M10).
-- Runs after tasks, va_match and restore_assign_tenant_cases; it doesn't touch private.assign_tenant().
--
-- Each row records the changed field names. Values only for an allow-list of safe columns (statuses, ids,
-- times, package terms); contact details, free text and anything not on the list are names only, so a new
-- column is private by default.
--
-- The actor, by how the write arrived (private.audit_actor):
--   signed-in user (role authenticated) → auth.uid(); app.actor is ignored, so a user can't name someone else
--   secret key (service_role) or a direct session → app.actor if set (transaction-local, by a service_role-only
--     function), else the row's own "by" column on insert (assigned_by, created_by), else system
-- A direct session's request.jwt.claims can be set by anyone with that session, so auth.uid() is never trusted
-- there.

create type public.audit_actor_kind as enum ('user', 'system');
create type public.audit_action as enum ('insert', 'update', 'delete');

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  at timestamptz not null default now(),
  actor_kind public.audit_actor_kind not null,
  -- No foreign keys on the ids below: an audit row must never block a write, a delete or the cascade that
  -- rolls back a failed invite. They are history, resolved when shown (an unknown id shows as unknown).
  actor_id uuid,
  action public.audit_action not null,
  record_type text not null check (record_type in ('leads', 'meetings', 'clients', 'client_va_assignments', 'tasks', 'va_shortlists', 'roles', 'profiles')),
  record_id uuid not null,
  -- The Lead Gen whose record this is (they read its entries); null for accounts and roles.
  owner_id uuid,
  client_id uuid,
  -- { column: value } on insert and delete, { column: [old, new] } on update; null = changed, value withheld.
  changes jsonb not null check (jsonb_typeof(changes) = 'object' and octet_length(changes::text) <= 4000),
  constraint audit_log_actor check ((actor_kind = 'user') = (actor_id is not null))
);

create index audit_log_owner_at_idx on public.audit_log (owner_id, at desc) where owner_id is not null;
create index audit_log_tenant_at_idx on public.audit_log (tenant_id, at desc);
create index audit_log_record_at_idx on public.audit_log (record_type, record_id, at desc);

-- Helpers ----------------------------------------------------------------------------------------------------

-- Who made the write (null = system). Security invoker: its only caller is write_audit (security definer), so it
-- runs as that function's owner and may read the profiles and roles it checks; execute is revoked from every API
-- role, so nobody calls it directly.
-- current_setting('role') is the API role of the request (PostgREST's `set local role`, or `set role`), and it
-- keeps that value inside security-definer functions and triggers; a session that never set a role reads 'none'.
create function private.audit_actor(row_tenant uuid, fallback uuid) returns uuid
language plpgsql stable security invoker set search_path = '' as $$
declare
  api_role text := coalesce(nullif(current_setting('role', true), ''), 'none');
  named text := nullif(current_setting('app.actor', true), '');
  actor uuid;
begin
  if api_role in ('authenticated', 'anon') then
    -- A signed-in user acts as themselves; app.actor is theirs to set, so it's ignored. A visitor is system.
    return case when api_role = 'authenticated' then auth.uid() end;
  end if;

  -- The secret key, or a direct session (migrations, the SQL editor, Supabase Auth's own role). auth.uid() is
  -- not trusted here: request.jwt.claims is just a setting any such session can write.
  if named is null then
    return fallback;
  end if;
  begin
    actor := named::uuid;
  exception when invalid_text_representation then
    raise exception 'app.actor is not a user id' using errcode = 'insufficient_privilege';
  end;
  -- Someone of this row's agency, or a Super Admin (who works across agencies).
  if not exists (select 1 from public.profiles p where p.id = actor and p.tenant_id = row_tenant)
    and not exists (
      select 1 from public.roles r join public.profiles p on p.id = r.user_id
      where r.user_id = actor and r.role = 'super_admin' and p.status <> 'inactive'
    ) then
    raise exception 'app.actor is not a user of this agency' using errcode = 'insufficient_privilege';
  end if;
  return actor;
end;
$$;

-- Columns whose values may be stored. Default deny: a table or column not listed here is recorded by name only.
create function private.audit_allow(tbl text) returns text[]
language sql immutable set search_path = '' as $$
  select case tbl
    when 'leads' then array['status', 'closer_id', 'converted_client_id', 'disabled_at', 'package_code']
    when 'meetings' then array['kind', 'status', 'lead_id', 'organizer_id', 'decided_by', 'decided_at', 'starts_at', 'ends_at']
    when 'clients' then array['status', 'onboarding_status', 'created_by', 'user_id', 'activated_at', 'disabled_at', 'package_code',
      'hours_per_week', 'term_months', 'monthly_cents', 'currency', 'starts_on', 'consented_at', 'onboarding_submitted_at',
      'registration_email_sent_at']
    -- va_first_name (a snapshot of a person's name) is left out: name only.
    when 'client_va_assignments' then array['client_id', 'va_id', 'status', 'started_at', 'ended_at', 'assigned_by']
    -- Never the title (the client's free text) or the name snapshots (company_name, va_first_name).
    when 'tasks' then array['client_id', 'va_id', 'status', 'deadline', 'deadline_timezone', 'done_at', 'closed_by', 'created_by']
    when 'va_shortlists' then array['client_id', 'va_id', 'status', 'offered_by', 'decided_at']
    when 'roles' then array['user_id', 'role', 'assigned_by']
    when 'profiles' then array['status']
    else '{}'::text[]
  end;
$$;

-- Columns that are bookkeeping, not a change: an update touching only these writes no row.
create function private.audit_ignore(tbl text) returns text[]
language sql immutable set search_path = '' as $$
  select array['id', 'created_at', 'updated_at', 'tenant_id'] || case tbl
    when 'leads' then array['notified_at']
    when 'profiles' then array['signed_in_at']
    else '{}'::text[]
  end;
$$;

-- One AFTER row trigger for every audited table. SECURITY DEFINER (written reason): audit_log has no write
-- grant for any API role, so only this function can insert into it, and it reads the lead or client a row
-- belongs to (for the owner), which the writer may not read.
-- A new audited table needs: a record_type in the check above, an allow-list (or none: names only), and an
-- owner case below — a missing owner case refuses the write, and a test checks every *_audit trigger has one.
create function private.write_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
  allowed text[] := private.audit_allow(tg_table_name);
  ignored text[] := private.audit_ignore(tg_table_name);
  diff jsonb := '{}'::jsonb;
  k text;
  row_tenant uuid := (r ->> 'tenant_id')::uuid;
  fallback uuid;
  owner uuid;
  client uuid;
begin
  for k in select jsonb_object_keys(r) loop
    -- profiles: only the account status is audited (email and name changes are Auth's business).
    continue when k = any (ignored) or (tg_table_name = 'profiles' and not k = any (allowed));
    if tg_op = 'UPDATE' then
      continue when (o -> k) is not distinct from (n -> k);
      diff := diff || jsonb_build_object(k, case when k = any (allowed) then jsonb_build_array(o -> k, n -> k) end);
    else
      continue when jsonb_typeof(r -> k) = 'null';
      diff := diff || jsonb_build_object(k, case when k = any (allowed) then r -> k end);
    end if;
  end loop;
  if diff = '{}'::jsonb then
    return null;
  end if;
  -- Never fail the write on size: past the limit keep the names only (allow-listed values are small, so this is
  -- a backstop).
  if octet_length(diff::text) > 4000 then
    diff := (select jsonb_object_agg(key, null) from jsonb_object_keys(diff) as key);
  end if;

  -- Who did it when nothing else says: the row's own "by" column, on insert only (later updates aren't theirs).
  if tg_op = 'INSERT' then
    fallback := case tg_table_name
      when 'roles' then (r ->> 'assigned_by')::uuid
      when 'client_va_assignments' then (r ->> 'assigned_by')::uuid
      when 'clients' then (r ->> 'created_by')::uuid
      when 'tasks' then (r ->> 'created_by')::uuid
      when 'va_shortlists' then (r ->> 'offered_by')::uuid
    end;
  end if;

  -- The owning Lead Gen. A meeting's is its lead's owner, else whoever organises or decided it (a confirm
  -- updates the meeting before it sets the lead's owner). A task's, shortlist's or assignment's is its client's creator.
  case tg_table_name
    when 'leads' then
      owner := (r ->> 'closer_id')::uuid;
      client := (r ->> 'converted_client_id')::uuid;
    when 'meetings' then
      owner := coalesce(
        (select l.closer_id from public.leads l where l.id = (r ->> 'lead_id')::uuid),
        (r ->> 'organizer_id')::uuid, (r ->> 'decided_by')::uuid);
    when 'clients' then
      owner := (r ->> 'created_by')::uuid;
      client := (r ->> 'id')::uuid;
    when 'client_va_assignments' then
      owner := (select c.created_by from public.clients c where c.id = (r ->> 'client_id')::uuid);
      client := (r ->> 'client_id')::uuid;
    -- Tasks and shortlists have no owning Lead Gen: Lead Gens can't read either table, so their entries are for
    -- admins only (owner null), while client_id still ties them to the client.
    when 'tasks' then
      owner := null;
      client := (r ->> 'client_id')::uuid;
    when 'va_shortlists' then
      owner := null;
      client := (r ->> 'client_id')::uuid;
    when 'roles' then
      owner := null;
    when 'profiles' then
      owner := null;
    else
      raise exception 'no audit owner rule for %', tg_table_name using errcode = 'feature_not_supported';
  end case;

  insert into public.audit_log (tenant_id, actor_kind, actor_id, action, record_type, record_id, owner_id, client_id, changes)
  select row_tenant, case when a.id is null then 'system' else 'user' end::public.audit_actor_kind, a.id,
    lower(tg_op)::public.audit_action, tg_table_name, (r ->> 'id')::uuid, owner, client, diff
  from (select private.audit_actor(row_tenant, fallback) as id) a;
  return null;
end;
$$;

-- Append-only for every API role: no write grant, and this refuses update, delete and truncate even for the
-- secret key or a migration. (The table's owner could still drop the trigger; that is a reviewed migration.)
create function private.guard_audit_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'the audit log is append-only' using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function private.audit_actor(uuid, uuid), private.audit_allow(text), private.audit_ignore(text),
  private.write_audit(), private.guard_audit_immutable() from public, anon, authenticated, service_role;

create trigger audit_log_immutable before update or delete on public.audit_log
  for each row execute function private.guard_audit_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.guard_audit_immutable();

create trigger leads_audit after insert or update or delete on public.leads
  for each row execute function private.write_audit();
create trigger meetings_audit after insert or update or delete on public.meetings
  for each row execute function private.write_audit();
create trigger clients_audit after insert or update or delete on public.clients
  for each row execute function private.write_audit();
create trigger client_va_assignments_audit after insert or update or delete on public.client_va_assignments
  for each row execute function private.write_audit();
create trigger roles_audit after insert or update or delete on public.roles
  for each row execute function private.write_audit();
create trigger tasks_audit after insert or update or delete on public.tasks
  for each row execute function private.write_audit();
create trigger va_shortlists_audit after insert or update or delete on public.va_shortlists
  for each row execute function private.write_audit();
create trigger profiles_audit after update of status on public.profiles
  for each row when (old.status is distinct from new.status) execute function private.write_audit();

-- Account status with an actor ---------------------------------------------------------------------------------

-- An admin deactivates an account (the app's "disable"), recorded as theirs. Secret key only, so it checks the
-- actor itself, as roles are granted (guard_role_grant): an active admin of the account's agency, or an active
-- Super Admin; never their own account; an admin's or Super Admin's account only by an active Super Admin. Only
-- 'inactive' for now: reactivating needs the invited / VA-review rules (a VA stays invited until approved), so it
-- isn't offered yet. Until the app follow-up lands (after this migration is live), the app still deactivates with
-- a direct secret-key update, which the audit log records as System.
-- IVA01 unknown account · IVA14 the actor isn't allowed
create function public.set_account_status(user_id uuid, actor uuid, status public.account_status) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  target public.profiles%rowtype;
begin
  if set_account_status.status is distinct from 'inactive' then
    raise exception 'only deactivation is supported' using errcode = 'check_violation';
  end if;
  select * into target from public.profiles p where p.id = set_account_status.user_id for update;
  if not found then
    raise exception 'account not found' using errcode = 'IVA01';
  end if;
  if actor is null or actor = target.id or not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = actor and p.status <> 'inactive'
      and (r.role = 'super_admin' or (r.role = 'admin' and r.tenant_id = target.tenant_id))
  ) then
    raise exception 'only an admin of this agency can change this account' using errcode = 'IVA14';
  end if;
  -- An admin's or Super Admin's account is changed only by an active Super Admin, as only a Super Admin grants
  -- those roles (guard_role_grant): a tenant admin can't lock out another admin.
  if exists (select 1 from public.roles r where r.user_id = target.id and r.role in ('admin', 'super_admin'))
    and not exists (
      select 1 from public.roles r join public.profiles p on p.id = r.user_id
      where r.user_id = actor and r.role = 'super_admin' and p.status <> 'inactive'
    ) then
    raise exception 'only a Super Admin can change an admin''s account' using errcode = 'IVA14';
  end if;
  perform set_config('app.actor', actor::text, true);
  update public.profiles p set status = set_account_status.status where p.id = target.id;
end;
$$;

revoke all on function public.set_account_status(uuid, uuid, public.account_status) from public, anon, authenticated, service_role;
grant execute on function public.set_account_status(uuid, uuid, public.account_status) to service_role;

-- Grants and RLS ---------------------------------------------------------------------------------------------
-- Read only, for everyone: rows arrive only through write_audit().

grant select on public.audit_log to authenticated, service_role;

alter table public.audit_log enable row level security;
-- An admin with 2FA: every entry · a Lead Gen: entries for records they own (the role from the token).
create policy "Read audit entries by role" on public.audit_log for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('closer')) and owner_id = (select auth.uid()))
  );
create policy "Own tenant only" on public.audit_log as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));
