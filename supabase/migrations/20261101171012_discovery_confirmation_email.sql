-- The visitor's confirmation email for a discovery call (M8 slice 5, the Confirmation row only).
-- When a Lead Gen confirms, the server claims the email (stamps the meeting), sends it, and releases the claim if the
-- send failed so the Lead Gen can send it again. confirmation_sent_for is the start the email named: after a reschedule
-- it no longer matches starts_at, so the call can be emailed again with the new time.
-- IVA14 actor not allowed · IVA23 not a scheduled call ahead of now · IVA48 the address can't be emailed.

alter table public.meetings
  add column confirmation_sent_at timestamptz,
  add column confirmation_sent_for timestamptz,
  add constraint meetings_confirmation_pair check ((confirmation_sent_at is null) = (confirmation_sent_for is null));

-- Server-only: authenticated keeps its table-wide select (a send time is not personal data, and Lead Gens already read
-- every meeting in the agency) and has no update grant on meetings.

-- Claims the confirmation email for the call's current start, and returns where and what to send. No row when it
-- was already sent for this start. Secret key only: the actor is the signed-in user the app checked; this checks them
-- again (a deactivated login keeps its token's roles for up to an hour).
create function public.claim_discovery_confirmation(meeting_id uuid, actor uuid)
returns table (email text, starts_at timestamptz, country text, claimed_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  meeting public.meetings%rowtype;
  lead public.leads%rowtype;
  address text;
  stamp timestamptz := clock_timestamp();
begin
  select * into meeting from public.meetings m where m.id = claim_discovery_confirmation.meeting_id for update;
  if not found or meeting.kind <> 'discovery' then
    raise exception 'meeting not found' using errcode = 'IVA01';
  end if;
  -- The call's organizer while still an active Lead Gen of its agency, or an active admin of the agency.
  if not exists (
    select 1 from public.roles r join public.profiles p on p.id = r.user_id
    where r.user_id = claim_discovery_confirmation.actor and p.status <> 'inactive' and p.tenant_id = meeting.tenant_id
      and (
        (r.role = 'closer' and meeting.organizer_id = claim_discovery_confirmation.actor)
        or r.role in ('admin', 'super_admin')
      )
  ) then
    raise exception 'only the call''s Lead Gen or an admin can send its confirmation' using errcode = 'IVA14';
  end if;
  if meeting.status <> 'scheduled' or meeting.starts_at <= now() then
    raise exception 'this call is % and can''t be confirmed by email', meeting.status using errcode = 'IVA23';
  end if;
  if meeting.confirmation_sent_for is not distinct from meeting.starts_at then
    return;
  end if;

  select * into lead from public.leads l where l.id = meeting.lead_id;
  address := btrim(coalesce(lead.email, ''));
  -- One plain address only: no list separators, brackets, quotes, spaces, line breaks or control characters.
  if address !~ '^[^@]+@[^@]+$' or length(address) > 254
    or address ~ '[[:space:][:cntrl:]]' or address <> translate(address, ',;<>"()[]\', '') then
    raise exception 'this address can''t be emailed' using errcode = 'IVA48';
  end if;

  -- After the actor check, and transaction-local: the audit log names this person for the stamp below.
  perform set_config('app.actor', claim_discovery_confirmation.actor::text, true);
  update public.meetings m set confirmation_sent_at = stamp, confirmation_sent_for = meeting.starts_at where m.id = meeting.id;
  return query select address, meeting.starts_at, lead.country, stamp;
end;
$$;

-- Undoes a claim whose send failed. Only that claim: a later claim (a new stamp) is left alone.
create function public.release_discovery_confirmation(meeting_id uuid, claimed_at timestamptz)
returns void
language sql security invoker set search_path = '' as $$
  update public.meetings m set confirmation_sent_at = null, confirmation_sent_for = null
  where m.id = release_discovery_confirmation.meeting_id and m.confirmation_sent_at = release_discovery_confirmation.claimed_at;
$$;

revoke all on function public.claim_discovery_confirmation(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.release_discovery_confirmation(uuid, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.claim_discovery_confirmation(uuid, uuid) to service_role;
grant execute on function public.release_discovery_confirmation(uuid, timestamptz) to service_role;

-- The stamps are bookkeeping, not a change to the call. Only where the audit log exists (see
-- 20261029063000_task_duration_timer): applied later, audit_log logs them by name only until a migration adds them.
do $do$
begin
  if to_regprocedure('private.audit_ignore(text)') is not null then
    execute $ddl$
    create or replace function private.audit_ignore(tbl text) returns text[]
    language sql immutable set search_path = '' as $$
      select array['id', 'created_at', 'updated_at', 'tenant_id'] || case tbl
        when 'leads' then array['notified_at']
        when 'profiles' then array['signed_in_at']
        when 'meetings' then array['confirmation_sent_at', 'confirmation_sent_for']
        else '{}'::text[]
      end;
    $$;
    $ddl$;
    revoke all on function private.audit_ignore(text) from public, anon, authenticated, service_role;
  end if;
end
$do$;
