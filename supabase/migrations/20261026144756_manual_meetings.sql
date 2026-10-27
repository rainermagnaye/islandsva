-- Admin bookings on the calendar. A manual meeting starts scheduled, has a title, and may name one
-- client and one employee. Names are copied onto the row so each person can read the booking without
-- opening the other's profile. History stays append-only. There is no delete: cancel writes a row.
-- Google and Meet are unchanged (still null). Discovery calls are unchanged.

alter table public.meetings
  add column title text,
  add column client_id uuid,
  add column staff_id uuid,
  add column created_by uuid,
  add column client_name text,
  add column staff_name text,
  add column creator_name text;

alter table public.meetings add constraint meetings_title_length check (title is null or char_length(btrim(title)) between 1 and 120);
alter table public.meetings add constraint meetings_client_name_length check (client_name is null or char_length(client_name) between 1 and 200);
alter table public.meetings add constraint meetings_staff_name_length check (staff_name is null or char_length(staff_name) between 1 and 200);
alter table public.meetings add constraint meetings_creator_name_length check (creator_name is null or char_length(creator_name) between 1 and 200);

-- A scheduled discovery call still needs its Lead Gen. A manual booking does not: the employee is staff_id.
alter table public.meetings drop constraint meetings_scheduled_has_organizer;
alter table public.meetings add constraint meetings_scheduled_has_organizer check (
  status not in ('scheduled', 'done', 'no_show') or kind = 'manual' or organizer_id is not null
);

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
    and status in ('scheduled', 'cancelled')
    and (client_id is null) = (client_name is null)
    and (staff_id is null) = (staff_name is null)
  )
);

alter table public.meeting_events
  add column actor_name text,
  add column attachment_name text,
  add column attachment_type text,
  add column attachment_bytes bytea;

alter table public.meeting_events add constraint meeting_events_actor_name_length check (
  actor_name is null or char_length(actor_name) between 1 and 200
);

alter table public.meeting_events add constraint meeting_events_attachment_check check (
  (attachment_name is null and attachment_type is null and attachment_bytes is null)
  or (
    kind = 'note'
    and attachment_name is not null
    and attachment_type is not null
    and attachment_bytes is not null
    and char_length(attachment_name) between 1 and 200
    and attachment_type in (
      'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
      'application/pdf', 'image/jpeg', 'image/png'
    )
    and octet_length(attachment_bytes) between 1 and 2097152
  )
);

-- A manual booking has no lead, so the tenant comes from the admin who creates it.
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
      when 'va_shortlists' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'va_working_hours' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'va_id')::uuid)
      else private.default_tenant_id()
    end;
  end if;
  return new;
end;
$$;

alter table public.meetings add constraint meetings_client_tenant_fkey
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete restrict;
alter table public.meetings add constraint meetings_staff_tenant_fkey
  foreign key (staff_id, tenant_id) references public.profiles (id, tenant_id) on delete restrict;
alter table public.meetings add constraint meetings_created_by_tenant_fkey
  foreign key (created_by, tenant_id) references public.profiles (id, tenant_id) on delete restrict;

create trigger meetings_created_by_role before insert or update of created_by on public.meetings
  for each row execute function private.enforce_role('created_by', 'admin');
create trigger meetings_staff_id_role before insert or update of staff_id on public.meetings
  for each row execute function private.enforce_role('staff_id', 'va', 'closer', 'admin');

-- An admin writes the history of a booking they create. Lead Gens still write discovery history.
drop trigger meeting_events_actor_id_role on public.meeting_events;
create trigger meeting_events_actor_id_role before insert on public.meeting_events
  for each row execute function private.enforce_role('actor_id', 'closer', 'admin');

create index meetings_client_starts_at_idx on public.meetings (client_id, starts_at);
create index meetings_staff_starts_at_idx on public.meetings (staff_id, starts_at);
create index meetings_created_by_idx on public.meetings (created_by);

create function public.create_manual_meeting(
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  client_id uuid,
  staff_id uuid,
  note text,
  attachment_name text default null,
  attachment_type text default null,
  attachment_base64 text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
  creator text;
  client_label text;
  staff_label text;
  stored_name text;
  stored_type text;
  bytes bytea;
  clean_note text := nullif(btrim(note), '');
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
  if client_id is null then
    client_label := null;
  else
    select c.company_name into client_label from public.clients c
    where c.id = client_id and c.tenant_id = (select private.tenant_id());
    if client_label is null then
      raise exception 'choose a client or staff from this agency' using errcode = 'IVA31';
    end if;
  end if;
  if staff_id is null then
    staff_label := null;
  else
    select coalesce(nullif(btrim(p.full_name), ''), 'Staff') into staff_label from public.profiles p
    where p.id = staff_id and p.tenant_id = (select private.tenant_id()) and p.status <> 'inactive'
      and exists (
        select 1 from public.roles r
        where r.user_id = p.id and r.role in ('va', 'closer', 'admin', 'super_admin')
      );
    if staff_label is null then
      raise exception 'choose a client or staff from this agency' using errcode = 'IVA31';
    end if;
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

  insert into public.meetings (
    kind, status, title, starts_at, ends_at, client_id, staff_id, created_by, client_name, staff_name, creator_name
  ) values (
    'manual', 'scheduled', btrim(title), starts_at, ends_at, client_id, staff_id, (select auth.uid()),
    client_label, staff_label, btrim(creator)
  ) returning id into new_id;

  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name) values (new_id, 'scheduled', (select auth.uid()), btrim(creator));
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
  client_id uuid,
  staff_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  meeting public.meetings%rowtype;
  client_label text;
  staff_label text;
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

  if client_id is null then
    client_label := null;
  else
    select c.company_name into client_label from public.clients c
    where c.id = client_id and c.tenant_id = (select private.tenant_id());
    if client_label is null then
      raise exception 'choose a client or staff from this agency' using errcode = 'IVA31';
    end if;
  end if;
  if staff_id is null then
    staff_label := null;
  else
    select coalesce(nullif(btrim(p.full_name), ''), 'Staff') into staff_label from public.profiles p
    where p.id = staff_id and p.tenant_id = (select private.tenant_id()) and p.status <> 'inactive'
      and exists (
        select 1 from public.roles r
        where r.user_id = p.id and r.role in ('va', 'closer', 'admin', 'super_admin')
      );
    if staff_label is null then
      raise exception 'choose a client or staff from this agency' using errcode = 'IVA31';
    end if;
  end if;
  update public.meetings m set
    title = btrim(update_manual_meeting.title),
    starts_at = update_manual_meeting.starts_at,
    ends_at = update_manual_meeting.ends_at,
    client_id = update_manual_meeting.client_id,
    staff_id = update_manual_meeting.staff_id,
    client_name = client_label,
    staff_name = staff_label
  where m.id = meeting.id;
  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (meeting.id, 'updated', (select auth.uid()), coalesce(nullif(btrim((select p.full_name from public.profiles p where p.id = (select auth.uid()))), ''), 'Admin'));
end;
$$;

create function public.cancel_manual_meeting(meeting_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  meeting public.meetings%rowtype;
begin
  if not private.is_admin() then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;
  select * into meeting from public.meetings m where m.id = cancel_manual_meeting.meeting_id and m.kind = 'manual' for update;
  if not found then
    raise exception 'booking not found' using errcode = 'IVA01';
  end if;
  if meeting.status <> 'scheduled' then
    raise exception 'the booking cannot change' using errcode = 'IVA30';
  end if;
  update public.meetings m set status = 'cancelled' where m.id = meeting.id;
  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (meeting.id, 'cancelled', (select auth.uid()), coalesce(nullif(btrim((select p.full_name from public.profiles p where p.id = (select auth.uid()))), ''), 'Admin'));
end;
$$;

create function public.add_manual_meeting_note(
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
  select * into meeting from public.meetings m where m.id = add_manual_meeting_note.meeting_id and m.kind = 'manual' for update;
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

revoke all on function public.create_manual_meeting(text, timestamptz, timestamptz, uuid, uuid, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.update_manual_meeting(uuid, text, timestamptz, timestamptz, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.cancel_manual_meeting(uuid) from public, anon, authenticated, service_role;
revoke all on function public.add_manual_meeting_note(uuid, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.create_manual_meeting(text, timestamptz, timestamptz, uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.update_manual_meeting(uuid, text, timestamptz, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.cancel_manual_meeting(uuid) to authenticated;
grant execute on function public.add_manual_meeting_note(uuid, text, text, text, text) to authenticated;

-- Security definer, so authenticated keeps no insert or update grant: a direct write could skip the history
-- row, and discovery calls must stay function-only. Each function checks the admin and two-factor first.
-- The signed-in employee, and the client the booking names, can read it.
drop policy "Read meetings by role" on public.meetings;
create policy "Read meetings by role" on public.meetings for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_role('closer')) and (organizer_id = (select auth.uid()) or decided_by = (select auth.uid())))
    or staff_id = (select auth.uid())
    or client_id in (select c.id from public.clients c where c.user_id = (select auth.uid()))
  );
