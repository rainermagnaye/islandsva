-- A discovery call uses the same notes as a meeting an admin creates. History other than
-- the note text stays append-only.

create or replace function private.guard_meeting_events_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE')
    and old.kind = 'note'
    and (select private.is_admin())
    and exists (
      select 1 from public.meetings m
      where m.id = old.meeting_id and m.kind in ('manual', 'discovery') and m.tenant_id = (select private.tenant_id())
    )
  then
    if tg_op = 'DELETE' then
      return old;
    end if;
    if new.id is distinct from old.id
      or new.meeting_id is distinct from old.meeting_id
      or new.tenant_id is distinct from old.tenant_id
      or new.kind is distinct from old.kind
      or new.actor_id is distinct from old.actor_id
      or new.actor_name is distinct from old.actor_name
      or new.created_at is distinct from old.created_at
      or new.attachment_name is distinct from old.attachment_name
      or new.attachment_type is distinct from old.attachment_type
      or new.attachment_bytes is distinct from old.attachment_bytes
    then
      raise exception 'meeting history is append-only' using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;
  raise exception 'meeting history is append-only' using errcode = 'insufficient_privilege';
end;
$$;

create or replace function public.add_manual_meeting_note(
  meeting_id uuid,
  note text,
  attachment_name text default null,
  attachment_type text default null,
  attachment_base64 text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  meeting public.meetings%rowtype;
  clean_note text := nullif(btrim(note), '');
  stored_name text;
  stored_type text;
  bytes bytea;
  new_id uuid;
begin
  if not private.is_admin() then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;
  if clean_note is null or char_length(clean_note) > 1000 then
    raise exception 'a note is required' using errcode = 'check_violation';
  end if;
  select * into meeting from public.meetings m
  where m.id = add_manual_meeting_note.meeting_id and m.kind in ('manual', 'discovery') for update;
  if not found then
    raise exception 'booking not found' using errcode = 'IVA01';
  end if;
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
  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name, body, attachment_name, attachment_type, attachment_bytes)
  values (
    meeting.id, 'note', (select auth.uid()),
    coalesce(nullif(btrim((select p.full_name from public.profiles p where p.id = (select auth.uid()))), ''), 'Admin'),
    clean_note, stored_name, stored_type, bytes
  )
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.update_manual_meeting_note(event_id uuid, note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  clean_note text := nullif(btrim(note), '');
  event public.meeting_events%rowtype;
begin
  if not private.is_admin() then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;
  if clean_note is null or char_length(clean_note) > 1000 then
    raise exception 'a note is required' using errcode = 'check_violation';
  end if;
  select * into event from public.meeting_events e where e.id = event_id and e.kind = 'note';
  if not found or not exists (
    select 1 from public.meetings m
    where m.id = event.meeting_id and m.kind in ('manual', 'discovery') and m.tenant_id = (select private.tenant_id())
  ) then
    raise exception 'that note cannot be changed' using errcode = 'IVA32';
  end if;
  update public.meeting_events set body = clean_note where id = event.id;
end;
$$;

create or replace function public.delete_manual_meeting_note(event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  event public.meeting_events%rowtype;
begin
  if not private.is_admin() then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;
  select * into event from public.meeting_events e where e.id = event_id and e.kind = 'note';
  if not found or not exists (
    select 1 from public.meetings m
    where m.id = event.meeting_id and m.kind in ('manual', 'discovery') and m.tenant_id = (select private.tenant_id())
  ) then
    raise exception 'that note cannot be changed' using errcode = 'IVA32';
  end if;
  delete from public.meeting_events where id = event.id;
end;
$$;
