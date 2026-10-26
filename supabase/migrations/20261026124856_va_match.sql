-- VA Match, slices 1 and 2. An admin offers up to three VAs. The client accepts or declines.
-- Accept is the only signed-in path that creates an assignment. Several VAs may be active for one client.
-- Working hours are weekly windows in Asia/Manila. Intro calls and retiring demos wait for meetings and Google.
--
-- Shortlist and assignment audit (status and ids only, never names) is added when audit_log exists.

-- Several active VAs. The same pair cannot be active twice. History stays when an assignment ends.
alter table public.client_va_assignments add column va_first_name text;

update public.client_va_assignments a
set va_first_name = coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'Your VA')
from public.profiles p
where p.id = a.va_id;

update public.client_va_assignments set va_first_name = 'Your VA' where va_first_name is null;

alter table public.client_va_assignments alter column va_first_name set not null;

drop index public.client_va_assignments_one_active_per_client;

create unique index client_va_assignments_one_active_pair
  on public.client_va_assignments (client_id, va_id) where status = 'active';

-- Signed-in users no longer insert assignments. The accept trigger does, as the table owner.
revoke insert on public.client_va_assignments from authenticated;

-- The name the client sees. Existing inserts from the test role omit the column.
create function private.fill_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  first_name text;
begin
  select coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'Your VA')
    into first_name
  from public.profiles p where p.id = new.va_id;
  new.va_first_name := coalesce(first_name, 'Your VA');
  return new;
end;
$$;

-- A signed-in insert is allowed only while a shortlist accept is in progress.
-- A signed-in update may only end one active assignment, and only an admin may do that.
create function private.guard_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null
      and coalesce(current_setting('islandsva.shortlist_accept', true), '') is distinct from 'on'
    then
      raise exception 'a signed-in user cannot assign a VA this way' using errcode = 'IVA28';
    end if;
    return new;
  end if;

  if (select auth.uid()) is null then
    return new;
  end if;

  if (select private.is_admin())
    and old.status = 'active'
    and new.status = 'ended'
    and new.ended_at is not null
    and new.client_id is not distinct from old.client_id
    and new.va_id is not distinct from old.va_id
    and new.va_first_name is not distinct from old.va_first_name
    and new.assigned_by is not distinct from old.assigned_by
    and new.tenant_id is not distinct from old.tenant_id
    and new.started_at is not distinct from old.started_at
  then
    return new;
  end if;

  raise exception 'a signed-in user cannot assign a VA this way' using errcode = 'IVA28';
end;
$$;

create trigger assignments_fill before insert on public.client_va_assignments
  for each row execute function private.fill_assignment();
create trigger assignments_guard before insert or update on public.client_va_assignments
  for each row execute function private.guard_assignment();

revoke all on function private.fill_assignment(), private.guard_assignment() from public, anon, authenticated, service_role;

-- Shortlist --------------------------------------------------------------------------------------------------

create type public.shortlist_status as enum ('offered', 'accepted', 'declined');

create table public.va_shortlists (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  va_id uuid not null,
  status public.shortlist_status not null default 'offered',
  va_first_name text not null,
  company_name text not null,
  offered_by uuid not null,
  decided_at timestamptz,
  tenant_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint va_shortlists_decided_matches_status check ((status = 'offered') = (decided_at is null)),
  constraint va_shortlists_id_tenant_key unique (id, tenant_id)
);

create unique index va_shortlists_one_offer on public.va_shortlists (client_id, va_id) where status = 'offered';

-- Working hours ----------------------------------------------------------------------------------------------

create table public.va_working_hours (
  id uuid primary key default gen_random_uuid(),
  va_id uuid not null,
  weekday smallint not null,
  start_minute smallint not null,
  end_minute smallint not null,
  tenant_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint va_working_hours_weekday check (weekday between 1 and 7),
  constraint va_working_hours_start check (start_minute between 0 and 1410 and start_minute % 30 = 0),
  constraint va_working_hours_end check (end_minute between 30 and 1440 and end_minute % 30 = 0),
  constraint va_working_hours_order check (end_minute > start_minute),
  constraint va_working_hours_one_window unique (va_id, weekday),
  constraint va_working_hours_id_tenant_key unique (id, tenant_id)
);

-- Tenants. Every existing case stays.
create or replace function private.assign_tenant() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := to_jsonb(new);
begin
  if new.tenant_id is null then
    new.tenant_id := case tg_table_name
      when 'roles' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'user_id')::uuid)
      when 'employee_profiles' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'user_id')::uuid)
      when 'clients' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'created_by')::uuid)
      when 'client_va_assignments' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'lead_events' then (select l.tenant_id from public.leads l where l.id = (rec ->> 'lead_id')::uuid)
      when 'client_notes' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'client_onboarding_links' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'payments' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'client_packets' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'demo_slots' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'va_id')::uuid)
      when 'demo_bookings' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'discovery_times' then coalesce(private.tenant_id(), private.default_tenant_id())
      when 'meetings' then (select l.tenant_id from public.leads l where l.id = (rec ->> 'lead_id')::uuid)
      when 'meeting_events' then (select m.tenant_id from public.meetings m where m.id = (rec ->> 'meeting_id')::uuid)
      when 'tasks' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'task_comments' then (select t.tenant_id from public.tasks t where t.id = (rec ->> 'task_id')::uuid)
      when 'va_shortlists' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'va_working_hours' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'va_id')::uuid)
      else private.default_tenant_id()
    end;
  end if;
  return new;
end;
$$;

create trigger va_shortlists_assign_tenant before insert on public.va_shortlists
  for each row execute function private.assign_tenant();
create trigger va_working_hours_assign_tenant before insert on public.va_working_hours
  for each row execute function private.assign_tenant();

alter table public.va_shortlists alter column tenant_id set not null;
alter table public.va_working_hours alter column tenant_id set not null;

alter table public.va_shortlists add constraint va_shortlists_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete restrict;
alter table public.va_shortlists add constraint va_shortlists_client_tenant_fkey
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete restrict;
alter table public.va_shortlists add constraint va_shortlists_va_tenant_fkey
  foreign key (va_id, tenant_id) references public.profiles (id, tenant_id) on delete restrict;
alter table public.va_shortlists add constraint va_shortlists_offered_by_tenant_fkey
  foreign key (offered_by, tenant_id) references public.profiles (id, tenant_id) on delete restrict;

alter table public.va_working_hours add constraint va_working_hours_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete restrict;
alter table public.va_working_hours add constraint va_working_hours_va_tenant_fkey
  foreign key (va_id, tenant_id) references public.profiles (id, tenant_id) on delete restrict;

create trigger va_shortlists_va_id_role before insert or update of va_id on public.va_shortlists
  for each row execute function private.enforce_role('va_id', 'va');
create trigger va_shortlists_offered_by_role before insert or update of offered_by on public.va_shortlists
  for each row execute function private.enforce_role('offered_by', 'admin', 'super_admin');
create trigger va_working_hours_va_id_role before insert or update of va_id on public.va_working_hours
  for each row execute function private.enforce_role('va_id', 'va');

create trigger va_shortlists_set_updated_at before update on public.va_shortlists
  for each row execute function private.set_updated_at();
create trigger va_working_hours_set_updated_at before update on public.va_working_hours
  for each row execute function private.set_updated_at();

create index va_shortlists_client_idx on public.va_shortlists (client_id, created_at desc);
create index va_shortlists_va_idx on public.va_shortlists (va_id, created_at desc);
create index va_shortlists_tenant_id_idx on public.va_shortlists (tenant_id);
create index va_working_hours_va_idx on public.va_working_hours (va_id, weekday);
create index va_working_hours_tenant_id_idx on public.va_working_hours (tenant_id);

create function private.fill_shortlist() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  client public.clients%rowtype;
  first_name text;
begin
  select * into client from public.clients c where c.id = new.client_id;
  if not found then
    raise exception 'client not found' using errcode = 'foreign_key_violation';
  end if;
  select coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'Your VA')
    into first_name
  from public.profiles p where p.id = new.va_id;
  new.company_name := client.company_name;
  new.va_first_name := coalesce(first_name, 'Your VA');
  return new;
end;
$$;

-- Offer: an open VA, not already offered, not already active, at most three open offers, company not disabled.
-- Decide: the company's own login, and only offered → accepted or declined. Accept inserts the assignment.
create function private.guard_shortlist() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  client public.clients%rowtype;
  actor uuid := (select auth.uid());
  open_offers integer;
begin
  select * into client from public.clients c where c.id = new.client_id;
  if not found then
    raise exception 'client not found' using errcode = 'foreign_key_violation';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'offered' or new.decided_at is not null then
      raise exception 'this offer cannot change' using errcode = 'IVA27';
    end if;
    if client.disabled_at is not null or not (select private.va_is_open(new.va_id)) then
      raise exception 'this offer is not acceptable' using errcode = 'IVA26';
    end if;
    if exists (
      select 1 from public.client_va_assignments a
      where a.client_id = new.client_id and a.va_id = new.va_id and a.status = 'active'
    ) or exists (
      select 1 from public.va_shortlists s
      where s.client_id = new.client_id and s.va_id = new.va_id and s.status = 'offered'
    ) then
      raise exception 'this offer is not acceptable' using errcode = 'IVA26';
    end if;
    select count(*) into open_offers from public.va_shortlists s
      where s.client_id = new.client_id and s.status = 'offered';
    if open_offers >= 3 then
      raise exception 'this offer is not acceptable' using errcode = 'IVA26';
    end if;
    if actor is not null and (actor is distinct from new.offered_by or not (select private.is_admin())) then
      raise exception 'this offer is not acceptable' using errcode = 'IVA26';
    end if;
    return new;
  end if;

  if new.client_id is distinct from old.client_id
    or new.va_id is distinct from old.va_id
    or new.offered_by is distinct from old.offered_by
    or new.company_name is distinct from old.company_name
    or new.va_first_name is distinct from old.va_first_name
    or new.tenant_id is distinct from old.tenant_id
  then
    raise exception 'this offer cannot change' using errcode = 'IVA27';
  end if;

  if old.status <> 'offered' or new.status not in ('accepted', 'declined') then
    raise exception 'this offer cannot change' using errcode = 'IVA27';
  end if;
  if actor is null or actor is distinct from client.user_id or client.status <> 'active' or client.disabled_at is not null then
    raise exception 'this offer cannot change' using errcode = 'IVA27';
  end if;

  new.decided_at := now();

  if new.status = 'accepted' then
    if not (select private.va_is_open(new.va_id)) or exists (
      select 1 from public.client_va_assignments a
      where a.client_id = new.client_id and a.va_id = new.va_id and a.status = 'active'
    ) then
      raise exception 'this offer is not acceptable' using errcode = 'IVA26';
    end if;
    perform set_config('islandsva.shortlist_accept', 'on', true);
    insert into public.client_va_assignments (client_id, va_id, assigned_by)
    values (new.client_id, new.va_id, new.offered_by);
  end if;

  return new;
end;
$$;

create function private.guard_working_hours() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.weekday not between 1 and 7
    or new.start_minute < 0 or new.start_minute > 1410 or new.start_minute % 30 <> 0
    or new.end_minute < 30 or new.end_minute > 1440 or new.end_minute % 30 <> 0
    or new.end_minute <= new.start_minute
  then
    raise exception 'these working hours are not acceptable' using errcode = 'IVA29';
  end if;
  if (select auth.uid()) is not null and (
    (select auth.uid()) is distinct from new.va_id or not (select private.is_open_va())
  ) then
    raise exception 'these working hours are not acceptable' using errcode = 'IVA29';
  end if;
  return new;
end;
$$;

create trigger va_shortlists_fill before insert on public.va_shortlists
  for each row execute function private.fill_shortlist();
create trigger va_shortlists_guard before insert or update on public.va_shortlists
  for each row execute function private.guard_shortlist();
create trigger va_working_hours_guard before insert or update on public.va_working_hours
  for each row execute function private.guard_working_hours();

revoke all on function private.fill_shortlist(), private.guard_shortlist(), private.guard_working_hours()
  from public, anon, authenticated, service_role;

-- Grants and RLS --------------------------------------------------------------------------------------------

grant select, insert, update, delete on public.va_shortlists, public.va_working_hours to service_role;
grant select on public.va_shortlists, public.va_working_hours to authenticated;
grant insert (client_id, va_id, offered_by) on public.va_shortlists to authenticated;
grant update (status) on public.va_shortlists to authenticated;
grant delete on public.va_shortlists to authenticated;
grant insert (va_id, weekday, start_minute, end_minute) on public.va_working_hours to authenticated;
grant update (weekday, start_minute, end_minute) on public.va_working_hours to authenticated;
grant delete on public.va_working_hours to authenticated;

alter table public.va_shortlists enable row level security;
alter table public.va_working_hours enable row level security;

create policy "Own tenant only" on public.va_shortlists as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));

create policy "Read shortlists by role" on public.va_shortlists for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('client')) and client_id in (select private.own_client_ids()))
    or ((select private.has_role('va')) and va_id = (select auth.uid()))
  );

create policy "Admins offer a VA" on public.va_shortlists for insert to authenticated
  with check (
    (select private.is_admin())
    and offered_by = (select auth.uid())
    and status = 'offered'
  );

create policy "Clients decide their offers" on public.va_shortlists for update to authenticated
  using (
    (select private.has_role('client'))
    and client_id in (select private.own_client_ids())
    and status = 'offered'
  )
  with check (
    (select private.has_role('client'))
    and client_id in (select private.own_client_ids())
    and status in ('accepted', 'declined')
  );

create policy "Admins withdraw an open offer" on public.va_shortlists for delete to authenticated
  using ((select private.is_admin()) and status = 'offered');

create policy "Own tenant only" on public.va_working_hours as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));

create policy "Read working hours by role" on public.va_working_hours for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('va')) and va_id = (select auth.uid()))
  );

create policy "Open VAs write their hours" on public.va_working_hours for insert to authenticated
  with check (
    (select private.has_role('va'))
    and (select private.is_open_va())
    and va_id = (select auth.uid())
  );

create policy "Open VAs update their hours" on public.va_working_hours for update to authenticated
  using (
    (select private.has_role('va'))
    and (select private.is_open_va())
    and va_id = (select auth.uid())
  )
  with check (
    (select private.has_role('va'))
    and (select private.is_open_va())
    and va_id = (select auth.uid())
  );

create policy "Open VAs delete their hours" on public.va_working_hours for delete to authenticated
  using (
    (select private.has_role('va'))
    and (select private.is_open_va())
    and va_id = (select auth.uid())
  );
