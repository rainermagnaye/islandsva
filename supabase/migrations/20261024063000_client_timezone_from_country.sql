-- The package time zone follows the client's country, so it is no longer one of eleven fixed zones.
-- submit_client_packet copies a zone out of the details payload onto clients.timezone and does not keep it in business.

alter table public.clients drop constraint clients_timezone_known;

alter table public.clients
  add constraint clients_timezone_known check (
    timezone is null or timezone ~ '^[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)+$'
  );

create or replace function public.convert_lead_noted(
  lead_id uuid,
  company_name text,
  contact_name text,
  contact_phone text,
  remarks text,
  package_code text,
  hours_per_week smallint,
  term_months smallint,
  monthly_cents integer,
  starts_on date,
  timezone text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  lead public.leads%rowtype;
  new_client uuid;
begin
  if not private.is_admin() then
    raise exception 'admins with two-factor sign-in only' using errcode = 'insufficient_privilege';
  end if;
  if remarks is null or char_length(btrim(remarks)) < 1 or char_length(remarks) > 2000 then
    raise exception 'remarks are required' using errcode = 'check_violation';
  end if;
  if package_code is null or package_code not in ('essentials', 'executive', 'day-and-night') then
    raise exception 'choose a package' using errcode = 'check_violation';
  end if;
  if not (
    (package_code = 'essentials' and hours_per_week = 20)
    or (package_code = 'executive' and hours_per_week = 40)
    or (package_code = 'day-and-night' and hours_per_week = 80)
  ) then
    raise exception 'hours do not match the package' using errcode = 'check_violation';
  end if;
  if term_months is null or term_months not in (1, 6, 12) then
    raise exception 'choose a term' using errcode = 'check_violation';
  end if;
  if monthly_cents is null or monthly_cents <= 0 then
    raise exception 'monthly price is missing' using errcode = 'check_violation';
  end if;
  if starts_on is null then
    raise exception 'choose a start date' using errcode = 'check_violation';
  end if;
  if timezone is null or timezone !~ '^[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)+$' then
    raise exception 'choose a time zone' using errcode = 'check_violation';
  end if;

  select * into lead from public.leads l where l.id = convert_lead_noted.lead_id;
  if not found then
    raise exception 'lead not found' using errcode = 'IVA01';
  end if;
  if lead.disabled_at is not null then
    raise exception 'this lead is disabled' using errcode = 'IVA04';
  end if;

  new_client := public.convert_lead(convert_lead_noted.lead_id, convert_lead_noted.company_name, convert_lead_noted.contact_name, convert_lead_noted.contact_phone);

  update public.clients
  set
    package_code = convert_lead_noted.package_code,
    hours_per_week = convert_lead_noted.hours_per_week,
    term_months = convert_lead_noted.term_months,
    monthly_cents = convert_lead_noted.monthly_cents,
    starts_on = convert_lead_noted.starts_on,
    timezone = convert_lead_noted.timezone
  where id = new_client;

  insert into public.lead_events (lead_id, author_id, kind, body)
  values (convert_lead_noted.lead_id, (select auth.uid()), 'conversion', btrim(remarks));
  return new_client;
end;
$$;

create or replace function public.submit_client_packet(
  token_hash text,
  company_name text,
  contact_name text,
  contact_phone text,
  details jsonb,
  consent_name text,
  proof_name text,
  proof_type text,
  proof_base64 text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  packet public.client_packets%rowtype;
  client public.clients%rowtype;
  bytes bytea;
  zone text;
begin
  if token_hash is null or token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'unknown registration link' using errcode = 'IVA06';
  end if;

  select * into packet from public.client_packets p where p.token_hash = submit_client_packet.token_hash for update;
  if not found then
    raise exception 'unknown registration link' using errcode = 'IVA06';
  end if;

  select * into client from public.clients c where c.id = packet.client_id for update;
  if not found then
    raise exception 'client not found' using errcode = 'IVA06';
  end if;
  if client.disabled_at is not null or client.status <> 'pending' then
    raise exception 'client is disabled' using errcode = 'IVA09';
  end if;
  if client.onboarding_status not in ('pending_customer', 'changes_requested')
    and not (client.onboarding_status = 'pending_review' and coalesce(array_length(packet.review_issues, 1), 0) > 0)
  then
    raise exception 'registration is not open' using errcode = 'IVA08';
  end if;

  if company_name is null or char_length(btrim(company_name)) not between 1 and 160
    or contact_name is null or char_length(btrim(contact_name)) not between 1 and 120
    or (contact_phone is not null and char_length(btrim(contact_phone)) > 40)
    or consent_name is null or char_length(btrim(consent_name)) not between 1 and 120
    or details is null or jsonb_typeof(details) <> 'object' or octet_length(details::text) > 4000
    or char_length(btrim(coalesce(details ->> 'industry', ''))) not between 1 and 80
    or char_length(btrim(coalesce(details ->> 'country', ''))) not between 1 and 80
    or char_length(btrim(coalesce(details ->> 'city', ''))) not between 1 and 80
    or char_length(btrim(coalesce(details ->> 'about', ''))) not between 1 and 2000
  then
    raise exception 'registration details are not valid' using errcode = 'check_violation';
  end if;

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

  zone := nullif(details ->> 'timezone', '');
  if zone is not null and zone !~ '^[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)+$' then
    raise exception 'registration details are not valid' using errcode = 'check_violation';
  end if;

  update public.client_packets set
    consent_name = btrim(submit_client_packet.consent_name),
    consent_signed_at = now(),
    payment_proof = bytes,
    payment_proof_name = btrim(proof_name),
    payment_proof_type = proof_type,
    review_issues = '{}',
    review_note = null,
    submitted_at = now(),
    updated_at = now()
  where client_packets.client_id = packet.client_id;

  update public.clients set
    company_name = btrim(submit_client_packet.company_name),
    contact_name = btrim(submit_client_packet.contact_name),
    contact_phone = nullif(btrim(coalesce(submit_client_packet.contact_phone, '')), ''),
    business = details - 'timezone',
    timezone = coalesce(zone, clients.timezone),
    onboarding_status = 'pending_review'
  where clients.id = client.id;

  return client.id;
end;
$$;
