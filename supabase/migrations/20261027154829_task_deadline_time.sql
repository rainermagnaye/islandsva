-- A deadline can name a time of day in the snapshotted zone. No time means the end of that day,
-- which is how a date-only deadline already behaved. A company with no time zone is snapshotted as
-- Asia/Manila (the agency's zone) so a task can still be saved.

alter table public.tasks add column deadline_time time;

-- Snapshots. Runs before tasks_guard (name order). Overwrites whatever the writer sent.
create or replace function private.fill_task() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  client public.clients%rowtype;
  first_name text;
  zone text;
begin
  select * into client from public.clients c where c.id = new.client_id;
  if not found then
    raise exception 'client not found' using errcode = 'foreign_key_violation';
  end if;
  -- A missing zone uses the agency's zone. Anything Postgres does not know is still IVA22.
  zone := coalesce(client.timezone, 'Asia/Manila');
  if not exists (
    select 1 from pg_catalog.pg_timezone_names z where z.name = zone
  ) then
    raise exception 'deadline timezone is not acceptable' using errcode = 'IVA22';
  end if;
  select coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'Your VA')
    into first_name
  from public.profiles p where p.id = new.va_id;
  new.company_name := client.company_name;
  new.deadline_timezone := zone;
  new.va_first_name := coalesce(first_name, 'Your VA');
  return new;
end;
$$;

create or replace function private.guard_task() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  client public.clients%rowtype;
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
  if new.severity is null or new.severity not in ('low', 'medium', 'high') then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

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

  if new.status = 'done' and old.status is distinct from 'done' then
    new.done_at := now();
    new.closed_by := actor;
  elsif new.done_at is distinct from old.done_at or new.closed_by is distinct from old.closed_by then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

  if old.status = 'todo' and new.status = 'in_progress' then
    new.started_at := now();
  elsif new.started_at is distinct from old.started_at then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;

  if old.status = 'done' and (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.deadline is distinct from old.deadline
    or new.deadline_time is distinct from old.deadline_time
    or new.severity is distinct from old.severity
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

  is_client := actor is not null and (actor = new.created_by or actor is not distinct from client.user_id);
  is_va := actor is not null and actor = new.va_id and not is_client;

  if is_client and new.status is distinct from old.status and new.status <> 'done' then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
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

  return new;
end;
$$;

grant insert (deadline_time) on public.tasks to authenticated;
grant update (deadline_time) on public.tasks to authenticated;
