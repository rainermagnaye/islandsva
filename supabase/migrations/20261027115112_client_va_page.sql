-- The client VA page: a task can carry a description, the first move to in progress stamps
-- started_at (the same way done stamps done_at), and a client can leave a message for that VA.
-- Messages are append-only. Hours worked are still not stored.

alter table public.tasks add column description text;
alter table public.tasks add column started_at timestamptz;

alter table public.tasks add constraint tasks_description_length
  check (description is null or char_length(description) between 1 and 2000);

-- Tasks: description and started_at -------------------------------------------------------------

create or replace function private.guard_task() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  client public.clients%rowtype;
  -- Null for the server, however the session's claims are set, so a server close leaves closed_by null.
  actor uuid := case when coalesce(current_setting('role', true), '') = 'authenticated' then (select auth.uid()) end;
  today date;
  is_client boolean;
  is_va boolean;
  old_rank integer;
  new_rank integer;
begin
  select * into client from public.clients c where c.id = new.client_id;
  if not found then
    raise exception 'client not found' using errcode = 'foreign_key_violation';
  end if;

  new.description := nullif(btrim(new.description), '');

  if tg_op = 'INSERT' then
    if new.status <> 'todo' or new.done_at is not null or new.closed_by is not null or new.started_at is not null then
      raise exception 'this change is not allowed' using errcode = 'IVA25';
    end if;
    if client.status <> 'active' or client.disabled_at is not null then
      raise exception 'the company is not active' using errcode = 'IVA23';
    end if;
    if not private.va_is_open(new.va_id) or not exists (
      select 1 from public.client_va_assignments a
      where a.client_id = new.client_id and a.va_id = new.va_id and a.status = 'active'
    ) then
      raise exception 'no active assignment for this VA' using errcode = 'IVA24';
    end if;
    today := (now() at time zone new.deadline_timezone)::date;
    if new.deadline < today or new.deadline > today + 366 then
      raise exception 'deadline is not acceptable' using errcode = 'IVA22';
    end if;
    return new;
  end if;

  if new.client_id is distinct from old.client_id
    or new.va_id is distinct from old.va_id
    or new.created_by is distinct from old.created_by
    or new.deadline_timezone is distinct from old.deadline_timezone
    or new.company_name is distinct from old.company_name
    or new.va_first_name is distinct from old.va_first_name
    or new.tenant_id is distinct from old.tenant_id
  then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

  -- Entering done stamps the time and the actor. Nothing else may write those columns, and a
  -- later update cannot clear them or move the status backwards.
  if new.status = 'done' and old.status is distinct from 'done' then
    new.done_at := now();
    new.closed_by := actor;
  elsif new.done_at is distinct from old.done_at or new.closed_by is distinct from old.closed_by then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

  -- The first move into in progress stamps the start. Skipping straight to done leaves it empty.
  if old.status = 'todo' and new.status = 'in_progress' then
    new.started_at := now();
  elsif new.started_at is distinct from old.started_at then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

  if old.status = 'done' and (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.deadline is distinct from old.deadline
    or new.status is distinct from old.status
  ) then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

  if new.status is distinct from old.status then
    old_rank := case old.status when 'todo' then 0 when 'in_progress' then 1 else 2 end;
    new_rank := case new.status when 'todo' then 0 when 'in_progress' then 1 else 2 end;
    if new_rank <= old_rank then
      raise exception 'this change is not allowed' using errcode = 'IVA25';
    end if;
  end if;

  -- Client: the company's login or the person who created the task. VA: the assigned VA.
  -- A person who is both is treated as the client, so closing still works after the assignment ends.
  is_client := actor is not null and (actor = new.created_by or actor is not distinct from client.user_id);
  is_va := actor is not null and actor = new.va_id and not is_client;

  if is_client and new.status is distinct from old.status and new.status <> 'done' then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

  if is_va and (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.deadline is distinct from old.deadline
  ) then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

  if is_va and (
    not private.va_is_open(new.va_id) or not exists (
      select 1 from public.client_va_assignments a
      where a.client_id = new.client_id and a.va_id = new.va_id and a.status = 'active'
    )
  ) then
    raise exception 'no active assignment for this VA' using errcode = 'IVA24';
  end if;

  -- A status-only update does not re-check the window, so a task can become overdue.
  if new.title is distinct from old.title or new.description is distinct from old.description or new.deadline is distinct from old.deadline then
    if client.status <> 'active' or client.disabled_at is not null then
      raise exception 'the company is not active' using errcode = 'IVA23';
    end if;
    if new.deadline is distinct from old.deadline then
      today := (now() at time zone new.deadline_timezone)::date;
      if new.deadline < today or new.deadline > today + 366 then
        raise exception 'deadline is not acceptable' using errcode = 'IVA22';
      end if;
    end if;
  end if;

  return new;
end;
$$;

grant insert (description) on public.tasks to authenticated;
grant update (description) on public.tasks to authenticated;

-- Messages ---------------------------------------------------------------------------------------------------

create table public.va_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  va_id uuid not null,
  author_id uuid not null,
  body text not null,
  tenant_id uuid,
  created_at timestamptz not null default now(),
  constraint va_messages_body_length check (char_length(btrim(body)) between 1 and 2000),
  constraint va_messages_id_tenant_key unique (id, tenant_id)
);

create index va_messages_client_va_created_at_idx on public.va_messages (client_id, va_id, created_at);

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
      when 'meetings' then coalesce(
        (select l.tenant_id from public.leads l where l.id = (rec ->> 'lead_id')::uuid),
        (select p.tenant_id from public.profiles p where p.id = (rec ->> 'created_by')::uuid)
      )
      when 'meeting_events' then (select m.tenant_id from public.meetings m where m.id = (rec ->> 'meeting_id')::uuid)
      when 'tasks' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'task_comments' then (select t.tenant_id from public.tasks t where t.id = (rec ->> 'task_id')::uuid)
      when 'va_messages' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'va_shortlists' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'va_working_hours' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'va_id')::uuid)
      else private.default_tenant_id()
    end;
  end if;
  return new;
end;
$$;

create trigger va_messages_assign_tenant before insert on public.va_messages
  for each row execute function private.assign_tenant();

alter table public.va_messages alter column tenant_id set not null;

alter table public.va_messages add constraint va_messages_client_tenant_fkey
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete restrict;
alter table public.va_messages add constraint va_messages_va_tenant_fkey
  foreign key (va_id, tenant_id) references public.profiles (id, tenant_id) on delete restrict;
alter table public.va_messages add constraint va_messages_author_tenant_fkey
  foreign key (author_id, tenant_id) references public.profiles (id, tenant_id) on delete restrict;

create trigger va_messages_va_id_role before insert on public.va_messages
  for each row execute function private.enforce_role('va_id', 'va');
create trigger va_messages_author_id_role before insert on public.va_messages
  for each row execute function private.enforce_role('author_id', 'client', 'va');

create function private.guard_va_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  client public.clients%rowtype;
begin
  if tg_op <> 'INSERT' then
    raise exception 'this message cannot change' using errcode = 'IVA35';
  end if;

  new.body := btrim(new.body);
  select * into client from public.clients c where c.id = new.client_id;
  if not found or client.status <> 'active' or client.disabled_at is not null then
    raise exception 'the company is not active' using errcode = 'IVA23';
  end if;
  if new.author_id is distinct from client.user_id and new.author_id is distinct from new.va_id then
    raise exception 'this message cannot change' using errcode = 'IVA35';
  end if;
  if not exists (
    select 1 from public.client_va_assignments a
    where a.client_id = new.client_id and a.va_id = new.va_id and a.status = 'active'
  ) then
    raise exception 'no active assignment for this VA' using errcode = 'IVA24';
  end if;
  return new;
end;
$$;

create trigger va_messages_guard before insert or update or delete on public.va_messages
  for each row execute function private.guard_va_message();

revoke all on function private.guard_va_message() from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.va_messages to service_role;
grant select on public.va_messages to authenticated;
grant insert (client_id, va_id, author_id, body) on public.va_messages to authenticated;

alter table public.va_messages enable row level security;

create policy "Own tenant only" on public.va_messages as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));

create policy "Read messages by role" on public.va_messages for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('client')) and client_id in (select private.own_client_ids()))
    or ((select private.has_role('va')) and va_id = (select auth.uid()))
  );

create policy "The client and the assigned VA send messages" on public.va_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.client_va_assignments a
      join public.clients c on c.id = a.client_id
      where a.client_id = va_messages.client_id
        and a.va_id = va_messages.va_id
        and a.status = 'active'
        and c.status = 'active'
        and c.disabled_at is null
    )
    and (
      (
        (select private.has_role('client'))
        and client_id in (select private.own_client_ids())
      )
      or (
        (select private.has_role('va'))
        and va_id = (select auth.uid())
        and (select private.is_open_va())
      )
    )
  );
