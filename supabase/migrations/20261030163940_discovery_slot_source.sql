-- The contact form books from the admin's daily times (open_discovery_slots) instead of any half hour, so it
-- calls request_discovery_call again. A discovery request comes from the public site, so the lead's source is
-- Website, as submit_discovery_request has stored since 20261027020000_website_lead_source. Same signature,
-- body and grants otherwise. submit_discovery_request stays until a cleanup migration drops it.

create or replace function public.request_discovery_call(
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
  if request_discovery_call.email is null or request_discovery_call.starts_at is null then
    raise exception 'email and time are required' using errcode = 'check_violation';
  end if;
  select t.id into tenant from public.tenants t where t.is_default;

  -- Serialise requests from the same email and the same IP, so two at once can't both pass the caps below.
  -- Always email (class 1) before IP (class 2), so two requests can't wait on each other.
  perform pg_advisory_xact_lock(1, hashtext(lower(request_discovery_call.email)));
  if request_discovery_call.ip_hash is not null then
    perform pg_advisory_xact_lock(2, hashtext(request_discovery_call.ip_hash));
  end if;

  -- Settle (no cron): this visitor's requests nobody answered before their time, so they no longer count against
  -- them; and any request still open on a closed, converted or paused lead (one the lead trigger skipped while
  -- it was being decided), so it no longer holds its start.
  with settled as (
    update public.meetings m set status = 'expired'
    where m.tenant_id = tenant and m.kind = 'discovery' and m.status = 'requested'
      and m.lead_id in (
        select l.id from public.leads l
        where l.tenant_id = tenant and (
          (m.starts_at <= now() and (l.email = request_discovery_call.email or l.ip_hash = request_discovery_call.ip_hash))
          or l.status in ('closed', 'converted') or l.disabled_at is not null
        )
      )
    returning m.id
  )
  insert into public.meeting_events (meeting_id, kind) select s.id, 'expired' from settled s;

  if not exists (select 1 from public.open_discovery_slots() as s(slot_start) where s.slot_start = request_discovery_call.starts_at) then
    raise exception 'this time is not open' using errcode = 'IVA22';
  end if;

  -- Slot squatting: one open request per email and two per IP, or a visitor could hold every slot.
  if exists (
    select 1 from public.meetings m join public.leads l on l.id = m.lead_id
    where m.tenant_id = tenant and m.kind = 'discovery' and m.status = 'requested' and l.email = request_discovery_call.email
  ) or (
    request_discovery_call.ip_hash is not null and (
      select count(*) from public.meetings m join public.leads l on l.id = m.lead_id
      where m.tenant_id = tenant and m.kind = 'discovery' and m.status = 'requested' and l.ip_hash = request_discovery_call.ip_hash
    ) >= 2
  ) then
    raise exception 'this visitor already has an open request' using errcode = 'IVA24';
  end if;

  insert into public.leads as l (full_name, email, company_name, industry, country, message, package_code, ip_hash, user_agent, profile)
  values (request_discovery_call.full_name, request_discovery_call.email, request_discovery_call.company_name,
    request_discovery_call.industry, request_discovery_call.country, request_discovery_call.message,
    request_discovery_call.package_code, request_discovery_call.ip_hash, request_discovery_call.user_agent,
    jsonb_build_object('source', 'Website'))
  returning l.id into new_lead;

  insert into public.meetings as m (kind, lead_id, starts_at, ends_at)
  values ('discovery', new_lead, request_discovery_call.starts_at, request_discovery_call.starts_at + interval '30 minutes')
  returning m.id into new_meeting;

  insert into public.meeting_events (meeting_id, kind) values (new_meeting, 'requested');
  return new_lead;
end;
$$;

revoke all on function public.request_discovery_call(text, text, text, text, text, text, text, text, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.request_discovery_call(text, text, text, text, text, text, text, text, text, timestamptz) to service_role;
