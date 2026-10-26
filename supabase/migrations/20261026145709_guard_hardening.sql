-- Guard hardening for va_match and tasks. Behaviour is unchanged except for two things:
--
-- 1. guard_shortlist clears islandsva.shortlist_accept right after its own assignment insert. The flag used to
--    stay on for the rest of the transaction, so a later signed-in insert into client_va_assignments in that
--    transaction would have passed guard_assignment.
-- 2. "Signed in" is decided by the API role of the request, current_setting('role'), not by auth.uid() being
--    set: request.jwt.claims is a setting anyone in a direct session can write, so a session with forged claims
--    was treated as that user. The rule is the audit log's (supabase/CLAUDE.md → Audit actor): 'authenticated'
--    is a signed-in user and auth.uid() is who; service_role, a direct session ('none') or any other role is the
--    server. PostgREST's `set local role` keeps its value inside these security-definer triggers.
--
-- Neither was reachable through the API (authenticated has no insert grant on client_va_assignments; anon has no
-- grants on these tables). Each function is redefined whole; only the lines named above differ.

-- A signed-in insert is allowed only while a shortlist accept is in progress.
-- A signed-in update may only end one active assignment, and only an admin may do that.
create or replace function private.guard_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  signed_in boolean := coalesce(current_setting('role', true), '') = 'authenticated';
begin
  if tg_op = 'INSERT' then
    if signed_in
      and coalesce(current_setting('islandsva.shortlist_accept', true), '') is distinct from 'on'
    then
      raise exception 'a signed-in user cannot assign a VA this way' using errcode = 'IVA28';
    end if;
    return new;
  end if;

  if not signed_in then
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


-- Offer: an open VA, not already offered, not already active, at most three open offers, company not disabled.
-- Decide: the company's own login, and only offered → accepted or declined. Accept inserts the assignment.
create or replace function private.guard_shortlist() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  client public.clients%rowtype;
  -- Null for the server, however the session's claims are set.
  actor uuid := case when coalesce(current_setting('role', true), '') = 'authenticated' then (select auth.uid()) end;
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
    -- Only this insert: a later one in the same transaction is a signed-in insert again.
    perform set_config('islandsva.shortlist_accept', '', true);
  end if;

  return new;
end;
$$;

create or replace function private.guard_working_hours() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.weekday not between 1 and 7
    or new.start_minute < 0 or new.start_minute > 1410 or new.start_minute % 30 <> 0
    or new.end_minute < 30 or new.end_minute > 1440 or new.end_minute % 30 <> 0
    or new.end_minute <= new.start_minute
  then
    raise exception 'these working hours are not acceptable' using errcode = 'IVA29';
  end if;
  if coalesce(current_setting('role', true), '') = 'authenticated' and (
    (select auth.uid()) is distinct from new.va_id or not (select private.is_open_va())
  ) then
    raise exception 'these working hours are not acceptable' using errcode = 'IVA29';
  end if;
  return new;
end;
$$;

-- Every role, including the table owner. Insert stays todo. Status only moves forward. A done row
-- keeps its title, deadline and status. The client may only close. The VA may advance, and only
-- while that assignment is active and the VA portal is open; they cannot change the title or deadline.
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

  if tg_op = 'INSERT' then
    if new.status <> 'todo' or new.done_at is not null or new.closed_by is not null then
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

  if old.status = 'done' and (
    new.title is distinct from old.title
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

  if is_va and (new.title is distinct from old.title or new.deadline is distinct from old.deadline) then
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
  if new.title is distinct from old.title or new.deadline is distinct from old.deadline then
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
