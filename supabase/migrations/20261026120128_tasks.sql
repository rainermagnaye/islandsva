-- Tasks (M11): a client adds work for the VA on their active assignment. Status moves forward only.
-- Company name, the VA's first name and the deadline's time zone are snapshots, so a later correction
-- to the client record does not move a deadline that was already set.
--
-- Task audit (status, deadline, va_id, done_at only; never title or comments) is added when audit_log exists.

create type public.task_status as enum ('todo', 'in_progress', 'done');

-- Tasks ------------------------------------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  va_id uuid not null,
  title text not null,
  deadline date not null,
  -- Copied from the client when the name is a real time zone. The client does not send it.
  deadline_timezone text not null,
  company_name text not null,
  va_first_name text not null,
  status public.task_status not null default 'todo',
  done_at timestamptz,
  -- Set by the guard from auth.uid() when the task is closed. Null when that write has no user
  -- (the done check still holds). Never cleared.
  closed_by uuid,
  created_by uuid not null,
  tenant_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_length check (char_length(btrim(title)) between 1 and 160),
  constraint tasks_deadline_timezone_known check (deadline_timezone ~ '^[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)+$'),
  constraint tasks_done_at_matches_status check ((status = 'done') = (done_at is not null)),
  constraint tasks_id_tenant_key unique (id, tenant_id)
);

-- Comments ---------------------------------------------------------------------------------------------------

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  author_id uuid not null,
  author_first_name text not null,
  body text not null,
  tenant_id uuid,
  created_at timestamptz not null default now(),
  constraint task_comments_body_length check (char_length(btrim(body)) between 1 and 2000)
);

-- Tenants: tasks from the client, comments from the task. Every existing case stays.
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
      when 'tasks' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'task_comments' then (select t.tenant_id from public.tasks t where t.id = (rec ->> 'task_id')::uuid)
      else private.default_tenant_id()
    end;
  end if;
  return new;
end;
$$;

-- Named *_assign_tenant so they run before the other BEFORE INSERT triggers (alphabetical).
create trigger tasks_assign_tenant before insert on public.tasks
  for each row execute function private.assign_tenant();
create trigger task_comments_assign_tenant before insert on public.task_comments
  for each row execute function private.assign_tenant();

alter table public.tasks alter column tenant_id set not null;
alter table public.task_comments alter column tenant_id set not null;

alter table public.tasks add constraint tasks_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete restrict;
alter table public.tasks add constraint tasks_client_tenant_fkey
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete restrict;
alter table public.tasks add constraint tasks_va_tenant_fkey
  foreign key (va_id, tenant_id) references public.profiles (id, tenant_id) on delete restrict;
alter table public.tasks add constraint tasks_created_by_tenant_fkey
  foreign key (created_by, tenant_id) references public.profiles (id, tenant_id) on delete restrict;
alter table public.tasks add constraint tasks_closed_by_tenant_fkey
  foreign key (closed_by, tenant_id) references public.profiles (id, tenant_id) on delete restrict;

alter table public.task_comments add constraint task_comments_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete restrict;
alter table public.task_comments add constraint task_comments_task_tenant_fkey
  foreign key (task_id, tenant_id) references public.tasks (id, tenant_id) on delete restrict;
alter table public.task_comments add constraint task_comments_author_tenant_fkey
  foreign key (author_id, tenant_id) references public.profiles (id, tenant_id) on delete restrict;

create trigger tasks_va_id_role before insert or update of va_id on public.tasks
  for each row execute function private.enforce_role('va_id', 'va');
create trigger tasks_created_by_role before insert or update of created_by on public.tasks
  for each row execute function private.enforce_role('created_by', 'client');
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();
create trigger task_comments_author_id_role before insert or update of author_id on public.task_comments
  for each row execute function private.enforce_role('author_id', 'client', 'va');

create index tasks_client_deadline_idx on public.tasks (client_id, deadline);
create index tasks_va_deadline_idx on public.tasks (va_id, deadline);
create index tasks_created_by_idx on public.tasks (created_by);
create index tasks_tenant_id_idx on public.tasks (tenant_id);
create index task_comments_task_created_at_idx on public.task_comments (task_id, created_at);
create index task_comments_author_id_idx on public.task_comments (author_id);
create index task_comments_tenant_id_idx on public.task_comments (tenant_id);

-- Snapshots. Runs before tasks_guard (name order). Overwrites whatever the writer sent.
create function private.fill_task() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  client public.clients%rowtype;
  first_name text;
begin
  select * into client from public.clients c where c.id = new.client_id;
  if not found then
    raise exception 'client not found' using errcode = 'foreign_key_violation';
  end if;
  -- The same shape as clients.timezone, and a zone Postgres actually knows. Anything else is IVA22.
  if client.timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names z where z.name = client.timezone
  ) then
    raise exception 'deadline timezone is not acceptable' using errcode = 'IVA22';
  end if;
  select coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'Your VA')
    into first_name
  from public.profiles p where p.id = new.va_id;
  new.company_name := client.company_name;
  new.deadline_timezone := client.timezone;
  new.va_first_name := coalesce(first_name, 'Your VA');
  return new;
end;
$$;

-- Every role, including the table owner. Insert stays todo. Status only moves forward. A done row
-- keeps its title, deadline and status. The client may only close. The VA may advance, and only
-- while that assignment is active and the VA portal is open; they cannot change the title or deadline.
create function private.guard_task() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  client public.clients%rowtype;
  actor uuid := (select auth.uid());
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

create trigger tasks_fill before insert on public.tasks
  for each row execute function private.fill_task();
create trigger tasks_guard before insert or update on public.tasks
  for each row execute function private.guard_task();

-- The commenter's first name, same split as the VA snapshot. An empty name becomes "Someone".
create function private.fill_task_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  first_name text;
begin
  select coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'Someone')
    into first_name
  from public.profiles p where p.id = new.author_id;
  new.author_first_name := coalesce(first_name, 'Someone');
  return new;
end;
$$;

-- The client who owns the task may comment after the assignment ends and while the company is disabled.
-- The assigned VA may comment only while that assignment is active and their portal is open.
create function private.guard_task_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  task public.tasks%rowtype;
  owner uuid;
begin
  select * into task from public.tasks t where t.id = new.task_id;
  if not found then
    raise exception 'this change is not allowed' using errcode = 'IVA25';
  end if;
  select c.user_id into owner from public.clients c where c.id = task.client_id;

  if new.author_id is not distinct from owner or new.author_id = task.created_by then
    return new;
  end if;
  if new.author_id = task.va_id then
    if not private.va_is_open(new.author_id) or not exists (
      select 1 from public.client_va_assignments a
      where a.client_id = task.client_id and a.va_id = task.va_id and a.status = 'active'
    ) then
      raise exception 'no active assignment for this VA' using errcode = 'IVA24';
    end if;
    return new;
  end if;
  raise exception 'this change is not allowed' using errcode = 'IVA25';
end;
$$;

create trigger task_comments_fill before insert on public.task_comments
  for each row execute function private.fill_task_comment();
create trigger task_comments_guard before insert on public.task_comments
  for each row execute function private.guard_task_comment();

revoke all on function private.fill_task(), private.guard_task(), private.fill_task_comment(), private.guard_task_comment()
  from public, anon, authenticated, service_role;

-- Grants and RLS --------------------------------------------------------------------------------------------
-- Names, the zone, done_at, closed_by and tenant_id are not writable by signed-in users. The triggers set them.

grant select, insert, update, delete on public.tasks, public.task_comments to service_role;
grant select on public.tasks, public.task_comments to authenticated;
grant insert (client_id, va_id, title, deadline, created_by) on public.tasks to authenticated;
grant update (title, deadline, status) on public.tasks to authenticated;
grant insert (task_id, author_id, body) on public.task_comments to authenticated;

alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;

create policy "Own tenant only" on public.tasks as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));

-- Client: their company · VA: tasks assigned to them, including after the assignment ends · admin with 2FA: all.
-- No Lead Gen branch.
create policy "Read tasks by role" on public.tasks for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('client')) and client_id in (select private.own_client_ids()))
    or ((select private.has_role('va')) and va_id = (select auth.uid()))
  );

create policy "Clients create tasks for their active VA" on public.tasks for insert to authenticated
  with check (
    (select private.has_role('client'))
    and created_by = (select auth.uid())
    and client_id in (select private.own_client_ids())
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

-- The trigger rejects a VA write after the assignment ends, a client writing in_progress, and
-- title or deadline edits when the company is not open.
create policy "Clients and the assigned VA update tasks" on public.tasks for update to authenticated
  using (
    ((select private.has_role('client')) and client_id in (select private.own_client_ids()))
    or (
      (select private.has_role('va'))
      and va_id = (select auth.uid())
      and (select private.is_open_va())
      and exists (
        select 1 from public.client_va_assignments a
        where a.client_id = tasks.client_id and a.va_id = tasks.va_id and a.status = 'active'
      )
    )
  )
  with check (
    ((select private.has_role('client')) and client_id in (select private.own_client_ids()))
    or (
      (select private.has_role('va'))
      and va_id = (select auth.uid())
      and (select private.is_open_va())
      and exists (
        select 1 from public.client_va_assignments a
        where a.client_id = tasks.client_id and a.va_id = tasks.va_id and a.status = 'active'
      )
    )
  );

create policy "Own tenant only" on public.task_comments as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));

-- Visible when the task is. RLS on tasks applies inside the exists; no security-definer helper.
create policy "Read comments on visible tasks" on public.task_comments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_comments.task_id));

create policy "Clients and the assigned VA comment" on public.task_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      (
        (select private.has_role('client'))
        and exists (
          select 1 from public.tasks t
          where t.id = task_comments.task_id
            and t.client_id in (select private.own_client_ids())
        )
      )
      or (
        (select private.has_role('va'))
        and (select private.is_open_va())
        and exists (
          select 1 from public.tasks t
          join public.client_va_assignments a
            on a.client_id = t.client_id and a.va_id = t.va_id and a.status = 'active'
          where t.id = task_comments.task_id
            and t.va_id = (select auth.uid())
        )
      )
    )
  );
