-- Registration agreement (slice 1a, expand only). The registration packet becomes three steps the customer saves
-- one at a time through the link — details, agreement, payment proof — and the packet goes to review by itself
-- once all three are done. Accepting the agreement stores evidence: the exact text and version shown, a snapshot
-- of the terms taken from the client row (never from the browser), the typed name, the contact email on file and
-- the hashed IP. Each acceptance is a new row that never changes.
--
-- Old and new app builds share the database while this rolls out, so nothing the current app calls changes:
-- submit_client_packet, save_client_review and accept_client_review(_paid) keep their behaviour. Review sections:
-- the new app uses basic | agreement | payment. Stored rows keep the old names (the old app still reads them);
-- the new functions read them through private.packet_section (address, contacts → basic; package, consent →
-- agreement).
--
-- Not done here (slice 1b): approval requiring a current acceptance or legacy_consent, and the new review screen.

-- Acceptance evidence ---------------------------------------------------------------------------------------------

-- tenant_id is set by accept_client_agreement from the locked client row, not by private.assign_tenant(): that
-- function differs between files and the live database (it lacks the task migrations' cases), so this migration
-- doesn't redefine it. The composite foreign key keeps the row in its client's tenant.
create table public.client_agreements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid not null,
  version text not null,
  body text not null,
  terms jsonb not null,
  signer_name text not null,
  contact_email_on_file text not null,
  ip_hash text,
  accepted_at timestamptz not null default now(),
  constraint client_agreements_version_check check (version ~ '^v[0-9]{1,3}$'),
  constraint client_agreements_body_check check (char_length(body) between 1 and 20000),
  constraint client_agreements_terms_check check (jsonb_typeof(terms) = 'object'),
  constraint client_agreements_signer_name_check check (
    char_length(signer_name) between 1 and 120 and signer_name !~ '[[:cntrl:]]'
  ),
  constraint client_agreements_email_check check (char_length(contact_email_on_file) between 1 and 320),
  constraint client_agreements_ip_hash_check check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  constraint client_agreements_id_client_key unique (id, client_id),
  constraint client_agreements_tenant_id_fkey foreign key (tenant_id) references public.tenants (id) on delete restrict,
  constraint client_agreements_client_tenant_fkey
    foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete restrict
);

create index client_agreements_client_accepted_at_idx on public.client_agreements (client_id, accepted_at desc);
create index client_agreements_tenant_id_idx on public.client_agreements (tenant_id);

-- Evidence never changes: refused for every role, the secret key and the database owner included (as audit_log).
create function private.guard_client_agreement_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'an agreement acceptance can''t change' using errcode = 'IVA44';
end;
$$;

revoke all on function private.guard_client_agreement_immutable() from public, anon, authenticated, service_role;

create trigger client_agreements_immutable before update or delete on public.client_agreements
  for each row execute function private.guard_client_agreement_immutable();
create trigger client_agreements_no_truncate before truncate on public.client_agreements
  for each statement execute function private.guard_client_agreement_immutable();

-- Server-only, like the rest of the packet: no policy lets a signed-in user read it.
revoke all on public.client_agreements from public, anon, authenticated, service_role;
grant select, insert on public.client_agreements to service_role;

alter table public.client_agreements enable row level security;
create policy "Own tenant only" on public.client_agreements as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));

-- Packet ----------------------------------------------------------------------------------------------------------

-- agreement_id: the acceptance that covers the client's current terms; cleared when the terms change.
-- legacy_consent: the packet was signed with the earlier sample consent, before agreements existed.
-- Both are server-only through the table's existing grants (service_role only).
alter table public.client_packets
  add column agreement_id uuid,
  add column legacy_consent boolean not null default false,
  add constraint client_packets_agreement_fkey
    foreign key (agreement_id, client_id) references public.client_agreements (id, client_id) on delete restrict;

create index client_packets_agreement_id_idx on public.client_packets (agreement_id) where agreement_id is not null;

alter table public.client_packets
  drop constraint client_packets_review_issues_check,
  add constraint client_packets_review_issues_check check (
    review_issues <@ array['basic', 'address', 'contacts', 'package', 'consent', 'payment', 'agreement']::text[]
  );

-- Backfill (the tests re-run the statements between these two markers on fixture rows) --------------------------
update public.client_packets p
set legacy_consent = true
from public.clients c
where c.id = p.client_id
  and c.onboarding_status in ('pending_review', 'approved', 'invite_sent')
  and p.consent_signed_at is not null
  and not p.legacy_consent;

-- submit_client_packet never set onboarding_submitted_at; the review queue sorts by it.
update public.clients c
set onboarding_submitted_at = p.submitted_at
from public.client_packets p
where p.client_id = c.id
  and c.onboarding_status = 'pending_review'
  and c.onboarding_submitted_at is null
  and p.submitted_at is not null;
-- End of backfill -------------------------------------------------------------------------------------------------

create index clients_review_queue_idx on public.clients (tenant_id, onboarding_submitted_at)
  where onboarding_status = 'pending_review';

-- Helpers ---------------------------------------------------------------------------------------------------------

-- A stored review section as the new step it belongs to.
create function private.packet_section(issue text) returns text
language sql immutable set search_path = '' as $$
  select case issue
    when 'address' then 'basic'
    when 'contacts' then 'basic'
    when 'package' then 'agreement'
    when 'consent' then 'agreement'
    else issue
  end
$$;

-- The terms an acceptance covers, always read from the client row.
create function private.client_agreement_terms(c public.clients) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'company_name', c.company_name,
    'country', c.business ->> 'country',
    'package_code', c.package_code,
    'hours_per_week', c.hours_per_week,
    'term_months', c.term_months,
    'monthly_cents', c.monthly_cents,
    'starts_on', c.starts_on
  )
$$;

-- The steps still to do: every section sent back and not saved since, plus any step that isn't complete — details
-- missing a required field (the checks submit_client_packet makes), no acceptance of the current terms (or the
-- package terms aren't set, so there is nothing to accept), no proof. Empty means the packet is ready for review.
create function private.packet_open_sections(p public.client_packets, c public.clients) returns text[]
language sql stable security invoker set search_path = '' as $$
  select coalesce(array_agg(distinct s order by s), '{}')
  from (
    select private.packet_section(i) as s from unnest(p.review_issues) as i
    union all
    select 'basic'
    where not (
      char_length(btrim(c.company_name)) between 1 and 160
      and char_length(btrim(c.contact_name)) between 1 and 120
      and char_length(btrim(coalesce(c.business ->> 'industry', ''))) between 1 and 80
      and char_length(btrim(coalesce(c.business ->> 'country', ''))) between 1 and 80
      and char_length(btrim(coalesce(c.business ->> 'city', ''))) between 1 and 80
      and char_length(btrim(coalesce(c.business ->> 'about', ''))) between 1 and 2000
    )
    union all
    select 'agreement'
    where c.package_code is null or c.hours_per_week is null or c.term_months is null
      or c.monthly_cents is null or c.starts_on is null
      or not exists (
      select 1 from public.client_agreements a
      where a.id = p.agreement_id and a.client_id = c.id and a.terms = private.client_agreement_terms(c)
    )
    union all
    select 'payment' where p.payment_proof is null
  ) steps
$$;

-- Finds the packet by its link, locks the client and then the packet (the order every step uses), and checks the
-- step may be saved now: any step while waiting on the customer; after a return, only a step still open.
-- IVA06 unknown link · IVA09 client disabled or no longer pending · IVA08 the packet or this step isn't open
create function private.lock_client_packet(token_hash text, section text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  packet_client uuid;
  client public.clients%rowtype;
  packet public.client_packets%rowtype;
begin
  if lock_client_packet.token_hash is null or lock_client_packet.token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'unknown registration link' using errcode = 'IVA06';
  end if;
  select p.client_id into packet_client from public.client_packets p where p.token_hash = lock_client_packet.token_hash;
  if not found then
    raise exception 'unknown registration link' using errcode = 'IVA06';
  end if;

  select * into client from public.clients c where c.id = packet_client for update;
  if not found then
    raise exception 'client not found' using errcode = 'IVA06';
  end if;
  select * into packet from public.client_packets p
  where p.client_id = packet_client and p.token_hash = lock_client_packet.token_hash for update;
  if not found then
    raise exception 'unknown registration link' using errcode = 'IVA06';
  end if;

  if client.disabled_at is not null or client.status <> 'pending' then
    raise exception 'client is disabled' using errcode = 'IVA09';
  end if;
  if client.onboarding_status = 'pending_customer' then
    return client.id;
  end if;
  if client.onboarding_status <> 'changes_requested' then
    raise exception 'registration is not open' using errcode = 'IVA08';
  end if;
  if not (lock_client_packet.section = any (private.packet_open_sections(packet, client))) then
    raise exception 'this section was not sent back' using errcode = 'IVA08';
  end if;
  return client.id;
end;
$$;

-- Sends the packet to review once nothing is open, as submit_client_packet does (submitted_at, review marks and
-- note cleared), and also stamps onboarding_submitted_at and consented_at (the acceptance's time) on the client.
-- Otherwise leaves it as it is. Returns the packet's status after the call.
create function private.finish_client_packet(client_id uuid) returns public.client_onboarding_status
language plpgsql security invoker set search_path = '' as $$
declare
  client public.clients%rowtype;
  packet public.client_packets%rowtype;
  agreed_at timestamptz;
begin
  select * into client from public.clients c where c.id = finish_client_packet.client_id for update;
  if not found then
    return null;
  end if;
  select * into packet from public.client_packets p where p.client_id = client.id for update;
  if not found
    or client.disabled_at is not null
    or client.status <> 'pending'
    or client.onboarding_status not in ('pending_customer', 'changes_requested')
    or cardinality(private.packet_open_sections(packet, client)) > 0
  then
    return client.onboarding_status;
  end if;

  select a.accepted_at into agreed_at from public.client_agreements a where a.id = packet.agreement_id;

  update public.client_packets p set
    review_issues = '{}',
    review_note = null,
    submitted_at = now(),
    updated_at = now()
  where p.client_id = client.id;

  update public.clients c set
    onboarding_status = 'pending_review',
    onboarding_submitted_at = now(),
    consented_at = agreed_at
  where c.id = client.id;
  return 'pending_review';
end;
$$;

-- All five helpers are security invoker: they run with the caller's rights, and only service_role may call them.
revoke all on function private.packet_section(text), private.client_agreement_terms(public.clients),
  private.packet_open_sections(public.client_packets, public.clients), private.lock_client_packet(text, text),
  private.finish_client_packet(uuid) from public, anon, authenticated, service_role;

-- The step functions below run as service_role, which until now had no use of the private schema.
grant usage on schema private to service_role;
grant execute on function private.packet_section(text), private.client_agreement_terms(public.clients),
  private.packet_open_sections(public.client_packets, public.clients), private.lock_client_packet(text, text),
  private.finish_client_packet(uuid) to service_role;

-- Steps (secret key only) -----------------------------------------------------------------------------------------
-- Each returns the packet's status afterwards: pending_review once the last open step is saved.
-- Refusals: IVA06 unknown link · IVA09 client disabled or not pending · IVA08 packet or step not open.

-- Details: the checks and writes submit_client_packet makes for them. A change to the agreed terms (company name or
-- country) clears the acceptance, so the customer accepts again.
create function public.save_client_packet_details(
  token_hash text,
  company_name text,
  contact_name text,
  contact_phone text,
  details jsonb
) returns public.client_onboarding_status
language plpgsql security invoker set search_path = '' as $$
declare
  packet_client uuid;
  client public.clients%rowtype;
  zone text;
begin
  packet_client := private.lock_client_packet(save_client_packet_details.token_hash, 'basic');

  if company_name is null or char_length(btrim(company_name)) not between 1 and 160
    or contact_name is null or char_length(btrim(contact_name)) not between 1 and 120
    or (contact_phone is not null and char_length(btrim(contact_phone)) > 40)
    or details is null or jsonb_typeof(details) <> 'object' or octet_length(details::text) > 4000
    or char_length(btrim(coalesce(details ->> 'industry', ''))) not between 1 and 80
    or char_length(btrim(coalesce(details ->> 'country', ''))) not between 1 and 80
    or char_length(btrim(coalesce(details ->> 'city', ''))) not between 1 and 80
    or char_length(btrim(coalesce(details ->> 'about', ''))) not between 1 and 2000
  then
    raise exception 'registration details are not valid' using errcode = 'check_violation';
  end if;
  zone := nullif(details ->> 'timezone', '');
  if zone is not null and zone !~ '^[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)+$' then
    raise exception 'registration details are not valid' using errcode = 'check_violation';
  end if;

  update public.clients set
    company_name = btrim(save_client_packet_details.company_name),
    contact_name = btrim(save_client_packet_details.contact_name),
    contact_phone = nullif(btrim(coalesce(save_client_packet_details.contact_phone, '')), ''),
    business = details - 'timezone',
    timezone = coalesce(zone, clients.timezone)
  where clients.id = packet_client
  returning * into client;

  update public.client_packets p set
    agreement_id = case
      when exists (
        select 1 from public.client_agreements a
        where a.id = p.agreement_id and a.terms = private.client_agreement_terms(client)
      ) then p.agreement_id
    end,
    review_issues = array(select i from unnest(p.review_issues) as i where i not in ('basic', 'address', 'contacts')),
    updated_at = now()
  where p.client_id = packet_client;

  return private.finish_client_packet(packet_client);
end;
$$;

-- Agreement: the terms come from the locked client, never the caller. terms_seen is what the customer was shown;
-- if it no longer matches, nothing is stored. The packet's consent fields are kept up to date for current screens.
-- Accepting again what the packet already holds (same version, terms and name: a repeated submit) stores no new row.
-- IVA43 the terms changed since the page was shown · IVA45 the package terms aren't set (the country may be empty)
create function public.accept_client_agreement(
  token_hash text,
  version text,
  body text,
  terms_seen jsonb,
  signer_name text,
  ip_hash text
) returns public.client_onboarding_status
language plpgsql security invoker set search_path = '' as $$
declare
  packet_client uuid;
  client public.clients%rowtype;
  snapshot jsonb;
  current_id uuid;
  signer text := btrim(coalesce(accept_client_agreement.signer_name, ''));
  new_id uuid;
begin
  packet_client := private.lock_client_packet(accept_client_agreement.token_hash, 'agreement');

  if accept_client_agreement.version is null or accept_client_agreement.version !~ '^v[0-9]{1,3}$'
    or accept_client_agreement.body is null or char_length(accept_client_agreement.body) not between 1 and 20000
    or char_length(signer) not between 1 and 120 or signer ~ '[[:cntrl:]]'
    or (accept_client_agreement.ip_hash is not null and accept_client_agreement.ip_hash !~ '^[0-9a-f]{64}$')
  then
    raise exception 'agreement acceptance is not valid' using errcode = 'check_violation';
  end if;

  select * into client from public.clients c where c.id = packet_client;
  snapshot := private.client_agreement_terms(client);
  if snapshot ->> 'company_name' is null or snapshot ->> 'package_code' is null or snapshot ->> 'monthly_cents' is null
    or snapshot ->> 'term_months' is null or snapshot ->> 'hours_per_week' is null or snapshot ->> 'starts_on' is null
  then
    raise exception 'the package terms are not set' using errcode = 'IVA45';
  end if;
  if terms_seen is null or terms_seen <> snapshot then
    raise exception 'the agreement terms have changed' using errcode = 'IVA43';
  end if;

  select a.id into current_id
  from public.client_packets p
  join public.client_agreements a on a.id = p.agreement_id and a.client_id = p.client_id
  where p.client_id = packet_client
    and a.version = accept_client_agreement.version
    and a.terms = snapshot
    and a.signer_name = signer;
  if current_id is not null then
    update public.client_packets p set
      review_issues = array(select i from unnest(p.review_issues) as i where i not in ('agreement', 'package', 'consent')),
      updated_at = now()
    where p.client_id = packet_client;
    return private.finish_client_packet(packet_client);
  end if;

  insert into public.client_agreements as a
    (tenant_id, client_id, version, body, terms, signer_name, contact_email_on_file, ip_hash)
  values (
    client.tenant_id, client.id, accept_client_agreement.version, accept_client_agreement.body, snapshot, signer,
    client.contact_email, accept_client_agreement.ip_hash
  )
  returning a.id into new_id;

  update public.client_packets p set
    agreement_id = new_id,
    consent_name = signer,
    consent_signed_at = now(),
    review_issues = array(select i from unnest(p.review_issues) as i where i not in ('agreement', 'package', 'consent')),
    updated_at = now()
  where p.client_id = packet_client;

  return private.finish_client_packet(packet_client);
end;
$$;

-- Payment proof: the same file checks as submit_client_packet.
create function public.save_client_payment_proof(
  token_hash text,
  proof_name text,
  proof_type text,
  proof_base64 text
) returns public.client_onboarding_status
language plpgsql security invoker set search_path = '' as $$
declare
  packet_client uuid;
  bytes bytea;
begin
  packet_client := private.lock_client_packet(save_client_payment_proof.token_hash, 'payment');

  if proof_base64 is null or btrim(proof_base64) = '' then
    raise exception 'payment proof is not valid' using errcode = 'check_violation';
  end if;
  bytes := decode(proof_base64, 'base64');
  if bytes is null
    or octet_length(bytes) not between 1 and 2097152
    or proof_name is null
    or char_length(btrim(proof_name)) not between 1 and 200
    or proof_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  then
    raise exception 'payment proof is not valid' using errcode = 'check_violation';
  end if;

  update public.client_packets p set
    payment_proof = bytes,
    payment_proof_name = btrim(proof_name),
    payment_proof_type = proof_type,
    review_issues = array(select i from unnest(p.review_issues) as i where i <> 'payment'),
    updated_at = now()
  where p.client_id = packet_client;

  return private.finish_client_packet(packet_client);
end;
$$;

revoke all on function public.save_client_packet_details(text, text, text, text, jsonb),
  public.accept_client_agreement(text, text, text, jsonb, text, text),
  public.save_client_payment_proof(text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.save_client_packet_details(text, text, text, text, jsonb),
  public.accept_client_agreement(text, text, text, jsonb, text, text),
  public.save_client_payment_proof(text, text, text, text) to service_role;
