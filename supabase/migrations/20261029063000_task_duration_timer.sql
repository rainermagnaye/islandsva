-- Task duration and the VA's timer. The client sets how long a task should take (a default per severity,
-- changeable until the task is closed). The VA's work is kept as sessions: "Start task" or "Resume" opens one,
-- "Pause" closes it, and handing the task over for review (or the client closing it) closes any open session.
-- Times come from the database clock, never from the browser. The app adds the sessions up: more time than
-- the duration is "Delayed", and the minutes inside a week count against the client's package hours.
--
--   todo ─start_task_timer─► in_progress + open session ─pause_task_timer─► in_progress, no open session
--   in_progress ─start_task_timer─► new session (after a pause, or after the client sent the task back)
--   submit for review / approve / close ─► the open session ends in the same statement
--
-- Applies after 20261028021600_task_review: it re-creates private.guard_task() and private.assign_tenant()
-- from that file, each with the additions marked below.

-- Duration ---------------------------------------------------------------------------------------------------

-- Values are stored for duration_minutes (a number the client chose, not free text). Only where the audit log
-- exists: on a database still waiting for 20261027073329_audit_log, creating the function here would make that
-- migration fail (it uses `create function`). Applied later, audit_log records duration_minutes by name only
-- (its default) until a migration adds it to the list again.
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
        when 'tasks' then array['client_id', 'va_id', 'status', 'deadline', 'deadline_timezone', 'done_at', 'closed_by', 'created_by',
          'duration_minutes']
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

-- Existing tasks take their severity's default (low 30 min, medium 1 h, high 2 h). Runs before guard_task is
-- re-created below, so the backfill goes through the guard that doesn't know the column yet.
alter table public.tasks add column duration_minutes integer;
update public.tasks set duration_minutes = case severity when 'low' then 30 when 'high' then 120 else 60 end;
alter table public.tasks alter column duration_minutes set not null;
alter table public.tasks add constraint tasks_duration_range check (duration_minutes between 5 and 600);

grant insert (duration_minutes) on public.tasks to authenticated;
grant update (duration_minutes) on public.tasks to authenticated;

-- Work sessions ----------------------------------------------------------------------------------------------

create table public.task_work_sessions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  va_id uuid not null,
  started_at timestamptz not null default now(),
  -- Null while the timer runs.
  ended_at timestamptz,
  tenant_id uuid,
  created_at timestamptz not null default now(),
  constraint task_work_sessions_order check (ended_at is null or ended_at >= started_at)
);

-- Tenants: sessions from their task. As 20261028021600_task_review, plus the task_work_sessions case.
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
      when 'task_work_sessions' then (select t.tenant_id from public.tasks t where t.id = (rec ->> 'task_id')::uuid)
      when 'va_messages' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'va_shortlists' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'va_working_hours' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'va_id')::uuid)
      else private.default_tenant_id()
    end;
  end if;
  return new;
end;
$$;

create trigger task_work_sessions_assign_tenant before insert on public.task_work_sessions
  for each row execute function private.assign_tenant();

alter table public.task_work_sessions alter column tenant_id set not null;

alter table public.task_work_sessions add constraint task_work_sessions_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete restrict;
-- Restrict: a task with recorded time can't be deleted (the time counts against the package).
alter table public.task_work_sessions add constraint task_work_sessions_task_tenant_fkey
  foreign key (task_id, tenant_id) references public.tasks (id, tenant_id) on delete restrict;
alter table public.task_work_sessions add constraint task_work_sessions_va_tenant_fkey
  foreign key (va_id, tenant_id) references public.profiles (id, tenant_id) on delete restrict;

-- One running timer per VA, whichever task it is on.
create unique index task_work_sessions_one_open_per_va on public.task_work_sessions (va_id) where ended_at is null;
create index task_work_sessions_task_started_idx on public.task_work_sessions (task_id, started_at);
create index task_work_sessions_tenant_id_idx on public.task_work_sessions (tenant_id);

-- A session only ever gains its end, once. Nothing else changes and nothing is deleted, even with the secret key.
create function private.guard_task_work_session() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;
  if old.ended_at is not null
    or new.ended_at is null
    or new.id is distinct from old.id
    or new.task_id is distinct from old.task_id
    or new.va_id is distinct from old.va_id
    or new.started_at is distinct from old.started_at
    or new.tenant_id is distinct from old.tenant_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;
  return new;
end;
$$;

create trigger task_work_sessions_guard before update or delete on public.task_work_sessions
  for each row execute function private.guard_task_work_session();

revoke all on function private.guard_task_work_session() from public, anon, authenticated, service_role;

-- Signed-in users only read. Sessions are written by start_task_timer, pause_task_timer and guard_task.
grant select, insert, update, delete on public.task_work_sessions to service_role;
grant select on public.task_work_sessions to authenticated;

alter table public.task_work_sessions enable row level security;

create policy "Own tenant only" on public.task_work_sessions as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));

-- Visible when the task is (its client, its VA, admins with 2FA). RLS on tasks applies inside the exists.
create policy "Read sessions on visible tasks" on public.task_work_sessions for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_work_sessions.task_id));

-- The guard -------------------------------------------------------------------------------------------------
-- As 20261028021600_task_review, plus: a missing duration takes the severity's default on insert; the duration
-- is frozen on a closed task, VA-proof and needs an active company, like the deadline; and a move to review or
-- done ends the open session.

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
    -- The app sends a duration; a write without one gets the severity's default.
    if new.duration_minutes is null then
      new.duration_minutes := case new.severity when 'low' then 30 when 'high' then 120 else 60 end;
    end if;
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
    or new.duration_minutes is distinct from old.duration_minutes
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
    or new.duration_minutes is distinct from old.duration_minutes
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
    or new.duration_minutes is distinct from old.duration_minutes
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

  -- Work handed over (review) or closed (done) stops the VA's clock. Runs as the function owner: signed-in
  -- users have no write grant on task_work_sessions.
  if kind in ('submitted', 'approved', 'closed') then
    update public.task_work_sessions s set ended_at = now() where s.task_id = new.id and s.ended_at is null;
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

-- The timer --------------------------------------------------------------------------------------------------
-- SECURITY DEFINER (written reason): signed-in users have no write grant on task_work_sessions, so these two
-- functions are the only way a VA records time, and they check the caller themselves. The start of a to-do task
-- goes through tasks (guard_task), so its 'started' event, started_at and every status rule apply as before.

-- Starts the VA's clock on their task: the first start also moves it to In progress. Returns the start time.
create function public.start_task_timer(task_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  task public.tasks%rowtype;
  client public.clients%rowtype;
  started timestamptz;
begin
  if me is null or not (select private.has_role('va')) then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;
  select * into task from public.tasks t
    where t.id = start_task_timer.task_id and t.va_id = me and t.tenant_id = (select private.tenant_id())
    for update;
  if not found then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;
  if task.status not in ('todo', 'in_progress') then
    raise exception 'the timer cannot start on this task' using errcode = 'IVA39';
  end if;
  select * into client from public.clients c where c.id = task.client_id;
  if client.status <> 'active' or client.disabled_at is not null then
    raise exception 'the company is not active' using errcode = 'IVA23';
  end if;
  if not private.va_is_open(me) or not exists (
    select 1 from public.client_va_assignments a
    where a.client_id = task.client_id and a.va_id = me and a.status = 'active'
  ) then
    raise exception 'no active assignment for this VA' using errcode = 'IVA24';
  end if;
  if exists (select 1 from public.task_work_sessions s where s.va_id = me and s.ended_at is null) then
    raise exception 'a timer is already running' using errcode = 'IVA39';
  end if;
  if task.status = 'todo' then
    update public.tasks t set status = 'in_progress' where t.id = task.id;
  end if;
  insert into public.task_work_sessions (task_id, va_id) values (task.id, me) returning started_at into started;
  return started;
exception
  -- Two starts at the same moment: the unique index lets one through.
  when unique_violation then
    raise exception 'a timer is already running' using errcode = 'IVA39';
end;
$$;

-- Stops the VA's running clock on their task. Allowed after the assignment ends, so a clock never runs on.
create function public.pause_task_timer(task_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  ended timestamptz;
begin
  if me is null or not (select private.has_role('va')) then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;
  update public.task_work_sessions s set ended_at = now()
    where s.task_id = pause_task_timer.task_id and s.va_id = me and s.ended_at is null
      and s.tenant_id = (select private.tenant_id())
    returning s.ended_at into ended;
  if ended is null then
    raise exception 'no timer is running on this task' using errcode = 'IVA40';
  end if;
  return ended;
end;
$$;

revoke all on function public.start_task_timer(uuid) from public, anon, authenticated, service_role;
revoke all on function public.pause_task_timer(uuid) from public, anon, authenticated, service_role;
grant execute on function public.start_task_timer(uuid) to authenticated;
grant execute on function public.pause_task_timer(uuid) to authenticated;
