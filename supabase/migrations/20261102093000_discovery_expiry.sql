-- Discovery requests expire 2 hours before their start, and the visitor is emailed to pick another time (M8 slice 4).
-- Until now a request could be confirmed up to its start. Now a Lead Gen has until 2 hours before: after that
-- confirm_discovery_booking and decide_discovery_call refuse (IVA23), reschedule_discovery_booking won't move it, the
-- inbox stops listing it, and request_discovery_call's lazy settling uses the same cutoff.
-- A scheduled job (pg_cron, every 15 minutes; set up by hand, docs/operations.md) runs private.run_discovery_expiry():
-- requested → expired with an `expired` event (actor System), then, when a notice is due, it calls the live site's
-- POST /api/v1/internal/discovery-expiry through pg_net with a bearer secret from Vault. That endpoint claims the
-- notices (claim_expiry_notices) and sends them. An expiry notice goes only where an acknowledgement went, never to a
-- lead that was closed, converted or paused, nor to a visitor who has booked again, and counts toward the agency's
-- 40 visitor emails a day.

alter table public.meetings add column expiry_notice_sent_at timestamptz;

-- Server-only, like ack_sent_at.

create or replace function private.visitor_emails_sent(tenant uuid) returns bigint
language sql stable set search_path = '' as $$
  select count(*) filter (where m.ack_sent_at > now() - interval '24 hours')
    + count(*) filter (where m.expiry_notice_sent_at > now() - interval '24 hours')
  from public.meetings m
  where m.tenant_id = visitor_emails_sent.tenant;
$$;

-- request_discovery_call: the same as 20261030163940_discovery_slot_source except the settling cutoff (2 hours).
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

  -- Settle: this visitor's requests nobody confirmed by the cutoff, so they no longer count against them (the job
  -- does the same every 15 minutes); and any request still open on a closed, converted or paused lead (one the lead
  -- trigger skipped while it was being decided), so it no longer holds its start.
  with settled as (
    update public.meetings m set status = 'expired'
    where m.tenant_id = tenant and m.kind = 'discovery' and m.status = 'requested'
      and m.lead_id in (
        select l.id from public.leads l
        where l.tenant_id = tenant and (
          (m.starts_at <= now() + interval '2 hours' and (l.email = request_discovery_call.email or l.ip_hash = request_discovery_call.ip_hash))
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

-- decide_discovery_call: the same as 20261026111332_discovery_calls except the cutoff (2 hours before the start).
create or replace function public.decide_discovery_call(
  meeting_id uuid,
  actor uuid,
  decision text,
  reason text,
  google_event_id text default null,
  meet_url text default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  meeting public.meetings%rowtype;
  lead public.leads%rowtype;
  clean_reason text := nullif(btrim(reason), '');
begin
  -- Lock order: the meeting, then its lead.
  select * into meeting from public.meetings m where m.id = decide_discovery_call.meeting_id for update;
  if not found or meeting.kind <> 'discovery' then
    raise exception 'meeting not found' using errcode = 'IVA01';
  end if;
  select * into lead from public.leads l where l.id = meeting.lead_id for update;

  -- An active Lead Gen of the meeting's tenant (a deactivated login's token keeps its role for up to an hour),
  -- and not someone else's lead.
  if not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = actor and r.role = 'closer' and r.tenant_id = meeting.tenant_id and p.status <> 'inactive'
  ) or (lead.closer_id is not null and lead.closer_id is distinct from actor) then
    raise exception 'only an active Lead Gen of this agency can decide this call' using errcode = 'IVA14';
  end if;
  -- Who acted, for the audit log (slice 2): the secret key has no auth.uid(). Transaction-local.
  perform set_config('app.actor', actor::text, true);
  if decision is null or decision not in ('scheduled', 'rejected') then
    raise exception 'decision must be scheduled or rejected' using errcode = 'check_violation';
  end if;
  if meeting.status <> 'requested' or meeting.starts_at <= now() + interval '2 hours'
    or lead.disabled_at is not null or lead.status in ('closed', 'converted') then
    raise exception 'this call is % and can''t be decided', meeting.status using errcode = 'IVA23';
  end if;

  if decision = 'scheduled' then
    update public.meetings m set status = 'scheduled', organizer_id = actor, decided_by = actor, decided_at = now(),
      google_event_id = decide_discovery_call.google_event_id, meet_url = decide_discovery_call.meet_url
    where m.id = meeting.id;
    insert into public.meeting_events (meeting_id, kind, actor_id) values (meeting.id, 'scheduled', actor);
    if lead.closer_id is null then
      update public.leads l set closer_id = actor where l.id = lead.id;
    end if;
  else
    if clean_reason is null or char_length(clean_reason) > 300 then
      raise exception 'a reason of 1 to 300 characters is required' using errcode = 'check_violation';
    end if;
    update public.meetings m set status = 'rejected', decided_by = actor, decided_at = now() where m.id = meeting.id;
    insert into public.meeting_events (meeting_id, kind, actor_id, body) values (meeting.id, 'rejected', actor, clean_reason);
    update public.leads l set status = 'closed' where l.id = lead.id;
    insert into public.lead_events (lead_id, author_id, kind, body) values (lead.id, actor, 'junk', clean_reason);
  end if;

  return jsonb_build_object('lead_id', lead.id, 'status', decision, 'starts_at', meeting.starts_at,
    'email', lead.email, 'full_name', lead.full_name);
end;
$$;

-- discovery_inbox: the same as 20261026111332_discovery_calls except the cutoff. SECURITY DEFINER for the reason
-- written there: it returns only what deciding needs, and checks the caller in the database.
create or replace function public.discovery_inbox() returns table (
  meeting_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  full_name text,
  company_name text,
  industry text,
  country text,
  package_code text,
  message text
)
language sql stable security definer set search_path = '' as $$
  select m.id, m.starts_at, m.ends_at, l.full_name, l.company_name, l.industry, l.country, l.package_code, l.message
  from public.meetings m join public.leads l on l.id = m.lead_id
  where exists (
      select 1 from public.roles r join public.profiles p on p.id = r.user_id
      where r.user_id = (select auth.uid()) and r.role = 'closer' and r.tenant_id = (select private.tenant_id())
        and p.status <> 'inactive'
    )
    and m.tenant_id = (select private.tenant_id())
    and m.kind = 'discovery' and m.status = 'requested' and m.starts_at > now() + interval '2 hours'
    -- Only what the caller could still decide (decide_discovery_call's IVA14 and IVA23 rules).
    and l.disabled_at is null and l.status not in ('closed', 'converted')
    and (l.closer_id is null or l.closer_id = (select auth.uid()))
  order by m.starts_at;
$$;

-- confirm_discovery_booking (the inbox's Confirm, signed in): the same as 20261027011000_discovery_form_booking except
-- the cutoff. SECURITY DEFINER for the reason written there; grants unchanged.
create or replace function public.confirm_discovery_booking(meeting_id uuid) returns void
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
  if meeting.status <> 'requested' or meeting.starts_at <= now() + interval '2 hours'
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

-- reschedule_discovery_booking: the same as 20261027014000_discovery_local_time, except that a request (not yet
-- confirmed) can't be moved once past the cutoff, nor to a start inside it, where it would only expire. A scheduled
-- call keeps the old rule (any start ahead of now). SECURITY DEFINER for the reason written there; grants unchanged.
create or replace function public.reschedule_discovery_booking(meeting_id uuid, starts_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  meeting public.meetings%rowtype;
  lead public.leads%rowtype;
  actor uuid := (select auth.uid());
begin
  if reschedule_discovery_booking.starts_at is null
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

-- Expires every request nobody confirmed by the cutoff, with an `expired` event (no actor: System). Returns how many.
create function private.expire_discovery_requests() returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  expired integer;
begin
  with settled as (
    update public.meetings m set status = 'expired'
    where m.kind = 'discovery' and m.status = 'requested' and m.starts_at <= now() + interval '2 hours'
    returning m.id
  )
  insert into public.meeting_events (meeting_id, kind) select s.id, 'expired' from settled s;
  get diagnostics expired = row_count;
  return expired;
end;
$$;

-- The expired requests whose visitor is due a notice: acknowledged, not yet noticed, expired because the cutoff
-- passed (not because their lead was closed while the start was still ahead) within the last day (a job that was down
-- doesn't email about long-gone times), on a lead still open, and the visitor hasn't booked again.
create function private.due_expiry_notices() returns setof public.meetings
language sql stable security invoker set search_path = '' as $$
  select m.* from public.meetings m join public.leads l on l.id = m.lead_id
  where m.kind = 'discovery' and m.status = 'expired' and m.ack_sent_at is not null and m.expiry_notice_sent_at is null
    and m.starts_at <= now() + interval '2 hours' and m.starts_at > now() - interval '1 day'
    and l.disabled_at is null and l.status not in ('closed', 'converted')
    and private.deliverable_address(l.email) is not null
    and not exists (
      select 1 from public.meetings o join public.leads ol on ol.id = o.lead_id
      where o.tenant_id = m.tenant_id and o.kind = 'discovery' and o.status in ('requested', 'scheduled')
        and lower(ol.email) = lower(l.email)
    );
$$;

-- Claims up to 50 due notices (within each agency's 40 visitor emails a day), stamps them, and returns where and what
-- to send. Secret key only: the internal endpoint calls it after checking the job's secret.
create function public.claim_expiry_notices()
returns table (meeting_id uuid, email text, starts_at timestamptz, country text)
language plpgsql security invoker set search_path = '' as $$
declare
  tenant uuid;
  room bigint;
  claimed integer := 0;
  batch integer;
begin
  for tenant in select distinct d.tenant_id from private.due_expiry_notices() d loop
    exit when claimed >= 50;
    -- The same agency lock as claim_discovery_acknowledgement, so the two can't both pass the daily cap.
    perform pg_advisory_xact_lock(3, hashtext(tenant::text));
    room := least(50 - claimed, 40 - private.visitor_emails_sent(tenant));
    continue when room <= 0;
    return query
      with picked as (
        select d.id from private.due_expiry_notices() d
        where d.tenant_id = tenant order by d.starts_at limit room
      ), stamped as (
        update public.meetings m set expiry_notice_sent_at = clock_timestamp()
        from picked where m.id = picked.id and m.expiry_notice_sent_at is null
        returning m.id, m.lead_id, m.starts_at
      )
      select s.id, private.deliverable_address(l.email), s.starts_at, l.country
      from stamped s join public.leads l on l.id = s.lead_id;
    get diagnostics batch = row_count;
    claimed := claimed + batch;
  end loop;
end;
$$;

-- What the job runs. Calls the endpoint only when a notice is due, and only where both Vault secrets exist (the URL
-- names production's endpoint; staging shares this database and must never send). pg_net and Vault are resolved when
-- it runs, so the migration applies where they aren't installed (local tests); the job is set up by hand.
create function private.run_discovery_expiry() returns void
language plpgsql security invoker set search_path = '' as $$
declare
  url text;
  secret text;
begin
  perform private.expire_discovery_requests();
  if not exists (select 1 from private.due_expiry_notices()) then
    return;
  end if;
  select s.decrypted_secret into url from vault.decrypted_secrets s where s.name = 'discovery_expiry_url';
  select s.decrypted_secret into secret from vault.decrypted_secrets s where s.name = 'discovery_expiry_secret';
  if url is null or secret is null then
    return;
  end if;
  perform net.http_post(url := url, headers := jsonb_build_object('Authorization', 'Bearer ' || secret), timeout_milliseconds := 5000);
end;
$$;

revoke all on function private.expire_discovery_requests(), private.due_expiry_notices(), private.run_discovery_expiry()
  from public, anon, authenticated, service_role;
revoke all on function public.claim_expiry_notices() from public, anon, authenticated, service_role;
grant execute on function private.due_expiry_notices() to service_role;
grant execute on function public.claim_expiry_notices() to service_role;

-- The stamp is bookkeeping, not a change to the call (see 20261102090000_discovery_acknowledgement).
do $do$
begin
  if to_regprocedure('private.audit_ignore(text)') is not null then
    execute $ddl$
    create or replace function private.audit_ignore(tbl text) returns text[]
    language sql immutable set search_path = '' as $$
      select array['id', 'created_at', 'updated_at', 'tenant_id'] || case tbl
        when 'leads' then array['notified_at']
        when 'profiles' then array['signed_in_at']
        when 'meetings' then array['confirmation_sent_at', 'confirmation_sent_for', 'ack_sent_at', 'expiry_notice_sent_at']
        else '{}'::text[]
      end;
    $$;
    $ddl$;
    revoke all on function private.audit_ignore(text) from public, anon, authenticated, service_role;
  end if;
end
$do$;
