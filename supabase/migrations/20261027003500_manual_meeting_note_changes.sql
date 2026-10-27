-- An admin can correct or remove a note on a manual meeting. The rest of meeting history
-- stays append-only, including discovery notes and the rows that record create, edit and cancel.

create or replace function private.guard_meeting_events_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE')
    and old.kind = 'note'
    and (select private.is_admin())
    and exists (
      select 1 from public.meetings m
      where m.id = old.meeting_id and m.kind = 'manual' and m.tenant_id = (select private.tenant_id())
    )
  then
    if tg_op = 'DELETE' then
      return old;
    end if;
    -- Only the note text may change. The file, who wrote it, and when, stay.
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

create function public.update_manual_meeting_note(event_id uuid, note text) returns void
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
    where m.id = event.meeting_id and m.kind = 'manual' and m.tenant_id = (select private.tenant_id())
  ) then
    raise exception 'that note cannot be changed' using errcode = 'IVA32';
  end if;
  update public.meeting_events set body = clean_note where id = event.id;
end;
$$;

create function public.delete_manual_meeting_note(event_id uuid) returns void
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
    where m.id = event.meeting_id and m.kind = 'manual' and m.tenant_id = (select private.tenant_id())
  ) then
    raise exception 'that note cannot be changed' using errcode = 'IVA32';
  end if;
  delete from public.meeting_events where id = event.id;
end;
$$;

revoke all on function public.update_manual_meeting_note(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.delete_manual_meeting_note(uuid) from public, anon, authenticated, service_role;
grant execute on function public.update_manual_meeting_note(uuid, text) to authenticated;
grant execute on function public.delete_manual_meeting_note(uuid) to authenticated;
