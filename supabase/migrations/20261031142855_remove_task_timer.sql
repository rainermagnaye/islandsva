-- Removes the task timer and task duration (20261029063000_task_duration_timer). VA hours are logged per client
-- with a play / pause timer instead (M14, docs/decisions.md), so time on a task and "Delayed" go away:
-- task_work_sessions, start_task_timer, pause_task_timer and tasks.duration_minutes.
--
-- Applies after 20261030150000_va_bookings: it re-creates private.guard_task() from that file and
-- private.assign_tenant() and private.audit_allow() from task_duration_timer, each without the timer.
--
-- The timer was never live, so no recorded time is lost. The migration stops rather than drop sessions if any exist.

do $$
begin
  if exists (select 1 from public.task_work_sessions) then
    raise exception 'task_work_sessions has rows: recorded time would be lost';
  end if;
end
$$;

-- The guard first: until it is re-created, a task move would still write to task_work_sessions.
-- As 20261030150000_va_bookings, without the duration (default, frozen, VA-proof) and without ending the
-- open session on review or close.
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

  is_client := actor is not null and actor is not distinct from client.user_id;
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

-- Tenants: as 20261029063000_task_duration_timer, without the task_work_sessions case. It must never name a
-- table that doesn't exist (Postgres plans the whole case), so it is re-created before the table is dropped.
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

-- Audit values: as task_duration_timer, without duration_minutes. Only where the audit log exists, for the same
-- reason as there: on a database still waiting for 20261027073329_audit_log, that migration creates it.
do $do$
begin
  if to_regprocedure('private.audit_allow(text)') is not null then
    execute $ddl$
    create or replace function private.audit_allow(tbl text) returns text[]
    language sql immutable set search_path = '' as $$
      select case tbl
        when 'leads' then array['status', 'closer_id', 'converted_client_id', 'disabled_at', 'package_code']
        -- A manual meeting's title and name snapshots (client_name, staff_name, creator_name) are names only.
        when 'meetings' then array['kind', 'status', 'lead_id', 'organizer_id', 'decided_by', 'decided_at', 'starts_at', 'ends_at',
          'client_id', 'staff_id', 'created_by']
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
    $ddl$;
    revoke all on function private.audit_allow(text) from public, anon, authenticated, service_role;
  end if;
end
$do$;

drop function public.start_task_timer(uuid);
drop function public.pause_task_timer(uuid);

-- The table's triggers, policies, indexes and foreign keys go with it.
drop table public.task_work_sessions;
drop function private.guard_task_work_session();

-- The range check and the column grants go with the column.
alter table public.tasks drop column duration_minutes;
