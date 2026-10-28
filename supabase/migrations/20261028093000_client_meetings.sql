-- Clients book meetings with their own assistants from the client calendar, the way an admin books from the
-- admin calendar: create (with an optional note and file), move, resize and edit, cancel, complete, add notes.
-- A client manages only the meetings they created; meetings an admin set up stay read-only for them.
-- Security definer like the admin functions, so authenticated keeps no insert or update grant on meetings.

-- A meeting's creator and a history row's actor may now be a client.
drop trigger meetings_created_by_role on public.meetings;
create trigger meetings_created_by_role
  before insert or update of created_by on public.meetings
  for each row execute function private.enforce_role('created_by', 'admin', 'client');

drop trigger meeting_events_actor_id_role on public.meeting_events;
create trigger meeting_events_actor_id_role
  before insert on public.meeting_events
  for each row execute function private.enforce_role('actor_id', 'closer', 'admin', 'client');

-- The signed-in client's company and the name their meetings show. Only a request signed in as a client
-- (API role authenticated, so a direct session's claims don't count), whose company is active and enabled.
create function private.meeting_client(out client_id uuid, out client_label text, out actor_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('role', true), '') <> 'authenticated' or not (select private.has_role('client')) then
    raise exception 'clients only' using errcode = 'insufficient_privilege';
  end if;
  select c.id, c.company_name, coalesce(nullif(btrim(p.full_name), ''), c.company_name)
    into client_id, client_label, actor_name
  from public.clients c
  join public.profiles p on p.id = c.user_id
  where c.user_id = (select auth.uid())
    and c.tenant_id = (select private.tenant_id())
    and c.status = 'active'
    and c.disabled_at is null
    and p.status <> 'inactive';
  if client_id is null then
    raise exception 'clients only' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- The assistants a client invites: at least one, each on an active assignment to this client.
create function private.check_client_meeting_staff(client uuid, staff_ids uuid[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if cardinality(coalesce(staff_ids, '{}')) = 0
    or exists (
      select 1 from unnest(staff_ids) as s(id)
      where s.id is null or not exists (
        select 1 from public.client_va_assignments a
        where a.client_id = client and a.va_id = s.id and a.status = 'active'
      )
    )
  then
    raise exception 'invite your own assistants' using errcode = 'IVA37';
  end if;
end;
$$;

-- A note's optional file, checked the way the admin functions check it (the table's check backs it up).
create function private.meeting_file(attachment_name text, attachment_type text, attachment_base64 text,
  out file_name text, out file_type text, out file_bytes bytea)
language plpgsql
immutable
set search_path = ''
as $$
begin
  if attachment_base64 is not null and btrim(attachment_base64) <> '' then
    file_bytes := decode(attachment_base64, 'base64');
    file_name := nullif(btrim(attachment_name), '');
    file_type := attachment_type;
    if file_bytes is null or octet_length(file_bytes) < 1 or octet_length(file_bytes) > 2097152
      or file_name is null or char_length(file_name) not between 1 and 200
      or file_type is null or file_type not in (
        'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
        'application/pdf', 'image/jpeg', 'image/png'
      )
    then
      raise exception 'attachment is too large' using errcode = 'check_violation';
    end if;
  elsif attachment_name is not null or attachment_type is not null then
    raise exception 'attachment is incomplete' using errcode = 'check_violation';
  end if;
end;
$$;

-- The client's own meeting, locked. Anything else (another client's, an admin's, a discovery call) is not found.
create function private.own_client_meeting(meeting_id uuid)
returns public.meetings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  meeting public.meetings%rowtype;
begin
  select * into meeting from public.meetings m
  where m.id = own_client_meeting.meeting_id
    and m.kind = 'manual'
    and m.created_by = (select auth.uid())
    and m.tenant_id = (select private.tenant_id())
  for update;
  if not found then
    raise exception 'booking not found' using errcode = 'IVA01';
  end if;
  return meeting;
end;
$$;

revoke all on function private.meeting_client() from public, anon, authenticated, service_role;
revoke all on function private.check_client_meeting_staff(uuid, uuid[]) from public, anon, authenticated, service_role;
revoke all on function private.meeting_file(text, text, text) from public, anon, authenticated, service_role;
revoke all on function private.own_client_meeting(uuid) from public, anon, authenticated, service_role;

create function public.create_client_meeting(
  title text, starts_at timestamptz, ends_at timestamptz, staff_ids uuid[],
  note text default null, attachment_name text default null, attachment_type text default null, attachment_base64 text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me record;
  file record;
  new_id uuid;
  clean_note text := nullif(btrim(note), '');
  guest_ids uuid[] := '{}';
  guest_labels text[] := '{}';
  guest record;
begin
  select * into me from private.meeting_client();
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
  if (attachment_base64 is not null and btrim(attachment_base64) <> '') and clean_note is null then
    raise exception 'a note is required' using errcode = 'check_violation';
  end if;
  perform private.check_client_meeting_staff(me.client_id, staff_ids);
  select * into file from private.meeting_file(attachment_name, attachment_type, attachment_base64);

  for guest in select * from private.resolve_manual_guests(null, staff_ids) loop
    guest_ids := guest_ids || guest.person_id;
    guest_labels := guest_labels || guest.guest_name;
  end loop;

  insert into public.meetings (
    kind, status, title, starts_at, ends_at,
    client_id, staff_id, client_name, staff_name,
    client_ids, staff_ids, client_names, staff_names,
    created_by, creator_name
  ) values (
    'manual', 'scheduled', btrim(title), starts_at, ends_at,
    me.client_id, guest_ids[1], me.client_label, guest_labels[1],
    array[me.client_id], guest_ids, array[me.client_label], guest_labels,
    (select auth.uid()), me.actor_name
  ) returning id into new_id;

  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (new_id, 'scheduled', (select auth.uid()), me.actor_name);
  if clean_note is not null then
    insert into public.meeting_events (meeting_id, kind, actor_id, actor_name, body, attachment_name, attachment_type, attachment_bytes)
    values (new_id, 'note', (select auth.uid()), me.actor_name, clean_note, file.file_name, file.file_type, file.file_bytes);
  end if;
  return new_id;
end;
$$;

-- Edit, move or resize: the guests stay the client plus their own assistants. A moved meeting starts ahead.
create function public.update_client_meeting(meeting_id uuid, title text, starts_at timestamptz, ends_at timestamptz, staff_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me record;
  meeting public.meetings%rowtype;
  guest_ids uuid[] := '{}';
  guest_labels text[] := '{}';
  guest record;
begin
  select * into me from private.meeting_client();
  if title is null or char_length(btrim(title)) not between 1 and 120
    or starts_at is null or ends_at is null
    or ends_at <= starts_at or ends_at > starts_at + interval '8 hours'
  then
    raise exception 'the booking cannot be saved' using errcode = 'IVA30';
  end if;
  meeting := private.own_client_meeting(update_client_meeting.meeting_id);
  if meeting.status <> 'scheduled' then
    raise exception 'the booking cannot change' using errcode = 'IVA30';
  end if;
  if update_client_meeting.starts_at is distinct from meeting.starts_at and update_client_meeting.starts_at <= now() then
    raise exception 'choose a time ahead' using errcode = 'IVA38';
  end if;
  perform private.check_client_meeting_staff(me.client_id, staff_ids);

  for guest in select * from private.resolve_manual_guests(null, staff_ids) loop
    guest_ids := guest_ids || guest.person_id;
    guest_labels := guest_labels || guest.guest_name;
  end loop;

  update public.meetings m set
    title = btrim(update_client_meeting.title),
    starts_at = update_client_meeting.starts_at,
    ends_at = update_client_meeting.ends_at,
    client_id = me.client_id,
    client_name = me.client_label,
    client_ids = array[me.client_id],
    client_names = array[me.client_label],
    staff_id = guest_ids[1],
    staff_name = guest_labels[1],
    staff_ids = guest_ids,
    staff_names = guest_labels
  where m.id = meeting.id;

  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (meeting.id, 'updated', (select auth.uid()), me.actor_name);
end;
$$;

create function public.cancel_client_meeting(meeting_id uuid)
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
  meeting := private.own_client_meeting(cancel_client_meeting.meeting_id);
  if meeting.status <> 'scheduled' then
    raise exception 'the booking cannot change' using errcode = 'IVA30';
  end if;
  update public.meetings m set status = 'cancelled' where m.id = meeting.id;
  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (meeting.id, 'cancelled', (select auth.uid()), me.actor_name);
end;
$$;

create function public.complete_client_meeting(meeting_id uuid)
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
  meeting := private.own_client_meeting(complete_client_meeting.meeting_id);
  if meeting.status <> 'scheduled' or meeting.starts_at > now() then
    raise exception 'this meeting cannot be completed yet' using errcode = 'IVA34';
  end if;
  update public.meetings m set status = 'done' where m.id = meeting.id;
  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (meeting.id, 'done', (select auth.uid()), me.actor_name);
end;
$$;

-- A note on the client's own meeting. Notes stay append-only for clients: only an admin edits or deletes one.
create function public.add_client_meeting_note(
  meeting_id uuid, note text, attachment_name text default null, attachment_type text default null, attachment_base64 text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me record;
  meeting public.meetings%rowtype;
  file record;
  clean_note text := nullif(btrim(note), '');
  new_id uuid;
begin
  select * into me from private.meeting_client();
  if clean_note is null or char_length(clean_note) > 1000 then
    raise exception 'a note is required' using errcode = 'check_violation';
  end if;
  meeting := private.own_client_meeting(add_client_meeting_note.meeting_id);
  select * into file from private.meeting_file(attachment_name, attachment_type, attachment_base64);
  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name, body, attachment_name, attachment_type, attachment_bytes)
  values (meeting.id, 'note', (select auth.uid()), me.actor_name, clean_note, file.file_name, file.file_type, file.file_bytes)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.create_client_meeting(text, timestamptz, timestamptz, uuid[], text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.update_client_meeting(uuid, text, timestamptz, timestamptz, uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.cancel_client_meeting(uuid) from public, anon, authenticated, service_role;
revoke all on function public.complete_client_meeting(uuid) from public, anon, authenticated, service_role;
revoke all on function public.add_client_meeting_note(uuid, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.create_client_meeting(text, timestamptz, timestamptz, uuid[], text, text, text, text) to authenticated;
grant execute on function public.update_client_meeting(uuid, text, timestamptz, timestamptz, uuid[]) to authenticated;
grant execute on function public.cancel_client_meeting(uuid) to authenticated;
grant execute on function public.complete_client_meeting(uuid) to authenticated;
grant execute on function public.add_client_meeting_note(uuid, text, text, text, text) to authenticated;
