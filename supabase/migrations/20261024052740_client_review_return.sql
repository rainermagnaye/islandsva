-- A returned registration must reopen for the customer.
-- Replaces save_client_review so pending_review becomes changes_requested, including a return that was
-- stored before that status change. Resubmit is allowed from changes_requested, and from pending_review
-- when sections were already marked.

create or replace function public.save_client_review(client_id uuid, issues text[], note text)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  client public.clients%rowtype;
  cleaned text[];
begin
  select * into client from public.clients c where c.id = save_client_review.client_id for update;
  if not found then
    raise exception 'client not found' using errcode = 'IVA06';
  end if;
  if client.disabled_at is not null or client.status <> 'pending' then
    raise exception 'client is disabled' using errcode = 'IVA09';
  end if;
  if client.onboarding_status <> 'pending_review' then
    raise exception 'registration is not in review' using errcode = 'IVA08';
  end if;

  select coalesce(array_agg(distinct item), '{}') into cleaned
  from unnest(coalesce(save_client_review.issues, '{}'::text[])) as item;

  if coalesce(array_length(cleaned, 1), 0) < 1
    or exists (
      select 1 from unnest(cleaned) as item
      where item not in ('basic', 'address', 'contacts', 'package', 'consent', 'payment')
    )
    or (note is not null and char_length(btrim(note)) > 500)
  then
    raise exception 'review sections are not valid' using errcode = 'check_violation';
  end if;

  update public.client_packets set
    review_issues = cleaned,
    review_note = nullif(btrim(coalesce(note, '')), ''),
    updated_at = now()
  where client_packets.client_id = client.id;
  if not found then
    raise exception 'client not found' using errcode = 'IVA06';
  end if;

  update public.clients set onboarding_status = 'changes_requested' where clients.id = client.id;
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
    business = details,
    onboarding_status = 'pending_review'
  where clients.id = client.id;

  return client.id;
end;
$$;

-- A return that was saved while the status was still pending review should open for the customer.
update public.clients c
set onboarding_status = 'changes_requested'
from public.client_packets p
where p.client_id = c.id
  and c.status = 'pending'
  and c.disabled_at is null
  and c.onboarding_status = 'pending_review'
  and (coalesce(array_length(p.review_issues, 1), 0) > 0 or p.review_note is not null);
