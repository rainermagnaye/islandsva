-- Task review (M11): the VA hands a task over for review, and the client either approves and closes it
-- or sends it back with feedback. Every status move is kept in task_events, the activity on the task page.
--
--   todo ─► in_progress ─► review ─► done (shown as Closed)
--     VA starts    VA submits   client approves
--                        └──► in_progress   client requests changes (feedback required)
--   todo / in_progress ─► done             client closes without review (as before)
--   done ─► in_progress                    client reopens (feedback required)
--
-- 'done' keeps its name so done_at, on-time and overdue keep working; the app labels it Closed.
-- The VA no longer closes a task. Nobody moves a task back to 'todo'.

-- Activity ---------------------------------------------------------------------------------------------------

create type public.task_event_kind as enum ('started', 'submitted', 'changes_requested', 'approved', 'closed', 'reopened');

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  kind public.task_event_kind not null,
  -- The VA's handover note, or the client's feedback. Required when the task goes back to the VA.
  note text,
  -- Null when the move had no signed-in user (the server). The first name is a snapshot.
  actor_id uuid,
  actor_first_name text,
  tenant_id uuid,
  created_at timestamptz not null default now(),
  constraint task_events_note_length check (note is null or char_length(btrim(note)) between 1 and 2000),
  constraint task_events_note_required check (kind not in ('changes_requested', 'reopened') or note is not null),
  constraint task_events_actor_named check ((actor_id is null) = (actor_first_name is null))
);

-- Tenants: events from their task. Every existing case stays.
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
      when 'task_attachments' then (select t.tenant_id from public.tasks t where t.id = (rec ->> 'task_id')::uuid)
      when 'task_events' then (select t.tenant_id from public.tasks t where t.id = (rec ->> 'task_id')::uuid)
      when 'va_messages' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'va_shortlists' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'va_working_hours' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'va_id')::uuid)
      else private.default_tenant_id()
    end;
  end if;
  return new;
end;
$$;

create trigger task_events_assign_tenant before insert on public.task_events
  for each row execute function private.assign_tenant();

alter table public.task_events alter column tenant_id set not null;

alter table public.task_events add constraint task_events_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete restrict;
alter table public.task_events add constraint task_events_task_tenant_fkey
  foreign key (task_id, tenant_id) references public.tasks (id, tenant_id) on delete restrict;
alter table public.task_events add constraint task_events_actor_tenant_fkey
  foreign key (actor_id, tenant_id) references public.profiles (id, tenant_id) on delete restrict;

create index task_events_task_created_at_idx on public.task_events (task_id, created_at);
create index task_events_actor_id_idx on public.task_events (actor_id);
create index task_events_tenant_id_idx on public.task_events (tenant_id);

-- Append-only. Only the task's client, signed in, may delete events, and only to delete the task with them.
create function private.guard_task_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  task public.tasks%rowtype;
  owner uuid;
begin
  if tg_op = 'DELETE' then
    if coalesce(current_setting('role', true), '') <> 'authenticated' then
      raise exception 'this change is not allowed' using errcode = 'IVA25';
    end if;
    select * into task from public.tasks t where t.id = old.task_id;
    if not found then
      return old;
    end if;
    select c.user_id into owner from public.clients c where c.id = task.client_id;
    if (select auth.uid()) is distinct from owner and (select auth.uid()) is distinct from task.created_by then
      raise exception 'this change is not allowed' using errcode = 'IVA25';
    end if;
    return old;
  end if;
  raise exception 'this change is not allowed' using errcode = 'IVA25';
end;
$$;

create trigger task_events_guard before update or delete on public.task_events
  for each row execute function private.guard_task_event();

revoke all on function private.guard_task_event() from public, anon, authenticated, service_role;

-- Signed-in users never insert an event: guard_task writes it in the same statement as the move.
grant select, insert, update, delete on public.task_events to service_role;
grant select, delete on public.task_events to authenticated;

alter table public.task_events enable row level security;

create policy "Own tenant only" on public.task_events as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));

-- Visible when the task is. RLS on tasks applies inside the exists.
create policy "Read events on visible tasks" on public.task_events for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_events.task_id));

create policy "The client deletes events on their task" on public.task_events for delete to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_events.task_id
        and (select private.has_role('client'))
        and t.client_id in (select private.own_client_ids())
    )
  );

-- The note on a move -----------------------------------------------------------------------------------------
-- Sent in the same update as the status. guard_task copies it into the event and clears it, so the
-- column is always empty on the row (the check holds it to that).

alter table public.tasks add column transition_note text;
alter table public.tasks add constraint tasks_transition_note_transient check (transition_note is null);

grant update (transition_note) on public.tasks to authenticated;

-- The guard ---------------------------------------------------------------------------------------------------
-- As 20261027154829_task_deadline_time, with the status rules above, done_at cleared on reopen, and the event.

create or replace function private.guard_task() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  client public.clients%rowtype;
  actor uuid := case when coalesce(current_setting('role', true), '') = 'authenticated' then (select auth.uid()) end;
  today date;
  is_client boolean;
  is_va boolean;
  note text;
  kind public.task_event_kind;
begin
  select * into client from public.clients c where c.id = new.client_id;
  if not found then
    raise exception 'client not found' using errcode = 'foreign_key_violation';
  end if;

  new.description := nullif(btrim(new.description), '');
  if new.severity is null or new.severity not in ('low', 'medium', 'high') then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'todo' or new.done_at is not null or new.closed_by is not null or new.started_at is not null
      or new.transition_note is not null
    then
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
    if new.deadline_time is not null and (new.deadline + new.deadline_time) <= (now() at time zone new.deadline_timezone) then
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

  -- The note belongs to a status move and is never stored on the row.
  note := nullif(btrim(new.transition_note), '');
  new.transition_note := null;
  if note is not null and char_length(note) > 2000 then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

  if new.status is distinct from old.status then
    kind := case
      when old.status = 'todo' and new.status = 'in_progress' then 'started'
      when old.status in ('todo', 'in_progress') and new.status = 'review' then 'submitted'
      when old.status = 'review' and new.status = 'in_progress' then 'changes_requested'
      when old.status = 'review' and new.status = 'done' then 'approved'
      when old.status in ('todo', 'in_progress') and new.status = 'done' then 'closed'
      when old.status = 'done' and new.status = 'in_progress' then 'reopened'
    end;
    if kind is null or (kind in ('changes_requested', 'reopened') and note is null) then
      raise exception 'this change is not allowed' using errcode = 'IVA25';
    end if;
  elsif note is not null then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

  if new.status = 'done' and old.status <> 'done' then
    new.done_at := now();
    new.closed_by := actor;
  elsif old.status = 'done' and new.status <> 'done' then
    new.done_at := null;
    new.closed_by := null;
  elsif new.done_at is distinct from old.done_at or new.closed_by is distinct from old.closed_by then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

  if old.status = 'todo' and new.status = 'in_progress' then
    new.started_at := now();
  elsif new.started_at is distinct from old.started_at then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

  -- A closed task is frozen; the only way out is a reopen, which changes nothing else.
  if old.status = 'done' and (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.deadline is distinct from old.deadline
    or new.deadline_time is distinct from old.deadline_time
    or new.severity is distinct from old.severity
  ) then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

  is_client := actor is not null and (actor = new.created_by or actor is not distinct from client.user_id);
  is_va := actor is not null and actor = new.va_id and not is_client;

  -- Signed in, the client reviews and closes; the VA starts and submits. Nobody else moves a task.
  if kind is not null and actor is not null and (
    (is_client and kind not in ('changes_requested', 'approved', 'closed', 'reopened'))
    or (is_va and kind not in ('started', 'submitted'))
    or (not is_client and not is_va)
  ) then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

  -- Work going back to the VA needs an open company and that VA still on the assignment.
  if kind in ('changes_requested', 'reopened') then
    if client.status <> 'active' or client.disabled_at is not null then
      raise exception 'the company is not active' using errcode = 'IVA23';
    end if;
    if not private.va_is_open(new.va_id) or not exists (
      select 1 from public.client_va_assignments a
      where a.client_id = new.client_id and a.va_id = new.va_id and a.status = 'active'
    ) then
      raise exception 'no active assignment for this VA' using errcode = 'IVA24';
    end if;
  end if;

  if is_va and (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.deadline is distinct from old.deadline
    or new.deadline_time is distinct from old.deadline_time
    or new.severity is distinct from old.severity
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

  if new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.deadline is distinct from old.deadline
    or new.deadline_time is distinct from old.deadline_time
    or new.severity is distinct from old.severity
  then
    if client.status <> 'active' or client.disabled_at is not null then
      raise exception 'the company is not active' using errcode = 'IVA23';
    end if;
    if new.deadline is distinct from old.deadline or new.deadline_time is distinct from old.deadline_time then
      today := (now() at time zone new.deadline_timezone)::date;
      if new.deadline < today or new.deadline > today + 366 then
        raise exception 'deadline is not acceptable' using errcode = 'IVA22';
      end if;
      if new.deadline_time is not null and (new.deadline + new.deadline_time) <= (now() at time zone new.deadline_timezone) then
        raise exception 'deadline is not acceptable' using errcode = 'IVA22';
      end if;
    end if;
  end if;

  -- Written here, in the same statement as the move, so the activity can't disagree with the status.
  -- Runs as the function owner: signed-in users have no insert grant on task_events.
  if kind is not null then
    insert into public.task_events (task_id, kind, note, actor_id, actor_first_name, tenant_id)
    values (
      new.id,
      kind,
      note,
      actor,
      case when actor is null then null else coalesce(
        (select nullif(split_part(btrim(p.full_name), ' ', 1), '') from public.profiles p where p.id = actor),
        'Someone'
      ) end,
      new.tenant_id
    );
  end if;

  return new;
end;
$$;
