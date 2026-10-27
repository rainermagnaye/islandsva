-- The public discovery form picks a date and time. The call is still 30 minutes on :00 or :30, from now
-- through 14 days, and it starts as requested. An admin or a Lead Gen can claim it or move it.
-- request_discovery_call stays the slot-list path; this is the form path.

create function public.submit_discovery_request(
  full_name text,
  email text,
  company_name text,
  industry text,
  country text,
  message text,
  package_code text,
  ip_hash text,
  user_agent text,
  starts_at timestamptz
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  tenant uuid;
  new_lead uuid;
  new_meeting uuid;
begin
  if submit_discovery_request.email is null or submit_discovery_request.starts_at is null then
    raise exception 'email and time are required' using errcode = 'check_violation';
  end if;
  if extract(epoch from submit_discovery_request.starts_at)::bigint % 1800 <> 0
    or submit_discovery_request.starts_at <= now()
    or submit_discovery_request.starts_at > now() + interval '14 days' then
    raise exception 'this time is not open' using errcode = 'IVA22';
  end if;
  select t.id into tenant from public.tenants t where t.is_default;

  perform pg_advisory_xact_lock(1, hashtext(lower(submit_discovery_request.email)));
  if submit_discovery_request.ip_hash is not null then
    perform pg_advisory_xact_lock(2, hashtext(submit_discovery_request.ip_hash));
  end if;

  with settled as (
    update public.meetings m set status = 'expired'
    where m.tenant_id = tenant and m.kind = 'discovery' and m.status = 'requested'
      and m.lead_id in (
        select l.id from public.leads l
        where l.tenant_id = tenant and (
          (m.starts_at <= now() and (l.email = submit_discovery_request.email or l.ip_hash = submit_discovery_request.ip_hash))
          or l.status in ('closed', 'converted') or l.disabled_at is not null
        )
      )
    returning m.id
  )
  insert into public.meeting_events (meeting_id, kind) select s.id, 'expired' from settled s;

  if exists (
    select 1 from public.meetings m join public.leads l on l.id = m.lead_id
    where m.tenant_id = tenant and m.kind = 'discovery' and m.status = 'requested' and l.email = submit_discovery_request.email
  ) or (
    submit_discovery_request.ip_hash is not null and (
      select count(*) from public.meetings m join public.leads l on l.id = m.lead_id
      where m.tenant_id = tenant and m.kind = 'discovery' and m.status = 'requested' and l.ip_hash = submit_discovery_request.ip_hash
    ) >= 2
  ) then
    raise exception 'this visitor already has an open request' using errcode = 'IVA24';
  end if;

  insert into public.leads as l (full_name, email, company_name, industry, country, message, package_code, ip_hash, user_agent)
  values (submit_discovery_request.full_name, submit_discovery_request.email, submit_discovery_request.company_name,
    submit_discovery_request.industry, submit_discovery_request.country, submit_discovery_request.message,
    submit_discovery_request.package_code, submit_discovery_request.ip_hash, submit_discovery_request.user_agent)
  returning l.id into new_lead;

  insert into public.meetings as m (kind, lead_id, starts_at, ends_at)
  values ('discovery', new_lead, submit_discovery_request.starts_at, submit_discovery_request.starts_at + interval '30 minutes')
  returning m.id into new_meeting;

  insert into public.meeting_events (meeting_id, kind) values (new_meeting, 'requested');
  return new_lead;
end;
$$;

-- An admin with two-factor, or an active Lead Gen of the agency, may organise a discovery call.
drop trigger meetings_organizer_id_role on public.meetings;
create trigger meetings_organizer_id_role before insert or update of organizer_id on public.meetings
  for each row execute function private.enforce_role('organizer_id', 'closer', 'admin');
drop trigger meetings_decided_by_role on public.meetings;
create trigger meetings_decided_by_role before insert or update of decided_by on public.meetings
  for each row execute function private.enforce_role('decided_by', 'closer', 'admin');

create function private.can_decide_discovery() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.is_admin()) or exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = (select auth.uid()) and r.role = 'closer'
      and r.tenant_id = (select private.tenant_id()) and p.status <> 'inactive'
  );
$$;

create function public.confirm_discovery_booking(meeting_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  meeting public.meetings%rowtype;
  lead public.leads%rowtype;
  actor uuid := (select auth.uid());
begin
  select * into meeting from public.meetings m where m.id = confirm_discovery_booking.meeting_id for update;
  if not found or meeting.kind <> 'discovery' or meeting.tenant_id is distinct from (select private.tenant_id()) then
    raise exception 'meeting not found' using errcode = 'IVA01';
  end if;
  select * into lead from public.leads l where l.id = meeting.lead_id for update;
  if not (select private.can_decide_discovery())
    or (lead.closer_id is not null and lead.closer_id is distinct from actor) then
    raise exception 'only an admin or lead gen of this agency can confirm this call' using errcode = 'IVA14';
  end if;
  if meeting.status <> 'requested' or meeting.starts_at <= now()
    or lead.disabled_at is not null or lead.status in ('closed', 'converted') then
    raise exception 'this call is % and can''t be confirmed', meeting.status using errcode = 'IVA23';
  end if;

  update public.meetings m set status = 'scheduled', organizer_id = actor, decided_by = actor, decided_at = now()
  where m.id = meeting.id;
  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (meeting.id, 'scheduled', actor, coalesce(nullif(btrim((select p.full_name from public.profiles p where p.id = actor)), ''), 'Team'));
  if lead.closer_id is null then
    update public.leads l set closer_id = actor where l.id = lead.id;
  end if;
end;
$$;

create function public.reschedule_discovery_booking(meeting_id uuid, starts_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  meeting public.meetings%rowtype;
  lead public.leads%rowtype;
  actor uuid := (select auth.uid());
begin
  if reschedule_discovery_booking.starts_at is null
    or extract(epoch from reschedule_discovery_booking.starts_at)::bigint % 1800 <> 0
    or reschedule_discovery_booking.starts_at <= now()
    or reschedule_discovery_booking.starts_at > now() + interval '14 days' then
    raise exception 'this time is not open' using errcode = 'IVA22';
  end if;
  select * into meeting from public.meetings m where m.id = reschedule_discovery_booking.meeting_id for update;
  if not found or meeting.kind <> 'discovery' or meeting.tenant_id is distinct from (select private.tenant_id()) then
    raise exception 'meeting not found' using errcode = 'IVA01';
  end if;
  select * into lead from public.leads l where l.id = meeting.lead_id;
  if not (select private.can_decide_discovery())
    or (lead.closer_id is not null and lead.closer_id is distinct from actor and not (select private.is_admin())) then
    raise exception 'only an admin or lead gen of this agency can move this call' using errcode = 'IVA14';
  end if;
  if meeting.status = 'scheduled' and not ((select private.is_admin()) or meeting.organizer_id = actor) then
    raise exception 'only the organizer can move this call' using errcode = 'IVA14';
  end if;
  if meeting.status not in ('requested', 'scheduled') or meeting.starts_at <= now() then
    raise exception 'this call is % and can''t be moved', meeting.status using errcode = 'IVA23';
  end if;

  update public.meetings m
  set starts_at = reschedule_discovery_booking.starts_at,
      ends_at = reschedule_discovery_booking.starts_at + interval '30 minutes'
  where m.id = meeting.id;
  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (meeting.id, 'updated', actor, coalesce(nullif(btrim((select p.full_name from public.profiles p where p.id = actor)), ''), 'Team'));
end;
$$;

revoke all on function public.submit_discovery_request(text, text, text, text, text, text, text, text, text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.can_decide_discovery() from public, anon, authenticated, service_role;
revoke all on function public.confirm_discovery_booking(uuid) from public, anon, authenticated, service_role;
revoke all on function public.reschedule_discovery_booking(uuid, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.submit_discovery_request(text, text, text, text, text, text, text, text, text, timestamptz) to service_role;
grant execute on function public.confirm_discovery_booking(uuid) to authenticated;
grant execute on function public.reschedule_discovery_booking(uuid, timestamptz) to authenticated;
