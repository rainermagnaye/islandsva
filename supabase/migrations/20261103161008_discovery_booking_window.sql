-- The contact form lets the visitor choose any half hour in their own time, 12 hours to 90 days ahead (product
-- decision 2026-11-03), through submit_discovery_request. Its live definition is 20261027020000_website_lead_source
-- (re-created when discovery_local_time was applied); this keeps that body with three changes:
--   * the window is 12 hours to 90 days ahead (was: after now, through 14 days). The 12 hours leave the team time
--     to confirm before the 2-hour cutoff, and were only checked by the app until now;
--   * this visitor's earlier unanswered requests are settled at the 2-hour cutoff, as request_discovery_call does
--     since 20261102093000_discovery_expiry (was: once their start had passed).
-- reschedule_discovery_booking takes the same 90 days, so a call booked weeks ahead can still be moved; otherwise
-- it is the 20261102093000_discovery_expiry definition. Signatures and grants are unchanged (re-stated below).

create or replace function public.submit_discovery_request(
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
  if submit_discovery_request.starts_at < now() + interval '12 hours'
    or submit_discovery_request.starts_at > now() + interval '90 days' then
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
          (m.starts_at <= now() + interval '2 hours' and (l.email = submit_discovery_request.email or l.ip_hash = submit_discovery_request.ip_hash))
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

  insert into public.leads as l (full_name, email, company_name, industry, country, message, package_code, ip_hash, user_agent, profile)
  values (submit_discovery_request.full_name, submit_discovery_request.email, submit_discovery_request.company_name,
    submit_discovery_request.industry, submit_discovery_request.country, submit_discovery_request.message,
    submit_discovery_request.package_code, submit_discovery_request.ip_hash, submit_discovery_request.user_agent,
    jsonb_build_object('source', 'Website'))
  returning l.id into new_lead;

  insert into public.meetings as m (kind, lead_id, starts_at, ends_at)
  values ('discovery', new_lead, submit_discovery_request.starts_at, submit_discovery_request.starts_at + interval '30 minutes')
  returning m.id into new_meeting;

  insert into public.meeting_events (meeting_id, kind) values (new_meeting, 'requested');
  return new_lead;
end;
$$;

-- SECURITY DEFINER for the reason written in 20261027011000_discovery_form_booking: it checks the actor itself.
create or replace function public.reschedule_discovery_booking(meeting_id uuid, starts_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  meeting public.meetings%rowtype;
  lead public.leads%rowtype;
  actor uuid := (select auth.uid());
begin
  if reschedule_discovery_booking.starts_at is null
    or reschedule_discovery_booking.starts_at <= now()
    or reschedule_discovery_booking.starts_at > now() + interval '90 days' then
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
  if meeting.status not in ('requested', 'scheduled') or meeting.starts_at <= now()
    or (meeting.status = 'requested' and meeting.starts_at <= now() + interval '2 hours') then
    raise exception 'this call is % and can''t be moved', meeting.status using errcode = 'IVA23';
  end if;
  if meeting.status = 'requested' and reschedule_discovery_booking.starts_at <= now() + interval '2 hours' then
    raise exception 'this time is not open' using errcode = 'IVA22';
  end if;

  update public.meetings m
  set starts_at = reschedule_discovery_booking.starts_at,
      ends_at = reschedule_discovery_booking.starts_at + interval '30 minutes'
  where m.id = meeting.id;
  insert into public.meeting_events (meeting_id, kind, actor_id, actor_name)
  values (meeting.id, 'updated', actor, coalesce(nullif(btrim((select p.full_name from public.profiles p where p.id = actor)), ''), 'Team'));
end;
$$;

revoke all on function public.submit_discovery_request(text, text, text, text, text, text, text, text, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_discovery_request(text, text, text, text, text, text, text, text, text, timestamptz) to service_role;
revoke all on function public.reschedule_discovery_booking(uuid, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.reschedule_discovery_booking(uuid, timestamptz) to authenticated;
