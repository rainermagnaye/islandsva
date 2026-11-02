-- The visitor's acknowledgement email for a discovery request (M8 slice 4).
-- After the contact form stores a request, the server claims the acknowledgement (stamps the meeting) and sends it in
-- after(). The claim enforces the limits, so a form can't be used to mail an address over and over: 1 per address per
-- 24 hours, 3 per 30 days, and at most 40 automatic visitor emails per agency per 24 hours (below Resend's free-tier
-- 100). Past a limit, or for an address that isn't one plain address, there is no row and nothing is sent; the request
-- itself is already stored. A failed send is logged, not retried, so the stamp stays.

alter table public.meetings add column ack_sent_at timestamptz;

-- Server-only, like confirmation_sent_at: authenticated keeps its table-wide select and has no update grant.

-- Automatic visitor emails sent for an agency in the last 24 hours (the expiry migration adds its notices).
create function private.visitor_emails_sent(tenant uuid) returns bigint
language sql stable set search_path = '' as $$
  select count(*) from public.meetings m
  where m.tenant_id = visitor_emails_sent.tenant and m.ack_sent_at > now() - interval '24 hours';
$$;

-- The address lower-cased when it is one plain address, otherwise null: no list separators, brackets, quotes, spaces,
-- line breaks or control characters (claim_discovery_confirmation's rule, without the error).
create function private.deliverable_address(email text) returns text
language sql immutable set search_path = '' as $$
  select a from (select lower(btrim(coalesce(deliverable_address.email, ''))) as a) x
  where a ~ '^[^@]+@[^@]+$' and length(a) <= 254 and a !~ '[[:space:][:cntrl:]]' and a = translate(a, ',;<>"()[]\', '');
$$;

-- Claims the acknowledgement for the lead's open discovery request, and returns where and what to send. No row when
-- it was already claimed, the request is no longer open, the address isn't one plain address, or a limit is reached.
-- Secret key only: it runs after the public form passed the honeypot and Turnstile and the slot was reserved.
create function public.claim_discovery_acknowledgement(lead_id uuid)
returns table (meeting_id uuid, email text, starts_at timestamptz, country text)
language plpgsql security invoker set search_path = '' as $$
declare
  meeting public.meetings%rowtype;
  lead public.leads%rowtype;
  address text;
begin
  select * into lead from public.leads l where l.id = claim_discovery_acknowledgement.lead_id;
  if not found then
    return;
  end if;
  address := private.deliverable_address(lead.email);
  if address is null then
    return;
  end if;

  -- Serialise per address (request_discovery_call's class 1) and per agency (class 3), so two claims at once can't
  -- both pass the limits below. Address before agency, always.
  perform pg_advisory_xact_lock(1, hashtext(address));
  perform pg_advisory_xact_lock(3, hashtext(lead.tenant_id::text));

  select * into meeting from public.meetings m
  where m.lead_id = lead.id and m.kind = 'discovery' and m.status = 'requested' and m.ack_sent_at is null
  order by m.created_at desc limit 1
  for update;
  if not found then
    return;
  end if;

  if exists (
    select 1 from public.meetings m join public.leads l on l.id = m.lead_id
    where m.tenant_id = lead.tenant_id and lower(l.email) = address and m.ack_sent_at > now() - interval '24 hours'
  ) or (
    select count(*) from public.meetings m join public.leads l on l.id = m.lead_id
    where m.tenant_id = lead.tenant_id and lower(l.email) = address and m.ack_sent_at > now() - interval '30 days'
  ) >= 3 or private.visitor_emails_sent(lead.tenant_id) >= 40 then
    return;
  end if;

  update public.meetings m set ack_sent_at = clock_timestamp() where m.id = meeting.id;
  return query select meeting.id, address, meeting.starts_at, lead.country;
end;
$$;

-- Security invoker: the claim runs as service_role (schema usage since 20261029172015_registration_agreement).
revoke all on function private.visitor_emails_sent(uuid), private.deliverable_address(text) from public, anon, authenticated, service_role;
revoke all on function public.claim_discovery_acknowledgement(uuid) from public, anon, authenticated, service_role;
grant execute on function private.visitor_emails_sent(uuid), private.deliverable_address(text) to service_role;
grant execute on function public.claim_discovery_acknowledgement(uuid) to service_role;

-- The stamp is bookkeeping, not a change to the call. Only where the audit log exists (see
-- 20261101171012_discovery_confirmation_email, whose stamps this keeps).
do $do$
begin
  if to_regprocedure('private.audit_ignore(text)') is not null then
    execute $ddl$
    create or replace function private.audit_ignore(tbl text) returns text[]
    language sql immutable set search_path = '' as $$
      select array['id', 'created_at', 'updated_at', 'tenant_id'] || case tbl
        when 'leads' then array['notified_at']
        when 'profiles' then array['signed_in_at']
        when 'meetings' then array['confirmation_sent_at', 'confirmation_sent_for', 'ack_sent_at']
        else '{}'::text[]
      end;
    $$;
    $ddl$;
    revoke all on function private.audit_ignore(text) from public, anon, authenticated, service_role;
  end if;
end
$do$;
