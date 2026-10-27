-- A manual meeting can invite several clients and employees. The first of each still sits on
-- client_id and staff_id so the existing shape stays valid. Google guests can map onto these lists later.

alter table public.meetings
  add column client_ids uuid[] not null default '{}',
  add column staff_ids uuid[] not null default '{}',
  add column client_names text[] not null default '{}',
  add column staff_names text[] not null default '{}';

update public.meetings set
  client_ids = case when client_id is null then '{}' else array[client_id] end,
  client_names = case when client_name is null then '{}' else array[client_name] end,
  staff_ids = case when staff_id is null then '{}' else array[staff_id] end,
  staff_names = case when staff_name is null then '{}' else array[staff_name] end
where kind = 'manual';

alter table public.meetings add constraint meetings_guest_lists check (
  cardinality(client_ids) = cardinality(client_names)
  and cardinality(staff_ids) = cardinality(staff_names)
  and cardinality(client_ids) + cardinality(staff_ids) <= 20
);

-- Resolves invite lists for this agency. Raises IVA33 over 20 people and IVA31 for anyone outside it.
create function private.resolve_manual_guests(client_ids uuid[], staff_ids uuid[])
returns table (kind text, person_id uuid, guest_name text)
language plpgsql stable security definer set search_path = '' as $$
declare
  cid uuid;
  sid uuid;
  label text;
  clients uuid[] := array(select distinct x from unnest(coalesce(client_ids, '{}'::uuid[])) as x where x is not null);
  people uuid[] := array(select distinct x from unnest(coalesce(staff_ids, '{}'::uuid[])) as x where x is not null);
begin
  if cardinality(clients) + cardinality(people) > 20 then
    raise exception 'too many guests' using errcode = 'IVA33';
  end if;
  foreach cid in array clients loop
    select c.company_name into label from public.clients c
    where c.id = cid and c.tenant_id = (select private.tenant_id()) and c.disabled_at is null;
    if label is null then
      raise exception 'choose a client or staff from this agency' using errcode = 'IVA31';
    end if;
    kind := 'client';
    person_id := cid;
    guest_name := label;
    return next;
  end loop;
  foreach sid in array people loop
    select coalesce(nullif(btrim(p.full_name), ''), 'Staff') into label from public.profiles p
    where p.id = sid and p.tenant_id = (select private.tenant_id()) and p.status <> 'inactive'
      and exists (
        select 1 from public.roles r
        where r.user_id = p.id and r.role in ('va', 'closer', 'admin', 'super_admin')
      );
    if label is null then
      raise exception 'choose a client or staff from this agency' using errcode = 'IVA31';
    end if;
    kind := 'staff';
    person_id := sid;
    guest_name := label;
    return next;
  end loop;
end;
$$;

revoke all on function private.resolve_manual_guests(uuid[], uuid[]) from public, anon, authenticated, service_role;

drop function public.create_manual_meeting(text, timestamptz, timestamptz, uuid, uuid, text, text, text, text);
drop function public.update_manual_meeting(uuid, text, timestamptz, timestamptz, uuid, uuid);

create function public.create_manual_meeting(
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  client_ids uuid[],
  staff_ids uuid[],
  note text default null,
  attachment_name text default null,
  attachment_type text default null,
  attachment_base64 text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
  creator text;
  stored_name text;
  stored_type text;
  bytes bytea;
  clean_note text := nullif(btrim(note), '');
  guests_client uuid[] := '{}';
  guests_client_name text[] := '{}';
  guests_staff uuid[] := '{}';
  guests_staff_name text[] := '{}';
  guest record;
begin
  if not private.is_admin() then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;
  if title is null or char_length(btrim(title)) not between 1 and 120
    or starts_at is null or ends_at is null
    or ends_at <= starts_at or ends_at > starts_at + interval '8 hours'
  then
    raise exception 'the booking cannot be saved' using errcode = 'IVA30';
  end if;
  if clean_note is not null and char_length(clean_note) > 1000 then
    raise exception 'the booking cannot be saved' using errcode = 'IVA30';
  end if;
  if (attachment_base64 is not null and btrim(attachment_base64) <> '') and clean_note is null then
    raise exception 'a note is required' using errcode = 'check_violation';
  end if;

  select p.full_name into creator from public.profiles p where p.id = (select auth.uid());
  if creator is null or char_length(btrim(creator)) < 1 then
    creator := 'Admin';
  end if;

  for guest in select * from private.resolve_manual_guests(client_ids, staff_ids) loop
    if guest.kind = 'client' then
      guests_client := guests_client || guest.person_id;
      guests_client_name := guests_client_name || guest.guest_name;
    else
      guests_staff := guests_staff || guest.person_id;
      guests_staff_name := guests_staff_name || guest.guest_name;
    end if;
  end loop;

  stored_name := null;
  stored_type := null;
  bytes := null;
  if attachment_base64 is not null and btrim(attachment_base64) <> '' then
    bytes := decode(attachment_base64, 'base64');
    stored_name := nullif(btrim(attachment_name), '');
    stored_type := attachment_type;
    if bytes is null or octet_length(bytes) < 1 or octet_length(bytes) > 2097152
      or stored_name is null or char_length(stored_name) not between 1 and 200
      or stored_type not in (
        'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
        'application/pdf', 'image/jpeg', 'image/png'
      )
    then
      raise exception 'attachment is too large' using errcode = 'check_violation';
    end if;
  elsif attachment_name is not null or attachment_type is not null then
    raise exception 'attachment is incomplete' using errcode = 'check_violation';
  end if;

  insert into public.meetings (
    kind, status, title, starts_at, ends_at,
    client_id, staff_id, client_name, staff_name,
    client_ids, staff_ids, client_names, staff_names,
    created_by, creator_name
  ) values (
    'manual', 'scheduled', btrim(title), starts_at, ends_at,
    guests_client[1], guests_staff[1], guests_client_name[1], guests_staff_name[1],
    guests_client, guests_staff, guests_client_name, guests_staff_name,
    (select auth.uid()), btrim(creator)
  ) returning id into new_id;

  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (new_id, 'scheduled', (select auth.uid()), btrim(creator));
  if clean_note is not null then
    insert into public.meeting_events (meeting_id, kind, actor_id, actor_name, body, attachment_name, attachment_type, attachment_bytes)
    values (new_id, 'note', (select auth.uid()), btrim(creator), clean_note, stored_name, stored_type, bytes);
  end if;
  return new_id;
end;
$$;

create function public.update_manual_meeting(
  meeting_id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  client_ids uuid[],
  staff_ids uuid[]
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  meeting public.meetings%rowtype;
  guests_client uuid[] := '{}';
  guests_client_name text[] := '{}';
  guests_staff uuid[] := '{}';
  guests_staff_name text[] := '{}';
  guest record;
begin
  if not private.is_admin() then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;
  if title is null or char_length(btrim(title)) not between 1 and 120
    or starts_at is null or ends_at is null
    or ends_at <= starts_at or ends_at > starts_at + interval '8 hours'
  then
    raise exception 'the booking cannot be saved' using errcode = 'IVA30';
  end if;

  select * into meeting from public.meetings m where m.id = update_manual_meeting.meeting_id and m.kind = 'manual' for update;
  if not found then
    raise exception 'booking not found' using errcode = 'IVA01';
  end if;
  if meeting.status <> 'scheduled' then
    raise exception 'the booking cannot change' using errcode = 'IVA30';
  end if;

  for guest in select * from private.resolve_manual_guests(client_ids, staff_ids) loop
    if guest.kind = 'client' then
      guests_client := guests_client || guest.person_id;
      guests_client_name := guests_client_name || guest.guest_name;
    else
      guests_staff := guests_staff || guest.person_id;
      guests_staff_name := guests_staff_name || guest.guest_name;
    end if;
  end loop;

  update public.meetings m set
    title = btrim(update_manual_meeting.title),
    starts_at = update_manual_meeting.starts_at,
    ends_at = update_manual_meeting.ends_at,
    client_id = guests_client[1],
    staff_id = guests_staff[1],
    client_name = guests_client_name[1],
    staff_name = guests_staff_name[1],
    client_ids = guests_client,
    staff_ids = guests_staff,
    client_names = guests_client_name,
    staff_names = guests_staff_name
  where m.id = meeting.id;

  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (meeting.id, 'updated', (select auth.uid()), coalesce(nullif(btrim((select p.full_name from public.profiles p where p.id = (select auth.uid()))), ''), 'Admin'));
end;
$$;

revoke all on function public.create_manual_meeting(text, timestamptz, timestamptz, uuid[], uuid[], text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.update_manual_meeting(uuid, text, timestamptz, timestamptz, uuid[], uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.create_manual_meeting(text, timestamptz, timestamptz, uuid[], uuid[], text, text, text, text) to authenticated;
grant execute on function public.update_manual_meeting(uuid, text, timestamptz, timestamptz, uuid[], uuid[]) to authenticated;

-- Anyone named on the invite lists can read the meeting, not only the first client and the first employee.
drop policy "Read meetings by role" on public.meetings;
create policy "Read meetings by role" on public.meetings for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('closer')) and (organizer_id = (select auth.uid()) or decided_by = (select auth.uid())))
    or staff_id = (select auth.uid())
    or (select auth.uid()) = any(staff_ids)
    or client_id in (select c.id from public.clients c where c.user_id = (select auth.uid()))
    or exists (
      select 1 from public.clients c
      where c.user_id = (select auth.uid()) and c.id = any(client_ids)
    )
  );
