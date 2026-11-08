-- Drag and stretch a booked appointment on the VA, Lead Gen or admin calendar. Times only; guests stay.
-- An admin with two-factor may move any open manual meeting in the agency. A VA or Lead Gen may move one
-- they created. Discovery calls stay on reschedule_discovery_booking (30 minutes, move only).

create function public.reschedule_calendar_meeting(
  meeting_id uuid, starts_at timestamptz, ends_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  meeting public.meetings%rowtype;
  actor text;
  admin_ok boolean := (select private.is_admin());
begin
  if coalesce(current_setting('role', true), '') <> 'authenticated' then
    raise exception 'staff only' using errcode = 'insufficient_privilege';
  end if;

  if starts_at is null or ends_at is null
    or ends_at <= starts_at or ends_at > starts_at + interval '8 hours'
  then
    raise exception 'the booking cannot be saved' using errcode = 'IVA30';
  end if;
  if starts_at <= now() then
    raise exception 'choose a time ahead' using errcode = 'IVA38';
  end if;

  if admin_ok then
    select coalesce(nullif(btrim(p.full_name), ''), 'Admin') into actor
    from public.profiles p
    where p.id = (select auth.uid());
    actor := coalesce(actor, 'Admin');
  elsif (select private.has_role('va')) then
    select actor_name into actor from private.meeting_va();
  elsif (select private.has_role('closer')) then
    select actor_name into actor from private.meeting_closer();
  else
    raise exception 'staff only' using errcode = 'insufficient_privilege';
  end if;

  select * into meeting from public.meetings m
  where m.id = reschedule_calendar_meeting.meeting_id
    and m.kind = 'manual'
    and m.tenant_id = (select private.tenant_id())
  for update;
  if not found then
    raise exception 'booking not found' using errcode = 'IVA01';
  end if;
  if not admin_ok and meeting.created_by <> (select auth.uid()) then
    raise exception 'booking not found' using errcode = 'IVA01';
  end if;
  if meeting.status not in ('requested', 'scheduled') then
    raise exception 'the booking cannot change' using errcode = 'IVA30';
  end if;

  update public.meetings m
  set starts_at = reschedule_calendar_meeting.starts_at,
      ends_at = reschedule_calendar_meeting.ends_at
  where m.id = meeting.id;

  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (meeting.id, 'updated', (select auth.uid()), actor);
end;
$$;

revoke all on function public.reschedule_calendar_meeting(uuid, timestamptz, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.reschedule_calendar_meeting(uuid, timestamptz, timestamptz) to authenticated;
