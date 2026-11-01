-- Lead Gens book from their calendar the same way a VA does:
--   * a meeting with one of their clients (created_by = them, not disabled): requested if the company is
--     active (the client accepts), scheduled at once if it is still pending;
--   * a meeting with the team only, scheduled right away.
-- Meetings stay security definer. The closer is the first staff guest so they can read the row, and the
-- read policy also lets them see meetings they created.

drop trigger meetings_created_by_role on public.meetings;
create trigger meetings_created_by_role
  before insert or update of created_by on public.meetings
  for each row execute function private.enforce_role('created_by', 'admin', 'client', 'va', 'closer');

drop policy "Read meetings by role" on public.meetings;
create policy "Read meetings by role" on public.meetings for select to authenticated
  using (
    (select private.is_admin())
    or (
      (select private.has_role('closer'))
      and (
        organizer_id = (select auth.uid())
        or decided_by = (select auth.uid())
        or created_by = (select auth.uid())
      )
    )
    or staff_id = (select auth.uid())
    or (select auth.uid()) = any(staff_ids)
    or client_id in (select c.id from public.clients c where c.user_id = (select auth.uid()))
    or exists (
      select 1 from public.clients c
      where c.user_id = (select auth.uid()) and c.id = any(client_ids)
    )
  );

-- The signed-in Lead Gen's name. Only a request signed in as an active closer.
create function private.meeting_closer(out actor_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('role', true), '') <> 'authenticated'
    or not (select private.has_role('closer'))
  then
    raise exception 'lead gens only' using errcode = 'insufficient_privilege';
  end if;
  select coalesce(nullif(btrim(p.full_name), ''), 'Lead Gen') into actor_name
  from public.profiles p
  where p.id = (select auth.uid())
    and p.tenant_id = (select private.tenant_id())
    and p.status <> 'inactive';
  if actor_name is null then
    raise exception 'lead gens only' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function private.meeting_closer() from public, anon, authenticated, service_role;

create function public.create_closer_meeting(
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
  company public.clients%rowtype;
  new_status public.meeting_status;
begin
  select * into me from private.meeting_closer();
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

  if create_closer_meeting.client_id is not null then
    select * into company from public.clients c
    where c.id = create_closer_meeting.client_id
      and c.created_by = (select auth.uid())
      and c.disabled_at is null
      and c.tenant_id = (select private.tenant_id());
    if not found then
      raise exception 'choose one of your clients' using errcode = 'IVA46';
    end if;
    client_list := array[create_closer_meeting.client_id];
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

  -- An active company can accept; a pending one has no login yet, so the call is booked at once.
  new_status := case
    when create_closer_meeting.client_id is null then 'scheduled'
    when company.status = 'active' then 'requested'
    else 'scheduled'
  end;
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

create function public.cancel_closer_meeting(meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me record;
  meeting public.meetings%rowtype;
begin
  select * into me from private.meeting_closer();
  select * into meeting from public.meetings m
  where m.id = cancel_closer_meeting.meeting_id
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

revoke all on function public.create_closer_meeting(text, timestamptz, timestamptz, uuid, uuid[], text) from public, anon, authenticated, service_role;
revoke all on function public.cancel_closer_meeting(uuid) from public, anon, authenticated, service_role;
grant execute on function public.create_closer_meeting(text, timestamptz, timestamptz, uuid, uuid[], text) to authenticated;
grant execute on function public.cancel_closer_meeting(uuid) to authenticated;
