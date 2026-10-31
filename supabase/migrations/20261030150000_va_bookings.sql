-- VAs book from their calendar (the "Book" menu):
--   * a meeting with one of their clients, which waits as requested until the client accepts or declines;
--   * a meeting with the team only, which is scheduled right away;
--   * a task for a client on an active assignment (the client reviews and closes it as usual);
--   * a block of time, on one of their own tasks or as a to-do of their own (calendar_blocks).
-- Meetings are written through security definer functions, as for admins and clients. Tasks and blocks are
-- plain inserts checked by RLS and triggers.

-- Meetings ---------------------------------------------------------------------------------------------------

-- A manual meeting may now wait for a client's answer.
alter table public.meetings drop constraint meetings_manual_shape;
alter table public.meetings add constraint meetings_manual_shape check (
  kind <> 'manual' or (
    title is not null
    and lead_id is null
    and organizer_id is null
    and decided_by is null
    and decided_at is null
    and google_event_id is null
    and meet_url is null
    and created_by is not null
    and creator_name is not null
    and status in ('requested', 'scheduled', 'cancelled', 'done')
    and (client_id is null) = (client_name is null)
    and (staff_id is null) = (staff_name is null)
  )
);

drop trigger meetings_created_by_role on public.meetings;
create trigger meetings_created_by_role
  before insert or update of created_by on public.meetings
  for each row execute function private.enforce_role('created_by', 'admin', 'client', 'va');

drop trigger meeting_events_actor_id_role on public.meeting_events;
create trigger meeting_events_actor_id_role
  before insert on public.meeting_events
  for each row execute function private.enforce_role('actor_id', 'closer', 'admin', 'client', 'va');

-- The signed-in VA's name for meetings and history. Only a request signed in as an open VA.
create function private.meeting_va(out actor_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('role', true), '') <> 'authenticated'
    or not (select private.has_role('va'))
    or not private.va_is_open((select auth.uid()))
  then
    raise exception 'assistants only' using errcode = 'insufficient_privilege';
  end if;
  select coalesce(nullif(btrim(p.full_name), ''), 'Your VA') into actor_name
  from public.profiles p
  where p.id = (select auth.uid()) and p.tenant_id = (select private.tenant_id());
  if actor_name is null then
    raise exception 'assistants only' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function private.meeting_va() from public, anon, authenticated, service_role;

-- With a client: one on an active assignment to this VA, and the meeting waits for them (requested). Without
-- one: a team call, scheduled now. The VA is always the first guest; other staff are optional.
create function public.create_va_meeting(
  title text, starts_at timestamptz, ends_at timestamptz,
  client_id uuid default null, staff_ids uuid[] default '{}', note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me record;
  new_id uuid;
  clean_note text := nullif(btrim(note), '');
  people uuid[];
  client_list uuid[] := '{}';
  client_labels text[] := '{}';
  guest_ids uuid[] := '{}';
  guest_labels text[] := '{}';
  guest record;
  new_status public.meeting_status;
begin
  select * into me from private.meeting_va();
  if title is null or char_length(btrim(title)) not between 1 and 120
    or starts_at is null or ends_at is null
    or ends_at <= starts_at or ends_at > starts_at + interval '8 hours'
    or (clean_note is not null and char_length(clean_note) > 1000)
  then
    raise exception 'the booking cannot be saved' using errcode = 'IVA30';
  end if;
  if starts_at <= now() then
    raise exception 'choose a time ahead' using errcode = 'IVA38';
  end if;

  if create_va_meeting.client_id is not null then
    if not exists (
      select 1 from public.client_va_assignments a
      join public.clients c on c.id = a.client_id
      where a.client_id = create_va_meeting.client_id
        and a.va_id = (select auth.uid())
        and a.status = 'active'
        and c.status = 'active'
        and c.disabled_at is null
        and c.tenant_id = (select private.tenant_id())
    ) then
      raise exception 'choose one of your clients' using errcode = 'IVA46';
    end if;
    client_list := array[create_va_meeting.client_id];
  end if;

  people := array[(select auth.uid())] || array(
    select distinct s.id from unnest(coalesce(staff_ids, '{}'::uuid[])) as s(id)
    where s.id is not null and s.id <> (select auth.uid())
  );
  for guest in select * from private.resolve_manual_guests(client_list, people) loop
    if guest.kind = 'client' then
      client_labels := client_labels || guest.guest_name;
    else
      guest_ids := guest_ids || guest.person_id;
      guest_labels := guest_labels || guest.guest_name;
    end if;
  end loop;

  new_status := case when create_va_meeting.client_id is null then 'scheduled' else 'requested' end;
  insert into public.meetings (
    kind, status, title, starts_at, ends_at,
    client_id, staff_id, client_name, staff_name,
    client_ids, staff_ids, client_names, staff_names,
    created_by, creator_name
  ) values (
    'manual', new_status, btrim(title), starts_at, ends_at,
    client_list[1], guest_ids[1], client_labels[1], guest_labels[1],
    client_list, guest_ids, client_labels, guest_labels,
    (select auth.uid()), me.actor_name
  ) returning id into new_id;

  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (new_id, case when new_status = 'requested' then 'requested' else 'scheduled' end::public.meeting_event_kind,
    (select auth.uid()), me.actor_name);
  if clean_note is not null then
    insert into public.meeting_events (meeting_id, kind, actor_id, actor_name, body)
    values (new_id, 'note', (select auth.uid()), me.actor_name, clean_note);
  end if;
  return new_id;
end;
$$;

-- The VA cancels a meeting they booked, while it's still open.
create function public.cancel_va_meeting(meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me record;
  meeting public.meetings%rowtype;
begin
  select * into me from private.meeting_va();
  select * into meeting from public.meetings m
  where m.id = cancel_va_meeting.meeting_id
    and m.kind = 'manual'
    and m.created_by = (select auth.uid())
    and m.tenant_id = (select private.tenant_id())
  for update;
  if not found then
    raise exception 'booking not found' using errcode = 'IVA01';
  end if;
  if meeting.status not in ('requested', 'scheduled') then
    raise exception 'the booking cannot change' using errcode = 'IVA30';
  end if;
  update public.meetings m set status = 'cancelled' where m.id = meeting.id;
  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (meeting.id, 'cancelled', (select auth.uid()), me.actor_name);
end;
$$;

-- The client answers a meeting their VA asked for: accept schedules it (if it hasn't started), decline cancels it.
create function public.answer_va_meeting(meeting_id uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me record;
  meeting public.meetings%rowtype;
begin
  select * into me from private.meeting_client();
  select * into meeting from public.meetings m
  where m.id = answer_va_meeting.meeting_id
    and m.kind = 'manual'
    and m.status = 'requested'
    and m.client_id = me.client_id
    and m.tenant_id = (select private.tenant_id())
  for update;
  if not found then
    raise exception 'booking not found' using errcode = 'IVA01';
  end if;
  if accept is null then
    raise exception 'the booking cannot change' using errcode = 'IVA30';
  end if;
  if accept and meeting.starts_at <= now() then
    raise exception 'choose a time ahead' using errcode = 'IVA38';
  end if;
  update public.meetings m set status = case when accept then 'scheduled' else 'cancelled' end::public.meeting_status
  where m.id = meeting.id;
  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (meeting.id, case when accept then 'scheduled' else 'cancelled' end::public.meeting_event_kind,
    (select auth.uid()), me.actor_name);
end;
$$;

revoke all on function public.create_va_meeting(text, timestamptz, timestamptz, uuid, uuid[], text) from public, anon, authenticated, service_role;
revoke all on function public.cancel_va_meeting(uuid) from public, anon, authenticated, service_role;
revoke all on function public.answer_va_meeting(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.create_va_meeting(text, timestamptz, timestamptz, uuid, uuid[], text) to authenticated;
grant execute on function public.cancel_va_meeting(uuid) to authenticated;
grant execute on function public.answer_va_meeting(uuid, boolean) to authenticated;

-- Tasks ------------------------------------------------------------------------------------------------------

-- A VA may add a task for a client on their active assignment. It is the client's task like any other: the client
-- edits, reviews and closes it; the VA starts and submits it.
drop trigger tasks_created_by_role on public.tasks;
create trigger tasks_created_by_role before insert or update of created_by on public.tasks
  for each row execute function private.enforce_role('created_by', 'client', 'va');

create policy "VAs create tasks for their active clients" on public.tasks for insert to authenticated
  with check (
    (select private.has_role('va'))
    and (select private.is_open_va())
    and created_by = (select auth.uid())
    and va_id = (select auth.uid())
    and status = 'todo'
    and exists (
      select 1 from public.client_va_assignments a
      join public.clients c on c.id = a.client_id
      where a.client_id = tasks.client_id
        and a.va_id = tasks.va_id
        and a.status = 'active'
        and c.status = 'active'
        and c.disabled_at is null
    )
  );

-- Same guard, one change: the client is the company's user only. Before, the task's creator also counted as the
-- client, which would let a VA who added a task approve their own work.
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

-- Calendar blocks ---------------------------------------------------------------------------------------------

-- Time a VA sets aside: on one of their own open tasks (title comes from the task), or a to-do of their own
-- (title required). Only the VA and admins see them. No update: remove and add again.
create table public.calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  va_id uuid not null,
  task_id uuid references public.tasks (id) on delete cascade,
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint calendar_blocks_title check (
    (task_id is null and title is not null and char_length(btrim(title)) between 1 and 160)
    or (task_id is not null and title is null)
  ),
  constraint calendar_blocks_span check (ends_at > starts_at and ends_at <= starts_at + interval '12 hours')
);

alter table public.calendar_blocks add constraint calendar_blocks_va_tenant_fkey
  foreign key (va_id, tenant_id) references public.profiles (id, tenant_id) on delete restrict;
create index calendar_blocks_va_starts_idx on public.calendar_blocks (va_id, starts_at);
create index calendar_blocks_task_idx on public.calendar_blocks (task_id) where task_id is not null;

-- Fills the owner and tenant from the session, and checks a task block is on the VA's own open task.
create function private.fill_calendar_block() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  task public.tasks%rowtype;
begin
  if coalesce(current_setting('role', true), '') = 'authenticated' then
    new.va_id := (select auth.uid());
  end if;
  select p.tenant_id into new.tenant_id from public.profiles p where p.id = new.va_id;
  new.title := nullif(btrim(new.title), '');
  if new.task_id is not null then
    select * into task from public.tasks t where t.id = new.task_id;
    if not found or task.va_id is distinct from new.va_id or task.status = 'done' then
      raise exception 'choose one of your open tasks' using errcode = 'IVA47';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.fill_calendar_block() from public, anon, authenticated, service_role;

create trigger calendar_blocks_fill before insert on public.calendar_blocks
  for each row execute function private.fill_calendar_block();
create trigger calendar_blocks_va_id_role before insert on public.calendar_blocks
  for each row execute function private.enforce_role('va_id', 'va');

alter table public.calendar_blocks enable row level security;

revoke all on public.calendar_blocks from public, anon, authenticated;
grant select, insert, update, delete on public.calendar_blocks to service_role;
grant select, delete on public.calendar_blocks to authenticated;
grant insert (task_id, title, starts_at, ends_at) on public.calendar_blocks to authenticated;

create policy "VAs and admins read blocks" on public.calendar_blocks for select to authenticated
  using (va_id = (select auth.uid()) or (select private.is_admin()));
create policy "Open VAs add their own blocks" on public.calendar_blocks for insert to authenticated
  with check ((select private.has_role('va')) and (select private.is_open_va()) and va_id = (select auth.uid()));
create policy "VAs remove their own blocks" on public.calendar_blocks for delete to authenticated
  using (va_id = (select auth.uid()));
