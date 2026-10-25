-- Registration packet for a converted client. The customer has no account: the link is the access.
-- Account status (pending / active / inactive) stays the login. onboarding_status is the packet:
--   ready → pending_customer → pending_review → changes_requested → approved → invite_sent.
-- The last three are reserved for review and the password email. This migration only moves a
-- client from ready to pending_customer, and from pending_customer to pending_review.
-- onboarding_status is readable with the client and is not in the authenticated update grant.
-- The token, signature and payment file are server-only (no grant to anon or authenticated).
-- The closer copies the same link from the profile, so the token is stored as well as its SHA-256.
-- The public page looks the row up by the hash. A database copy still reveals the link.

create type public.client_onboarding_status as enum (
  'ready',
  'pending_customer',
  'pending_review',
  'changes_requested',
  'approved',
  'invite_sent'
);

alter table public.clients
  add column onboarding_status public.client_onboarding_status not null default 'ready';

create table public.client_packets (
  client_id uuid primary key,
  tenant_id uuid,
  token text not null,
  token_hash text not null,
  consent_name text,
  consent_signed_at timestamptz,
  payment_proof bytea,
  payment_proof_name text,
  payment_proof_type text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_packets_token_check check (token ~ '^[A-Za-z0-9_-]{43}$'),
  constraint client_packets_token_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint client_packets_token_key unique (token),
  constraint client_packets_token_hash_key unique (token_hash),
  constraint client_packets_consent_check check (
    (consent_name is null and consent_signed_at is null)
    or (
      consent_name is not null
      and consent_signed_at is not null
      and char_length(btrim(consent_name)) between 1 and 120
    )
  ),
  constraint client_packets_proof_check check (
    (payment_proof is null and payment_proof_name is null and payment_proof_type is null)
    or (
      payment_proof is not null
      and payment_proof_name is not null
      and payment_proof_type is not null
      and char_length(payment_proof_name) between 1 and 200
      and payment_proof_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
      and octet_length(payment_proof) between 1 and 2097152
    )
  ),
  constraint client_packets_submitted_check check (
    submitted_at is null or (consent_name is not null and payment_proof is not null)
  )
);

-- Inherit the client's tenant. The previous cases stay as they are.
create or replace function private.assign_tenant() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := to_jsonb(new);
begin
  if new.tenant_id is null then
    new.tenant_id := case tg_table_name
      when 'roles' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'user_id')::uuid)
      when 'staff_profiles' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'user_id')::uuid)
      when 'clients' then (select p.tenant_id from public.profiles p where p.id = (rec ->> 'created_by')::uuid)
      when 'client_va_assignments' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'lead_events' then (select l.tenant_id from public.leads l where l.id = (rec ->> 'lead_id')::uuid)
      when 'client_notes' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      when 'client_packets' then (select c.tenant_id from public.clients c where c.id = (rec ->> 'client_id')::uuid)
      else private.default_tenant_id()
    end;
  end if;
  return new;
end;
$$;

create trigger client_packets_assign_tenant before insert on public.client_packets
  for each row execute function private.assign_tenant();

alter table public.client_packets alter column tenant_id set not null;

alter table public.client_packets add constraint client_packets_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete restrict;
alter table public.client_packets add constraint client_packets_client_tenant_fkey
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id) on delete restrict;

create index client_packets_tenant_id_idx on public.client_packets (tenant_id);

-- Creates the stable link and moves the client to pending_customer.
-- IVA06 no such client · IVA07 a link already exists · IVA09 the client is disabled.
create function public.issue_client_onboarding_link(client_id uuid, token text, token_hash text)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  client public.clients%rowtype;
begin
  select * into client from public.clients c where c.id = issue_client_onboarding_link.client_id for update;
  if not found then
    raise exception 'client not found' using errcode = 'IVA06';
  end if;
  if client.disabled_at is not null then
    raise exception 'client is disabled' using errcode = 'IVA09';
  end if;
  if client.onboarding_status <> 'ready' then
    raise exception 'onboarding link already exists' using errcode = 'IVA07';
  end if;
  if token !~ '^[A-Za-z0-9_-]{43}$' or token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad onboarding token' using errcode = 'check_violation';
  end if;

  insert into public.client_packets (client_id, token, token_hash)
  values (client.id, token, token_hash);

  update public.clients set onboarding_status = 'pending_customer' where id = client.id;
end;
$$;

-- Saves the company details, the signature and the payment file, then locks the packet.
-- IVA06 unknown link · IVA08 not waiting on the customer · IVA09 the client is disabled.
create function public.submit_client_packet(
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
  if client.onboarding_status <> 'pending_customer' then
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
    submitted_at = now(),
    updated_at = now()
  where client_id = packet.client_id;

  update public.clients set
    company_name = btrim(submit_client_packet.company_name),
    contact_name = btrim(submit_client_packet.contact_name),
    contact_phone = nullif(btrim(coalesce(submit_client_packet.contact_phone, '')), ''),
    business = details,
    onboarding_status = 'pending_review'
  where id = client.id;

  return client.id;
end;
$$;

revoke all on function public.issue_client_onboarding_link(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.submit_client_packet(text, text, text, text, jsonb, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.issue_client_onboarding_link(uuid, text, text) to service_role;
grant execute on function public.submit_client_packet(text, text, text, text, jsonb, text, text, text, text) to service_role;

grant select, insert, update, delete on public.client_packets to service_role;

alter table public.client_packets enable row level security;
create policy "Own tenant only" on public.client_packets as restrictive for all to authenticated
  using (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()))
  with check (tenant_id = (select private.tenant_id()) or (select private.is_super_admin()));
