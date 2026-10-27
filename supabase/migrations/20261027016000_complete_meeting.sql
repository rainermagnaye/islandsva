-- An admin can mark a scheduled meeting done once it has started. Before the start, and for any
-- other status, the call is refused. A discovery call that was still a new lead moves to contacted.

alter table public.meetings drop constraint meetings_manual_shape;
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
    and status in ('scheduled', 'cancelled', 'done')
    and (client_id is null) = (client_name is null)
    and (staff_id is null) = (staff_name is null)
  )
);

create function public.complete_meeting(meeting_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  meeting public.meetings%rowtype;
  lead public.leads%rowtype;
  actor uuid := (select auth.uid());
begin
  if not (select private.is_admin()) then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;
  select * into meeting from public.meetings m
  where m.id = complete_meeting.meeting_id
    and m.kind in ('manual', 'discovery')
    and m.tenant_id = (select private.tenant_id())
  for update;
  if not found then
    raise exception 'meeting not found' using errcode = 'IVA01';
  end if;
  if meeting.status <> 'scheduled' or meeting.starts_at > now() then
    raise exception 'this meeting cannot be completed yet' using errcode = 'IVA34';
  end if;

  if meeting.kind = 'discovery' then
    select * into lead from public.leads l where l.id = meeting.lead_id for update;
  end if;

  update public.meetings set status = 'done' where id = meeting.id;
  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (
    meeting.id, 'done', actor,
    coalesce(nullif(btrim((select p.full_name from public.profiles p where p.id = actor)), ''), 'Admin')
  );
  if meeting.kind = 'discovery' and lead.status = 'new' and lead.disabled_at is null then
    update public.leads set status = 'contacted' where id = lead.id;
  end if;
end;
$$;

revoke all on function public.complete_meeting(uuid) from public, anon, authenticated, service_role;
grant execute on function public.complete_meeting(uuid) to authenticated;
