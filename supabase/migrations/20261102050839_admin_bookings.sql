-- Admins book from the calendar the same way a Lead Gen does:
--   * a meeting with one agency client (not disabled): requested if the company is active
--     (the client accepts), scheduled at once if it is still pending;
--   * a meeting with the team only, scheduled right away.
-- create_manual_meeting stays for the edit form (start and end, several guests, an attachment).
-- The admin is the first staff guest. Meetings stay security definer; private.is_admin() needs two-factor.

create function public.create_admin_meeting(
  title text, starts_at timestamptz, ends_at timestamptz,
  client_id uuid default null, staff_ids uuid[] default '{}', note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  creator text;
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
  if not private.is_admin() then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;
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

  select coalesce(nullif(btrim(p.full_name), ''), 'Admin') into creator
  from public.profiles p
  where p.id = (select auth.uid());
  if creator is null then
    creator := 'Admin';
  end if;

  if create_admin_meeting.client_id is not null then
    select * into company from public.clients c
    where c.id = create_admin_meeting.client_id
      and c.disabled_at is null
      and c.tenant_id = (select private.tenant_id());
    if not found then
      raise exception 'choose one of your clients' using errcode = 'IVA46';
    end if;
    client_list := array[create_admin_meeting.client_id];
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
    when create_admin_meeting.client_id is null then 'scheduled'
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
    (select auth.uid()), creator
  ) returning id into new_id;

  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (new_id, case when new_status = 'requested' then 'requested' else 'scheduled' end::public.meeting_event_kind,
    (select auth.uid()), creator);
  if clean_note is not null then
    insert into public.meeting_events (meeting_id, kind, actor_id, actor_name, body)
    values (new_id, 'note', (select auth.uid()), creator, clean_note);
  end if;
  return new_id;
end;
$$;

revoke all on function public.create_admin_meeting(text, timestamptz, timestamptz, uuid, uuid[], text) from public, anon, authenticated, service_role;
grant execute on function public.create_admin_meeting(text, timestamptz, timestamptz, uuid, uuid[], text) to authenticated;
