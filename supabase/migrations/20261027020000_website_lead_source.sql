-- A discovery request comes from the public site, so the lead's source is Website.
-- Leads that already have a discovery call and no source get the same value.

update public.leads l
set profile = coalesce(l.profile, '{}'::jsonb) || jsonb_build_object('source', 'Website')
where coalesce(l.profile ->> 'source', '') = ''
  and exists (
    select 1 from public.meetings m
    where m.lead_id = l.id and m.kind = 'discovery'
  );

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
  if submit_discovery_request.starts_at <= now()
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
